import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import type { Market } from '../hooks/useMarketData'
import TradeHistory from './TradeHistory'
import type { Trade } from '../hooks/useMarketData'

interface Props {
  trades: Trade[]
  market: Market
}

const TABS = ['Positions', 'Open Orders', 'Trade History', 'Funding History', 'Portfolio']

export default function BottomPanel({ trades, market }: Props) {
  const [tab, setTab] = useState('Positions')
  const { isConnected } = useAccount()

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: 220,
        flexShrink: 0,
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {TABS.map(t => (
          <button
            key={t}
            className={`tab-base ${tab === t ? 'tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'Trade History' ? (
          <TradeHistory trades={trades} baseAsset={market.baseAsset} />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
            }}
          >
            {!isConnected ? (
              <>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  Connect your wallet to view {tab.toLowerCase()}
                </span>
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <button
                      onClick={show}
                      style={{
                        background: 'var(--accent)',
                        border: 'none',
                        color: '#fff',
                        padding: '8px 20px',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif',
                      }}
                    >
                      Connect Wallet
                    </button>
                  )}
                </ConnectKitButton.Custom>
              </>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>No {tab.toLowerCase()} yet</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
