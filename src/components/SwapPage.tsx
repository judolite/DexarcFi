import { useState, useCallback } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AppKit, type SwapEstimate } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import type { EIP1193Provider } from 'viem'
import { toast } from 'sonner'
import { ArrowUpDown, RefreshCw, ExternalLink, Info, ChevronDown } from 'lucide-react'
import { ARC_TESTNET_TOKENS, type TokenInfo } from '@/tokens'

// One AppKit instance for the whole page
const appKit = new AppKit()

const ARC_TESTNET_CHAIN_ID = 5042002

// All 6 swap pairs on Arc Testnet (USDC/EURC/cirBTC — all combinations)
const TOKENS = ARC_TESTNET_TOKENS  // USDC, EURC, cirBTC

interface ReviewedSwap {
  estimate: SwapEstimate
  tokenIn: string
  tokenOut: string
  amountIn: string
  account: string
}

function TokenBadge({ token, onClick }: { token: TokenInfo; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--surface-strong)', border: '1px solid var(--border)',
        borderRadius: 9, padding: '8px 12px', cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'DM Sans, sans-serif', flexShrink: 0,
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: token.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
      }}>{token.abbr}</div>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{token.symbol}</span>
      {onClick && <ChevronDown size={13} color="var(--muted)" />}
    </button>
  )
}

