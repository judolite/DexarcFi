import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { TrendingUp, TrendingDown, Info, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

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
  { asset: 'USDC', ltv: 'N/A', apy: 3.44, oraclePrice: 1.0, totalSupplied: '560,171,263.84', youSupplied: '0.00', interestEarned: '0.00', supplyable: true },
  { asset: 'BTC', ltv: '50.00%', apy: 0.00, oraclePrice: 81759.71, totalSupplied: '2,258.51', youSupplied: '0.00000', interestEarned: null, supplyable: true },
  { asset: 'HYPE', ltv: '65.00%', apy: 0.00, oraclePrice: 78.17, totalSupplied: '14,416,831.67', youSupplied: '0.00', interestEarned: null, supplyable: true },
  { asset: 'ETH', ltv: '70.00%', apy: 0.12, oraclePrice: 3412.5, totalSupplied: '18,420.50', youSupplied: '0.00000', interestEarned: '0.00', supplyable: true },
]

const BORROW_ASSETS: BorrowRow[] = [
  { asset: 'USDC', apy: 5.00, oraclePrice: 1.0, totalBorrowed: '428,800,963.43', youBorrowed: '0.00', interestOwed: '0.00' },
  { asset: 'USDT', apy: 5.00, oraclePrice: 1.0, totalBorrowed: '1,452,783.02', youBorrowed: '0.00', interestOwed: '0.00' },
]

function formatOraclePrice(p: number): string {
  if (p > 10000) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p > 100) return '$' + p.toFixed(2)
  return '$' + p.toFixed(2)
}

function ApyBadge({ apy, positive = true }: { apy: number; positive?: boolean }) {
  const color = apy > 0 ? (positive ? 'var(--success)' : 'var(--danger)') : 'var(--muted)'
  const bg = apy > 0 ? (positive ? 'var(--success-dim)' : 'var(--danger-dim)') : 'transparent'
  return (
    <span
      className="mono"
      style={{
        fontSize: 13,
        fontWeight: 600,
        color,
        background: bg,
        padding: apy > 0 ? '2px 8px' : '0',
        borderRadius: 4,
      }}
    >
      {apy.toFixed(2)}%
    </span>
  )
}

export default function EarnPage() {
  const { isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'supply' | 'borrow'>('supply')

  const handleAction = (action: string, asset: string) => {
    if (!isConnected) {
      toast.error('Connect your wallet first')
      return
    }
    toast.success(`${action} ${asset}`, { description: 'Demo mode — no real funds moved on Arc Testnet' })
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        background: 'var(--bg)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            className="display"
            style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.03em' }}
          >
            Earn
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 600 }}>
            Supply USDC or other assets to earn interest, or borrow against your collateral. Quote asset suppliers earn yield paid by borrowers.
          </p>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Your Total Supplied', value: '$0.00', icon: <TrendingUp size={18} color="var(--success)" /> },
            { label: 'Your Total Borrowed', value: '$0.00', icon: <TrendingDown size={18} color="var(--danger)" /> },
            { label: 'Net Interest Rate', value: '—', icon: <Info size={18} color="var(--accent)" /> },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'var(--surface-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
                <div className="display mono" style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>
                  {value}
                </div>
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
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              overflow: 'hidden',
            }}
          >
            {/* Col headers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 0.8fr 1fr 1fr 1fr 1fr 1fr',
                padding: '10px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {['Asset', 'LTV', 'APY', 'Oracle Price', 'Your Supplied', 'Interest Earned', 'Total Supplied', ''].map((h, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    color: 'var(--subtle)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 500,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {SUPPLY_ASSETS.map((row) => (
              <div
                key={row.asset}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 0.8fr 1fr 1fr 1fr 1fr 1fr',
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: row.asset === 'USDC' ? '#2775ca' : row.asset === 'BTC' ? '#f7931a' : row.asset === 'ETH' ? '#627eea' : '#7b61ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}
                  >
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
                  <button
                    onClick={() => handleAction('Supply', row.asset)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 7,
                      background: 'var(--accent)',
                      border: 'none',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Supply
                  </button>
                  <button
                    onClick={() => handleAction('Withdraw', row.asset)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 7,
                      background: 'var(--surface-strong)',
                      border: '1px solid var(--border)',
                      color: 'var(--muted)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'DM Sans, sans-serif',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Borrow table */}
        {activeTab === 'borrow' && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              borderRadius: '0 0 12px 12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr',
                padding: '10px 20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {['Asset', 'APY', 'Oracle Price', 'Your Borrowed', 'Interest Owed', 'Total Borrowed', ''].map((h, i) => (
                <span key={i} style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {h}
                </span>
              ))}
            </div>
            {BORROW_ASSETS.map((row) => (
              <div
                key={row.asset}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 1fr',
                  padding: '14px 20px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'center',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: '#2775ca',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                    }}
                  >
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
                  <button
                    onClick={() => handleAction('Borrow', row.asset)}
                    style={{
                      padding: '6px 14px', borderRadius: 7,
                      background: 'var(--danger)', border: 'none',
                      color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
                    }}
                  >
                    Borrow
                  </button>
                  <button
                    onClick={() => handleAction('Repay', row.asset)}
                    style={{
                      padding: '6px 14px', borderRadius: 7,
                      background: 'var(--surface-strong)', border: '1px solid var(--border)',
                      color: 'var(--muted)', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
                    }}
                  >
                    Repay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Connect prompt */}
        {!isConnected && (
          <div
            style={{
              marginTop: 24,
              padding: '16px 20px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>Connect your wallet to supply, withdraw, borrow, or repay.</span>
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button
                  onClick={show}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'var(--accent)', border: 'none', color: '#fff',
                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  }}
                >
                  Connect Wallet <ChevronRight size={14} />
                </button>
              )}
            </ConnectKitButton.Custom>
          </div>
        )}
      </div>
    </div>
  )
}
