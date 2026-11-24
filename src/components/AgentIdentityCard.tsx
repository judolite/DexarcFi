import { useState } from 'react'
import { useAccount, useConfig, useReadContract, useSwitchChain, useWriteContract, useDisconnect } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { parseEventLogs } from 'viem'
import { toast } from 'sonner'
import { BadgeCheck, ShieldQuestion, Copy, ExternalLink, Network, Coins, Fingerprint } from 'lucide-react'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { TOOLS, PREMIUM_PRICE } from '@/agent/tools'
import {
  AGENT_CARD_URL, MCP_URL, IDENTITY_REGISTRY, identityRegistryAbi,
  CONCORDIUM_BADGE, CONCORDIUM_DOCS, X402_DOCS,
} from '@/agent/config'

const ARC_TESTNET_ID = 5042002
const REG_KEY = 'dexarcfi.agent.registration.v1'

interface Registration { agentId: string; txHash: string; owner: string }

function loadRegistration(): Registration | null {
  try {
    const raw = localStorage.getItem(REG_KEY)
    return raw ? (JSON.parse(raw) as Registration) : null
  } catch {
    return null
  }
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }
const btn: React.CSSProperties = { background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }
const ghost: React.CSSProperties = { background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink)', borderRadius: 8, padding: '7px 11px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }

function Status({ ok, text }: { ok: boolean; text: string }) {
  const color = ok ? 'var(--success)' : '#f5a524'
  const Icon = ok ? BadgeCheck : ShieldQuestion
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color }}>
      <Icon size={14} /> {text}
    </span>
  )
}

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success('Copied'), () => toast.error('Could not copy'))
}

