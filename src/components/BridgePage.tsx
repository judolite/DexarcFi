import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import { createSolanaKitAdapterFromProvider } from '@circle-fin/adapter-solana-kit'
import type { EIP1193Provider } from 'viem'
import { toast } from 'sonner'
import { ArrowRight, ExternalLink, RefreshCw, Info, ShieldAlert, Wallet } from 'lucide-react'
import { parseAmountSafe, validateRecipient } from '@/security'
import {
  CIRCLE_FAUCET_URL, MAX_BRIDGE_USDC, SOLANA_QUICKSTART_URL, SUI_QUICKSTART_URL,
  getInjectedSolana, shortError, switchWalletChain, withAddress,
} from '@/bridgeHelpers'

const appKit = new AppKit()

const MONAD_TESTNET_ID = 10143
const amber = '#f59e0b'

type Source = 'solana' | 'monad' | 'sui'

const SOURCES: { id: Source; name: string; chain: string; badge: string; speed: string; note: string }[] = [
  { id: 'solana', name: 'Solana', chain: 'Solana Devnet', badge: 'CCTP V2', speed: 'Fast transfer', note: 'Phantom wallet. Fastest route into Arc.' },
  { id: 'monad', name: 'Monad', chain: 'Monad Testnet', badge: 'CCTP V2', speed: 'Standard transfer', note: 'Any EVM wallet. Standard speed only.' },
  { id: 'sui', name: 'Sui', chain: 'Sui Testnet', badge: 'CCTP V1', speed: 'Standard transfer', note: 'Guided setup. No in-app wallet support yet.' },
]

interface Quote { fees: { type: string; amount: string | null; token: string }[]; gas: { token: string; blockchain: string; fee: string | null }[]; amount: string; recipient: string; source: Source }
interface BridgeStep { name: string; state: string; txHash?: string; explorerUrl?: string }
interface Outcome { state: string; steps: BridgeStep[] }

const STEP_LABEL: Record<string, string> = {
  'bridge.approve': 'Approve', 'bridge.burn': 'Burn on source', 'bridge.fetchAttestation': 'Circle attestation', 'bridge.mint': 'Mint on Arc',
}

