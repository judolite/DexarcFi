import type { Trade } from '../hooks/useMarketData'
import { ArrowUp, ArrowDown } from 'lucide-react'

interface Props {
  trades: Trade[]
  baseAsset: string
}

function formatPrice(p: number): string {
  if (p > 10000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (p > 100) return p.toFixed(2)
  if (p > 1) return p.toFixed(4)
  return p.toFixed(6)
}

export default function TradeHistory({ trades, baseAsset }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Column headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          padding: '4px 12px 4px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {[`Price (USD)`, `Size (${baseAsset})`, 'Time'].map((h, i) => (
          <span
            key={h}
            style={{
              fontSize: 10,
              color: 'var(--subtle)',
              fontWeight: 500,
              textAlign: i === 0 ? 'left' : 'right',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Trades list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {trades.slice(0, 40).map((trade, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              padding: '2px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 12,
                color: trade.side === 'buy' ? 'var(--success)' : 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {trade.side === 'buy'
                ? <ArrowUp size={10} />
                : <ArrowDown size={10} />}
              {formatPrice(trade.price)}
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'right' }}>
              {trade.size.toFixed(3)}
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--subtle)', textAlign: 'right' }}>
              {trade.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
