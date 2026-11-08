import { useEffect, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AppKit } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import { createSolanaKitAdapterFromProvider } from '@circle-fin/adapter-solana-kit'
import { isAddress as isSolanaAddress } from '@solana/kit'
import { erc20Abi, type EIP1193Provider } from 'viem'
import { toast } from 'sonner'
import { ArrowRight, ExternalLink, RefreshCw, Wallet } from 'lucide-react'
import { getUsdc } from '@/onchain-facts'
import { parseAmountSafe, validateRecipient } from '@/security'
import { HyperEVMTestnet } from '@circle-fin/app-kit/chains'
import { MAX_BRIDGE_USDC, SOLANA_QUICKSTART_URL, getInjectedSolana, shortError, switchWalletChain, withAddress, type AddChainParams } from '@/bridgeHelpers'
import {
  AMBER, ARC_TESTNET_ID, CHAINS, HYPEREVM_TESTNET_ID, MONAD_TESTNET_ID, STEP_LABEL, routeKey,
  type Chain, type Direction, type Outcome, type Quote,
} from '@/bridgeConfig'

const appKit = new AppKit()

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 } as const
const label = { fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 } as const
const field = { background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' } as const
const cta = (enabled: boolean) => ({
  width: '100%', padding: 13, borderRadius: 10, border: 'none', background: enabled ? AMBER : 'var(--surface-strong)',
  color: enabled ? '#0b1320' : 'var(--muted)', fontSize: 14, fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed',
  fontFamily: 'DM Sans, sans-serif', display: 'flex', justifyContent: 'center', gap: 6, alignItems: 'center',
}) as const
const connectBtn = { display: 'flex', alignItems: 'center', gap: 6, background: AMBER, border: 'none', color: '#0b1320', padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' } as const

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <span style={{ color: 'var(--subtle)', textTransform: 'capitalize' }}>{k}</span>
      <span className="mono" style={{ color: 'var(--ink)' }}>{v}</span>
    </div>
  )
}

// HyperEVM is not in the app's chain registry, so its add-to-wallet details come from Circle's kit definition.
const HYPEREVM_ADD_CHAIN: AddChainParams = {
  name: HyperEVMTestnet.name,
  nativeCurrency: { ...HyperEVMTestnet.nativeCurrency },
  rpcUrls: [...HyperEVMTestnet.rpcEndpoints],
  explorerBase: HyperEVMTestnet.explorerUrl.replace('/tx/{hash}', ''),
}

