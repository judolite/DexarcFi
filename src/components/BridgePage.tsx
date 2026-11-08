import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Info, ShieldAlert } from 'lucide-react'
import { CIRCLE_FAUCET_URL, HYPERCORE_DEPOSIT_URL, HYPERCORE_WITHDRAW_URL } from '@/bridgeHelpers'
import { AMBER, CHAINS, type Chain, type Direction } from '@/bridgeConfig'
import BridgeForm from './BridgeForm'

export default function BridgePage() {
  const [dir, setDir] = useState<Direction>('in')
  const [chain, setChain] = useState<Chain>('solana')
  const meta = CHAINS.find(c => c.id === chain)!

  const speedFor = (id: Chain) => {
    const c = CHAINS.find(x => x.id === id)!
    return dir === 'in' ? c.speedIn : 'Standard transfer out'
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 className="display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
          {dir === 'in' ? 'Bridge to Arc' : 'Bridge from Arc'}
        </h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
          Move USDC between Arc and Solana, Monad or Hyperliquid with Circle CCTP, in either direction. Circle submits the final step on the destination for you, so you do not need destination gas first.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 9, marginBottom: 18 }}>
          <ShieldAlert size={13} color="#fbbf24" />
          <span style={{ fontSize: 12, color: '#fbbf24' }}>Testnet only. Use test USDC from the <a href={CIRCLE_FAUCET_URL} target="_blank" rel="noopener noreferrer" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Circle faucet</a>. Never bridge real funds here.</span>
        </div>

        {/* Direction */}
        <div role="tablist" aria-label="Bridge direction" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 14 }}>
          {([['in', 'Into Arc', ArrowDownToLine], ['out', 'Out of Arc', ArrowUpFromLine]] as const).map(([id, text, Icon]) => (
            <button key={id} role="tab" aria-selected={dir === id} onClick={() => setDir(id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 700,
                background: dir === id ? `${AMBER}22` : 'transparent', color: dir === id ? AMBER : 'var(--muted)' }}>
              <Icon size={15} /> {text}
            </button>
          ))}
        </div>

        {/* Chain */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
          {CHAINS.map(c => (
            <button key={c.id} onClick={() => setChain(c.id)}
              style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                background: chain === c.id ? `${AMBER}18` : 'var(--surface)', border: `1px solid ${chain === c.id ? AMBER + '88' : 'var(--border)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: chain === c.id ? AMBER : 'var(--ink)' }}>{c.name}</span>
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-strong)', color: 'var(--muted)' }}>{c.badge}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{speedFor(c.id)}</div>
            </button>
          ))}
        </div>

        <BridgeForm key={`${dir}:${chain}`} dir={dir} chain={chain} />

        {chain === 'hyperliquid' && (
          <div style={{ marginTop: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
              {dir === 'in' ? 'Using it on Hyperliquid trading' : 'Before you bridge out of Hyperliquid'}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 10px' }}>
              {dir === 'in'
                ? 'This route moves USDC on HyperEVM, Hyperliquid\'s EVM layer. Hyperliquid trading balances live on HyperCore, so after bridging you move the USDC from HyperEVM to HyperCore with Circle\'s CCTP deposit steps.'
                : 'This route sends USDC held on HyperEVM, Hyperliquid\'s EVM layer. If your funds are in a Hyperliquid trading balance on HyperCore, withdraw them to HyperEVM first with Circle\'s CCTP withdrawal steps, then bridge here.'}
            </p>
            <a href={dir === 'in' ? HYPERCORE_DEPOSIT_URL : HYPERCORE_WITHDRAW_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: AMBER, fontSize: 12, fontWeight: 700 }}>
              {dir === 'in' ? 'HyperEVM to HyperCore guide' : 'HyperCore to HyperEVM guide'} <ExternalLink size={12} />
            </a>
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={13} color="var(--subtle)" style={{ marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--subtle)', lineHeight: 1.6 }}>
            {dir === 'in'
              ? `You need a little gas on the source chain (${meta.nativeGas}). Arc gas is paid in USDC, and the Forwarding Service covers the final step, so a brand new Arc wallet works.`
              : 'Sending out of Arc costs the amount plus a little USDC for Arc gas, both from your Arc balance. The Forwarding Service covers the final step, so the destination wallet needs no gas.'}
          </span>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
