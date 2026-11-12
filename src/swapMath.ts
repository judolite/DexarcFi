import { formatUnits, parseUnits } from 'viem'

export interface MinReceived {
  /** Smallest-unit floor for the output token (what the swap enforces). */
  raw: bigint
  /** Human-readable floor, trailing zeros removed. */
  display: string
}

/**
 * Worst-case output for a quoted swap: the estimated output reduced by the
 * slippage tolerance, rounded DOWN, in exact integer math (no floats).
 */
export function minReceived(estimatedOutput: string, decimals: number, slippageBps: number): MinReceived {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10_000) throw new Error('Invalid slippage')
  if (!/^\d+(\.\d+)?$/.test(estimatedOutput.trim())) throw new Error('Unexpected quote amount')
  const [whole, frac = ''] = estimatedOutput.trim().split('.')
  // Quotes may carry more digits than the token has; drop the extra (rounds down).
  const est = parseUnits(`${whole}.${frac.slice(0, decimals)}`.replace(/\.$/, ''), decimals)
  const raw = (est * BigInt(10_000 - slippageBps)) / 10_000n
  const display = formatUnits(raw, decimals)
  return { raw, display: display.includes('.') ? display.replace(/0+$/, '').replace(/\.$/, '') : display }
}
