/**
 * DexArcFi risk agent: pure risk math. No React, no network, no wallet access.
 * Shared by the Agent tab, the pre-trade panel and the MCP server, so every
 * surface gives the same numbers.
 *
 * Model: isolated margin, 1% maintenance margin, fees and funding ignored.
 * These are estimates for decision support, not a promise of where a venue
 * would liquidate a position.
 */

export type Side = 'long' | 'short'
export type RiskLevel = 'low' | 'moderate' | 'high' | 'dangerous'

export const MAINTENANCE_MARGIN = 0.01
export const MAX_LEVERAGE = 50
/** Leverage at or above this is flagged as dangerous. */
export const DANGEROUS_LEVERAGE = 20
/** Leverage the agent recommends as an upper bound. */
export const SAFER_LEVERAGE = 10

function assertPositive(name: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a positive number`)
}

function assertLeverage(lev: number): void {
  if (!Number.isFinite(lev) || lev < 1 || lev > MAX_LEVERAGE) {
    throw new Error(`leverage must be between 1 and ${MAX_LEVERAGE}`)
  }
}

export function liquidationPrice(side: Side, entry: number, leverage: number, mmr = MAINTENANCE_MARGIN): number {
  assertPositive('entry price', entry)
  assertLeverage(leverage)
  return side === 'long' ? entry * (1 - 1 / leverage + mmr) : entry * (1 + 1 / leverage - mmr)
}

/** Percent the mark price can still move against the position before liquidation. Negative means already past it. */
export function liquidationDistancePct(side: Side, mark: number, liq: number): number {
  assertPositive('mark price', mark)
  return side === 'long' ? ((mark - liq) / mark) * 100 : ((liq - mark) / mark) * 100
}

export function classifyLeverage(leverage: number): RiskLevel {
  if (leverage >= DANGEROUS_LEVERAGE) return 'dangerous'
  if (leverage > SAFER_LEVERAGE) return 'high'
  if (leverage > 5) return 'moderate'
  return 'low'
}

export interface TradeInput {
  side: Side
  entryPrice: number
  leverage: number
  /** Current mark price; defaults to the entry price for a new trade. */
  markPrice?: number
  marginUsd?: number
  balanceUsd?: number
}

export interface TradeAssessment {
  liquidationPrice: number
  distancePct: number
  level: RiskLevel
  warnings: string[]
  suggestedLeverage: number
  suggestedStopPct: number
  suggestedStopPrice: number
  suggestedTakeProfitPrice: number
}

export function assessTrade(input: TradeInput): TradeAssessment {
  const { side, entryPrice, leverage } = input
  const mark = input.markPrice ?? entryPrice
  const liq = liquidationPrice(side, entryPrice, leverage)
  const distancePct = liquidationDistancePct(side, mark, liq)
  const level = classifyLeverage(leverage)

  const warnings: string[] = []
  if (distancePct <= 0) {
    warnings.push('This position is at or past its estimated liquidation price.')
  } else if (level === 'dangerous') {
    warnings.push(`${leverage}x is dangerous: a ${distancePct.toFixed(2)}% move against you wipes out the margin.`)
  } else if (level === 'high') {
    warnings.push(`${leverage}x is high leverage: only a ${distancePct.toFixed(2)}% move against you liquidates.`)
  }
  if (distancePct > 0 && distancePct < 5 && level !== 'dangerous') {
    warnings.push(`Liquidation is only ${distancePct.toFixed(2)}% away.`)
  }
  if (input.marginUsd && input.balanceUsd && input.balanceUsd > 0) {
    const share = (input.marginUsd / input.balanceUsd) * 100
    if (share > 50) warnings.push(`This trade puts ${share.toFixed(0)}% of your balance at risk as margin.`)
  }

  const suggestedLeverage = Math.min(leverage, SAFER_LEVERAGE)
  const safeDistance = (1 / suggestedLeverage - MAINTENANCE_MARGIN) * 100
  const suggestedStopPct = Math.max(0.5, Math.min(5, safeDistance / 2))
  const stop = suggestedStopPct / 100
  const suggestedStopPrice = side === 'long' ? entryPrice * (1 - stop) : entryPrice * (1 + stop)
  const suggestedTakeProfitPrice = side === 'long' ? entryPrice * (1 + 2 * stop) : entryPrice * (1 - 2 * stop)

  return {
    liquidationPrice: liq,
    distancePct,
    level,
    warnings,
    suggestedLeverage,
    suggestedStopPct,
    suggestedStopPrice,
    suggestedTakeProfitPrice,
  }
}

export interface SizeSuggestion {
  marginUsd: number
  notionalUsd: number
  /** Loss if the stop is hit. */
  riskUsd: number
  riskPctOfBalance: number
  cappedByMaxMargin: boolean
}

/** Share of the balance one trade may lock up as margin. */
export const MAX_MARGIN_SHARE = 0.25

/** Size a trade so that hitting the stop loses about `riskPct` of the balance. */
export function suggestPositionSize(args: {
  balanceUsd: number
  leverage: number
  stopPct: number
  riskPct?: number
}): SizeSuggestion {
  const { balanceUsd, leverage, stopPct } = args
  const riskPct = args.riskPct ?? 1
  assertPositive('balance', balanceUsd)
  assertPositive('stop distance', stopPct)
  assertPositive('risk percent', riskPct)
  assertLeverage(leverage)

  const wantedRisk = (balanceUsd * riskPct) / 100
  let notional = wantedRisk / (stopPct / 100)
  let margin = notional / leverage
  const maxMargin = balanceUsd * MAX_MARGIN_SHARE
  let capped = false
  if (margin > maxMargin) {
    margin = maxMargin
    notional = margin * leverage
    capped = true
  }
  const riskUsd = notional * (stopPct / 100)
  return { marginUsd: margin, notionalUsd: notional, riskUsd, riskPctOfBalance: (riskUsd / balanceUsd) * 100, cappedByMaxMargin: capped }
}

export function positionPnl(side: Side, entry: number, mark: number, notionalUsd: number): number {
  assertPositive('entry price', entry)
  return side === 'long' ? notionalUsd * (mark / entry - 1) : notionalUsd * (1 - mark / entry)
}

export interface PositionInput {
  market: string
  side: Side
  entryPrice: number
  markPrice: number
  leverage: number
  marginUsd: number
}

export interface StressRow {
  shockPct: number
  pnlUsd: number
  equityUsd: number
  liquidated: boolean
}

/** What happens to one position if every price moves by each shock (percent). */
export function stressPosition(p: PositionInput, shocks: number[]): StressRow[] {
  const liq = liquidationPrice(p.side, p.entryPrice, p.leverage)
  const notional = p.marginUsd * p.leverage
  return shocks.map((shockPct) => {
    const price = p.markPrice * (1 + shockPct / 100)
    const liquidated = p.side === 'long' ? price <= liq : price >= liq
    const pnl = positionPnl(p.side, p.entryPrice, price, notional)
    return { shockPct, pnlUsd: liquidated ? -p.marginUsd : pnl, equityUsd: liquidated ? 0 : p.marginUsd + pnl, liquidated }
  })
}
