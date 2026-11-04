import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { ExternalLink } from 'lucide-react'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { useTradingState, closePosition, cancelOrder, fillOrder, unrealizedPnl } from '@/tradingStore'
import type { Market, Trade } from '../hooks/useMarketData'
import TradeHistory from './TradeHistory'

const ARC_TESTNET_ID = 5042002

interface Props {
  trades: Trade[]
  market: Market
  markets: Market[]
}

const TABS = ['Positions', 'Open Orders', 'Trade History', 'Funding History', 'Portfolio']

const th: CSSProperties = { fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, padding: '6px 12px', textAlign: 'left', whiteSpace: 'nowrap' }
const td: CSSProperties = { fontSize: 12, padding: '7px 12px', whiteSpace: 'nowrap', borderTop: '1px solid rgba(255,255,255,0.04)' }

const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPrice = (p: number) => (p >= 100 ? fmt(p, 2) : p >= 1 ? fmt(p, 4) : fmt(p, 6))
const pnlColor = (n: number) => (n > 0 ? 'var(--success)' : n < 0 ? 'var(--danger)' : 'var(--muted)')
const signed = (n: number) => (n >= 0 ? '+' : '-') + '$' + fmt(Math.abs(n))
const timeStr = (t: number) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function Table({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{heads.map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120 }}>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{text}</span>
    </div>
  )
}

function SideTag({ side }: { side: 'long' | 'short' }) {
  return <span style={{ color: side === 'long' ? 'var(--success)' : 'var(--danger)', fontWeight: 600, textTransform: 'capitalize' }}>{side}</span>
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a href={buildTxExplorerUrl(ARC_TESTNET_ID, hash)} target="_blank" rel="noopener noreferrer"
      style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {hash.slice(0, 8)}… <ExternalLink size={10} />
    </a>
  )
}

