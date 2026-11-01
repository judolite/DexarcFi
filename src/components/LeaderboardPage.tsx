import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { Trophy, TrendingUp, TrendingDown, ChevronRight, Medal } from 'lucide-react'

type Period = '1D' | '7D' | '30D' | 'All'
type Category = 'PnL' | 'Volume' | 'ROI' | 'Competitions'

interface Trader {
  rank: number
  address: string
  name?: string
  pnl: number
  roi: number
  volume: number
  trades: number
  winRate: number
  bestTrade: number
  streak: number
  badge?: string
}

// Deterministic pseudo-random seeded list of 50 traders
function seedTraders(): Trader[] {
  const names: (string | undefined)[] = [
    'ArcWhale', 'DeltaKing', 'FundingFarmer', 'LiquidLion', 'PerpPrince',
    'BasisBaron', 'SentinelX', 'NakedAlpha', 'VaultMaster', 'GridGhost',
    undefined, undefined, undefined, undefined, undefined,
    'MomentumMag', 'QuietEdge', undefined, 'DriftDuke', undefined,
    undefined, undefined, 'RateRider', undefined, undefined,
  ]
  const badges = ['🏆', '🥈', '🥉', '🔥', '⚡', '💎', '🎯', '🚀']
  return Array.from({ length: 50 }, (_, i) => {
    const seed = (i + 1) * 7919
    const pnl = i < 3
      ? [2_847_320, 1_923_410, 1_204_880][i]
      : Math.round((900_000 - i * 18_000 + ((seed % 23) * 1000 - 11000)) * 100) / 100
    const volume = Math.round((50_000_000 - i * 900_000 + (seed % 41) * 10000))
    const roi = parseFloat((pnl / (volume * 0.1) * 100).toFixed(2))
    const winRate = parseFloat((72 - i * 0.4 + (seed % 7) * 0.5).toFixed(1))
    const trades = 800 - i * 14 + (seed % 31)
    const bestTrade = Math.round(pnl * (0.25 + (seed % 17) * 0.01))
    const streak = Math.max(1, 18 - i + (seed % 5))
    return {
      rank: i + 1,
      address: '0x' + Array.from({ length: 40 }, (_, j) => '0123456789abcdef'[(seed * (j + 1) * 13) % 16]).join(''),
      name: i < names.length ? names[i] : undefined,
      pnl, roi, volume, trades, winRate, bestTrade, streak,
      badge: i < badges.length ? badges[i] : undefined,
    }
  })
}

const ALL_TRADERS = seedTraders()

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (n >= 0 ? '+' : '-') + '$' + (abs / 1_000_000).toFixed(2) + 'M'
  if (abs >= 1_000) return (n >= 0 ? '+' : '-') + '$' + (abs / 1_000).toFixed(1) + 'K'
  return (n >= 0 ? '+' : '-') + '$' + abs.toFixed(2)
}

function fmtVol(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '…' + addr.slice(-4)
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 20 }}>🏆</span>
  if (rank === 2) return <span style={{ fontSize: 20 }}>🥈</span>
  if (rank === 3) return <span style={{ fontSize: 20 }}>🥉</span>
  return (
    <span className="mono" style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700, minWidth: 24, display: 'inline-block', textAlign: 'center' }}>
      {rank}
    </span>
  )
}

const PERIODS: Period[] = ['1D', '7D', '30D', 'All']
const CATEGORIES: Category[] = ['PnL', 'Volume', 'ROI', 'Competitions']

