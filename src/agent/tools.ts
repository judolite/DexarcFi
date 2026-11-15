/**
 * The agent's tools, shared by the Agent tab and the MCP server. Pure and
 * validated: callers can be other apps or AI agents, so every input is checked.
 */

import {
  assessTrade, stressPosition, suggestPositionSize, liquidationPrice, liquidationDistancePct,
  classifyLeverage, positionPnl, MAX_LEVERAGE,
  type PositionInput, type Side,
} from './riskMath.js'
import { planIdleFunds } from './yieldData.js'

export class ToolError extends Error {}

export interface ToolDef {
  name: string
  title: string
  description: string
  /** Premium tools are paid per request with x402. */
  paid: boolean
  inputSchema: Record<string, unknown>
}

export const PREMIUM_PRICE = '$0.01'

const sideSchema = { type: 'string', enum: ['long', 'short'] }

export const TOOLS: ToolDef[] = [
  {
    name: 'liquidation_risk',
    title: 'Liquidation risk',
    description: 'Estimated liquidation price and distance for a perp trade, a leverage risk level, warnings, and a safer leverage with stop and take-profit levels.',
    paid: false,
    inputSchema: {
      type: 'object',
      properties: {
        side: sideSchema,
        entryPrice: { type: 'number', description: 'Entry price in USD' },
        leverage: { type: 'number', minimum: 1, maximum: MAX_LEVERAGE },
        markPrice: { type: 'number', description: 'Current price, defaults to entryPrice' },
        marginUsd: { type: 'number' },
        balanceUsd: { type: 'number' },
      },
      required: ['side', 'entryPrice', 'leverage'],
    },
  },
  {
    name: 'position_sizing',
    title: 'Position sizing',
    description: 'Suggests a margin and notional size so that hitting the stop loses about riskPct of the balance.',
    paid: false,
    inputSchema: {
      type: 'object',
      properties: {
        balanceUsd: { type: 'number' },
        leverage: { type: 'number', minimum: 1, maximum: MAX_LEVERAGE },
        stopPct: { type: 'number', description: 'Stop distance in percent' },
        riskPct: { type: 'number', description: 'Percent of balance to risk, default 1' },
      },
      required: ['balanceUsd', 'leverage', 'stopPct'],
    },
  },
  {
    name: 'compare_yields',
    title: 'Compare yields',
    description: 'Compares the Earn, Vault and Staking yields shown in DexArcFi and suggests how to split idle USDC across risk tiers. Rates are testnet display values, not live market rates.',
    paid: false,
    inputSchema: {
      type: 'object',
      properties: { idleUsd: { type: 'number', description: 'Idle USDC in USD' } },
      required: ['idleUsd'],
    },
  },
  {
    name: 'premium_analysis',
    title: 'Premium portfolio stress test',
    description: `Paid per request (${PREMIUM_PRICE} USDC via x402). Stress-tests a set of perp positions against price shocks, finds the move that first liquidates you, and returns prioritised risk actions.`,
    paid: true,
    inputSchema: {
      type: 'object',
      properties: {
        balanceUsd: { type: 'number' },
        positions: {
          type: 'array',
          maxItems: 25,
          items: {
            type: 'object',
            properties: {
              market: { type: 'string' },
              side: sideSchema,
              entryPrice: { type: 'number' },
              markPrice: { type: 'number' },
              leverage: { type: 'number' },
              marginUsd: { type: 'number' },
            },
            required: ['market', 'side', 'entryPrice', 'markPrice', 'leverage', 'marginUsd'],
          },
        },
      },
      required: ['balanceUsd', 'positions'],
    },
  },
]

type Args = Record<string, unknown>

