/**
 * Arc Testnet token addresses — sourced from https://docs.arc.io/arc/references/contract-addresses
 * Do NOT edit: update this file if Circle publishes new addresses.
 */

export interface TokenInfo {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
  /** Hex color for avatar/icon */
  color: string
  /** Short 2-letter abbreviation for avatar */
  abbr: string
}

export const ARC_TESTNET_ID = 5042002

/** All Arc Testnet tokens DexArcFi supports */
export const ARC_TESTNET_TOKENS: TokenInfo[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x3600000000000000000000000000000000000000',
    decimals: 6,
    color: '#2775ca',
    abbr: 'US',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    address: '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
    decimals: 6,
    color: '#003399',
    abbr: 'EU',
  },
  {
    symbol: 'cirBTC',
    name: 'Circle Wrapped Bitcoin',
    address: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
    decimals: 8,
    color: '#f7931a',
    abbr: 'BT',
  },
]

export function getToken(symbol: string): TokenInfo | undefined {
  return ARC_TESTNET_TOKENS.find(t => t.symbol === symbol)
}
