export type Chain = 'solana' | 'monad' | 'hyperliquid'
export type Direction = 'in' | 'out'

export const AMBER = '#f59e0b'
export const ARC_TESTNET_ID = 5042002
export const MONAD_TESTNET_ID = 10143
export const HYPEREVM_TESTNET_ID = 998

export interface ChainMeta {
  id: Chain
  name: string
  label: string
  badge: string
  /** Speed when this chain is the SOURCE (bridging into Arc). */
  speedIn: string
  nativeGas: string
}

export const CHAINS: ChainMeta[] = [
  { id: 'solana', name: 'Solana', label: 'Solana Devnet', badge: 'CCTP V2', speedIn: 'Fast transfer in', nativeGas: 'devnet SOL' },
  { id: 'monad', name: 'Monad', label: 'Monad Testnet', badge: 'CCTP V2', speedIn: 'Standard transfer in', nativeGas: 'MON' },
  { id: 'hyperliquid', name: 'Hyperliquid', label: 'HyperEVM Testnet', badge: 'CCTP V2', speedIn: 'Standard transfer in', nativeGas: 'HYPE' },
]

export interface Quote {
  fees: { type: string; amount: string | null; token: string }[]
  gas: { token: string; blockchain: string; fee: string | null }[]
  amount: string
  recipient: string
  key: string
}

export interface BridgeStep { name: string; state: string; txHash?: string; explorerUrl?: string }
export interface Outcome { state: string; steps: BridgeStep[] }

export const STEP_LABEL: Record<string, string> = {
  'bridge.approve': 'Approve',
  'bridge.burn': 'Burn on source',
  'bridge.fetchAttestation': 'Circle attestation',
  'bridge.mint': 'Mint on destination',
}

export const routeKey = (dir: Direction, chain: Chain) => `${dir}:${chain}`