export default function BottomPanel({ trades, market, markets }: Props) {
  const [tab, setTab] = useState('Positions')
  const [histView, setHistView] = useState<'mine' | 'market'>('mine')
  const { address, isConnected } = useAccount()
  const { positions, orders, fills } = useTradingState(address)

  // Clock for funding accrual (ticks every 30s; kept out of render so the component stays pure).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const prices = useMemo(() => {
    const m: Record<string, Market> = {}
    for (const x of markets) m[x.symbol] = x
    return m
  }, [markets])

  // Resting limit orders fill when the mark price reaches the limit.
  useEffect(() => {
    if (!address) return
    for (const o of orders) {
      if (o.orderType !== 'Limit') continue
      const mark = prices[o.market]?.markPrice
      if (mark == null) continue
      if ((o.side === 'long' && mark <= o.limitPrice) || (o.side === 'short' && mark >= o.limitPrice)) fillOrder(address, o.id)
    }
  }, [orders, prices, address])

  const usdc = getUsdc(ARC_TESTNET_ID)
  const { data: rawBal } = useReadContract({
    address: usdc?.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined, chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!usdc, refetchInterval: 15_000 },
  })
  const walletUsdc = rawBal != null ? parseFloat(Amount.fromRaw(rawBal, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)) : 0

  const markOf = (sym: string, fallback: number) => prices[sym]?.markPrice ?? fallback
  const totalMargin = positions.reduce((s, p) => s + p.margin, 0)
  const totalPnl = positions.reduce((s, p) => s + unrealizedPnl(p, markOf(p.market, p.entryPrice)), 0)
  const orderMargin = orders.reduce((s, o) => s + o.margin, 0)

  let body: ReactNode
  if (!isConnected) {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>Connect your wallet to view {tab.toLowerCase()}</span>
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button onClick={show} style={{ background: 'var(--accent)', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Connect Wallet
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    )
  } else if (tab === 'Positions') {
    body = positions.length === 0 ? <Empty text="No positions yet" /> : (
      <Table heads={['Market', 'Side', 'Size', 'Entry', 'Mark', 'Margin', 'Lev', 'PnL', 'Opened', 'Tx', '']}>
        {positions.map(p => {
          const mark = markOf(p.market, p.entryPrice)
          const pnl = unrealizedPnl(p, mark)
          return (
            <tr key={p.id}>
              <td style={{ ...td, fontWeight: 600, color: 'var(--ink)' }}>{p.market}</td>
              <td style={td}><SideTag side={p.side} /></td>
              <td className="mono" style={td}>{fmt(p.sizeBase, 4)} {p.baseAsset}</td>
              <td className="mono" style={td}>{fmtPrice(p.entryPrice)}</td>
              <td className="mono" style={td}>{fmtPrice(mark)}</td>
              <td className="mono" style={td}>${fmt(p.margin)}</td>
              <td className="mono" style={td}>{p.leverage}x</td>
              <td className="mono" style={{ ...td, color: pnlColor(pnl), fontWeight: 600 }}>{signed(pnl)} ({fmt((pnl / p.margin) * 100)}%)</td>
              <td style={{ ...td, color: 'var(--muted)' }}>{timeStr(p.openedAt)}</td>
              <td style={td}><TxLink hash={p.txHash} /></td>
              <td style={td}>
                <button onClick={() => address && closePosition(address, p.id, mark)}
                  style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink-2)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  Close
                </button>
              </td>
            </tr>
          )
        })}
      </Table>
    )
  } else if (tab === 'Open Orders') {
    body = orders.length === 0 ? <Empty text="No open orders yet" /> : (
      <Table heads={['Market', 'Type', 'Side', 'Limit Price', 'Margin', 'Lev', 'Placed', 'Tx', '']}>
        {orders.map(o => (
          <tr key={o.id}>
            <td style={{ ...td, fontWeight: 600, color: 'var(--ink)' }}>{o.market}</td>
            <td style={td}>{o.orderType}</td>
            <td style={td}><SideTag side={o.side} /></td>
            <td className="mono" style={td}>{fmtPrice(o.limitPrice)}</td>
            <td className="mono" style={td}>${fmt(o.margin)}</td>
            <td className="mono" style={td}>{o.leverage}x</td>
            <td style={{ ...td, color: 'var(--muted)' }}>{timeStr(o.createdAt)}</td>
            <td style={td}><TxLink hash={o.txHash} /></td>
            <td style={td}>
              <button onClick={() => address && cancelOrder(address, o.id)}
                style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                Cancel
              </button>
            </td>
          </tr>
        ))}
      </Table>
    )
  } else if (tab === 'Trade History') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', gap: 6, padding: '6px 12px', flexShrink: 0 }}>
          {(['mine', 'market'] as const).map(v => (
            <button key={v} onClick={() => setHistView(v)}
              style={{ background: histView === v ? 'rgba(59,130,246,0.15)' : 'none', border: '1px solid var(--border)', color: histView === v ? 'var(--accent)' : 'var(--muted)', borderRadius: 6, padding: '2px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {v === 'mine' ? 'My trades' : 'Market trades'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {histView === 'market' ? <TradeHistory trades={trades} baseAsset={market.baseAsset} />
            : fills.length === 0 ? <Empty text="No trade history yet" /> : (
              <Table heads={['Time', 'Market', 'Side', 'Action', 'Price', 'Size', 'Margin', 'Realized PnL', 'Tx']}>
                {fills.map(f => (
                  <tr key={f.id}>
                    <td style={{ ...td, color: 'var(--muted)' }}>{timeStr(f.time)}</td>
                    <td style={{ ...td, fontWeight: 600, color: 'var(--ink)' }}>{f.market}</td>
                    <td style={td}><SideTag side={f.side} /></td>
                    <td style={td}>{f.kind === 'open' ? 'Open' : 'Close'}</td>
                    <td className="mono" style={td}>{fmtPrice(f.price)}</td>
                    <td className="mono" style={td}>{fmt(f.sizeBase, 4)} {f.baseAsset}</td>
                    <td className="mono" style={td}>${fmt(f.margin)}</td>
                    <td className="mono" style={{ ...td, color: f.pnl == null ? 'var(--muted)' : pnlColor(f.pnl) }}>{f.pnl == null ? '—' : signed(f.pnl)}</td>
                    <td style={td}><TxLink hash={f.txHash} /></td>
                  </tr>
                ))}
              </Table>
            )}
        </div>
      </div>
    )
  } else if (tab === 'Funding History') {
    body = positions.length === 0 ? <Empty text="No funding history yet" /> : (
      <Table heads={['Market', 'Side', 'Notional', 'Funding Rate / hr', 'Held', 'Est. Funding Paid / Received']}>
        {positions.map(p => {
          const rate = prices[p.market]?.fundingRate ?? 0
          const hours = Math.max(0, now - p.openedAt) / 3_600_000
          const notional = p.margin * p.leverage
          const flow = (p.side === 'long' ? -1 : 1) * notional * rate * hours
          return (
            <tr key={p.id}>
              <td style={{ ...td, fontWeight: 600, color: 'var(--ink)' }}>{p.market}</td>
              <td style={td}><SideTag side={p.side} /></td>
              <td className="mono" style={td}>${fmt(notional)}</td>
              <td className="mono" style={td}>{(rate * 100).toFixed(4)}%</td>
              <td style={{ ...td, color: 'var(--muted)' }}>{hours < 1 ? Math.max(1, Math.round(hours * 60)) + 'm' : hours.toFixed(1) + 'h'}</td>
              <td className="mono" style={{ ...td, color: pnlColor(flow) }}>{(flow >= 0 ? '+' : '-') + '$' + Math.abs(flow).toFixed(4)}</td>
            </tr>
          )
        })}
      </Table>
    )
  } else {
    const equity = walletUsdc + totalMargin + totalPnl
    const stat = (label: string, value: string, color?: string) => (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', minWidth: 150 }}>
        <div style={{ fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
        <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: color ?? 'var(--ink)' }}>{value}</div>
      </div>
    )
    body = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 14 }}>
        {stat('Account Equity', '$' + fmt(equity))}
        {stat('Wallet USDC', '$' + fmt(walletUsdc))}
        {stat('Margin in Positions', '$' + fmt(totalMargin))}
        {stat('Margin in Open Orders', '$' + fmt(orderMargin))}
        {stat('Unrealized PnL', signed(totalPnl), pnlColor(totalPnl))}
        {stat('Open Positions', String(positions.length))}
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: 220, flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', overflowX: 'auto', flexShrink: 0 }}>
        {TABS.map(t => {
          const count = t === 'Positions' ? positions.length : t === 'Open Orders' ? orders.length : 0
          return (
            <button key={t} className={`tab-base ${tab === t ? 'tab-active' : ''}`} onClick={() => setTab(t)}>
              {t}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{body}</div>
    </div>
  )
}
