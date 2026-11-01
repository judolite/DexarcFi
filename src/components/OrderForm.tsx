import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor, parseAmount } from '@/onchain-money'
import type { Market } from '../hooks/useMarketData'
import { Info, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

const ARC_TESTNET_ID = 5042002

interface Props {
  market: Market
  price: number
  onPriceChange?: (p: number) => void
}

const LEVERAGES = [1, 2, 3, 5, 10, 20, 50]
const ORDER_TYPES = ['Market', 'Limit', 'Stop Market', 'Stop Limit']

// Escrow address for margin — receives USDC on Arc Testnet when an order is placed.
// Replace with your deployed perp engine contract address before going to mainnet.
const MARGIN_ESCROW = '0x0000000000000000000000000000000000000001' as const

export default function OrderForm({ market, price, onPriceChange }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [orderType, setOrderType] = useState('Market')
  const [leverage, setLeverage] = useState(10)
  const [sizeUsd, setSizeUsd] = useState('')
  const [limitPrice, setLimitPrice] = useState(price.toFixed(2))
  const [tpsl, setTpsl] = useState(false)
  const [tpPrice, setTpPrice] = useState('')
  const [slPrice, setSlPrice] = useState('')

  const usdcFact = getUsdc(ARC_TESTNET_ID)
  const isWrongChain = isConnected && chainId !== ARC_TESTNET_ID

  const { data: rawBalance, refetch: refetchBalance } = useReadContract({
    address: usdcFact?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!usdcFact },
  })

  const balanceFormatted = rawBalance != null
    ? Amount.fromRaw(rawBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
    : '0.00'

  const sizeUsdNum = parseFloat(sizeUsd) || 0
  const notional = sizeUsdNum * leverage
  const marginRequired = sizeUsdNum > 0 ? sizeUsdNum : null

  const { writeContract, data: txHash, isPending: isSubmitting } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  // Show explorer link once confirmed
  if (isConfirmed && txHash) {
    const explorerUrl = buildTxExplorerUrl(ARC_TESTNET_ID, txHash)
    toast.success(
      `${side === 'buy' ? 'Long' : 'Short'} ${market.symbol} — ${leverage}x · $${sizeUsdNum.toFixed(2)} margin`,
      {
        description: (
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
            View on Arc Explorer <ExternalLink size={12} />
          </a>
        ),
        duration: 8000,
      }
    )
    void refetchBalance()
  }

  const handleSubmit = () => {
    if (!isConnected) return
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    if (!sizeUsdNum || sizeUsdNum <= 0) { toast.error('Enter a position size'); return }
    if (!usdcFact) { toast.error('USDC not found on Arc Testnet'); return }

    const parsedMargin = parseAmount(ARC_TESTNET_ID, sizeUsd)
    writeContract({
      address: usdcFact.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [MARGIN_ESCROW, parsedMargin.raw],
      chainId: ARC_TESTNET_ID,
    })
  }

  const isLoading = isSubmitting || isConfirming
  const buttonLabel = isWrongChain ? 'Switch to Arc Testnet'
    : isSubmitting ? 'Confirm in wallet…'
    : isConfirming ? 'Confirming on Arc…'
    : side === 'buy' ? `Buy / Long ${market.baseAsset}` : `Sell / Short ${market.baseAsset}`

  return (
    <div
      style={{
        width: 260,
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Buy / Sell tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {(['buy', 'sell'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            style={{
              flex: 1,
              padding: '12px 0',
              background: side === s
                ? s === 'buy' ? 'rgba(38,208,124,0.12)' : 'rgba(240,78,97,0.12)'
                : 'none',
              border: 'none',
              borderBottom: `2px solid ${side === s ? (s === 'buy' ? 'var(--buy)' : 'var(--sell)') : 'transparent'}`,
              color: side === s
                ? s === 'buy' ? 'var(--buy)' : 'var(--sell)'
                : 'var(--muted)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontFamily: 'DM Sans, sans-serif',
              transition: 'all 0.15s',
            }}
          >
            {s === 'buy' ? 'Buy / Long' : 'Sell / Short'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {/* Order type */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Order Type
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {ORDER_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: orderType === t ? 'var(--surface-strong)' : 'var(--surface)',
                  border: orderType === t ? '1px solid var(--border-strong)' : '1px solid var(--border)',
                  color: orderType === t ? 'var(--ink)' : 'var(--muted)',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Leverage */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Leverage
            </span>
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{leverage}x</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {LEVERAGES.map(l => (
              <button
                key={l}
                onClick={() => setLeverage(l)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: 4,
                  background: leverage === l ? 'var(--accent)' : 'var(--surface)',
                  border: '1px solid ' + (leverage === l ? 'var(--accent)' : 'var(--border)'),
                  color: leverage === l ? '#fff' : 'var(--muted)',
                  fontSize: 10,
                  fontWeight: leverage === l ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {l}x
              </button>
            ))}
          </div>
        </div>

        {/* Limit price (show only for limit orders) */}
        {orderType !== 'Market' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Price
            </div>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <input
                type="number"
                value={limitPrice}
                onChange={e => {
                  setLimitPrice(e.target.value)
                  onPriceChange?.(parseFloat(e.target.value) || 0)
                }}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--ink)',
                  fontSize: 14,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                placeholder="0.00"
              />
              <span style={{ fontSize: 11, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>USD</span>
            </div>
          </div>
        )}

        {/* Size in USD */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Size
            </span>
            {isConnected && (
              <button
                onClick={() => setSizeUsd(balanceFormatted)}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}
              >
                Max: {balanceFormatted} USDC
              </button>
            )}
          </div>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              type="number"
              value={sizeUsd}
              onChange={e => setSizeUsd(e.target.value)}
              placeholder="0.00"
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: 'var(--ink)',
                fontSize: 14,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--subtle)', whiteSpace: 'nowrap' }}>USDC</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {[25, 50, 75, 100].map(pct => (
              <button
                key={pct}
                onClick={() => setSizeUsd(((parseFloat(balanceFormatted) * pct) / 100).toFixed(2))}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  borderRadius: 4,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted)',
                  fontSize: 10,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                }}
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* TP/SL toggle */}
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setTpsl(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              color: tpsl ? 'var(--accent)' : 'var(--muted)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            <div
              style={{
                width: 28,
                height: 16,
                borderRadius: 8,
                background: tpsl ? 'var(--accent)' : 'var(--surface-strong)',
                border: '1px solid var(--border)',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: 1,
                  left: tpsl ? 13 : 1,
                  transition: 'left 0.2s',
                }}
              />
            </div>
            Take Profit / Stop Loss
          </button>

          {tpsl && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
              {[
                { label: 'TP Price', value: tpPrice, set: setTpPrice, color: 'var(--buy)' },
                { label: 'SL Price', value: slPrice, set: setSlPrice, color: 'var(--sell)' },
              ].map(({ label, value, set, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 4 }}>{label}</div>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: `1px solid ${color}33`,
                      borderRadius: 6,
                      padding: '6px 8px',
                    }}
                  >
                    <input
                      type="number"
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder="–"
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        color,
                        fontSize: 12,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary rows */}
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 12,
          }}
        >
          {[
            { label: 'Margin Required', value: marginRequired != null ? '$' + marginRequired.toFixed(2) : 'N/A' },
            { label: 'Notional Value', value: notional > 0 ? '$' + notional.toFixed(2) : 'N/A' },
            { label: 'Est. Slippage', value: orderType === 'Market' ? '~0%' : '0%' },
            { label: 'Fees', value: '0.0450% / 0.0150%' },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {label}
                <Info size={10} color="var(--subtle)" />
              </span>
              <span className="mono" style={{ color: 'var(--ink-2)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 12px 12px', flexShrink: 0 }}>
        {!isConnected ? (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                onClick={show}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 10,
                  background: 'var(--accent)',
                  border: 'none',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  letterSpacing: '0.02em',
                }}
              >
                Connect Wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 10,
              background: isWrongChain ? 'var(--accent)' : side === 'buy' ? 'var(--buy)' : 'var(--sell)',
              border: 'none',
              color: '#0b1320',
              fontSize: 14,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              fontFamily: 'DM Sans, sans-serif',
              letterSpacing: '0.02em',
              transition: 'opacity 0.15s',
            }}
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  )
}