export default function BridgePage() {
  const { address, isConnected, connector } = useAccount()
  const [source, setSource] = useState<Source>('solana')
  const [amount, setAmount] = useState('')
  const [recipientInput, setRecipientInput] = useState('')
  const [solAddress, setSolAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'connect' | 'quote' | 'bridge'>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [live, setLive] = useState<string[]>([])

  const recipient = recipientInput.trim() || address || ''

  // Live step progress from the kit while a bridge is running.
  useEffect(() => {
    const handler = (payload: unknown) => {
      const method = (payload as { method?: string })?.method
      if (method && STEP_LABEL[method]) setLive(prev => (prev.includes(STEP_LABEL[method]) ? prev : [...prev, STEP_LABEL[method]]))
    }
    appKit.on('*', handler)
    return () => { appKit.off('*', handler) }
  }, [])

  const reset = () => { setQuote(null); setOutcome(null); setLive([]) }

  const connectPhantom = async () => {
    const wallet = getInjectedSolana()
    if (!wallet) { toast.error('No Solana wallet found. Install Phantom, then reload.'); return }
    setBusy('connect')
    try {
      const res = await wallet.connect()
      setSolAddress(res.publicKey.toString())
    } catch (err) {
      toast.error(shortError(err, 'Wallet connection cancelled'))
    } finally {
      setBusy(null)
    }
  }

  /** Validate inputs shared by the quote and the bridge. Throws a readable error. */
  const validate = (): `0x${string}` => {
    const raw = parseAmountSafe(amount, 6)
    if (raw > BigInt(MAX_BRIDGE_USDC) * 10n ** 6n) throw new Error(`Max ${MAX_BRIDGE_USDC.toLocaleString()} USDC per transfer on testnet`)
    const safe = validateRecipient(recipient)
    if (source === 'solana' && !solAddress) throw new Error('Connect your Solana wallet first')
    if (source === 'monad' && !isConnected) throw new Error('Connect your EVM wallet first')
    return safe
  }

  /** Build the source adapter + route params for the selected chain. */
  const buildRoute = async (to: `0x${string}`) => {
    const dest = { chain: 'Arc_Testnet' as const, recipientAddress: to, useForwarder: true as const }
    if (source === 'solana') {
      const wallet = getInjectedSolana()
      if (!wallet) throw new Error('Solana wallet not found')
      const adapter = createSolanaKitAdapterFromProvider({ provider: withAddress(wallet) })
      return { from: { adapter, chain: 'Solana_Devnet' as const }, to: dest, config: { transferSpeed: 'FAST' as const } }
    }
    if (!connector) throw new Error('Wallet not connected')
    const provider = (await connector.getProvider()) as EIP1193Provider
    await switchWalletChain(provider, MONAD_TESTNET_ID)
    const adapter = await createViemAdapterFromProvider({ provider })
    return { from: { adapter, chain: 'Monad_Testnet' as const }, to: dest, config: { transferSpeed: 'SLOW' as const } }
  }

  const getQuote = async () => {
    reset()
    setBusy('quote')
    try {
      const to = validate()
      const route = await buildRoute(to)
      const est = await appKit.estimateBridge({ ...route, amount })
      setQuote({
        fees: est.fees.map(f => ({ type: f.type, amount: f.amount, token: String(f.token) })),
        gas: est.gasFees.map(g => ({ token: g.token, blockchain: String(g.blockchain), fee: g.fees?.fee ?? null })),
        amount, recipient: to, source,
      })
    } catch (err) {
      toast.error(shortError(err, 'Could not get a quote'))
    } finally {
      setBusy(null)
    }
  }

  const bridge = async () => {
    if (!quote) return
    setBusy('bridge'); setLive([]); setOutcome(null)
    try {
      // Re-validate and require the same inputs that were quoted.
      const to = validate()
      if (to !== quote.recipient || amount !== quote.amount || source !== quote.source) throw new Error('Inputs changed since the quote. Get a new quote.')
      const route = await buildRoute(to)
      const result = await appKit.bridge({ ...route, amount })
      setOutcome({ state: result.state, steps: result.steps.map(s => ({ name: s.name, state: s.state, txHash: s.txHash, explorerUrl: s.explorerUrl })) })
      if (result.state === 'success') toast.success(`Bridged ${amount} USDC to Arc Testnet`)
      else toast.error('Bridge did not complete. See the steps below.')
    } catch (err) {
      toast.error(shortError(err, 'Bridge failed'))
    } finally {
      setBusy(null)
    }
  }

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 } as const
  const label = { fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 } as const
  const field = { background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' } as const
  const meta = SOURCES.find(s => s.id === source)!
  const canQuote = !!amount && busy === null && (source === 'solana' ? !!solAddress : isConnected)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>Bridge to Arc</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Bring USDC from Solana, Monad or Sui onto Arc with Circle CCTP. Circle submits the final step on Arc for you, so you do not need Arc gas first.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 9, marginBottom: 18 }}>
          <ShieldAlert size={13} color="#fbbf24" />
          <span style={{ fontSize: 12, color: '#fbbf24' }}>Testnet only. Use test USDC from the <a href={CIRCLE_FAUCET_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Circle faucet</a>. Never bridge real funds here.</span>
        </div>

        {/* Source selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {SOURCES.map(s => (
            <button key={s.id} onClick={() => { setSource(s.id); reset() }}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                background: source === s.id ? `${amber}18` : 'var(--surface)', border: `1px solid ${source === s.id ? amber + '88' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: source === s.id ? amber : 'var(--ink)' }}>{s.name}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-strong)', color: 'var(--muted)' }}>{s.badge}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{s.speed}</div>
            </button>
          ))}
        </div>

        {source === 'sui' ? (
          <div style={{ ...card, padding: 24 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--ink)' }}>Sui to Arc</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
              Sui uses the older CCTP V1 protocol, standard transfers only, and the Forwarding Service is not available. Circle's kits do not cover Sui, so the transfer needs a Sui wallet and Circle's Move packages instead of this form.
            </p>
            <ol style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.9, margin: '0 0 16px', paddingLeft: 20 }}>
              <li>Get Sui Testnet SUI and test USDC.</li>
              <li>Burn USDC on Sui with the CCTP package.</li>
              <li>Fetch Circle's attestation for the burn.</li>
              <li>Mint on Arc Testnet by calling the message transmitter with the attestation (you pay Arc gas in USDC).</li>
            </ol>
            <a href={SUI_QUICKSTART_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: amber, color: '#0b1320', padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
              Open Circle's Sui to Arc guide <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <div style={{ ...card, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              {meta.chain} <ArrowRight size={14} color="var(--muted)" /> Arc Testnet
              {source === 'solana' && <a href={SOLANA_QUICKSTART_URL} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>Circle guide</a>}
            </div>

            {/* Source wallet */}
            <div style={{ marginBottom: 14 }}>
              <div style={label}>Source wallet</div>
              {source === 'solana' ? (
                solAddress ? (
                  <div className="mono" style={{ ...field, fontSize: 12, color: 'var(--ink-2)' }}>{solAddress.slice(0, 8)}…{solAddress.slice(-6)}</div>
                ) : (
                  <button onClick={() => { void connectPhantom() }} disabled={busy !== null}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: amber, border: 'none', color: '#0b1320', padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                    <Wallet size={14} /> {busy === 'connect' ? 'Connecting…' : 'Connect Phantom'}
                  </button>
                )
              ) : isConnected ? (
                <div className="mono" style={{ ...field, fontSize: 12, color: 'var(--ink-2)' }}>{address?.slice(0, 8)}…{address?.slice(-6)} (will switch to Monad Testnet)</div>
              ) : (
                <ConnectKitButton.Custom>
                  {({ show }) => <button onClick={show} style={{ background: amber, border: 'none', color: '#0b1320', padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Connect Wallet</button>}
                </ConnectKitButton.Custom>
              )}
            </div>

            {/* Amount */}
            <div style={{ marginBottom: 14 }}>
              <div style={label}>Amount</div>
              <div style={{ ...field, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="text" inputMode="decimal" value={amount} placeholder="0.00"
                  onChange={e => { setAmount(e.target.value); reset() }}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }} />
                <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>USDC</span>
              </div>
            </div>

            {/* Recipient on Arc */}
            <div style={{ marginBottom: 18 }}>
              <div style={label}>Recipient on Arc Testnet</div>
              <div style={field}>
                <input type="text" value={recipientInput} placeholder={address ?? '0x… (connect an EVM wallet or paste an address)'}
                  onChange={e => { setRecipientInput(e.target.value); reset() }}
                  style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 5 }}>Double-check this address. Bridged USDC cannot be recovered if it goes to the wrong one.</div>
            </div>

            {/* Quote */}
            {quote && (
              <div style={{ background: 'var(--surface-strong)', borderRadius: 9, padding: '12px 14px', marginBottom: 16, fontSize: 12 }}>
                <Row k="Route" v={`${meta.chain} to Arc Testnet`} />
                <Row k="Send" v={`${quote.amount} USDC`} />
                <Row k="Recipient" v={`${quote.recipient.slice(0, 10)}…${quote.recipient.slice(-6)}`} />
                {quote.fees.map((f, i) => <Row key={i} k={`${f.type} fee`} v={f.amount == null ? 'unavailable' : `${f.amount} ${f.token}`} />)}
                {quote.gas.map((g, i) => <Row key={'g' + i} k={`Gas (${g.blockchain})`} v={g.fee == null ? 'unavailable' : `${g.fee} ${g.token}`} />)}
                <Row k="Speed" v={source === 'solana' ? 'Fast (about 8 to 20 seconds)' : 'Standard (several minutes)'} />
                <div style={{ marginTop: 8, color: 'var(--subtle)' }}>Final step on Arc is submitted by Circle's Forwarding Service, which adds a small fee.</div>
              </div>
            )}

            {!quote ? (
              <button onClick={() => { void getQuote() }} disabled={!canQuote}
                style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: canQuote ? amber : 'var(--surface-strong)', color: canQuote ? '#0b1320' : 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: canQuote ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
                {busy === 'quote' ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Getting quote…</> : 'Get quote'}
              </button>
            ) : (
              <button onClick={() => { void bridge() }} disabled={busy !== null}
                style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: busy ? 'var(--surface-strong)' : amber, color: busy ? 'var(--muted)' : '#0b1320', fontSize: 14, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
                {busy === 'bridge' ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Bridging… confirm in your wallet</> : `Bridge ${quote.amount} USDC to Arc`}
              </button>
            )}

            {busy === 'bridge' && live.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>Progress: {live.join(' → ')}</div>
            )}

            {outcome && (
              <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 9, background: outcome.state === 'success' ? 'var(--success-dim)' : 'var(--danger-dim)', border: `1px solid ${outcome.state === 'success' ? 'var(--success)' : 'var(--danger)'}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: outcome.state === 'success' ? 'var(--success)' : 'var(--danger)', marginBottom: 6 }}>
                  {outcome.state === 'success' ? 'Bridge complete' : 'Bridge did not complete'}
                </div>
                {outcome.steps.map((s, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-2)', padding: '2px 0' }}>
                    <span>{s.name} ({s.state})</span>
                    {s.explorerUrl && <a href={s.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', display: 'inline-flex', gap: 3, alignItems: 'center' }}>View <ExternalLink size={10} /></a>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={13} color="var(--subtle)" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--subtle)', lineHeight: 1.6 }}>
            You need a little gas on the source chain ({source === 'solana' ? 'devnet SOL' : source === 'monad' ? 'MON' : 'SUI'}). Arc gas is paid in USDC, and the Forwarding Service covers the mint, so a brand new Arc wallet works.
          </span>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ color: 'var(--subtle)', textTransform: 'capitalize' }}>{k}</span>
      <span className="mono" style={{ color: 'var(--ink)' }}>{v}</span>
    </div>
  )
}