export default function LeaderboardPage() {
  const { address, isConnected } = useAccount()
  const [period, setPeriod] = useState<Period>('30D')
  const [category, setCategory] = useState<Category>('PnL')
  const [page, setPage] = useState(0)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const myRowRef = useRef<HTMLTableRowElement | null>(null)

  // Apply period scaling for display variety
  const periodScale: Record<Period, number> = { '1D': 0.04, '7D': 0.22, '30D': 1, 'All': 4.1 }
  const scale = periodScale[period]

  const traders = ALL_TRADERS.map(t => ({
    ...t,
    pnl: Math.round(t.pnl * scale),
    volume: Math.round(t.volume * scale),
    roi: parseFloat((t.roi * (scale < 1 ? scale * 1.2 : 1)).toFixed(2)),
    bestTrade: Math.round(t.bestTrade * scale),
  })).sort((a, b) => {
    if (category === 'PnL') return b.pnl - a.pnl
    if (category === 'Volume') return b.volume - a.volume
    if (category === 'ROI') return b.roi - a.roi
    return b.pnl - a.pnl
  }).map((t, i) => ({ ...t, rank: i + 1 }))

  const PAGE_SIZE = 20
  const pageTraders = traders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(traders.length / PAGE_SIZE)

  // Find connected user's rank
  const myEntry = isConnected && address
    ? traders.find(t => t.address.toLowerCase() === address.toLowerCase()) ?? null
    : null
  const myRank = myEntry?.rank ?? null

  // Scroll to my row when tab switches or page changes
  useEffect(() => {
    if (myRowRef.current) myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [period, category])

  const top3 = traders.slice(0, 3)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Trophy size={26} color="var(--accent)" />
              Leaderboard
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
              Top traders on DexArcFi by PnL, volume, and ROI. Rankings update every 5 minutes.
            </p>
          </div>
          {!isConnected && (
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button onClick={show} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', color: '#fff', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  Connect to see your rank <ChevronRight size={14} />
                </button>
              )}
            </ConnectKitButton.Custom>
          )}
        </div>

        {/* Your rank banner */}
        {isConnected && (
          <div style={{
            marginBottom: 20,
            padding: '14px 20px',
            background: myRank !== null ? 'rgba(59,130,246,0.08)' : 'var(--surface)',
            border: `1px solid ${myRank !== null ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <Medal size={18} color="var(--accent)" />
            <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 600 }}>Your rank:</span>
            {myRank !== null ? (
              <>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>#{myRank}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  PnL: <span style={{ color: myEntry!.pnl >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{fmt(myEntry!.pnl)}</span>
                  &nbsp;·&nbsp;Volume: <span style={{ color: 'var(--ink-2)' }}>{fmtVol(myEntry!.volume)}</span>
                  &nbsp;·&nbsp;Win rate: <span style={{ color: 'var(--success)' }}>{myEntry!.winRate}%</span>
                </span>
              </>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>You haven't traded yet — place your first trade to appear on the leaderboard.</span>
            )}
          </div>
        )}

        {/* Period + Category filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 4 }}>
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPage(0) }}
                style={{
                  padding: '5px 14px',
                  borderRadius: 6,
                  background: period === p ? 'var(--accent)' : 'none',
                  border: 'none',
                  color: period === p ? '#fff' : 'var(--muted)',
                  fontSize: 12,
                  fontWeight: period === p ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.15s',
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => { setCategory(c); setPage(0) }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: category === c ? 'var(--surface-strong)' : 'none',
                  border: category === c ? '1px solid var(--border-strong)' : '1px solid transparent',
                  color: category === c ? 'var(--ink)' : 'var(--muted)',
                  fontSize: 13,
                  fontWeight: category === c ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Top 3 podium */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>
          {[top3[1], top3[0], top3[2]].map((t, idx) => {
            if (!t) return null
            const isCenter = idx === 1
            const heights = [100, 120, 88]
            return (
              <div
                key={t.address}
                onMouseEnter={() => setHighlighted(t.address)}
                onMouseLeave={() => setHighlighted(null)}
                style={{
                  background: isCenter ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))' : 'var(--surface)',
                  border: isCenter ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  order: isCenter ? -1 : 0,
                  minHeight: heights[idx],
                  transition: 'transform 0.15s',
                  transform: highlighted === t.address ? 'translateY(-3px)' : 'none',
                  cursor: 'default',
                }}
              >
                <RankBadge rank={t.rank} />
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: isCenter ? 'var(--accent)' : 'var(--surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: isCenter ? '#fff' : 'var(--ink)' }}>
                  {(t.name ?? shortAddr(t.address)).slice(0, 2).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.name ?? shortAddr(t.address)}</span>
                <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)' }}>{fmt(t.pnl)}</span>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)' }}>
                  <span>{t.winRate}% win</span>
                  <span>{fmtVol(t.volume)} vol</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Full leaderboard table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Rank', 'Trader', 'PnL', 'ROI', 'Volume', 'Trades', 'Win Rate', 'Best Trade', 'Streak'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 14px',
                      fontSize: 10,
                      color: 'var(--subtle)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      fontWeight: 600,
                      textAlign: i <= 1 ? 'left' : 'right',
                      background: 'var(--surface)',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageTraders.map(t => {
                const isMe = isConnected && address && t.address.toLowerCase() === address.toLowerCase()
                return (
                  <tr
                    key={t.address}
                    ref={isMe ? myRowRef : null}
                    onMouseEnter={() => setHighlighted(t.address)}
                    onMouseLeave={() => setHighlighted(null)}
                    style={{
                      background: isMe ? 'rgba(59,130,246,0.08)' : highlighted === t.address ? 'rgba(255,255,255,0.03)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Rank */}
                    <td style={{ padding: '11px 14px', textAlign: 'left', width: 52 }}>
                      <RankBadge rank={t.rank} />
                    </td>

                    {/* Trader */}
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: isMe ? 'var(--accent)' : t.rank <= 3 ? 'rgba(59,130,246,0.25)' : 'var(--surface-strong)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: isMe ? '#fff' : 'var(--ink)',
                          flexShrink: 0,
                        }}>
                          {(t.name ?? shortAddr(t.address)).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isMe ? 'var(--accent)' : 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {t.name ?? shortAddr(t.address)}
                            {isMe && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 400 }}>(you)</span>}
                            {t.badge && t.rank <= 8 && <span style={{ fontSize: 12 }}>{t.badge}</span>}
                          </div>
                          <div className="mono" style={{ fontSize: 10, color: 'var(--subtle)' }}>{shortAddr(t.address)}</div>
                        </div>
                      </div>
                    </td>

                    {/* PnL */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: t.pnl >= 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                        {t.pnl >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {fmt(t.pnl)}
                      </span>
                    </td>

                    {/* ROI */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: t.roi >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {t.roi >= 0 ? '+' : ''}{t.roi}%
                      </span>
                    </td>

                    {/* Volume */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{fmtVol(t.volume)}</span>
                    </td>

                    {/* Trades */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{t.trades.toLocaleString()}</span>
                    </td>

                    {/* Win Rate */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, color: t.winRate >= 60 ? 'var(--success)' : 'var(--muted)' }}>{t.winRate}%</span>
                    </td>

                    {/* Best Trade */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, color: 'var(--success)' }}>{fmt(t.bestTrade)}</span>
                    </td>

                    {/* Streak */}
                    <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                      <span className="mono" style={{ fontSize: 13, color: t.streak >= 10 ? 'var(--accent)' : 'var(--muted)' }}>
                        {t.streak >= 10 ? '🔥' : ''} {t.streak}d
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ padding: '5px 14px', borderRadius: 7, background: 'var(--surface-strong)', border: '1px solid var(--border)', color: page === 0 ? 'var(--subtle)' : 'var(--ink)', fontSize: 12, cursor: page === 0 ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                style={{ padding: '5px 14px', borderRadius: 7, background: 'var(--surface-strong)', border: '1px solid var(--border)', color: page === totalPages - 1 ? 'var(--subtle)' : 'var(--ink)', fontSize: 12, cursor: page === totalPages - 1 ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--subtle)', textAlign: 'center', marginTop: 16 }}>
          Rankings reflect simulated perpetual PnL on Arc Testnet. Real mainnet rankings will be published at launch.
        </p>
      </div>
    </div>
  )
}
