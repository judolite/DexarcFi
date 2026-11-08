import type { ReactNode } from 'react'
import {
  Activity, ArrowLeftRight, BarChart3, Coins, Globe, Landmark, Layers, Link2, Shield, Timer, Wallet, Zap, ChevronRight,
} from 'lucide-react'
import type { NavTab } from './Navbar'

interface Props {
  onNavigate: (tab: NavTab) => void
}

interface Highlight {
  tab: NavTab
  icon: ReactNode
  title: string
  body: string
}

const ICON = 18

const HIGHLIGHTS: Highlight[] = [
  { tab: 'Trade', icon: <Activity size={ICON} />, title: 'Trade', body: 'A perpetuals terminal with an order book, candlestick chart and long or short orders up to 50x leverage. Positions, open orders, trade history and PnL are tracked per wallet.' },
  { tab: 'Swap', icon: <ArrowLeftRight size={ICON} />, title: 'Swap', body: 'Swap between USDC, EURC and cirBTC. You see a quote before you confirm anything.' },
  { tab: 'Bridge', icon: <Link2 size={ICON} />, title: 'Bridge', body: 'Move USDC into and out of Arc with Solana, Monad and Hyperliquid using Circle CCTP. Circle completes the final step on the destination, so new users need no gas there up front.' },
  { tab: 'Gateway', icon: <Globe size={ICON} />, title: 'Gateway', body: 'Hold one unified USDC balance across several chains and move it where you need it.' },
  { tab: 'Earn', icon: <Coins size={ICON} />, title: 'Earn', body: 'Supply assets to earn yield from a lending market.' },
  { tab: 'Vaults', icon: <Landmark size={ICON} />, title: 'Vaults', body: 'Deposit into strategy vaults and compare return, drawdown and lock period before you commit.' },
  { tab: 'Staking', icon: <Layers size={ICON} />, title: 'Staking', body: 'Delegate to validators and compare uptime, commission and estimated APR.' },
  { tab: 'Markets', icon: <BarChart3 size={ICON} />, title: 'Markets, Portfolio and Leaderboard', body: 'Live market prices, your balances and history, and trader rankings in one place.' },
]

const WHY_ARC: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Wallet size={ICON} />, title: 'USDC is the gas token', body: 'Every action is paid for in the same dollar asset you trade with. There is no separate gas token to buy first.' },
  { icon: <Shield size={ICON} />, title: 'Predictable fees', body: 'Fees are denominated in dollars, so the cost of an action is easy to understand before you sign.' },
  { icon: <Timer size={ICON} />, title: 'Sub-second finality', body: 'Transactions confirm fast enough that trading and swapping feel immediate.' },
]

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14 } as const
const eyebrow = { fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 } as const

function IconBox({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </div>
  )
}

export default function AboutPage({ onNavigate }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 40px 64px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'rgba(59,130,246,0.12)', padding: '4px 10px', borderRadius: 999, marginBottom: 16, letterSpacing: '0.04em' }}>
            <Zap size={12} fill="var(--accent)" /> Testnet preview on Arc
          </div>
          <h1 className="display" style={{ fontSize: 44, fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px', letterSpacing: '-0.04em', lineHeight: 1.05, textWrap: 'balance' }}>
            About DexArcFi
          </h1>
          <p style={{ fontSize: 17, color: 'var(--ink-2)', margin: '0 0 14px', maxWidth: '62ch', lineHeight: 1.65, textWrap: 'pretty' }}>
            DexArcFi is a trading and DeFi hub built on Arc, Circle&apos;s blockchain where USDC is the native gas token. It brings perpetual trading, swaps, bridging, lending, vaults and staking into one app, all paid for in USDC.
          </p>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: '62ch', lineHeight: 1.65, textWrap: 'pretty' }}>
            DexArcFi currently runs on Arc Testnet with test funds, so you can try every feature before anything touches real money.
          </p>
        </div>

        {/* Why Arc */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...eyebrow, marginBottom: 14 }}>Why Arc</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {WHY_ARC.map(w => (
              <div key={w.title} style={{ ...card, padding: '20px 22px' }}>
                <IconBox>{w.icon}</IconBox>
                <h3 className="display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '14px 0 6px', letterSpacing: '-0.01em' }}>{w.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{w.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Highlights */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ ...eyebrow, marginBottom: 14 }}>Highlights</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {HIGHLIGHTS.map(h => (
              <button
                key={h.title}
                onClick={() => onNavigate(h.tab)}
                style={{ ...card, padding: '18px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'flex-start', fontFamily: 'DM Sans, sans-serif', transition: 'border-color 0.15s, background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                <IconBox>{h.icon}</IconBox>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span className="display" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{h.title}</span>
                    <ChevronRight size={14} color="var(--subtle)" />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>{h.body}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Testnet note */}
        <div style={{ ...card, padding: '22px 24px', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Shield size={16} color="#fbbf24" />
            <span className="display" style={{ fontSize: 15, fontWeight: 600, color: '#fbbf24' }}>What to know about the testnet preview</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: '72ch' }}>
            <li>Everything runs on Arc Testnet. Do not send real mainnet funds.</li>
            <li>Margin, stake and vault deposits are real test USDC transfers, sent to placeholder addresses because the trading, lending, vault and staking contracts are not deployed yet.</li>
            <li>Positions and PnL are tracked in your browser, and closing a position does not return USDC.</li>
            <li>Prices on the Trade tab are simulated. The Markets tab shows live prices.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
