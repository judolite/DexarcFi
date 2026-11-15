import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react'
import { assessTrade, suggestPositionSize, type RiskLevel, type Side, type TradeAssessment } from '@/agent/riskMath'

interface Props {
  side: Side
  entryPrice: number
  leverage: number
  marginUsd: number
  balanceUsd: number
  /** Whether the user acknowledged the dangerous-leverage warning for this leverage. */
  acknowledged: boolean
  onAcknowledge: () => void
  onSetLeverage: (n: number) => void
  onSetMargin: (n: number) => void
  onSetStops: (stopPrice: number, takeProfitPrice: number) => void
}

const LEVEL_STYLE: Record<RiskLevel, { color: string; label: string }> = {
  low: { color: 'var(--success)', label: 'Low risk' },
  moderate: { color: 'var(--accent)', label: 'Moderate' },
  high: { color: '#f5a524', label: 'High risk' },
  dangerous: { color: 'var(--danger)', label: 'Dangerous' },
}

function fmt(n: number): string {
  return n >= 100 ? n.toFixed(2) : n.toFixed(4)
}

function safeAssess(args: Parameters<typeof assessTrade>[0]): TradeAssessment | null {
  try {
    return assessTrade(args)
  } catch {
    return null
  }
}

const ghostBtn: React.CSSProperties = {
  background: 'var(--surface-strong)',
  border: '1px solid var(--border)',
  color: 'var(--ink)',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
}

export default function RiskPanel(p: Props) {
  const a = safeAssess({ side: p.side, entryPrice: p.entryPrice, leverage: p.leverage, marginUsd: p.marginUsd || undefined, balanceUsd: p.balanceUsd || undefined })
  if (!a) return null

  const style = LEVEL_STYLE[a.level]
  const Icon = a.level === 'low' || a.level === 'moderate' ? ShieldCheck : ShieldAlert

  let size: ReturnType<typeof suggestPositionSize> | null = null
  if (p.balanceUsd > 0) {
    try {
      size = suggestPositionSize({ balanceUsd: p.balanceUsd, leverage: a.suggestedLeverage, stopPct: a.suggestedStopPct })
    } catch {
      size = null
    }
  }

  return (
    <div
      role="region"
      aria-label="Risk agent pre-trade check"
      style={{ background: 'var(--surface)', border: `1px solid ${style.color}55`, borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>
          <Icon size={13} color={style.color} /> Risk agent
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: style.color }}>{style.label}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--subtle)' }}>Est. liquidation price</span>
        <span className="mono" style={{ color: 'var(--ink)' }}>${fmt(a.liquidationPrice)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: a.warnings.length ? 8 : 0 }}>
        <span style={{ color: 'var(--subtle)' }}>Distance to liquidation</span>
        <span className="mono" style={{ color: style.color, fontWeight: 600 }}>{a.distancePct.toFixed(2)}%</span>
      </div>

      {a.warnings.map((w) => (
        <div key={w} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: style.color, marginBottom: 4, lineHeight: 1.4 }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> <span>{w}</span>
        </div>
      ))}

      {(p.leverage > a.suggestedLeverage || size || a.level !== 'low') && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {p.leverage > a.suggestedLeverage && (
            <button type="button" style={ghostBtn} onClick={() => p.onSetLeverage(a.suggestedLeverage)}>
              Use {a.suggestedLeverage}x
            </button>
          )}
          {size && (
            <button type="button" style={ghostBtn} onClick={() => p.onSetMargin(Number(size.marginUsd.toFixed(2)))}>
              Size for {size.riskPctOfBalance.toFixed(1)}% risk: ${size.marginUsd.toFixed(2)}
            </button>
          )}
          <button type="button" style={ghostBtn} onClick={() => p.onSetStops(a.suggestedStopPrice, a.suggestedTakeProfitPrice)}>
            Set stop {a.suggestedStopPct.toFixed(1)}% + 2R target
          </button>
        </div>
      )}

      {a.level === 'dangerous' && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: 11, color: 'var(--muted)', cursor: 'pointer', lineHeight: 1.4 }}>
          <input type="checkbox" checked={p.acknowledged} onChange={p.onAcknowledge} style={{ marginTop: 2 }} />
          <span>I understand a {a.distancePct.toFixed(2)}% move against me can liquidate this position.</span>
        </label>
      )}

      <div style={{ marginTop: 8, fontSize: 10, color: 'var(--subtle)', lineHeight: 1.4 }}>
        Estimate only: isolated margin, 1% maintenance, no fees or funding. Not financial advice.
      </div>
    </div>
  )
}
