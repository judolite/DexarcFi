import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, Search, Activity } from 'lucide-react'

interface MarketRow {
  symbol: string       // e.g. BTC
  pair: string         // e.g. BTCUSDT
  price: number
  change24h: number
  high24h: number
  low24h: number
  volume24h: number    // in quote (USDC)
  category: 'Layer1' | 'Layer2' | 'DeFi' | 'Meme' | 'AI'
}

const MARKET_DEFS: { symbol: string; pair: string; category: MarketRow['category'] }[] = [
  { symbol: 'BTC',  pair: 'BTCUSDT',  category: 'Layer1' },
  { symbol: 'ETH',  pair: 'ETHUSDT',  category: 'Layer1' },
  { symbol: 'SOL',  pair: 'SOLUSDT',  category: 'Layer1' },
  { symbol: 'BNB',  pair: 'BNBUSDT',  category: 'Layer1' },
  { symbol: 'AVAX', pair: 'AVAXUSDT', category: 'Layer1' },
  { symbol: 'ARB',  pair: 'ARBUSDT',  category: 'Layer2' },
  { symbol: 'OP',   pair: 'OPUSDT',   category: 'Layer2' },
  { symbol: 'MATIC',pair: 'MATICUSDT',category: 'Layer2' },
  { symbol: 'UNI',  pair: 'UNIUSDT',  category: 'DeFi' },
  { symbol: 'AAVE', pair: 'AAVEUSDT', category: 'DeFi' },
  { symbol: 'LINK', pair: 'LINKUSDT', category: 'DeFi' },
  { symbol: 'CRV',  pair: 'CRVUSDT',  category: 'DeFi' },
  { symbol: 'DOGE', pair: 'DOGEUSDT', category: 'Meme' },
  { symbol: 'SHIB', pair: 'SHIBUSDT', category: 'Meme' },
  { symbol: 'PEPE', pair: 'PEPEUSDT', category: 'Meme' },
  { symbol: 'FET',  pair: 'FETUSDT',  category: 'AI' },
  { symbol: 'RNDR', pair: 'RNDRUSDT', category: 'AI' },
  { symbol: 'TAO',  pair: 'TAOUSDT',  category: 'AI' },
]

type SortKey = 'price' | 'change24h' | 'volume24h'
type SortDir = 'asc' | 'desc'