export default function BridgeForm({ dir, chain }: { dir: Direction; chain: Chain }) {
  const { address, isConnected, connector } = useAccount()
  const [amount, setAmount] = useState('')
  const [recipientInput, setRecipientInput] = useState('')
  const [solAddress, setSolAddress] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'connect' | 'quote' | 'bridge'>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [live, setLive] = useState<string[]>([])

  const meta = CHAINS.find(c => c.id === chain)!
  const key = routeKey(dir, chain)
  const from = dir === 'in' ? meta.label : 'Arc Testnet'
  const to = dir === 'in' ? 'Arc Testnet' : meta.label
  const destIsSolana = dir === 'out' && chain === 'solana'
  const defaultRecipient = destIsSolana ? (solAddress ?? '') : (address ?? '')
  const recipient = recipientInput.trim() || defaultRecipient

  // Arc balance, used to stop an over-balance transfer before the wallet prompt (out of Arc only).
  const usdc = getUsdc(ARC_TESTNET_ID)
  const { data: arcBalance } = useReadContract({
    address: usdc?.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined, chainId: ARC_TESTNET_ID,
    query: { enabled: dir === 'out' && !!address && !!usdc },
  })

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
    try { setSolAddress((await wallet.connect()).publicKey.toString()) }
    catch (err) { toast.error(shortError(err, 'Wallet connection cancelled')) }
    finally { setBusy(null) }
  }

  /** Checks shared by the quote and the bridge. Returns the validated recipient. */
  const validate = (): string => {
    const raw = parseAmountSafe(amount, 6)
    if (raw > BigInt(MAX_BRIDGE_USDC) * 10n ** 6n) throw new Error(`Max ${MAX_BRIDGE_USDC.toLocaleString()} USDC per transfer on testnet`)
    if (dir === 'in' && chain === 'solana' && !solAddress) throw new Error('Connect your Solana wallet first')
    if (!(dir === 'in' && chain === 'solana') && !isConnected) throw new Error('Connect your EVM wallet first')
    if (dir === 'out' && arcBalance != null && raw > arcBalance) throw new Error('Not enough USDC on Arc Testnet for this amount')
    if (destIsSolana) {
      if (!isSolanaAddress(recipient)) throw new Error('Enter a valid Solana address for the recipient')
      return recipient
    }
    return validateRecipient(recipient)
  }

  const buildRoute = async (rcpt: string) => {
    if (dir === 'in') {
      const dest = { chain: 'Arc_Testnet' as const, recipientAddress: rcpt, useForwarder: true as const }
      if (chain === 'solana') {
        const wallet = getInjectedSolana()
        if (!wallet) throw new Error('Solana wallet not found')
        const adapter = createSolanaKitAdapterFromProvider({ provider: withAddress(wallet) })
        return { from: { adapter, chain: 'Solana_Devnet' as const }, to: dest, config: { transferSpeed: 'FAST' as const } }
      }
      if (!connector) throw new Error('Wallet not connected')
      const provider = (await connector.getProvider()) as EIP1193Provider
      const config = { transferSpeed: 'SLOW' as const }
      if (chain === 'hyperliquid') {
        await switchWalletChain(provider, HYPEREVM_TESTNET_ID, HYPEREVM_ADD_CHAIN)
        const adapter = await createViemAdapterFromProvider({ provider })
        return { from: { adapter, chain: 'HyperEVM_Testnet' as const }, to: dest, config }
      }
      await switchWalletChain(provider, MONAD_TESTNET_ID)
      const adapter = await createViemAdapterFromProvider({ provider })
      return { from: { adapter, chain: 'Monad_Testnet' as const }, to: dest, config }
    }
    // Out of Arc: sign on Arc with the EVM wallet, Circle's forwarder delivers on the destination.
    if (!connector) throw new Error('Wallet not connected')
    const provider = (await connector.getProvider()) as EIP1193Provider
    await switchWalletChain(provider, ARC_TESTNET_ID)
    const adapter = await createViemAdapterFromProvider({ provider })
    const src = { adapter, chain: 'Arc_Testnet' as const }
    const config = { transferSpeed: 'SLOW' as const }
    if (chain === 'solana') return { from: src, to: { chain: 'Solana_Devnet' as const, recipientAddress: rcpt, useForwarder: true as const }, config }
    if (chain === 'hyperliquid') return { from: src, to: { chain: 'HyperEVM_Testnet' as const, recipientAddress: rcpt, useForwarder: true as const }, config }
    return { from: src, to: { chain: 'Monad_Testnet' as const, recipientAddress: rcpt, useForwarder: true as const }, config }
  }

  const getQuote = async () => {
    reset(); setBusy('quote')
    try {
      const rcpt = validate()
      const route = await buildRoute(rcpt)
      const est = await appKit.estimateBridge({ ...route, amount })
      setQuote({
        fees: est.fees.map(f => ({ type: f.type, amount: f.amount, token: String(f.token) })),
        gas: est.gasFees.map(g => ({ token: g.token, blockchain: String(g.blockchain), fee: g.fees?.fee ?? null })),
        amount, recipient: rcpt, key,
      })
    } catch (err) { toast.error(shortError(err, 'Could not get a quote')) }
    finally { setBusy(null) }
  }

  const bridge = async () => {
    if (!quote) return
    setBusy('bridge'); setLive([]); setOutcome(null)
    try {
      const rcpt = validate()
      if (rcpt !== quote.recipient || amount !== quote.amount || key !== quote.key) throw new Error('Inputs changed since the quote. Get a new quote.')
      const route = await buildRoute(rcpt)
      const result = await appKit.bridge({ ...route, amount })
      setOutcome({ state: result.state, steps: result.steps.map(s => ({ name: s.name, state: s.state, txHash: s.txHash, explorerUrl: s.explorerUrl })) })
      if (result.state === 'success') toast.success(`Bridged ${amount} USDC to ${to}`)
      else toast.error('Bridge did not complete. See the steps below.')
    } catch (err) { toast.error(shortError(err, 'Bridge failed')) }
    finally { setBusy(null) }
  }

  const needsPhantomSource = dir === 'in' && chain === 'solana'
  const canQuote = !!amount && busy === null && (needsPhantomSource ? !!solAddress : isConnected)
  const slowNote = dir === 'in' && chain === 'solana' ? 'Fast (about 8 to 20 seconds)' : 'Standard (several minutes)'

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
        {from} <ArrowRight size={14} color="var(--muted)" /> {to}
        {needsPhantomSource && <a href={SOLANA_QUICKSTART_URL} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)' }}>Circle guide</a>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={label}>Source wallet</div>
        {needsPhantomSource ? (
          solAddress ? <div className="mono" style={{ ...field, fontSize: 12, color: 'var(--ink-2)' }}>{solAddress.slice(0, 8)}…{solAddress.slice(-6)}</div> : (
            <button onClick={() => { void connectPhantom() }} disabled={busy !== null} style={connectBtn}><Wallet size={14} /> {busy === 'connect' ? 'Connecting…' : 'Connect Phantom'}</button>
          )
        ) : isConnected ? (
          <div className="mono" style={{ ...field, fontSize: 12, color: 'var(--ink-2)' }}>{address?.slice(0, 8)}…{address?.slice(-6)} (will switch to {from})</div>
        ) : (
          <ConnectKitButton.Custom>{({ show }) => <button onClick={show} style={connectBtn}>Connect Wallet</button>}</ConnectKitButton.Custom>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={label}>Amount</div>
        <div style={{ ...field, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="text" inputMode="decimal" value={amount} placeholder="0.00" onChange={e => { setAmount(e.target.value); reset() }}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }} />
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>USDC</span>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={label}>Recipient on {to}</div>
        <div style={field}>
          <input type="text" value={recipientInput} onChange={e => { setRecipientInput(e.target.value); reset() }}
            placeholder={defaultRecipient || (destIsSolana ? 'Solana address (connect Phantom or paste)' : '0x… (connect an EVM wallet or paste an address)')}
            style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }} />
        </div>
        {destIsSolana && !solAddress && (
          <button onClick={() => { void connectPhantom() }} style={{ background: 'none', border: 'none', color: AMBER, fontSize: 11, cursor: 'pointer', padding: '4px 0', fontFamily: 'DM Sans, sans-serif' }}>Use my Phantom address</button>
        )}
        <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 5 }}>Double-check this address. Bridged USDC cannot be recovered if it goes to the wrong one.</div>
      </div>

      {quote && (
        <div style={{ background: 'var(--surface-strong)', borderRadius: 9, padding: '12px 14px', marginBottom: 16, fontSize: 12 }}>
          <Row k="Route" v={`${from} to ${to}`} />
          <Row k="Send" v={`${quote.amount} USDC`} />
          <Row k="Recipient" v={`${quote.recipient.slice(0, 10)}…${quote.recipient.slice(-6)}`} />
          {quote.fees.map((f, i) => <Row key={i} k={`${f.type} fee`} v={f.amount == null ? 'unavailable' : `${f.amount} ${f.token}`} />)}
          {quote.gas.map((g, i) => <Row key={'g' + i} k={`Gas (${g.blockchain})`} v={g.fee == null ? 'unavailable' : `${g.fee} ${g.token}`} />)}
          <Row k="Speed" v={slowNote} />
          <div style={{ marginTop: 8, color: 'var(--subtle)' }}>
            The final step on {to} is submitted by Circle's Forwarding Service, which adds a small fee.
            {destIsSolana && ' That fee also covers creating the recipient\'s USDC account, so the amount must be larger than the fee.'}
          </div>
        </div>
      )}

      {!quote ? (
        <button onClick={() => { void getQuote() }} disabled={!canQuote} style={cta(canQuote)}>
          {busy === 'quote' ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Getting quote…</> : 'Get quote'}
        </button>
      ) : (
        <button onClick={() => { void bridge() }} disabled={busy !== null} style={cta(busy === null)}>
          {busy === 'bridge' ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Bridging… confirm in your wallet</> : `Bridge ${quote.amount} USDC to ${dir === 'out' ? meta.name : 'Arc'}`}
        </button>
      )}

      {busy === 'bridge' && live.length > 0 && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>Progress: {live.join(' → ')}</div>}

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
  )
}
