import { useSyncExternalStore } from 'react'

/**
 * Per-wallet record of confirmed trades. Entries are written only after the
 * margin transfer is confirmed onchain, and are de-duplicated by tx hash so a
 * re-render or retry can never create a second position.
 */

export type Side = 'long' | 'short'

export interface Position {
  id: string // tx hash of the margin transfer
  market: string
  baseAsset: string
  side: Side
  leverage: number
  margin: number // USDC
  entryPrice: number
  sizeBase: number // notional / entryPrice
  openedAt: number
  txHash: string
}

export interface OpenOrder {
  id: string
  market: string
  baseAsset: string
  side: Side
  orderType: string
  leverage: number
  margin: number
  limitPrice: number
  createdAt: number
  txHash: string
}

export interface Fill {
  id: string
  market: string
  baseAsset: string
  side: Side
  kind: 'open' | 'close'
  price: number
  sizeBase: number
  margin: number
  pnl: number | null
  time: number
  txHash: string
}

interface WalletState {
  positions: Position[]
  orders: OpenOrder[]
  fills: Fill[]
}

const KEY = 'dexarcfi.trading.v1'
const EMPTY: WalletState = { positions: [], orders: [], fills: [] }

type AllState = Record<string, WalletState>

let cache: AllState | null = null
const listeners = new Set<() => void>()

function load(): AllState {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as AllState) : {}
  } catch {
    cache = {}
  }
  return cache
}

function commit(next: AllState) {
  cache = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage full or blocked */ }
  listeners.forEach(l => l())
}

function walletState(addr: string): WalletState {
  return load()[addr.toLowerCase()] ?? EMPTY
}

function update(addr: string, fn: (s: WalletState) => WalletState) {
  const all = load()
  const k = addr.toLowerCase()
  commit({ ...all, [k]: fn(all[k] ?? EMPTY) })
}

export function recordPosition(addr: string, p: Position) {
  update(addr, s => {
    if (s.positions.some(x => x.id === p.id) || s.fills.some(f => f.id === p.id + ':open')) return s
    const fill: Fill = {
      id: p.id + ':open', market: p.market, baseAsset: p.baseAsset, side: p.side, kind: 'open',
      price: p.entryPrice, sizeBase: p.sizeBase, margin: p.margin, pnl: null, time: p.openedAt, txHash: p.txHash,
    }
    return { ...s, positions: [p, ...s.positions], fills: [fill, ...s.fills] }
  })
}

export function recordOrder(addr: string, o: OpenOrder) {
  update(addr, s => (s.orders.some(x => x.id === o.id) ? s : { ...s, orders: [o, ...s.orders] }))
}

export function cancelOrder(addr: string, id: string) {
  update(addr, s => ({ ...s, orders: s.orders.filter(o => o.id !== id) }))
}

/** Fill a resting limit order: it becomes a position at its limit price. */
export function fillOrder(addr: string, id: string) {
  update(addr, s => {
    const o = s.orders.find(x => x.id === id)
    if (!o) return s
    const pos: Position = {
      id: o.id, market: o.market, baseAsset: o.baseAsset, side: o.side, leverage: o.leverage, margin: o.margin,
      entryPrice: o.limitPrice, sizeBase: (o.margin * o.leverage) / o.limitPrice, openedAt: Date.now(), txHash: o.txHash,
    }
    const fill: Fill = {
      id: o.id + ':open', market: o.market, baseAsset: o.baseAsset, side: o.side, kind: 'open',
      price: o.limitPrice, sizeBase: pos.sizeBase, margin: o.margin, pnl: null, time: pos.openedAt, txHash: o.txHash,
    }
    return { ...s, orders: s.orders.filter(x => x.id !== id), positions: [pos, ...s.positions], fills: [fill, ...s.fills] }
  })
}

export function closePosition(addr: string, id: string, markPrice: number) {
  update(addr, s => {
    const p = s.positions.find(x => x.id === id)
    if (!p) return s
    const pnl = unrealizedPnl(p, markPrice)
    const fill: Fill = {
      id: p.id + ':close', market: p.market, baseAsset: p.baseAsset, side: p.side, kind: 'close',
      price: markPrice, sizeBase: p.sizeBase, margin: p.margin, pnl, time: Date.now(), txHash: p.txHash,
    }
    return { ...s, positions: s.positions.filter(x => x.id !== id), fills: [fill, ...s.fills] }
  })
}

export function unrealizedPnl(p: Position, mark: number): number {
  const diff = p.side === 'long' ? mark - p.entryPrice : p.entryPrice - mark
  return diff * p.sizeBase
}

export function useTradingState(addr: string | undefined): WalletState {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => (addr ? walletState(addr) : EMPTY),
    () => EMPTY,
  )
}
