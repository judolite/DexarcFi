import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { TrendingUp, TrendingDown, Info, ChevronRight, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { assertTestnetOnly, parseAmountSafe, assertSufficientBalance, ESCROW_ADDRESSES } from '@/security'

const ARC_TESTNET_ID = 5042002

// Testnet-only lending pool addresses — guarded by assertTestnetOnly() at call site.
// Only Supply is enabled until real lending contracts are deployed.
const LENDING_POOL: Record<string, `0x${string}`> = {
  USDC:   ESCROW_ADDRESSES.LENDING_USDC,
  BTC:    ESCROW_ADDRESSES.LENDING_BTC,
  HYPE:   ESCROW_ADDRESSES.LENDING_HYPE,
  ETH:    ESCROW_ADDRESSES.LENDING_ETH,
  EURC:   ESCROW_ADDRESSES.LENDING_EURC,
  cirBTC: ESCROW_ADDRESSES.LENDING_CIRBTC,
}

interface AssetRow {
  asset: string
  ltv: string
  apy: number
  oraclePrice: number
  totalSupplied: string
  youSupplied: string
  interestEarned: string | null
  supplyable: boolean
}

interface BorrowRow {
  asset: string
  apy: number
  oraclePrice: number
  totalBorrowed: string
  youBorrowed: string
  interestOwed: string
}

const SUPPLY_ASSETS: AssetRow[] = [
  { asset: 'USDC',   ltv: 'N/A',    apy: 3.44, oraclePrice: 1.0,     totalSupplied: '560,171,263.84', youSupplied: '0.00',        interestEarned: '0.00', supplyable: true },
  { asset: 'EURC',   ltv: 'N/A',    apy: 2.81, oraclePrice: 1.0832,  totalSupplied: '12,840,003.00',  youSupplied: '0.00',        interestEarned: '0.00', supplyable: true },
  { asset: 'cirBTC', ltv: '60.00%', apy: 0.48, oraclePrice: 67450.0, totalSupplied: '843.21',          youSupplied: '0.00000000',  interestEarned: null,   supplyable: true },
  { asset: 'BTC',    ltv: '50.00%', apy: 0.00, oraclePrice: 81759.71,totalSupplied: '2,258.51',        youSupplied: '0.00000',     interestEarned: null,   supplyable: true },
  { asset: 'HYPE',   ltv: '65.00%', apy: 0.00, oraclePrice: 78.17,   totalSupplied: '14,416,831.67',   youSupplied: '0.00',        interestEarned: null,   supplyable: true },
  { asset: 'ETH',    ltv: '70.00%', apy: 0.12, oraclePrice: 3412.5,  totalSupplied: '18,420.50',       youSupplied: '0.00000',     interestEarned: '0.00', supplyable: true },
]

const BORROW_ASSETS: BorrowRow[] = [
  { asset: 'USDC', apy: 5.00, oraclePrice: 1.0, totalBorrowed: '428,800,963.43', youBorrowed: '0.00', interestOwed: '0.00' },
  { asset: 'USDT', apy: 5.00, oraclePrice: 1.0, totalBorrowed: '1,452,783.02',   youBorrowed: '0.00', interestOwed: '0.00' },
]

const ASSET_COLORS: Record<string, string> = {
  USDC: '#2775ca', EURC: '#003399', cirBTC: '#f7931a',
  BTC: '#f7931a', ETH: '#627eea', HYPE: '#7b61ff', USDT: '#26a17b',
}

// Arc Testnet token addresses
const TOKEN_ADDRESSES: Record<string, `0x${string}`> = {
  USDC:   '0x3600000000000000000000000000000000000000',
  EURC:   '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
  cirBTC: '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF',
}
const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6, EURC: 6, cirBTC: 8,
}

