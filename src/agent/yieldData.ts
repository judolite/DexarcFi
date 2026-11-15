/**
 * Yield options the agent compares for idle USDC.
 *
 * These are the rates DexArcFi displays on its Earn, Vaults and Staking tabs.
 * They are testnet display values, not live market rates, and every agent
 * output that uses them says so. Keep this list in step with those tabs.
 */

export type YieldKind = 'earn' | 'vault' | 'staking'
export type YieldRisk = 'very low' | 'low' | 'low-medium' | 'medium' | 'high'
export type Tier = 'conservative' | 'balanced' | 'aggressive'

export interface YieldOption {
  id: string
  kind: YieldKind
  name: string
  apy: number
  /** Days funds are locked. null when the tab does not state a period. */
  lockDays: number | null
  risk: YieldRisk
  tier: Tier
  note: string
}

export const YIELD_OPTIONS: YieldOption[] = [
  { id: 'earn-usdc', kind: 'earn', name: 'Earn: USDC supply', apy: 3.44, lockDays: 0, risk: 'very low', tier: 'conservative', note: 'Withdraw any time' },
  { id: 'staking-arc', kind: 'staking', name: 'Staking: Arc validators', apy: 2.2, lockDays: null, risk: 'low', tier: 'conservative', note: 'Network average APR. Unbonding period is not modelled' },
  { id: 'vault-hyperbase', kind: 'vault', name: 'Vault: HyperBase USDC Yield', apy: 8.2, lockDays: 1, risk: 'very low', tier: 'conservative', note: 'Lending yield plus basis trade' },
  { id: 'vault-delta', kind: 'vault', name: 'Vault: Arc Delta Neutral', apy: 18.4, lockDays: 7, risk: 'low', tier: 'balanced', note: 'Funding rate arbitrage' },
  { id: 'vault-pair', kind: 'vault', name: 'Vault: BTC-ETH Pair Trade', apy: 14.1, lockDays: 7, risk: 'low-medium', tier: 'balanced', note: 'Mean-reverting pair strategy' },
  { id: 'vault-vol', kind: 'vault', name: 'Vault: Volatility Harvester', apy: 26.3, lockDays: 14, risk: 'high', tier: 'aggressive', note: 'Sells volatility, can lose in sharp moves' },
  { id: 'vault-momentum', kind: 'vault', name: 'Vault: Momentum Alpha', apy: 34.7, lockDays: 3, risk: 'medium', tier: 'aggressive', note: 'Trend following at 3-5x leverage' },
]

const RISK_PENALTY: Record<YieldRisk, number> = {
  'very low': 0,
  low: 1,
  'low-medium': 2.5,
  medium: 4,
  high: 7,
}

/** APY minus a penalty for risk and for lock-up time, in percentage points. */
export function riskAdjustedScore(o: YieldOption): number {
  return o.apy - RISK_PENALTY[o.risk] - 0.05 * (o.lockDays ?? 7)
}

export interface IdlePick {
  tier: Tier
  option: YieldOption
  amountUsd: number
  expectedYearlyUsd: number
  reason: string
}

export interface IdlePlan {
  reserveUsd: number
  deployableUsd: number
  picks: IdlePick[]
  blendedApyPct: number
  expectedYearlyUsd: number
  ranked: Array<YieldOption & { score: number }>
  simulatedRates: true
}

const WEIGHTS: Record<Tier, number> = { conservative: 0.6, balanced: 0.3, aggressive: 0.1 }

/** Leave a gas and safety reserve, then spread the rest across risk tiers. */
export function planIdleFunds(idleUsd: number, reserveUsd = 1, options: YieldOption[] = YIELD_OPTIONS): IdlePlan {
  if (!Number.isFinite(idleUsd) || idleUsd < 0) throw new Error('idle amount must be zero or more')
  const ranked = options
    .map((o) => ({ ...o, score: riskAdjustedScore(o) }))
    .sort((a, b) => b.score - a.score)
  const deployable = Math.max(0, idleUsd - reserveUsd)

  const picks: IdlePick[] = []
  if (deployable >= 1) {
    for (const tier of ['conservative', 'balanced', 'aggressive'] as const) {
      const best = ranked.find((o) => o.tier === tier)
      if (!best) continue
      const amountUsd = deployable * WEIGHTS[tier]
      picks.push({
        tier,
        option: best,
        amountUsd,
        expectedYearlyUsd: (amountUsd * best.apy) / 100,
        reason: `${best.name}: ${best.apy.toFixed(2)}% APY, ${best.risk} risk, ${best.lockDays === null ? 'unbonding applies' : best.lockDays === 0 ? 'no lock' : `${best.lockDays} day lock`}.`,
      })
    }
  }
  const expectedYearlyUsd = picks.reduce((s, p) => s + p.expectedYearlyUsd, 0)
  return {
    reserveUsd,
    deployableUsd: deployable,
    picks,
    blendedApyPct: deployable > 0 && picks.length ? (expectedYearlyUsd / deployable) * 100 : 0,
    expectedYearlyUsd,
    ranked,
    simulatedRates: true,
  }
}
