import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink, Info, ShieldAlert } from 'lucide-react'
import { CIRCLE_FAUCET_URL, SUI_QUICKSTART_URL } from '@/bridgeHelpers'
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
          Move USDC between Arc and Solana, Monad or Sui with Circle CCTP, in either direction. Circle submits the final step on the destination for you, so you do not need destination gas first.
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

        {chain === 'sui' ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--ink)' }}>{dir === 'in' ? 'Sui to Arc' : 'Arc to Sui'}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
              Sui uses the older CCTP V1 protocol, standard transfers only, and the Forwarding Service is not available. Circle's kits do not cover Sui, so this route needs a Sui wallet and Circle's Move packages instead of this form.
            </p>
            <ol style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.9, margin: '0 0 16px', paddingLeft: 20 }}>
              {dir === 'in' ? (
                <>
                  <li>Get Sui Testnet SUI and test USDC.</li>
                  <li>Burn USDC on Sui with the CCTP package.</li>
                  <li>Fetch Circle's attestation for the burn.</li>
                  <li>Mint on Arc Testnet by calling the message transmitter with the attestation (you pay Arc gas in USDC).</li>
                </>
              ) : (
                <>
                  <li>Burn USDC on Arc Testnet by calling the token messenger, with your Sui address as the recipient.</li>
                  <li>Fetch Circle's attestation for the burn.</li>
                  <li>Mint on Sui with the CCTP package (you pay Sui gas).</li>
                </>
              )}
            </ol>
            <a href={SUI_QUICKSTART_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: AMBER, color: '#0b1320', padding: '10px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
              Open Circle's Sui and Arc guide <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <BridgeForm key={`${dir}:${chain}`} dir={dir} chain={chain} />
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
