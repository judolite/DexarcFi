import { useMemo } from 'react'
import type { OrderBook, Market } from '../hooks/useMarketData'

interface Props {
  orderBook: OrderBook
  market: Market
  onPriceClick?: (price: number) => void
}

function formatPrice(p: number): string {
  if (p > 10000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (p > 100) return p.toFixed(2)
  if (p > 1) return p.toFixed(4)
  return p.toFixed(6)
}

function formatSize(s: number): string {
  return s.toFixed(2)
}

export default function OrderBook({ orderBook, market, onPriceClick }: Props) {
  const maxTotal = useMemo(() => {
    const maxAsk = orderBook.asks.length ? orderBook.asks[orderBook.asks.length - 1].total : 0
    const maxBid = orderBook.bids.length ? orderBook.bids[orderBook.bids.length - 1].total : 0
    return Math.max(maxAsk, maxBid)
  }, [orderBook])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        minWidth: 220,
        maxWidth: 260,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>Order Book</span>
      </div>

      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          padding: '4px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {['Price', 'Size', 'Total'].map((h, i) => (
          <span
            key={h}
            style={{
              fontSize: 10,
              color: 'var(--subtle)',
              fontWeight: 500,
              textAlign: i === 0 ? 'left' : 'right',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Asks (top) */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 0 }}>
          {[...orderBook.asks].reverse().map((level, i) => {
            const pct = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0
            return (
              <div
                key={i}
                onClick={() => onPriceClick?.(level.price)}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  padding: '2px 12px',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,78,97,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                {/* Depth bar */}
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: pct + '%',
                    background: 'var(--sell-dim)',
                    pointerEvents: 'none',
                  }}
                />
                <span className="mono" style={{ fontSize: 12, color: 'var(--danger)', position: 'relative' }}>
                  {formatPrice(level.price)}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'right', position: 'relative' }}>
                  {formatSize(level.size)}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', position: 'relative' }}>
                  {formatSize(level.total)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Spread */}
        <div
          style={{
            padding: '6px 12px',
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {formatPrice(orderBook.midPrice)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            Spread {orderBook.spreadPct.toFixed(4)}%
          </span>
        </div>

        {/* Bids */}
        <div>
          {orderBook.bids.map((level, i) => {
            const pct = maxTotal > 0 ? (level.total / maxTotal) * 100 : 0
            return (
              <div
                key={i}
                onClick={() => onPriceClick?.(level.price)}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  padding: '2px 12px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(38,208,124,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: pct + '%',
                    background: 'var(--buy-dim)',
                    pointerEvents: 'none',
                  }}
                />
                <span className="mono" style={{ fontSize: 12, color: 'var(--success)', position: 'relative' }}>
                  {formatPrice(level.price)}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'right', position: 'relative' }}>
                  {formatSize(level.size)}
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', position: 'relative' }}>
                  {formatSize(level.total)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Symbol label */}
      <div
        style={{
          padding: '4px 12px',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          flexShrink: 0,
        }}
      >
        {['Price', `Size (${market.baseAsset})`, `Total (${market.baseAsset})`].map((h, i) => (
          <span key={h} style={{ fontSize: 10, color: 'var(--subtle)', textAlign: i === 0 ? 'left' : 'right' }}>
            {h}
          </span>
        ))}
      </div>
    </div>
  )
}
