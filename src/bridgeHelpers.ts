import { numberToHex, type EIP1193Provider } from 'viem'
import type { CreateAdapterFromProviderParams } from '@circle-fin/adapter-solana-kit'
import { requireChain } from '@/onchain-facts'

/* ── EVM: switch the wallet to a chain it may not know yet ─────────────────── */

function isUnrecognizedChain(error: unknown): boolean {
  const e = error as { code?: number; data?: { originalError?: { code?: number } } }
  return e?.code === 4902 || e?.data?.originalError?.code === 4902 // nested on MetaMask mobile
}

/**
 * Switch an injected wallet to `chainId`, adding the chain first (from the
 * registry in @/onchain-facts) when the wallet reports it as unknown (4902).
 * Needed because the app's wagmi config only knows Arc, so wagmi's own
 * switchChain cannot move the wallet to Monad or other source chains.
 */
export async function switchWalletChain(provider: EIP1193Provider, chainId: number): Promise<void> {
  const send = provider.request.bind(provider) as (args: { method: string; params?: unknown }) => Promise<unknown>
  try {
    await send({ method: 'wallet_switchEthereumChain', params: [{ chainId: numberToHex(chainId) }] })
  } catch (error) {
    if (!isUnrecognizedChain(error)) throw error
    const chain = requireChain(chainId)
    await send({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: numberToHex(chainId),
        chainName: chain.name,
        nativeCurrency: { name: chain.nativeCurrency.symbol, symbol: chain.nativeCurrency.symbol, decimals: chain.nativeCurrency.decimals },
        rpcUrls: [...chain.rpcUrls],
        blockExplorerUrls: chain.explorerBase ? [chain.explorerBase] : undefined,
      }],
    })
    await send({ method: 'wallet_switchEthereumChain', params: [{ chainId: numberToHex(chainId) }] })
  }
}

/* ── Solana: injected wallet (Phantom exposes publicKey, not address) ─────── */

type PublicKeyProvider = {
  isConnected: boolean
  publicKey: { toString(): string } | null
  connect(): Promise<{ publicKey: { toString(): string } }>
  disconnect(): Promise<void>
  signTransaction(transaction: unknown): Promise<unknown>
}

export type SolanaProvider = CreateAdapterFromProviderParams['provider']

export function getInjectedSolana(): PublicKeyProvider | null {
  const w = window as unknown as { phantom?: { solana?: PublicKeyProvider }; solana?: PublicKeyProvider }
  return w.phantom?.solana ?? w.solana ?? null
}

export function withAddress(wallet: PublicKeyProvider): SolanaProvider {
  return {
    get isConnected() { return wallet.isConnected },
    get address() { return wallet.publicKey?.toString() },
    connect: async () => ({ address: (await wallet.connect()).publicKey.toString() }),
    disconnect: () => wallet.disconnect(),
    signTransaction: (transaction) => wallet.signTransaction(transaction),
  }
}

/* ── Shared ───────────────────────────────────────────────────────────────── */

export const CIRCLE_FAUCET_URL = 'https://faucet.circle.com'
export const SUI_QUICKSTART_URL = 'https://developers.circle.com/cctp/quickstarts/transfer-usdc-sui-arc'
export const SOLANA_QUICKSTART_URL = 'https://developers.circle.com/cctp/quickstarts/transfer-usdc-solana-to-arc'

/** Largest amount accepted from the UI in one bridge (testnet guard). */
export const MAX_BRIDGE_USDC = 10_000

export function shortError(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : fallback
  return msg.length > 140 ? msg.slice(0, 140) + '…' : msg
}
