import { useMemo } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { Bot, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react'
import { useTradingState, unrealizedPnl } from '@/tradingStore'
import { useDeposits, totalsByKind, type Deposit } from '@/depositStore'
import { getUsdc } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { assessTrade, type RiskLevel, type TradeAssessment } from '@/agent/riskMath'
import { planIdleFunds, YIELD_OPTIONS } from '@/agent/yieldData'
import type { Market } from '@/hooks/useMarketData'
import type { NavTab } from './Navbar'
import AgentIdentityCard from './AgentIdentityCard'

const ARC_TESTNET_ID = 5042002

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }
const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }
const LEVEL_COLOR: Record<RiskLevel, string> = { low: 'var(--success)', moderate: 'var(--accent)', high: '#f5a524', dangerous: 'var(--danger)' }

const usd = (n: number) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const signed = (n: number) => (n >= 0 ? '+' : '') + usd(n)

function depositApy(d: Deposit): number {
  const id = d.kind === 'earn' ? 'earn-usdc' : d.kind === 'staking' ? 'staking-arc' : undefined
  const opt = id ? YIELD_OPTIONS.find((o) => o.id === id) : YIELD_OPTIONS.find((o) => o.name === `Vault: ${d.name}`)
  return opt?.apy ?? 0
}

function Stat({ title, value, sub, color }: { title: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={card}>
      <div style={eyebrow}>{title}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--ink)', margin: '8px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--subtle)' }}>{sub}</div>}
    </div>
  )
}

interface Props {
  markets: Market[]
  onNavigate: (tab: NavTab) => void
}

