import { useState, useEffect, useRef, useCallback } from 'react'

export interface Market {
  symbol: string
  baseAsset: string
  markPrice: number
  indexPrice: number
  fundingRate: number
  openInterest: number
  volume24h: number
  change24h: number
  high24h: number
  low24h: number
}

export interface OrderBookLevel {
  price: number
  size: number
  total: number
}

export interface OrderBook {
  bids: OrderBookLevel[]
  asks: OrderBookLevel[]
  spread: number
  spreadPct: number
  midPrice: number
}

export interface Trade {
  price: number
  size: number
  side: 'buy' | 'sell'
  time: string
  ts: number
}

export interface CandlePoint {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const MARKETS: Market[] = [
  { symbol: 'USDC-PERP', baseAsset: 'USDC', markPrice: 1.0002, indexPrice: 1.0001, fundingRate: 0.000013, openInterest: 4_200_000, volume24h: 12_800_000, change24h: 0.02, high24h: 1.0008, low24h: 0.9995 },
  { symbol: 'ETH-PERP', baseAsset: 'ETH', markPrice: 3412.5, indexPrice: 3411.8, fundingRate: 0.000082, openInterest: 89_200_000, volume24h: 420_000_000, change24h: 1.4, high24h: 3445.0, low24h: 3375.0 },
  { symbol: 'BTC-PERP', baseAsset: 'BTC', markPrice: 67_450.0, indexPrice: 67_438.5, fundingRate: 0.000110, openInterest: 540_000_000, volume24h: 1_200_000_000, change24h: 0.8, high24h: 68_200.0, low24h: 66_900.0 },
  // Circle native Arc assets
  { symbol: 'EURC-PERP', baseAsset: 'EURC', markPrice: 1.0832, indexPrice: 1.0831, fundingRate: 0.000008, openInterest: 3_100_000, volume24h: 8_400_000, change24h: 0.11, high24h: 1.0851, low24h: 1.0808 },
  { symbol: 'cirBTC-PERP', baseAsset: 'cirBTC', markPrice: 67_450.0, indexPrice: 67_438.5, fundingRate: 0.000105, openInterest: 220_000_000, volume24h: 480_000_000, change24h: 0.8, high24h: 68_200.0, low24h: 66_900.0 },
  { symbol: 'SOL-PERP', baseAsset: 'SOL', markPrice: 168.42, indexPrice: 168.35, fundingRate: 0.000095, openInterest: 34_000_000, volume24h: 95_000_000, change24h: -0.5, high24h: 172.8, low24h: 165.9 },
  { symbol: 'ARB-PERP', baseAsset: 'ARB', markPrice: 0.8821, indexPrice: 0.8815, fundingRate: -0.000043, openInterest: 9_800_000, volume24h: 18_500_000, change24h: -1.2, high24h: 0.905, low24h: 0.871 },
  { symbol: 'AVAX-PERP', baseAsset: 'AVAX', markPrice: 38.74, indexPrice: 38.71, fundingRate: 0.000067, openInterest: 14_100_000, volume24h: 31_000_000, change24h: 2.1, high24h: 39.5, low24h: 37.9 },
  { symbol: 'MATIC-PERP', baseAsset: 'MATIC', markPrice: 0.5423, indexPrice: 0.5419, fundingRate: 0.000021, openInterest: 7_200_000, volume24h: 11_400_000, change24h: 0.3, high24h: 0.552, low24h: 0.534 },
  { symbol: 'LINK-PERP', baseAsset: 'LINK', markPrice: 13.28, indexPrice: 13.26, fundingRate: 0.000038, openInterest: 11_800_000, volume24h: 22_000_000, change24h: 1.7, high24h: 13.5, low24h: 12.95 },
  { symbol: 'OP-PERP', baseAsset: 'OP', markPrice: 1.842, indexPrice: 1.840, fundingRate: -0.000025, openInterest: 6_400_000, volume24h: 9_200_000, change24h: -0.8, high24h: 1.875, low24h: 1.815 },
]

function generateOrderBook(midPrice: number, decimals: number): OrderBook {
  const tickSize = midPrice > 10000 ? 0.5 : midPrice > 100 ? 0.01 : midPrice > 1 ? 0.001 : 0.00001
  const asks: OrderBookLevel[] = []
  const bids: OrderBookLevel[] = []

  let askTotal = 0
  for (let i = 10; i >= 1; i--) {
    const price = parseFloat((midPrice + i * tickSize).toFixed(decimals))
    const size = parseFloat((Math.random() * 300 + 5).toFixed(2))
    askTotal += size
    asks.unshift({ price, size, total: parseFloat(askTotal.toFixed(2)) })
  }

  let bidTotal = 0
  for (let i = 1; i <= 10; i++) {
    const price = parseFloat((midPrice - i * tickSize).toFixed(decimals))
    const size = parseFloat((Math.random() * 300 + 5).toFixed(2))
    bidTotal += size
    bids.push({ price, size, total: parseFloat(bidTotal.toFixed(2)) })
  }

  const spread = parseFloat((asks[0].price - bids[0].price).toFixed(decimals))
  const spreadPct = parseFloat(((spread / midPrice) * 100).toFixed(4))
  return { asks, bids, spread, spreadPct, midPrice: parseFloat(midPrice.toFixed(decimals)) }
}

function generateTrades(midPrice: number, decimals: number, count = 30): Trade[] {
  const trades: Trade[] = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell'
    const offset = (Math.random() - 0.5) * midPrice * 0.002
    const price = parseFloat((midPrice + offset).toFixed(decimals))
    const size = parseFloat((Math.random() * 100 + 0.1).toFixed(3))
    const ts = now - i * (Math.random() * 2000 + 500)
    const d = new Date(ts)
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
    trades.push({ price, size, side, time, ts })
  }
  return trades.sort((a, b) => b.ts - a.ts)
}

