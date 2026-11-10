import { ConnectKitButton } from 'connectkit'
import { BarChart2 } from 'lucide-react'

export type NavTab = 'Trade' | 'Swap' | 'Bridge' | 'Gateway' | 'Earn' | 'Vaults' | 'Staking' | 'Portfolio' | 'Markets' | 'Leaderboard' | 'About'

const NAV_ITEMS: { label: NavTab; group?: 'earn' | 'gateway' | 'swap' }[] = [
  { label: 'Trade' },
  { label: 'Swap', group: 'swap' },
  { label: 'Bridge', group: 'swap' },
  { label: 'Gateway', group: 'gateway' },
  { label: 'Earn', group: 'earn' },
  { label: 'Vaults', group: 'earn' },
  { label: 'Staking', group: 'earn' },
  { label: 'Portfolio' },
  { label: 'Markets' },
  { label: 'Leaderboard' },
  { label: 'About' },
]

interface Props {
  activeTab: NavTab
  onTabChange: (tab: NavTab) => void
}

export default function Navbar({ activeTab, onTabChange }: Props) {
  return (
    <nav
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        className="display"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--accent)',
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: '-0.04em',
          marginRight: 20,
          flexShrink: 0,
        }}
      >
        <img src="/logo.svg" alt="" width={30} height={24} style={{ display: 'block', height: 24, width: 'auto' }} />
        DexArcFi
      </div>

      {/* Nav links */}
      <div className="nav-scroll" style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, overflowX: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.label
          const isEarnGroup = item.group === 'earn'
          const isGateway = item.group === 'gateway'
          const isSwap = item.group === 'swap'
          const activeColor = isGateway ? '#63cab7' : isSwap ? '#a78bfa' : 'var(--accent)'
          const inactiveColor = isGateway ? '#63cab7cc' : isSwap ? '#a78bfaaa' : isEarnGroup ? 'var(--ink-2)' : 'var(--muted)'
          const activeBg = isGateway ? 'rgba(99,202,183,0.12)' : isSwap ? 'rgba(167,139,250,0.12)' : 'rgba(59,130,246,0.12)'
          const hoverBg = isGateway ? 'rgba(99,202,183,0.08)' : isSwap ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.04)'
          return (
            <button
              key={item.label}
              onClick={() => onTabChange(item.label)}
              style={{
                background: isActive ? activeBg : 'none',
                border: 'none',
                color: isActive ? activeColor : inactiveColor,
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                padding: '6px 10px',
                whiteSpace: 'nowrap' as const,
                flexShrink: 0,
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'color 0.15s, background 0.15s',
                borderBottom: isEarnGroup && !isActive ? '1px dashed rgba(255,255,255,0.15)' : 'none',
                position: 'relative' as const,
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = activeColor
                  e.currentTarget.style.background = hoverBg
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = inactiveColor
                  e.currentTarget.style.background = 'none'
                }
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--success)',
            padding: '4px 10px',
            background: 'var(--success-dim)',
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--success)',
              display: 'inline-block',
              boxShadow: '0 0 6px var(--success)',
            }}
          />
          Arc Testnet
        </div>

        <BarChart2 size={16} color="var(--muted)" style={{ cursor: 'pointer' }} />

        <ConnectKitButton.Custom>
          {({ isConnected, show, address }) => (
            <button
              onClick={show}
              style={{
                background: isConnected ? 'var(--surface-strong)' : 'var(--accent)',
                border: isConnected ? '1px solid var(--border-strong)' : 'none',
                color: isConnected ? 'var(--ink)' : '#fff',
                padding: isConnected ? '6px 12px' : '7px 16px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'opacity 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {isConnected && address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : 'Connect Wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </nav>
  )
}
