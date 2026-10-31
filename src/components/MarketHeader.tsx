import { useState, useEffect, useRef } from 'react'
import type { Market } from '../hooks/useMarketData'
import { ChevronDown } from 'lucide-react'

interface Props {
  market: Market
  onOpenMarkets?: () => void
}

function formatNumber(n: number, digits = 2): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K'
  return n.toFixed(digits)
}

function formatPrice(p: number): string {
  if (p > 10000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (p > 100) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p > 1) return p.toFixed(4)
  return p.toFixed(6)
}

export default function MarketHeader({ market, onOpenMarkets }: Props) {
  const prevPrice = useRef(market.markPrice)
  const [priceClass, setPriceClass] = useState('')

  useEffect(() => {
    if (market.markPrice !== prevPrice.current) {
      setPriceClass(market.markPrice > prevPrice.current ? 'pulse-green' : 'pulse-red')
      prevPrice.current = market.markPrice
      const t = setTimeout(() => setPriceClass(''), 600)
      return () => clearTimeout(t)
    }
  }, [market.markPrice])

  const isPos = market.change24h >= 0

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        overflowX: 'auto',
        flexShrink: 0,
      }}
    >
      {/* Market selector */}
      <button
        onClick={onOpenMarkets}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 12px',
          cursor: 'pointer',
          minWidth: 160,
          flexShrink: 0,
        }}
      >
        <span
          className="display"
          style={{ color: 'var(--ink)', fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}
        >
          {market.symbol}
        </span>
        <ChevronDown size={14} color="var(--muted)" />
      </button>

      {/* Price */}
      <div style={{ flexShrink: 0 }}>
        <div
          className={`mono ${priceClass}`}
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: isPos ? 'var(--success)' : 'var(--danger)',
            tabularNums: 'true',
          } as React.CSSProperties}
        >
          {formatPrice(market.markPrice)}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="mono">{formatPrice(market.indexPrice)}</span>
          <span style={{ opacity: 0.6 }}>Index</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />

      {/* Stats */}
      {[
        { label: '24h Change', value: `${isPos ? '+' : ''}${market.change24h.toFixed(2)}%`, color: isPos ? 'var(--success)' : 'var(--danger)' },
        { label: '24h High', value: formatPrice(market.high24h) },
        { label: '24h Low', value: formatPrice(market.low24h) },
        { label: '24h Volume', value: '$' + formatNumber(market.volume24h) },
        { label: 'Open Interest', value: '$' + formatNumber(market.openInterest) },
        { label: 'Funding / 1h', value: (market.fundingRate * 100).toFixed(4) + '%', color: market.fundingRate >= 0 ? 'var(--success)' : 'var(--danger)' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 2, whiteSpace: 'nowrap' }}>{label}</div>
          <div
            className="mono"
            style={{ fontSize: 13, fontWeight: 500, color: color || 'var(--ink-2)', whiteSpace: 'nowrap' }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}
