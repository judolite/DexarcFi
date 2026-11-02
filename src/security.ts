/**
 * DexArcFi — Security guards for all money-moving flows.
 *
 * Every component that calls erc20.transfer, kit.swap, kit.deposit, or
 * kit.spend MUST call assertTestnetOnly() before constructing any transaction.
 * The function throws a human-readable error when the wallet is on the wrong
 * chain or a placeholder address would be used on mainnet.
 */

import { isAddress, getAddress, zeroAddress } from 'viem'

/** The only chain where placeholder escrow addresses are permitted. */
export const ALLOWED_CHAIN_ID = 5042002 // Arc Testnet

/**
 * Placeholder escrow addresses used on Arc Testnet until real protocol
 * contracts are deployed. These must NEVER be used on any other chain.
 */
export const ESCROW_ADDRESSES = {
  MARGIN:   '0x0000000000000000000000000000000000000001' as `0x${string}`,
  STAKING:  '0x0000000000000000000000000000000000000002' as `0x${string}`,
  VAULT_1:  '0x0000000000000000000000000000000000000003' as `0x${string}`,
  VAULT_2:  '0x0000000000000000000000000000000000000004' as `0x${string}`,
  VAULT_3:  '0x0000000000000000000000000000000000000005' as `0x${string}`,
  VAULT_4:  '0x0000000000000000000000000000000000000006' as `0x${string}`,
  VAULT_5:  '0x0000000000000000000000000000000000000007' as `0x${string}`,
  EURC_ESCROW:    '0x0000000000000000000000000000000000000008' as `0x${string}`,
  CIRBTC_ESCROW:  '0x0000000000000000000000000000000000000009' as `0x${string}`,
  LENDING_USDC:   '0x0000000000000000000000000000000000000010' as `0x${string}`,
  LENDING_BTC:    '0x0000000000000000000000000000000000000011' as `0x${string}`,
  LENDING_HYPE:   '0x0000000000000000000000000000000000000012' as `0x${string}`,
  LENDING_ETH:    '0x0000000000000000000000000000000000000013' as `0x${string}`,
  LENDING_EURC:   '0x0000000000000000000000000000000000000014' as `0x${string}`,
  LENDING_CIRBTC: '0x0000000000000000000000000000000000000015' as `0x${string}`,
} as const

/** All placeholder addresses as a lowercase Set for fast lookup. */
const PLACEHOLDER_SET = new Set(
  Object.values(ESCROW_ADDRESSES).map(a => a.toLowerCase()),
)

/** Returns true when the address is a known testnet placeholder. */
export function isPlaceholder(addr: string): boolean {
  return PLACEHOLDER_SET.has(addr.toLowerCase())
}

/**
 * Guards every money-moving call.
 * Throws with a user-readable message when:
 *  - the connected chain is not Arc Testnet, OR
 *  - a placeholder address would be used outside Arc Testnet.
 */
export function assertTestnetOnly(connectedChainId: number | undefined): void {
  if (connectedChainId !== ALLOWED_CHAIN_ID) {
    throw new Error(
      `Security: this action is only permitted on Arc Testnet (chain ${ALLOWED_CHAIN_ID}). ` +
      `Your wallet is connected to chain ${connectedChainId ?? 'unknown'}. ` +
      `Switch to Arc Testnet before proceeding.`,
    )
  }
}

/**
 * Validates and normalises a recipient address.
 * Throws a user-readable error for:
 *  - invalid address format
 *  - zero address (burn)
 *  - known placeholder addresses
 */
export function validateRecipient(raw: string): `0x${string}` {
  if (!isAddress(raw)) {
    throw new Error('Invalid address format. Must be a 42-character 0x-prefixed hex address.')
  }
  const checksummed = getAddress(raw)
  if (checksummed.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new Error('Recipient is the zero address (0x000…000). This would permanently burn your funds.')
  }
  if (isPlaceholder(checksummed)) {
    throw new Error(
      'Recipient is a testnet placeholder address. Real funds must not be sent to this address.',
    )
  }
  return checksummed
}

/**
 * Parses a decimal string amount into a bigint with the given decimals.
 * Uses only integer arithmetic to avoid floating-point precision errors.
 * Throws on: empty, NaN, negative, zero, or exceeding maxWhole.
 */
export function parseAmountSafe(
  raw: string,
  decimals: number,
  maxWhole = 1_000_000,
): bigint {
  const trimmed = raw.trim()
  if (!trimmed) throw new Error('Amount is required.')

  // Allow only digits and a single dot
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: "${trimmed}". Enter a positive number.`)
  }

  const [whole, frac = ''] = trimmed.split('.')
  const wholeNum = parseInt(whole, 10)
  if (Number.isNaN(wholeNum) || wholeNum < 0) {
    throw new Error('Amount must be a positive number.')
  }
  if (wholeNum > maxWhole) {
    throw new Error(`Amount exceeds the allowed maximum of ${maxWhole.toLocaleString()}.`)
  }

  // Pad or truncate fractional part to `decimals` digits
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, '0')
  const raw128 = BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded)

  if (raw128 === 0n) throw new Error('Amount must be greater than zero.')
  return raw128
}

/**
 * Validates that rawAmount (bigint) does not exceed the wallet balance.
 * Both values are in the same raw unit (no decimals applied).
 */
export function assertSufficientBalance(
  rawAmount: bigint,
  rawBalance: bigint,
  symbol: string,
): void {
  if (rawAmount > rawBalance) {
    throw new Error(`Insufficient ${symbol} balance. You have less than the requested amount in your wallet.`)
  }
}
