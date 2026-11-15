import { useSyncExternalStore } from 'react'
import type { Config } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'

/**
 * Per-wallet record of confirmed Earn, Vault and Staking deposits. An entry is
 * written only after the transfer is confirmed onchain, keyed by tx hash so it
 * can never be recorded twice. The agent reads this to show your yield balances.
 *
 * These deposits are testnet transfers to placeholder escrow addresses. There
 * is no withdrawal, so a balance here means "sent", not "claimable".
 */

export type DepositKind = 'earn' | 'vault' | 'staking'

export interface Deposit {
  id: string // tx hash
  kind: DepositKind
  name: string // asset, vault or validator
  token: string
  amount: number
  ts: number
}

const KEY = 'dexarcfi.deposits.v1'
const EMPTY: Deposit[] = []
const listeners = new Set<() => void>()
const cache = new Map<string, Deposit[]>()

function load(addr: string): Deposit[] {
  const hit = cache.get(addr)
  if (hit) return hit
  let value = EMPTY
  try {
    const raw = localStorage.getItem(`${KEY}:${addr}`)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) value = parsed as Deposit[]
    }
  } catch {
    value = EMPTY
  }
  cache.set(addr, value)
  return value
}

export function addDeposit(address: string, d: Deposit): void {
  const addr = address.toLowerCase()
  const current = load(addr)
  if (current.some((x) => x.id === d.id)) return
  const next = [d, ...current].slice(0, 500)
  cache.set(addr, next)
  try {
    localStorage.setItem(`${KEY}:${addr}`, JSON.stringify(next))
  } catch {
    // storage full or blocked: keep the in-memory copy
  }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useDeposits(address: string | undefined): Deposit[] {
  return useSyncExternalStore(
    subscribe,
    () => (address ? load(address.toLowerCase()) : EMPTY),
    () => EMPTY,
  )
}

/** Wait for the receipt, then record the deposit only if it succeeded. */
export function recordDepositOnConfirm(
  config: Config,
  address: string,
  hash: `0x${string}`,
  entry: Omit<Deposit, 'id' | 'ts'>,
): void {
  void waitForTransactionReceipt(config, { hash })
    .then((receipt) => {
      if (receipt.status === 'success') addDeposit(address, { ...entry, id: hash, ts: Date.now() })
    })
    .catch(() => {
      // a dropped or unreachable receipt must not record a deposit
    })
}

export function totalsByKind(deposits: Deposit[]): Record<DepositKind, number> {
  const t: Record<DepositKind, number> = { earn: 0, vault: 0, staking: 0 }
  for (const d of deposits) t[d.kind] += d.token === 'USDC' ? d.amount : 0
  return t
}