function ColHeader({
  label, sortable, sKey, sortKeyActive, sortDir, onSort,
}: {
  label: string
  sortable?: boolean
  sKey?: SortKey
  sortKeyActive?: SortKey
  sortDir?: SortDir
  onSort?: (k: SortKey) => void
}) {
  return (
    <th
      onClick={sortable && sKey && onSort ? () => onSort(sKey) : undefined}
      style={{
        textAlign: 'right',
        fontSize: 11,
        color: sortKeyActive === sKey ? 'var(--accent)' : 'var(--subtle)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 600,
        padding: '10px 12px',
        cursor: sortable ? 'pointer' : 'default',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {label} {sortable && sKey && sortKeyActive === sKey ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
}

function buildInitialRows(): Record<string, MarketRow> {
  const m: Record<string, MarketRow> = {}
  MARKET_DEFS.forEach(def => {
    m[def.pair] = { symbol: def.symbol, pair: def.pair, price: 0, change24h: 0, high24h: 0, low24h: 0, volume24h: 0, category: def.category }
  })
  return m
}

function fmt(n: number, decimals = 2): string {
  if (n >= 1_000_000_000) return '$' + (n / 1_000_000_000).toFixed(2) + 'B'
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(2) + 'K'
  return '$' + n.toFixed(decimals)
}

function fmtPrice(n: number): string {
  if (n >= 10_000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return '$' + n.toFixed(4)
  return '$' + n.toFixed(8)
}

export default function MarketsPage() {
  const initialRows = buildInitialRows()
  const [rows, setRows] = useState<MarketRow[]>(Object.values(initialRows))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<'All' | MarketRow['category']>('All')
  const [sortKey, setSortKey] = useState<SortKey>('volume24h')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const rowsRef = useRef<Record<string, MarketRow>>(initialRows)

  useEffect(() => {
    // Subscribe to Binance public 24h ticker stream (no auth required)
    const streams = MARKET_DEFS.map(d => d.pair.toLowerCase() + '@ticker').join('/')
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    ws.onmessage = (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as {
        data: { s: string; c: string; P: string; h: string; l: string; q: string }
      }
      const d = msg.data
      const def = MARKET_DEFS.find(x => x.pair === d.s)
      if (!def) return
      rowsRef.current[d.s] = {
        symbol: def.symbol, pair: def.pair,
        price: parseFloat(d.c), change24h: parseFloat(d.P),
        high24h: parseFloat(d.h), low24h: parseFloat(d.l),
        volume24h: parseFloat(d.q), category: def.category,
      }
      setRows(Object.values(rowsRef.current))
    }

    return () => { ws.close() }
  }, [])

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
      else setSortDir('desc')
      return key
    })
  }, [])

  const CATEGORIES = ['All', 'Layer1', 'Layer2', 'DeFi', 'Meme', 'AI'] as const

  const filtered = rows
    .filter(r => r.price > 0) // hide unloaded rows
    .filter(r => category === 'All' || r.category === category)
    .filter(r => r.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      return (a[sortKey] - b[sortKey]) * mul
    })

  const topGainers = [...rows].filter(r => r.price > 0).sort((a, b) => b.change24h - a.change24h).slice(0, 3)
  const topLosers  = [...rows].filter(r => r.price > 0).sort((a, b) => a.change24h - b.change24h).slice(0, 3)
  const totalVolume = rows.reduce((s, r) => s + r.volume24h, 0)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>
              Markets
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
              Live prices via Binance public stream
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: connected ? 'var(--success)' : 'var(--danger)' }}>
            <Activity size={13} />
            {connected ? 'Live' : 'Connecting…'}
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>24h Volume</div>
            <div className="mono display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{fmt(totalVolume)}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Markets</div>
            <div className="mono display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{MARKET_DEFS.length}</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Top Gainer</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{topGainers[0]?.symbol ?? '—'}</span>
              <span className="mono" style={{ fontSize: 14, color: 'var(--success)', fontWeight: 700 }}>
                {topGainers[0] ? '+' + topGainers[0].change24h.toFixed(2) + '%' : ''}
              </span>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Top Loser</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{topLosers[0]?.symbol ?? '—'}</span>
              <span className="mono" style={{ fontSize: 14, color: 'var(--danger)', fontWeight: 700 }}>
                {topLosers[0] ? topLosers[0].change24h.toFixed(2) + '%' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Top movers strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Top Gainers', data: topGainers, color: 'var(--success)' },
            { label: 'Top Losers',  data: topLosers,  color: 'var(--danger)' },
          ].map(({ label, data, color }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
              <div style={{ fontSize: 12, color: 'var(--subtle)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {data.map(r => (
                  <div key={r.pair} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink)' }}>
                        {r.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{r.symbol}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtPrice(r.price)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color }}>
                      {r.change24h >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {r.change24h >= 0 ? '+' : ''}{r.change24h.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Table controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', flex: '0 0 220px' }}>
            <Search size={13} color="var(--muted)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search token…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 7,
                  background: category === c ? 'var(--accent)' : 'var(--surface)',
                  border: category === c ? 'none' : '1px solid var(--border)',
                  color: category === c ? '#fff' : 'var(--muted)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  Market
                </th>
                <ColHeader label="Price" sortable sKey="price" sortKeyActive={sortKey} sortDir={sortDir} onSort={handleSort} />
                <ColHeader label="24h Change" sortable sKey="change24h" sortKeyActive={sortKey} sortDir={sortDir} onSort={handleSort} />
                <ColHeader label="24h High" />
                <ColHeader label="24h Low" />
                <ColHeader label="24h Volume" sortable sKey="volume24h" sortKeyActive={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th style={{ textAlign: 'center', fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                  Category
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: 14 }}>
                    {connected ? 'No markets match your filter.' : 'Connecting to live feed…'}
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const isPos = r.change24h >= 0
                return (
                  <tr
                    key={r.pair}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.1s',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => { (e.currentTarget).style.background = 'var(--surface-strong)' }}
                    onMouseLeave={e => { (e.currentTarget).style.background = 'transparent' }}
                  >
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>
                          {r.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{r.symbol}<span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 11 }}>/USDC</span></div>
                          <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{r.symbol}-PERP</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '11px 12px' }}>
                      <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{fmtPrice(r.price)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '11px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 13, fontWeight: 700, color: isPos ? 'var(--success)' : 'var(--danger)' }}>
                        {isPos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {isPos ? '+' : ''}{r.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '11px 12px' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--success)' }}>{fmtPrice(r.high24h)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '11px 12px' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--danger)' }}>{fmtPrice(r.low24h)}</span>
                    </td>
                    <td style={{ textAlign: 'right', padding: '11px 12px' }}>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>{fmt(r.volume24h)}</span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '11px 12px' }}>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 500 }}>
                        {r.category}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
