import { useState } from 'react'
import { useMarketData } from './hooks/useMarketData'
import Navbar, { type NavTab } from './components/Navbar'
import MarketHeader from './components/MarketHeader'
import OrderBook from './components/OrderBook'
import TradingChart from './components/TradingChart'
import OrderForm from './components/OrderForm'
import BottomPanel from './components/BottomPanel'
import MarketsList from './components/MarketsList'
import EarnPage from './components/EarnPage'
import VaultsPage from './components/VaultsPage'
import StakingPage from './components/StakingPage'
import GatewayPage from './components/GatewayPage'
import MarketsPage from './components/MarketsPage'

// Placeholder for portfolio/markets/leaderboard
function ComingSoonPage({ title }: { title: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: 'var(--bg)' }}>
      <div style={{ fontSize: 32 }}>📊</div>
      <h2 className="display" style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
        {title}
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>Coming soon — check back later.</p>
    </div>
  )
}

export default function App() {
  const { markets, activeSymbol, activeMarket, orderBook, trades, candles, switchMarket } = useMarketData()
  const [activeTab, setActiveTab] = useState<NavTab>('Trade')
  const [showMarkets, setShowMarkets] = useState(false)
  const [formPrice, setFormPrice] = useState(activeMarket.markPrice)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--bg)',
        overflow: 'hidden',
      }}
    >
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'Trade' && (
        <>
          <MarketHeader
            market={activeMarket}
            onOpenMarkets={() => setShowMarkets(true)}
          />

          {/* Main trading area */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
            <OrderBook
              orderBook={orderBook}
              market={activeMarket}
              onPriceClick={setFormPrice}
            />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
                <TradingChart candles={candles} />
              </div>
              <BottomPanel trades={trades} market={activeMarket} />
            </div>

            <OrderForm
              market={activeMarket}
              price={formPrice}
              onPriceChange={setFormPrice}
            />
          </div>

          {showMarkets && (
            <MarketsList
              markets={markets}
              activeSymbol={activeSymbol}
              onSelect={switchMarket}
              onClose={() => setShowMarkets(false)}
            />
          )}
        </>
      )}

      {activeTab === 'Gateway' && <GatewayPage />}
      {activeTab === 'Earn' && <EarnPage />}
      {activeTab === 'Vaults' && <VaultsPage />}
      {activeTab === 'Staking' && <StakingPage />}
      {activeTab === 'Portfolio' && <ComingSoonPage title="Portfolio" />}
      {activeTab === 'Markets' && <MarketsPage />}
      {activeTab === 'Leaderboard' && <ComingSoonPage title="Leaderboard" />}
    </div>
  )
}