export default function AgentPage({ markets, onNavigate }: Props) {
  const { address, isConnected } = useAccount()
  const { positions, orders, fills } = useTradingState(address)
  const deposits = useDeposits(address)

  const usdc = getUsdc(ARC_TESTNET_ID)
  const { data: rawBal } = useReadContract({
    address: usdc?.address as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined, chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!usdc, refetchInterval: 15_000 },
  })
  const walletUsdc = rawBal != null ? parseFloat(Amount.fromRaw(rawBal, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)) : 0

  const prices = useMemo(() => Object.fromEntries(markets.map((m) => [m.symbol, m.markPrice])), [markets])

  const rows = positions.map((p) => {
    const mark = prices[p.market] ?? p.entryPrice
    let a: TradeAssessment | null = null
    try {
      a = assessTrade({ side: p.side, entryPrice: p.entryPrice, leverage: p.leverage, markPrice: mark, marginUsd: p.margin, balanceUsd: walletUsdc || undefined })
    } catch {
      a = null
    }
    return { p, mark, a, pnl: unrealizedPnl(p, mark) }
  })

  const totalMargin = positions.reduce((s, p) => s + p.margin, 0)
  const unrealized = rows.reduce((s, r) => s + r.pnl, 0)
  const realized = fills.reduce((s, f) => s + (f.kind === 'close' && f.pnl != null ? f.pnl : 0), 0)
  const depositTotals = totalsByKind(deposits)
  const totalDeposited = depositTotals.earn + depositTotals.vault + depositTotals.staking
  const yearlyYield = deposits.reduce((s, d) => s + (d.token === 'USDC' ? (d.amount * depositApy(d)) / 100 : 0), 0)

  const closest = rows.filter((r) => r.a).sort((x, y) => (x.a?.distancePct ?? 0) - (y.a?.distancePct ?? 0))[0]
  const plan = useMemo(() => planIdleFunds(walletUsdc), [walletUsdc])

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 40px 64px' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 6 }}>
          <Bot size={26} color="var(--accent)" />
          <h1 className="display" style={{ fontSize: 30, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em' }}>Risk Agent</h1>
        </div>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 6px', maxWidth: '68ch', lineHeight: 1.6 }}>
          Tracks your positions, orders, PnL and yield deposits, checks risk before you trade, and suggests where idle USDC could work harder.
        </p>
        <p style={{ fontSize: 12, color: 'var(--subtle)', margin: '0 0 24px' }}>
          Suggestions only. The agent never places trades or moves funds, and its output is an estimate, not financial advice.
        </p>

        {!isConnected ? (
          <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '36px 20px', marginBottom: 28 }}>
            <Wallet size={28} color="var(--muted)" />
            <div style={{ color: 'var(--ink)', fontWeight: 600 }}>Connect a wallet to start tracking</div>
            <ConnectKitButton />
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 20 }}>
              <Stat title="Wallet USDC" value={usd(walletUsdc)} sub="Arc Testnet" />
              <Stat title="Margin in positions" value={usd(totalMargin)} sub={`${positions.length} open · ${orders.length} orders`} />
              <Stat title="Unrealized PnL" value={signed(unrealized)} color={unrealized >= 0 ? 'var(--success)' : 'var(--danger)'} sub="Live mark prices" />
              <Stat title="Realized PnL" value={signed(realized)} color={realized >= 0 ? 'var(--success)' : 'var(--danger)'} sub={`${fills.length} fills`} />
              <Stat title="Yield deposits" value={usd(totalDeposited)} sub={`Earn ${usd(depositTotals.earn)} · Vaults ${usd(depositTotals.vault)} · Staking ${usd(depositTotals.staking)}`} />
            </div>

            {/* Position risk */}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={eyebrow}>Position risk</span>
                {closest?.a && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: LEVEL_COLOR[closest.a.level], display: 'flex', gap: 5, alignItems: 'center' }}>
                    {closest.a.level === 'low' || closest.a.level === 'moderate' ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                    Closest to liquidation: {closest.p.market} at {closest.a.distancePct.toFixed(2)}%
                  </span>
                )}
              </div>
              {rows.length === 0 ? (
                <div style={{ color: 'var(--subtle)', fontSize: 13, padding: '10px 0' }}>
                  No open positions. Open one on the Trade tab and the agent will check it here and before you submit.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: 'var(--subtle)', textAlign: 'left', fontSize: 11 }}>
                        {['Market', 'Side', 'Lev', 'Entry', 'Mark', 'Liq. price', 'Distance', 'PnL', 'Suggestion'].map((h) => <th key={h} style={{ padding: '6px 8px', fontWeight: 600 }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ p, mark, a, pnl }) => (
                        <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--ink)' }}>{p.market}</td>
                          <td style={{ padding: '10px 8px', color: p.side === 'long' ? 'var(--buy)' : 'var(--sell)' }}>{p.side}</td>
                          <td className="mono" style={{ padding: '10px 8px', color: a ? LEVEL_COLOR[a.level] : 'var(--ink)', fontWeight: 700 }}>{p.leverage}x</td>
                          <td className="mono" style={{ padding: '10px 8px' }}>{p.entryPrice.toFixed(2)}</td>
                          <td className="mono" style={{ padding: '10px 8px' }}>{mark.toFixed(2)}</td>
                          <td className="mono" style={{ padding: '10px 8px' }}>{a ? a.liquidationPrice.toFixed(2) : '–'}</td>
                          <td className="mono" style={{ padding: '10px 8px', color: a ? LEVEL_COLOR[a.level] : 'var(--ink)' }}>{a ? a.distancePct.toFixed(2) + '%' : '–'}</td>
                          <td className="mono" style={{ padding: '10px 8px', color: pnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>{signed(pnl)}</td>
                          <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--muted)', maxWidth: 260 }}>
                            {a && a.level !== 'low' && a.level !== 'moderate'
                              ? `Cut to ${a.suggestedLeverage}x, stop near ${a.suggestedStopPrice.toFixed(2)}`
                              : a && a.distancePct <= 0 ? 'Past estimated liquidation: close or add margin'
                              : 'Within a sensible range'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 10 }}>
                Isolated margin, 1% maintenance, no fees or funding. Estimates for decision support.
              </div>
            </div>

            {/* Idle funds */}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={eyebrow}>Idle funds</span>
                <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Rates are testnet display values, not live market rates</span>
              </div>
              {plan.picks.length === 0 ? (
                <div style={{ color: 'var(--subtle)', fontSize: 13 }}>
                  {walletUsdc <= plan.reserveUsd ? 'Not enough idle USDC to deploy after keeping a $1 gas reserve.' : 'Nothing to suggest yet.'}
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {plan.picks.map((pick) => (
                      <div key={pick.tier} style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 12px', background: 'var(--surface-strong)', borderRadius: 8 }}>
                        <span style={{ ...eyebrow, color: 'var(--accent)' }}>{pick.tier}</span>
                        <div>
                          <div style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 13 }}>{pick.option.name}</div>
                          <div style={{ color: 'var(--subtle)', fontSize: 12 }}>{pick.reason}</div>
                        </div>
                        <div className="mono" style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink)' }}>
                          {usd(pick.amountUsd)}
                          <div style={{ fontSize: 11, color: 'var(--success)' }}>+{usd(pick.expectedYearlyUsd)}/yr</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Keeps {usd(plan.reserveUsd)} for gas. Blended {plan.blendedApyPct.toFixed(2)}% APY, about {usd(plan.expectedYearlyUsd)} a year at these rates.
                    </span>
                    {(['Earn', 'Vaults', 'Staking'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => onNavigate(t)} style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--ink)', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Open {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {deposits.length > 0 && (
                <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ ...eyebrow, marginBottom: 8 }}>Your deposits ({usd(yearlyYield)}/yr at displayed rates)</div>
                  {deposits.slice(0, 6).map((d) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', color: 'var(--muted)' }}>
                      <span>{d.kind} · {d.name}</span>
                      <span className="mono">{d.amount} {d.token}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 6 }}>These are testnet transfers to placeholder escrow addresses, so they show what you sent, not what you can withdraw.</div>
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ ...eyebrow, margin: '8px 0 12px' }}>Identity and access</div>
        <AgentIdentityCard />
      </div>
    </div>
  )
}
