import type { Market } from '../hooks/useMarketData'
import { Search, X } from 'lucide-react'
import { useState } from 'react'

interface Props {
  markets: Market[]
  activeSymbol: string
  onSelect: (symbol: string) => void
  onClose: () => void
}

function formatVol(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  return (n / 1_000).toFixed(0) + 'K'
}

function formatPrice(p: number): string {
  if (p > 10000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (p > 100) return p.toFixed(2)
  if (p > 1) return p.toFixed(4)
  return p.toFixed(6)
}

export default function MarketsList({ markets, activeSymbol, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')

  const filtered = markets.filter(m =>
    m.symbol.toLowerCase().includes(query.toLowerCase()) ||
    m.baseAsset.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingTop: 100,
        paddingLeft: 20,
      }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          width: 480,
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            gap: 12,
          }}
        >
          <Search size={16} color="var(--muted)" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search markets…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--ink)',
              fontSize: 14,
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={16} color="var(--muted)" />
          </button>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            padding: '6px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {['Market', 'Price', '24h Chg', 'Volume'].map((h, i) => (
            <span
              key={h}
              style={{
                fontSize: 10,
                color: 'var(--subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                textAlign: i > 0 ? 'right' : 'left',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Markets */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.map(m => {
            const isPos = m.change24h >= 0
            const isActive = m.symbol === activeSymbol
            return (
              <div
                key={m.symbol}
                onClick={() => { onSelect(m.symbol); onClose() }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  background: isActive ? 'var(--surface)' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>{m.symbol}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.baseAsset} Perp</div>
                </div>
                <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>
                  {formatPrice(m.markPrice)}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 13, color: isPos ? 'var(--success)' : 'var(--danger)', textAlign: 'right' }}
                >
                  {isPos ? '+' : ''}{m.change24h.toFixed(2)}%
                </span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>
                  ${formatVol(m.volume24h)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