export default function AgentIdentityCard() {
  const { address, isConnected, chainId } = useAccount()
  const config = useConfig()
  const { switchChain } = useSwitchChain()
  const { disconnect } = useDisconnect()
  const { writeContract, isPending } = useWriteContract()
  const [reg, setReg] = useState<Registration | null>(loadRegistration)
  const [confirming, setConfirming] = useState(false)
  const [cardHash, setCardHash] = useState<string | null>(null)
  const [endpoint, setEndpoint] = useState<string | null>(null)

  const { data: onchainUri } = useReadContract({
    address: IDENTITY_REGISTRY, abi: identityRegistryAbi, functionName: 'tokenURI',
    args: reg ? [BigInt(reg.agentId)] : undefined, chainId: ARC_TESTNET_ID,
    query: { enabled: !!reg },
  })

  const register = () => {
    if (!isConnected) { toast.error('Connect your wallet first'); return }
    if (chainId !== ARC_TESTNET_ID) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    writeContract(
      { address: IDENTITY_REGISTRY, abi: identityRegistryAbi, functionName: 'register', args: [AGENT_CARD_URL], chainId: ARC_TESTNET_ID },
      {
        onSuccess: (hash) => {
          setConfirming(true)
          void waitForTransactionReceipt(config, { hash })
            .then((receipt) => {
              if (receipt.status !== 'success') throw new Error('Registration reverted')
              const [ev] = parseEventLogs({ abi: identityRegistryAbi, logs: receipt.logs, eventName: 'Registered' })
              if (!ev) throw new Error('Registered event not found')
              const next = { agentId: ev.args.agentId.toString(), txHash: hash, owner: ev.args.owner }
              localStorage.setItem(REG_KEY, JSON.stringify(next))
              setReg(next)
              toast.success(`Agent registered as #${next.agentId}`)
            })
            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Registration failed'))
            .finally(() => setConfirming(false))
        },
        onError: (e) => {
          // EIP-1193 4100: the wallet has not authorized this site for the selected account/method.
          if (/not been authorized|unauthorized|4100/i.test(e.message)) {
            toast.error('Your wallet has not approved this site for the selected account. Reconnect and approve the request in your wallet.')
            disconnect()
            return
          }
          toast.error(e.message.split('\n')[0])
        },
      },
    )
  }

  const computeHash = async () => {
    try {
      const res = await fetch('/.well-known/agent-card.json', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Card not found (${res.status})`)
      const digest = await crypto.subtle.digest('SHA-256', await res.arrayBuffer())
      setCardHash(Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join(''))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not read the card')
    }
  }

  const checkEndpoint = async () => {
    setEndpoint('Checking...')
    try {
      const res = await fetch('/api/mcp')
      const j = (await res.json()) as { payment?: { configured?: boolean } }
      setEndpoint(j.payment?.configured ? 'Online. Paid tool is configured.' : 'Online. Paid tool is not configured (no payout wallet set).')
    } catch {
      setEndpoint('Not reachable from here.')
    }
  }

  const uriMatches = onchainUri === AGENT_CARD_URL

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
      {/* ERC-8004 */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ ...label, display: 'flex', gap: 6, alignItems: 'center' }}><Fingerprint size={13} /> ERC-8004 Agent Card</span>
          <Status ok={!!reg} text={reg ? `Registered #${reg.agentId}` : 'Not registered'} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.6 }}>
          Registering mints an identity NFT in the Arc Testnet IdentityRegistry that points to the Agent Card below. The agent is owned by the wallet that registers it.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: 'var(--subtle)' }}>Card</span>
          <a className="mono" href={AGENT_CARD_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', wordBreak: 'break-all' }}>{AGENT_CARD_URL}</a>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginBottom: 12 }}>
          <span style={{ color: 'var(--subtle)' }}>Registry</span>
          <a className="mono" href={buildAddressExplorerUrl(ARC_TESTNET_ID, IDENTITY_REGISTRY)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
            {IDENTITY_REGISTRY.slice(0, 10)}…{IDENTITY_REGISTRY.slice(-6)} <ExternalLink size={11} />
          </a>
        </div>
        {reg ? (
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            <div>Owner <span className="mono">{reg.owner.slice(0, 8)}…{reg.owner.slice(-4)}</span></div>
            <div>
              Onchain URI check: {onchainUri === undefined ? 'reading…' : uriMatches ? <span style={{ color: 'var(--success)' }}>matches the card URL</span> : <span style={{ color: 'var(--danger)' }}>does not match</span>}
            </div>
            <a href={buildTxExplorerUrl(ARC_TESTNET_ID, reg.txHash)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>View registration <ExternalLink size={11} /></a>
          </div>
        ) : (
          <button type="button" style={{ ...btn, opacity: isPending || confirming ? 0.7 : 1 }} disabled={isPending || confirming} onClick={register}>
            {chainId !== ARC_TESTNET_ID && isConnected ? 'Switch to Arc Testnet' : isPending ? 'Confirm in wallet…' : confirming ? 'Confirming on Arc…' : 'Register agent on Arc Testnet'}
          </button>
        )}
        <p style={{ fontSize: 11, color: 'var(--subtle)', margin: '10px 0 0', lineHeight: 1.5 }}>
          The card must be live at the URL above before you register. The registration is saved in this browser; the NFT itself lives onchain.
        </p>
      </div>

      {/* Concordium */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ ...label, display: 'flex', gap: 6, alignItems: 'center' }}><BadgeCheck size={13} /> Verified by Concordium</span>
          <Status ok={!!CONCORDIUM_BADGE} text={CONCORDIUM_BADGE ? 'Registered' : 'Not verified'} />
        </div>
        {CONCORDIUM_BADGE ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.6 }}>Badge (CIS-8004 token address). Anyone can resolve it against Concordium to confirm the owner, status and card hash.</p>
            <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--ink)' }}>{CONCORDIUM_BADGE}</div>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.6 }}>
              This agent has not been registered with Concordium yet, so no badge is shown. Verification needs a Concordium account tied to a verified identity, then the card hash recorded in Concordium&apos;s CIS-8004 registry. You complete that with your own Concordium wallet.
            </p>
            <ol style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px', paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Create a Concordium account and complete identity verification.</li>
              <li>Copy the card hash below and register the agent with it in the Agent Registry.</li>
              <li>Set <span className="mono">VITE_CONCORDIUM_BADGE</span> to the token address you receive, then redeploy.</li>
            </ol>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={ghost} onClick={() => void computeHash()}>Compute card SHA-256</button>
          <a href={CONCORDIUM_DOCS} target="_blank" rel="noopener noreferrer" style={{ ...ghost, textDecoration: 'none' }}>Concordium guide <ExternalLink size={11} /></a>
        </div>
        {cardHash && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
            <span className="mono" style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--ink)' }}>{cardHash}</span>
            <button type="button" aria-label="Copy hash" style={ghost} onClick={() => copy(cardHash)}><Copy size={12} /></button>
          </div>
        )}
      </div>

      {/* MCP */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ ...label, display: 'flex', gap: 6, alignItems: 'center' }}><Network size={13} /> MCP endpoint</span>
          <button type="button" style={ghost} onClick={() => void checkEndpoint()}>Check endpoint</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', wordBreak: 'break-all' }}>{MCP_URL}</span>
          <button type="button" aria-label="Copy MCP URL" style={ghost} onClick={() => copy(MCP_URL)}><Copy size={12} /></button>
        </div>
        {endpoint && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{endpoint}</div>}
        <div style={{ display: 'grid', gap: 6 }}>
          {TOOLS.map((t) => (
            <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
              <span className="mono" style={{ color: 'var(--ink)' }}>{t.name}</span>
              <span style={{ color: t.paid ? '#f5a524' : 'var(--success)', fontWeight: 600 }}>{t.paid ? `Paid ${PREMIUM_PRICE}` : 'Free'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* x402 */}
      <div style={card}>
        <div style={{ ...label, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}><Coins size={13} /> Pay per request (x402)</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px', lineHeight: 1.6 }}>
          <span className="mono">premium_analysis</span> costs {PREMIUM_PRICE} USDC per call on Arc Testnet. Callers sign an offchain USDC authorisation through Circle Gateway Nanopayments, so they pay no gas, and Circle batches the settlement.
        </p>
        <p style={{ fontSize: 12, color: 'var(--subtle)', margin: '0 0 10px', lineHeight: 1.6 }}>
          An unpaid call returns HTTP 402 with the payment requirements. The payout wallet is set on the server, so the paid tool stays off until it is configured.
        </p>
        <a href={X402_DOCS} target="_blank" rel="noopener noreferrer" style={{ ...ghost, textDecoration: 'none', display: 'inline-flex', gap: 5, alignItems: 'center' }}>Buyer guide <ExternalLink size={11} /></a>
        {address && <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 10 }}>Free tools need no payment and no wallet.</div>}
      </div>
    </div>
  )
}