function TokenSelector({ selected, exclude, onSelect }: { selected: TokenInfo; exclude: TokenInfo; onSelect: (t: TokenInfo) => void }) {
  const [open, setOpen] = useState(false)
  const options = TOKENS.filter(t => t.symbol !== exclude.symbol)
  return (
    <div style={{ position: 'relative' }}>
      <TokenBadge token={selected} onClick={() => setOpen(o => !o)} />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          overflow: 'hidden', minWidth: 160,
        }}>
          {options.map(t => (
            <button
              key={t.symbol}
              onClick={() => { onSelect(t); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 14px', background: t.symbol === selected.symbol ? 'var(--surface-strong)' : 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
              }}
            >
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>{t.abbr}</div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{t.symbol}</div>
                <div style={{ fontSize: 11, color: 'var(--subtle)' }}>{t.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SwapPage() {
  const { address, isConnected, connector } = useAccount()
  const { switchChainAsync } = useSwitchChain()

  const [tokenIn, setTokenIn] = useState<TokenInfo>(TOKENS[0])   // USDC
  const [tokenOut, setTokenOut] = useState<TokenInfo>(TOKENS[1]) // EURC
  const [amountIn, setAmountIn] = useState('')
  const [slippageBps, setSlippageBps] = useState(300)
  const [showSlippage, setShowSlippage] = useState(false)

  const [estimating, setEstimating] = useState(false)
  const [reviewed, setReviewed] = useState<ReviewedSwap | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [swapResult, setSwapResult] = useState<{ txHash: string; amountOut: string; explorerUrl?: string } | null>(null)

  const purple = '#a78bfa'

  const getAdapter = useCallback(async () => {
    if (!connector) throw new Error('Wallet not connected')
    const currentChainId = await connector.getChainId()
    if (currentChainId !== ARC_TESTNET_CHAIN_ID) {
      await switchChainAsync({ chainId: ARC_TESTNET_CHAIN_ID })
    }
    const provider = await connector.getProvider() as EIP1193Provider
    return await createViemAdapterFromProvider({ provider })
  }, [connector, switchChainAsync])

  const handleFlip = () => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setReviewed(null)
    setSwapResult(null)
    setAmountIn('')
  }

  const handleTokenInChange = (t: TokenInfo) => {
    setTokenIn(t)
    if (t.symbol === tokenOut.symbol) {
      setTokenOut(TOKENS.find(x => x.symbol !== t.symbol)!)
    }
    setReviewed(null)
    setSwapResult(null)
  }

  const handleTokenOutChange = (t: TokenInfo) => {
    setTokenOut(t)
    if (t.symbol === tokenIn.symbol) {
      setTokenIn(TOKENS.find(x => x.symbol !== t.symbol)!)
    }
    setReviewed(null)
    setSwapResult(null)
  }

  const handleGetQuote = async () => {
    if (!address) { toast.error('Connect your wallet first'); return }
    const amt = parseFloat(amountIn)
    if (!amt || amt <= 0) { toast.error('Enter an amount to swap'); return }
    if (tokenIn.symbol === tokenOut.symbol) { toast.error('Select different tokens'); return }

    setEstimating(true)
    setReviewed(null)
    setSwapResult(null)
    try {
      const adapter = await getAdapter()
      const estimate = await appKit.estimateSwap({
        from: { adapter, chain: 'Arc_Testnet' },
        tokenIn: tokenIn.symbol,
        tokenOut: tokenOut.symbol,
        amountIn,
        config: { slippageBps },
      })
      setReviewed({ estimate, tokenIn: tokenIn.symbol, tokenOut: tokenOut.symbol, amountIn, account: address })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get quote'
      toast.error(msg.length > 120 ? msg.slice(0, 120) + '…' : msg)
    } finally {
      setEstimating(false)
    }
  }

  const handleSwap = async () => {
    if (!reviewed || !address) return
    if (address !== reviewed.account) {
      toast.error('Wallet account changed since the quote — get a new quote')
      setReviewed(null)
      return
    }
    setSwapping(true)
    try {
      const adapter = await getAdapter()
      const result = await appKit.swap({
        from: { adapter, chain: 'Arc_Testnet' },
        tokenIn: reviewed.tokenIn,
        tokenOut: reviewed.tokenOut,
        amountIn: reviewed.amountIn,
        config: { slippageBps },
      })
      setSwapResult({
        txHash: result.txHash,
        amountOut: result.amountOut ?? reviewed.estimate.estimatedOutput.amount,
        explorerUrl: result.explorerUrl,
      })
      setReviewed(null)
      setAmountIn('')
      toast.success(`Swapped ${reviewed.amountIn} ${reviewed.tokenIn} → ${reviewed.tokenOut}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Swap failed'
      toast.error(msg.length > 120 ? msg.slice(0, 120) + '…' : msg)
    } finally {
      setSwapping(false)
    }
  }

  const isReady = isConnected && amountIn && parseFloat(amountIn) > 0 && tokenIn.symbol !== tokenOut.symbol

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Header */}
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${purple}22`, border: `1px solid ${purple}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpDown size={18} color={purple} />
            </div>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.03em' }}>Swap</h1>
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            Swap USDC, EURC, and cirBTC on Arc Testnet — powered by Circle Swap Kit.
          </p>
        </div>

        {/* Pairs grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { from: 'USDC', to: 'EURC' },
            { from: 'USDC', to: 'cirBTC' },
            { from: 'EURC', to: 'USDC' },
            { from: 'EURC', to: 'cirBTC' },
            { from: 'cirBTC', to: 'USDC' },
            { from: 'cirBTC', to: 'EURC' },
          ].map(({ from, to }) => {
            const fromT = TOKENS.find(t => t.symbol === from)!
            const toT = TOKENS.find(t => t.symbol === to)!
            const isSelected = tokenIn.symbol === from && tokenOut.symbol === to
            return (
              <button
                key={from + to}
                onClick={() => { setTokenIn(fromT); setTokenOut(toT); setReviewed(null); setSwapResult(null); setAmountIn('') }}
                style={{
                  padding: '8px 6px', borderRadius: 8, border: `1px solid ${isSelected ? purple + '88' : 'var(--border)'}`,
                  background: isSelected ? `${purple}12` : 'var(--surface)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: fromT.color, fontSize: 7, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{fromT.abbr}</div>
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>→</span>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: toT.color, fontSize: 7, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{toT.abbr}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: isSelected ? 600 : 400, color: isSelected ? purple : 'var(--muted)' }}>{from}/{to}</span>
              </button>
            )
          })}
        </div>

        {/* Swap card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }}>

          {/* From */}
          <div style={{ background: 'var(--surface-strong)', borderRadius: 12, padding: '14px 16px', marginBottom: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>You Pay</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                value={amountIn}
                onChange={e => { setAmountIn(e.target.value); setReviewed(null); setSwapResult(null) }}
                placeholder="0.00"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 28, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, minWidth: 0 }}
              />
              <TokenSelector selected={tokenIn} exclude={tokenOut} onSelect={handleTokenInChange} />
            </div>
          </div>

          {/* Flip button */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
            <button
              onClick={handleFlip}
              style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
            >
              <ArrowUpDown size={14} color="var(--muted)" />
            </button>
          </div>

          {/* To */}
          <div style={{ background: 'var(--surface-strong)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>You Receive (est.)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 28, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: reviewed ? 'var(--success)' : 'var(--subtle)' }}>
                {reviewed ? reviewed.estimate.estimatedOutput.amount : '—'}
              </div>
              <TokenSelector selected={tokenOut} exclude={tokenIn} onSelect={handleTokenOutChange} />
            </div>
          </div>

          {/* Quote details */}
          {reviewed && (
            <div style={{ background: 'var(--surface-strong)', borderRadius: 10, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--subtle)' }}>Estimated output</span>
                <span className="mono" style={{ color: 'var(--success)', fontWeight: 600 }}>
                  {reviewed.estimate.estimatedOutput.amount} {reviewed.estimate.estimatedOutput.token}
                </span>
              </div>
              {reviewed.estimate.fees?.map((fee, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--subtle)', textTransform: 'capitalize' }}>{fee.type} fee</span>
                  <span className="mono" style={{ color: 'var(--muted)' }}>{fee.amount} {fee.token}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--subtle)' }}>Slippage tolerance</span>
                <span style={{ color: 'var(--muted)' }}>{(slippageBps / 100).toFixed(1)}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--subtle)' }}>Route</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>Circle Swap Kit (Arc Testnet)</span>
              </div>
              <div style={{ marginTop: 8, padding: '6px 10px', background: `${purple}10`, borderRadius: 7, fontSize: 11, color: '#a78bfacc' }}>
                Swap is routed through a third-party aggregator (LiFi or Circle) — rates may vary.
              </div>
            </div>
          )}

          {/* Slippage toggle */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setShowSlippage(s => !s)}
              style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, fontFamily: 'DM Sans, sans-serif' }}
            >
              <Info size={12} /> Slippage: {(slippageBps / 100).toFixed(1)}% {showSlippage ? '▲' : '▼'}
            </button>
            {showSlippage && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[100, 200, 300, 500].map(bps => (
                  <button
                    key={bps}
                    onClick={() => setSlippageBps(bps)}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                      background: slippageBps === bps ? `${purple}22` : 'var(--surface-strong)',
                      border: `1px solid ${slippageBps === bps ? purple + '88' : 'var(--border)'}`,
                      color: slippageBps === bps ? purple : 'var(--muted)',
                      fontWeight: slippageBps === bps ? 600 : 400,
                    }}
                  >{(bps / 100).toFixed(1)}%</button>
                ))}
              </div>
            )}
          </div>

          {/* Action button */}
          {!isConnected ? (
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button onClick={show} style={{ width: '100%', padding: 14, borderRadius: 12, background: purple, border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  Connect Wallet
                </button>
              )}
            </ConnectKitButton.Custom>
          ) : reviewed ? (
            <button
              onClick={() => { void handleSwap() }}
              disabled={swapping}
              style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
                background: swapping ? 'var(--surface-strong)' : purple,
                color: swapping ? 'var(--muted)' : '#fff',
                cursor: swapping ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {swapping
                ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Swapping…</>
                : <>Swap {reviewed.amountIn} {reviewed.tokenIn} → {reviewed.tokenOut}</>}
            </button>
          ) : (
            <button
              onClick={() => { void handleGetQuote() }}
              disabled={!isReady || estimating}
              style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
                background: !isReady || estimating ? 'var(--surface-strong)' : `${purple}cc`,
                color: !isReady || estimating ? 'var(--muted)' : '#fff',
                cursor: !isReady || estimating ? 'default' : 'pointer', fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {estimating
                ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Getting quote…</>
                : 'Get Quote'}
            </button>
          )}
        </div>

        {/* Swap result */}
        {swapResult && (
          <div style={{ background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--success)', marginBottom: 6 }}>Swap confirmed</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
              Received: <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>{swapResult.amountOut} {tokenOut.symbol}</span>
            </div>
            {swapResult.explorerUrl && (
              <a href={swapResult.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="mono">{swapResult.txHash.slice(0, 20)}…</span>
                <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <Info size={13} color="var(--subtle)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 11, color: 'var(--subtle)', lineHeight: 1.6 }}>
            Swaps on Arc Testnet use real testnet USDC, EURC, and cirBTC. No mainnet funds are involved. Rates are provided by Circle Swap Kit and may be routed through third-party aggregators subject to their own terms.
          </p>
        </div>

      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