function formatOraclePrice(p: number): string {
  return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ApyBadge({ apy, positive = true }: { apy: number; positive?: boolean }) {
  const color = apy > 0 ? (positive ? 'var(--success)' : 'var(--danger)') : 'var(--muted)'
  const bg    = apy > 0 ? (positive ? 'rgba(38,208,124,0.1)' : 'rgba(240,78,97,0.1)') : 'transparent'
  return (
    <span className="mono" style={{ fontSize: 13, fontWeight: 600, color, background: bg, padding: apy > 0 ? '2px 8px' : '0', borderRadius: 4 }}>
      {apy.toFixed(2)}%
    </span>
  )
}

type ModalAction = 'Supply' | 'Withdraw' | 'Borrow' | 'Repay'

interface ModalState { action: ModalAction; asset: string }

export default function EarnPage() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>('supply')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [amount, setAmount] = useState('')

  const usdcFact = getUsdc(ARC_TESTNET_ID)
  const isWrongChain = isConnected && chainId !== ARC_TESTNET_ID

  // Live USDC balance
  const { data: rawUsdcBal } = useReadContract({
    address: usdcFact?.address as `0x${string}`,
    abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!usdcFact },
  })
  const usdcBalance = rawUsdcBal != null
    ? Amount.fromRaw(rawUsdcBal, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2) : '0.00'

  // Live EURC balance (6 decimals)
  const { data: rawEurcBal } = useReadContract({
    address: TOKEN_ADDRESSES['EURC'],
    abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })
  const eurcBalance = rawEurcBal != null
    ? Amount.fromRaw(rawEurcBal, 6).toFixed(2) : '0.00'

  // Live cirBTC balance (8 decimals)
  const { data: rawCirBtcBal } = useReadContract({
    address: TOKEN_ADDRESSES['cirBTC'],
    abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address },
  })
  const cirBtcBalance = rawCirBtcBal != null
    ? Amount.fromRaw(rawCirBtcBal, 8).toFixed(8) : '0.00000000'

  // Pick displayed wallet balance for the active modal asset
  const modalBalance = modal?.asset === 'EURC' ? eurcBalance
    : modal?.asset === 'cirBTC' ? cirBtcBalance
    : usdcBalance

  const { writeContract, data: txHash, isPending: isSubmitting, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Close modal + reset on success
  if (isSuccess && modal) {
    toast.success(`${modal.action} ${amount} USDC confirmed on Arc Testnet`, {
      description: txHash ? (
        <a
          href={buildTxExplorerUrl(ARC_TESTNET_ID, txHash)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          View on explorer <ExternalLink size={11} />
        </a>
      ) : undefined,
    })
    setModal(null)
    setAmount('')
  }

  if (isError && error) {
    const msg = error.message?.toLowerCase() || ''
    if (!msg.includes('user rejected')) {
      toast.error('Transaction failed: ' + (error.message?.slice(0, 80) ?? 'unknown error'))
    }
  }

  const openModal = (action: ModalAction, asset: string) => {
    if (!isConnected) { toast.error('Connect your wallet first'); return }
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    // Withdraw/Borrow/Repay require deployed lending contracts — blocked until then
    if (action !== 'Supply') {
      toast.info(`${action} will be available when the lending contracts are deployed on Arc Testnet.`)
      return
    }
    setAmount('')
    setModal({ action, asset })
  }

  // Raw balance for the active modal asset — used for balance check
  const modalRawBalance = modal?.asset === 'EURC' ? rawEurcBal
    : modal?.asset === 'cirBTC' ? rawCirBtcBal
    : rawUsdcBal

  const handleConfirm = () => {
    if (!modal) return
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    if (modal.action !== 'Supply') {
      toast.info('Only Supply is currently enabled on Arc Testnet.')
      return
    }
    const dest = LENDING_POOL[modal.asset] ?? LENDING_POOL['USDC']
    const tokenAddr = TOKEN_ADDRESSES[modal.asset] ?? usdcFact?.address
    const decimals = TOKEN_DECIMALS[modal.asset] ?? 6
    if (!tokenAddr) { toast.error('Token not supported'); return }
    try {
      assertTestnetOnly(chainId)
      const rawAmt = parseAmountSafe(amount, decimals)
      if (modalRawBalance != null) assertSufficientBalance(rawAmt, modalRawBalance, modal.asset)
      writeContract({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [dest, rawAmt],
        chainId: ARC_TESTNET_ID,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed')
    }
  }

  const isLoading = isSubmitting || isConfirming
  const confirmLabel = isWrongChain ? 'Switch to Arc Testnet'
    : isSubmitting ? 'Confirm in wallet…'
    : isConfirming ? 'Confirming on Arc…'
    : modal ? `${modal.action} ${modal.asset}` : ''

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 className="display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            Earn
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 600 }}>
            Supply USDC or other assets to earn interest, or borrow against your collateral. Quote asset suppliers earn yield paid by borrowers.
          </p>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Your Total Supplied', value: '$0.00',       icon: <TrendingUp  size={18} color="var(--success)" /> },
            { label: 'Your Total Borrowed', value: '$0.00',       icon: <TrendingDown size={18} color="var(--danger)" /> },
            { label: 'Wallet Balance', value: usdcBalance + ' USDC', icon: <Info size={18} color="var(--accent)" /> },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div className="display mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
          {(['supply', 'borrow'] as const).map(t => (
            <button
              key={t}
              className={`tab-base ${activeTab === t ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(t)}
              style={{ textTransform: 'capitalize', fontSize: 14 }}
            >
              {t === 'supply' ? 'Supply' : 'Borrow'}
            </button>
          ))}
        </div>

        {/* Supply table */}
        {activeTab === 'supply' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
              {['Asset', 'LTV', 'APY', 'Oracle Price', 'Your Supplied', 'Interest Earned', 'Total Supplied', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{h}</span>
              ))}
            </div>
            {SUPPLY_ASSETS.map((row) => (
              <div
                key={row.asset}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: ASSET_COLORS[row.asset] ?? '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {row.asset.slice(0, 2)}
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>{row.asset}</span>
                </div>
                <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{row.ltv}</span>
                <ApyBadge apy={row.apy} positive />
                <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{formatOraclePrice(row.oraclePrice)}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{row.youSupplied} {row.asset}</span>
                <span className="mono" style={{ fontSize: 13, color: row.interestEarned !== null && row.apy > 0 ? 'var(--success)' : 'var(--muted)' }}>
                  {row.interestEarned !== null ? row.interestEarned + ' ' + row.asset : 'N/A'}
                </span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{row.totalSupplied} {row.asset}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openModal('Supply', row.asset)} style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                    Supply
                  </button>
                  <button onClick={() => openModal('Withdraw', row.asset)} style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Borrow table */}
        {activeTab === 'borrow' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
              {['Asset', 'APY (Borrow)', 'Oracle Price', 'Your Borrowed', 'Interest Owed', 'Total Borrowed', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
              ))}
            </div>
            {BORROW_ASSETS.map((row) => (
              <div
                key={row.asset}
                style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr 1fr', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: ASSET_COLORS[row.asset] ?? '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                    {row.asset.slice(0, 2)}
                  </div>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}>{row.asset}</span>
                </div>
                <ApyBadge apy={row.apy} positive={false} />
                <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{formatOraclePrice(row.oraclePrice)}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{row.youBorrowed} {row.asset}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{row.interestOwed} {row.asset}</span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--muted)' }}>{row.totalBorrowed} {row.asset}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openModal('Borrow', row.asset)} style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--danger)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                    Borrow
                  </button>
                  <button onClick={() => openModal('Repay', row.asset)} style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--surface-strong)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}>
                    Repay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connect prompt */}
        {!isConnected && (
          <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>Connect your wallet to supply, withdraw, borrow, or repay.</span>
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button onClick={show} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', color: '#fff', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  Connect Wallet <ChevronRight size={14} />
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: 360, maxWidth: '90vw' }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{modal.action} {modal.asset}</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Arc Testnet · USDC transfer</span>
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Balance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Wallet USDC</span>
              <button onClick={() => setAmount(modalBalance)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
                Max: {modalBalance} {modal?.asset ?? 'USDC'}
              </button>
            </div>

            {/* Amount input */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 20, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}
              />
              <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>USDC</span>
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {[25, 50, 75, 100].map(pct => (
                <button key={pct} onClick={() => setAmount(((parseFloat(modalBalance) * pct) / 100).toFixed(modal?.asset === 'cirBTC' ? 8 : 2))} style={{ flex: 1, padding: '5px 0', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  {pct}%
                </button>
              ))}
            </div>

            {/* APY preview */}
            {modal.action === 'Supply' && (
              <div style={{ background: 'rgba(38,208,124,0.07)', border: '1px solid rgba(38,208,124,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Supply APY</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
                  {SUPPLY_ASSETS.find(a => a.asset === modal.asset)?.apy.toFixed(2) ?? '0.00'}%
                </span>
              </div>
            )}
            {modal.action === 'Borrow' && (
              <div style={{ background: 'rgba(240,78,97,0.07)', border: '1px solid rgba(240,78,97,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Borrow APY (cost)</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)' }}>
                  {BORROW_ASSETS.find(a => a.asset === modal.asset)?.apy.toFixed(2) ?? '0.00'}%
                </span>
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 10, background: modal.action === 'Borrow' || modal.action === 'Repay' ? 'var(--danger)' : 'var(--accent)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}>
              {confirmLabel}
            </button>

            <p style={{ fontSize: 11, color: 'var(--subtle)', textAlign: 'center', margin: '10px 0 0' }}>
              This sends USDC on Arc Testnet. Transactions are irreversible.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
