import { useMemo, useRef, useState } from 'react'
import type { CandlePoint } from '../hooks/useMarketData'

interface Props {
  candles: CandlePoint[]
}

const WINDOWS = ['1m', '5m', '15m', '1h', '4h', '1d']

function formatPrice(p: number): string {
  if (p > 10000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  if (p > 100) return p.toFixed(2)
  if (p > 1) return p.toFixed(4)
  return p.toFixed(6)
}

export default function TradingChart({ candles }: Props) {
  const [window, setWindow] = useState('1m')
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ x: number; candle: CandlePoint } | null>(null)

  const { priceTicks, candleWidth, candleData } = useMemo(() => {
    if (candles.length < 2) return { priceTicks: [], candleWidth: 8, candleData: [] }
    const W = 760, H = 220
    const pad = { left: 60, right: 10, top: 10, bottom: 10 }
    const chartW = W - pad.left - pad.right
    const chartH = H - pad.top - pad.bottom

    const visible = candles.slice(-80)
    const maxH = Math.max(...visible.map(c => c.high))
    const minL = Math.min(...visible.map(c => c.low))
    const range = maxH - minL || 1

    const toY = (v: number) => pad.top + chartH - ((v - minL) / range) * chartH
    const cw = Math.max(4, (chartW / visible.length) - 2)

    const candleData = visible.map((c, i) => {
      const x = pad.left + i * (chartW / visible.length) + (chartW / visible.length - cw) / 2
      const openY = toY(c.open)
      const closeY = toY(c.close)
      const highY = toY(c.high)
      const lowY = toY(c.low)
      const isGreen = c.close >= c.open
      const bodyTop = Math.min(openY, closeY)
      const bodyH = Math.max(1, Math.abs(closeY - openY))
      return { x, openY, closeY, highY, lowY, bodyTop, bodyH, isGreen, candle: c, cx: x + cw / 2 }
    })

    const ticks = 5
    const priceTicks = Array.from({ length: ticks }, (_, i) => {
      const v = minL + (range / (ticks - 1)) * i
      return { y: toY(v), label: formatPrice(v) }
    })

    return { priceTicks, candleWidth: cw, candleData }
  }, [candles])

  const hoverCandle = hover?.candle
  const displayCandle = hoverCandle || candles[candles.length - 1]

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Chart toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {/* OHLC display */}
        {displayCandle && (
          <div style={{ display: 'flex', gap: 12, marginRight: 16 }}>
            {[
              { l: 'O', v: formatPrice(displayCandle.open) },
              { l: 'H', v: formatPrice(displayCandle.high) },
              { l: 'L', v: formatPrice(displayCandle.low) },
              { l: 'C', v: formatPrice(displayCandle.close) },
            ].map(({ l, v }) => (
              <span key={l} style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--subtle)' }}>{l} </span>
                <span
                  className="mono"
                  style={{
                    color: displayCandle.close >= displayCandle.open ? 'var(--success)' : 'var(--danger)',
                  }}
                >
                  {v}
                </span>
              </span>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Time windows */}
        {WINDOWS.map(w => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              background: window === w ? 'var(--surface-strong)' : 'none',
              border: 'none',
              color: window === w ? 'var(--accent)' : 'var(--muted)',
              fontSize: 12,
              padding: '3px 8px',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              fontWeight: window === w ? 600 : 400,
            }}
          >
            {w}
          </button>
        ))}
      </div>

      {/* SVG chart */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 760 240"
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%' }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={e => {
            if (!svgRef.current) return
            const rect = svgRef.current.getBoundingClientRect()
            const scaleX = 760 / rect.width
            const mx = (e.clientX - rect.left) * scaleX
            // Find nearest candle
            let nearest = candleData[0]
            let nearestDist = Infinity
            for (const d of candleData) {
              const dist = Math.abs(d.cx - mx)
              if (dist < nearestDist) { nearestDist = dist; nearest = d }
            }
            if (nearest) setHover({ x: nearest.cx, candle: nearest.candle })
          }}
        >
          {/* Grid lines */}
          {priceTicks.map(({ y, label }) => (
            <g key={label}>
              <line x1={60} y1={y} x2={750} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} />
              <text x={8} y={y + 4} fill="var(--subtle)" fontSize={9} fontFamily="JetBrains Mono, monospace">
                {label}
              </text>
            </g>
          ))}

          {/* Candles */}
          {candleData.map((d, i) => (
            <g key={i}>
              {/* Wick */}
              <line
                x1={d.cx}
                y1={d.highY}
                x2={d.cx}
                y2={d.lowY}
                stroke={d.isGreen ? 'var(--buy)' : 'var(--sell)'}
                strokeWidth={1}
              />
              {/* Body */}
              <rect
                x={d.x}
                y={d.bodyTop}
                width={candleWidth}
                height={d.bodyH}
                fill={d.isGreen ? 'var(--buy)' : 'var(--sell)'}
                opacity={hover?.candle === d.candle ? 1 : 0.9}
              />
            </g>
          ))}

          {/* Hover crosshair */}
          {hover && (
            <line
              x1={hover.x}
              y1={10}
              x2={hover.x}
              y2={230}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              strokeDasharray="4 3"
              pointerEvents="none"
            />
          )}

          {/* Current price line */}
          {candles.length > 0 && (() => {
            const last = candles[candles.length - 1]
            const H = 220
            const pad = { left: 60, top: 10, bottom: 10 }
            const visible = candles.slice(-80)
            const mxH = Math.max(...visible.map(c => c.high))
            const mnL = Math.min(...visible.map(c => c.low))
            const range = mxH - mnL || 1
            const chartH = H - pad.top - pad.bottom
            const y = pad.top + chartH - ((last.close - mnL) / range) * chartH
            const isUp = last.close >= last.open
            return (
              <g>
                <line x1={60} y1={y} x2={750} y2={y} stroke={isUp ? 'var(--buy)' : 'var(--sell)'} strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
                <rect x={754} y={y - 9} width={6} height={18} fill={isUp ? 'var(--buy)' : 'var(--sell)'} rx={2} />
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}