function generateCandles(basePrice: number, count = 120): CandlePoint[] {
  const candles: CandlePoint[] = []
  let price = basePrice * 0.95
  const now = Math.floor(Date.now() / 60000) * 60000
  for (let i = count; i >= 0; i--) {
    const open = price
    const change = (Math.random() - 0.48) * price * 0.008
    const close = open + change
    const high = Math.max(open, close) + Math.random() * price * 0.003
    const low = Math.min(open, close) - Math.random() * price * 0.003
    const volume = Math.random() * 500 + 50
    candles.push({ time: now - i * 60000, open, high, low, close, volume })
    price = close
  }
  return candles
}

export function useMarketData() {
  const [markets] = useState<Market[]>(MARKETS)
  const [activeSymbol, setActiveSymbol] = useState('ETH-PERP')
  const [activeMarket, setActiveMarket] = useState<Market>(MARKETS[1])
  const [orderBook, setOrderBook] = useState<OrderBook>(() => generateOrderBook(MARKETS[1].markPrice, 2))
  const [trades, setTrades] = useState<Trade[]>(() => generateTrades(MARKETS[1].markPrice, 2))
  const [candles, setCandles] = useState<CandlePoint[]>(() => generateCandles(MARKETS[1].markPrice))
  const priceRef = useRef(MARKETS[1].markPrice)

  const switchMarket = useCallback((symbol: string) => {
    const m = MARKETS.find(m => m.symbol === symbol)
    if (!m) return
    setActiveSymbol(symbol)
    setActiveMarket(m)
    priceRef.current = m.markPrice
    const dec = m.markPrice > 10000 ? 1 : m.markPrice > 100 ? 2 : m.markPrice > 1 ? 4 : 6
    setOrderBook(generateOrderBook(m.markPrice, dec))
    setTrades(generateTrades(m.markPrice, dec))
    setCandles(generateCandles(m.markPrice))
  }, [])

  // Simulate live price updates
  useEffect(() => {
    const interval = setInterval(() => {
      const drift = (Math.random() - 0.499) * priceRef.current * 0.0005
      priceRef.current = priceRef.current + drift
      const p = priceRef.current
      const dec = p > 10000 ? 1 : p > 100 ? 2 : p > 1 ? 4 : 6

      setActiveMarket(prev => ({
        ...prev,
        markPrice: parseFloat(p.toFixed(dec)),
        change24h: parseFloat((prev.change24h + (Math.random() - 0.5) * 0.01).toFixed(3)),
      }))
      setOrderBook(generateOrderBook(p, dec))

      // Add new trade occasionally
      if (Math.random() > 0.4) {
        const side: 'buy' | 'sell' = Math.random() > 0.5 ? 'buy' : 'sell'
        const now = new Date()
        const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
        const newTrade: Trade = {
          price: parseFloat((p + (Math.random() - 0.5) * p * 0.001).toFixed(dec)),
          size: parseFloat((Math.random() * 80 + 0.1).toFixed(3)),
          side,
          time,
          ts: Date.now(),
        }
        setTrades(prev => [newTrade, ...prev.slice(0, 49)])
      }

      // Update last candle
      setCandles(prev => {
        if (!prev.length) return prev
        const last = { ...prev[prev.length - 1] }
        last.close = parseFloat(p.toFixed(dec))
        last.high = Math.max(last.high, last.close)
        last.low = Math.min(last.low, last.close)
        last.volume += Math.random() * 5
        return [...prev.slice(0, -1), last]
      })
    }, 800)

    return () => clearInterval(interval)
  }, [activeSymbol])

  return { markets, activeSymbol, activeMarket, orderBook, trades, candles, switchMarket }
}