function num(args: Args, key: string, opts: { min?: number; max?: number; optional?: boolean } = {}): number {
  const v = args[key]
  if (v === undefined || v === null) {
    if (opts.optional) return Number.NaN
    throw new ToolError(`${key} is required`)
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new ToolError(`${key} must be a finite number`)
  if (opts.min !== undefined && v < opts.min) throw new ToolError(`${key} must be at least ${opts.min}`)
  if (opts.max !== undefined && v > opts.max) throw new ToolError(`${key} must be at most ${opts.max}`)
  return v
}

function side(args: Args, key = 'side'): Side {
  const v = args[key]
  if (v !== 'long' && v !== 'short') throw new ToolError(`${key} must be "long" or "short"`)
  return v
}

const BIG = 1e12
const opt = (n: number): number | undefined => (Number.isNaN(n) ? undefined : n)

function liquidationRisk(args: Args) {
  const s = side(args)
  const entry = num(args, 'entryPrice', { min: 1e-9, max: BIG })
  const leverage = num(args, 'leverage', { min: 1, max: MAX_LEVERAGE })
  const mark = opt(num(args, 'markPrice', { min: 1e-9, max: BIG, optional: true }))
  const marginUsd = opt(num(args, 'marginUsd', { min: 0, max: BIG, optional: true }))
  const balanceUsd = opt(num(args, 'balanceUsd', { min: 0, max: BIG, optional: true }))
  return {
    ...assessTrade({ side: s, entryPrice: entry, leverage, markPrice: mark, marginUsd, balanceUsd }),
    assumptions: 'Isolated margin, 1% maintenance margin, fees and funding ignored. An estimate, not financial advice.',
  }
}

function positionSizing(args: Args) {
  const balanceUsd = num(args, 'balanceUsd', { min: 1e-9, max: BIG })
  const leverage = num(args, 'leverage', { min: 1, max: MAX_LEVERAGE })
  const stopPct = num(args, 'stopPct', { min: 0.05, max: 50 })
  const riskPct = opt(num(args, 'riskPct', { min: 0.01, max: 10, optional: true }))
  return suggestPositionSize({ balanceUsd, leverage, stopPct, riskPct })
}

function compareYields(args: Args) {
  const idleUsd = num(args, 'idleUsd', { min: 0, max: BIG })
  return {
    ...planIdleFunds(idleUsd),
    disclaimer: 'Rates are testnet display values from DexArcFi, not live market rates. Suggestions only, not financial advice.',
  }
}

const SHOCKS = [-20, -10, -5, 5, 10, 20]

function premiumAnalysis(args: Args) {
  const balanceUsd = num(args, 'balanceUsd', { min: 0, max: BIG })
  const raw = args.positions
  if (!Array.isArray(raw)) throw new ToolError('positions must be an array')
  if (raw.length > 25) throw new ToolError('at most 25 positions per request')

  const positions: PositionInput[] = raw.map((r, i) => {
    if (typeof r !== 'object' || r === null) throw new ToolError(`positions[${i}] must be an object`)
    const p = r as Args
    const market = p.market
    if (typeof market !== 'string' || market.length === 0 || market.length > 32) throw new ToolError(`positions[${i}].market must be a short string`)
    return {
      market,
      side: side(p),
      entryPrice: num(p, 'entryPrice', { min: 1e-9, max: BIG }),
      markPrice: num(p, 'markPrice', { min: 1e-9, max: BIG }),
      leverage: num(p, 'leverage', { min: 1, max: MAX_LEVERAGE }),
      marginUsd: num(p, 'marginUsd', { min: 0, max: BIG }),
    }
  })

  const rows = positions.map((p) => {
    const liq = liquidationPrice(p.side, p.entryPrice, p.leverage)
    const distancePct = liquidationDistancePct(p.side, p.markPrice, liq)
    const notional = p.marginUsd * p.leverage
    return {
      market: p.market, side: p.side, leverage: p.leverage, level: classifyLeverage(p.leverage),
      liquidationPrice: liq, distancePct, marginUsd: p.marginUsd,
      unrealizedPnlUsd: positionPnl(p.side, p.entryPrice, p.markPrice, notional),
      stress: stressPosition(p, SHOCKS),
    }
  })

  const totalMargin = rows.reduce((s, r) => s + r.marginUsd, 0)
  const unrealized = rows.reduce((s, r) => s + r.unrealizedPnlUsd, 0)
  const portfolioStress = SHOCKS.map((shockPct, i) => {
    const pnlUsd = rows.reduce((s, r) => s + r.stress[i].pnlUsd, 0)
    return { shockPct, pnlUsd, liquidatedPositions: rows.filter((r) => r.stress[i].liquidated).length }
  })
  const closest = rows.length ? Math.min(...rows.map((r) => r.distancePct)) : null
  const utilisationPct = balanceUsd > 0 ? (totalMargin / (balanceUsd + totalMargin)) * 100 : totalMargin > 0 ? 100 : 0

  const actions: string[] = []
  for (const r of [...rows].sort((a, b) => a.distancePct - b.distancePct)) {
    if (r.distancePct <= 0) actions.push(`${r.market} ${r.side} is past its estimated liquidation price: close or add margin now.`)
    else if (r.level === 'dangerous') actions.push(`${r.market} ${r.side} runs ${r.leverage}x with ${r.distancePct.toFixed(2)}% to liquidation: cut leverage to 10x or below.`)
    else if (r.level === 'high') actions.push(`${r.market} ${r.side} runs ${r.leverage}x: consider 10x or below.`)
  }
  if (utilisationPct > 60) actions.push(`${utilisationPct.toFixed(0)}% of your capital is locked as margin: keep more free balance as a buffer.`)
  if (!actions.length) actions.push('No urgent risks found at these levels.')

  return {
    summary: { positions: rows.length, totalMarginUsd: totalMargin, unrealizedPnlUsd: unrealized, marginUtilisationPct: utilisationPct, closestLiquidationPct: closest },
    positions: rows,
    portfolioStress,
    actions,
    assumptions: 'Every market moves by the same percent at once (worst-case correlation). Isolated margin, 1% maintenance, no fees or funding. Not financial advice.',
  }
}

export function runTool(name: string, args: unknown): unknown {
  const a: Args = typeof args === 'object' && args !== null && !Array.isArray(args) ? (args as Args) : {}
  switch (name) {
    case 'liquidation_risk': return liquidationRisk(a)
    case 'position_sizing': return positionSizing(a)
    case 'compare_yields': return compareYields(a)
    case 'premium_analysis': return premiumAnalysis(a)
    default: throw new ToolError(`unknown tool: ${name}`)
  }
}
