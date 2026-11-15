/**
 * DexArcFi Risk Agent: MCP server (Streamable HTTP, JSON-RPC 2.0, stateless).
 *
 * Free tools run for anyone. `premium_analysis` is paid per request with x402
 * through Circle Gateway Nanopayments on Arc Testnet: buyers sign an offchain
 * USDC authorisation and pay no gas, and Circle batches the settlement.
 *
 * Configuration (server environment only, never VITE_ prefixed):
 *   X402_SELLER_ADDRESS    wallet that receives the payments (required for the paid tool)
 *   X402_FACILITATOR_URL   optional, defaults to the Circle Gateway testnet facilitator
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server'
import { TOOLS, runTool, ToolError, PREMIUM_PRICE } from '../src/agent/tools.js'

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'dexarcfi-risk-agent', title: 'DexArcFi Risk Agent', version: '1.0.0' }
const ARC_TESTNET_CAIP2 = 'eip155:5042002'
const DEFAULT_FACILITATOR = 'https://gateway-api-testnet.circle.com'
const MAX_BODY_BYTES = 64 * 1024
const RATE_LIMIT = 60 // requests per minute per client, best effort per instance

type Gate = ReturnType<typeof createGatewayMiddleware>
let gate: Gate | null | undefined

function getGate(): Gate | null {
  if (gate !== undefined) return gate
  const seller = process.env.X402_SELLER_ADDRESS ?? ''
  if (!/^0x[0-9a-fA-F]{40}$/.test(seller) || /^0x0{40}$/.test(seller)) {
    gate = null
    return gate
  }
  gate = createGatewayMiddleware({
    sellerAddress: seller,
    networks: ARC_TESTNET_CAIP2,
    facilitatorUrl: process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR,
    description: 'DexArcFi premium portfolio stress test',
  })
  return gate
}

const hits = new Map<string, { count: number; reset: number }>()
function limited(key: string): boolean {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || h.reset < now) {
    hits.set(key, { count: 1, reset: now + 60_000 })
    if (hits.size > 5000) hits.clear()
    return false
  }
  h.count += 1
  return h.count > RATE_LIMIT
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Payment-Signature, X-Payment, Authorization')
  res.setHeader('Access-Control-Expose-Headers', 'Payment-Required, Payment-Response, X-Payment-Response')
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (res.writableEnded) return
  res.statusCode = status
  if (body === undefined) {
    res.end()
    return
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

type Rpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result })

async function readJson(req: IncomingMessage): Promise<unknown> {
  const pre = (req as IncomingMessage & { body?: unknown }).body
  if (pre !== undefined && pre !== null && typeof pre !== 'string') return pre
  let raw = typeof pre === 'string' ? pre : ''
  if (typeof pre !== 'string') {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      const buf = chunk as Buffer
      size += buf.length
      if (size > MAX_BODY_BYTES) throw new ToolError('request body too large')
      chunks.push(buf)
    }
    raw = Buffer.concat(chunks).toString('utf8')
  }
  if (raw.length > MAX_BODY_BYTES) throw new ToolError('request body too large')
  return JSON.parse(raw)
}

function toolResult(out: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], structuredContent: out, isError: false }
}
const toolFailure = (message: string) => ({ content: [{ type: 'text', text: message }], isError: true })

/** Runs the x402 check. Resolves true only when payment verified; otherwise the middleware already replied. */
function requirePayment(g: Gate, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  return new Promise((resolve) => {
    res.once('close', () => resolve(false))
    const mw = g.require(PREMIUM_PRICE) as unknown as (r: IncomingMessage, s: ServerResponse, next: () => void) => void | Promise<void>
    Promise.resolve(mw(req, res, () => resolve(true))).catch(() => {
      send(res, 502, rpcError(null, -32000, 'Payment verification failed'))
      resolve(false)
    })
  })
}

async function handleRpc(msg: Rpc, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const id = msg.id
  const method = msg.method
  if (typeof method !== 'string') return send(res, 400, rpcError(id, -32600, 'Invalid request'))
  if (id === undefined) return send(res, 202) // notification

  switch (method) {
    case 'initialize':
      return send(res, 200, rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'Risk tools for DeFi perps and yield on Arc. Outputs are estimates and suggestions, not financial advice. premium_analysis is paid per request with x402.',
      }))
    case 'ping':
      return send(res, 200, rpcResult(id, {}))
    case 'tools/list':
      return send(res, 200, rpcResult(id, {
        tools: TOOLS.map((t) => ({
          name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema,
          annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
        })),
      }))
    case 'tools/call': {
      const params = (typeof msg.params === 'object' && msg.params !== null ? msg.params : {}) as { name?: unknown; arguments?: unknown }
      const tool = TOOLS.find((t) => t.name === params.name)
      if (!tool) return send(res, 200, rpcError(id, -32602, `Unknown tool: ${String(params.name).slice(0, 64)}`))

      if (tool.paid) {
        const g = getGate()
        if (!g) return send(res, 200, rpcResult(id, toolFailure('Premium analysis is not configured on this server (no payout wallet set).')))
        const paid = await requirePayment(g, req, res)
        if (!paid) return
      }
      try {
        return send(res, 200, rpcResult(id, toolResult(runTool(tool.name, params.arguments))))
      } catch (err) {
        if (err instanceof ToolError) return send(res, 200, rpcResult(id, toolFailure(err.message)))
        return send(res, 200, rpcResult(id, toolFailure('Tool failed')))
      }
    }
    default:
      return send(res, 200, rpcError(id, -32601, `Method not found: ${method.slice(0, 64)}`))
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res)
  if (req.method === 'OPTIONS') return send(res, 204)

  if (req.method === 'GET') {
    return send(res, 200, {
      ...SERVER_INFO,
      protocolVersion: PROTOCOL_VERSION,
      transport: 'streamable-http (POST JSON-RPC)',
      tools: TOOLS.map((t) => ({ name: t.name, paid: t.paid })),
      payment: { protocol: 'x402', network: ARC_TESTNET_CAIP2, price: PREMIUM_PRICE, paidTools: TOOLS.filter((t) => t.paid).map((t) => t.name), configured: getGate() !== null },
    })
  }
  if (req.method !== 'POST') return send(res, 405, rpcError(null, -32600, 'Use POST'))

  const fwd = req.headers['x-forwarded-for']
  const client = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown'
  if (limited(client)) {
    res.setHeader('Retry-After', '60')
    return send(res, 429, rpcError(null, -32000, 'Rate limit exceeded'))
  }

  let body: unknown
  try {
    body = await readJson(req)
  } catch (err) {
    return send(res, err instanceof ToolError ? 413 : 400, rpcError(null, -32700, err instanceof ToolError ? err.message : 'Parse error'))
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return send(res, 400, rpcError(null, -32600, 'Send a single JSON-RPC request object'))
  return handleRpc(body as Rpc, req, res)
}
