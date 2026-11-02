import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { TrendingUp, Users, Lock, ChevronRight, Shield, Zap, ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { assertTestnetOnly, parseAmountSafe, assertSufficientBalance, ESCROW_ADDRESSES } from '@/security'

const ARC_TESTNET_ID = 5042002
// Testnet-only vault addresses — guarded by assertTestnetOnly() at call site.
const VAULT_ADDRESSES: Record<string, `0x${string}`> = {
  'Arc Delta Neutral':    ESCROW_ADDRESSES.VAULT_1,
  'Momentum Alpha':       ESCROW_ADDRESSES.VAULT_2,
  'HyperBase USDC Yield': ESCROW_ADDRESSES.VAULT_3,
  'Volatility Harvester': ESCROW_ADDRESSES.VAULT_4,
  'BTC-ETH Pair Trade':   ESCROW_ADDRESSES.VAULT_5,
}

interface Vault {
  name: string
  description: string
  manager: string
  tvl: number
  apy: number
  allTimeReturn: number
  maxDrawdown: number
  followers: number
  tags: string[]
  myDeposit: number
  lockPeriod: string
  featured?: boolean
}

const VAULTS: Vault[] = [
  {
    name: 'Arc Delta Neutral',
    description: 'Market-neutral strategy using funding rate arbitrage across perpetual markets.',
    manager: '0xa1b2…3c4d',
    tvl: 4_250_000,
    apy: 18.4,
    allTimeReturn: 42.1,
    maxDrawdown: -3.2,
    followers: 214,
    tags: ['Delta Neutral', 'Low Risk'],
    myDeposit: 0,
    lockPeriod: '7d',
    featured: true,
  },
  {
    name: 'Momentum Alpha',
    description: 'Trend-following strategy on top liquid perpetuals. Uses 3-5x leverage.',
    manager: '0xb3c4…5d6e',
    tvl: 1_880_000,
    apy: 34.7,
    allTimeReturn: 91.5,
    maxDrawdown: -18.6,
    followers: 88,
    tags: ['Trend Following', 'Medium Risk'],
    myDeposit: 0,
    lockPeriod: '3d',
  },
  {
    name: 'HyperBase USDC Yield',
    description: 'Supplies USDC to earn lending yield plus basis trade on ETH perps.',
    manager: '0xc5d6…7e8f',
    tvl: 9_600_000,
    apy: 8.2,
    allTimeReturn: 18.9,
    maxDrawdown: -0.4,
    followers: 501,
    tags: ['Yield', 'Stablecoin', 'Very Low Risk'],
    myDeposit: 0,
    lockPeriod: '1d',
    featured: true,
  },
  {
    name: 'Volatility Harvester',
    description: 'Sells options-equivalent vega exposure on large-cap tokens via perpetuals.',
    manager: '0xd7e8…9f0a',
    tvl: 720_000,
    apy: 26.3,
    allTimeReturn: 58.4,
    maxDrawdown: -12.1,
    followers: 63,
    tags: ['Volatility', 'High Risk'],
    myDeposit: 0,
    lockPeriod: '14d',
  },
  {
    name: 'BTC-ETH Pair Trade',
    description: 'Long BTC / Short ETH pair strategy. Mean-reverts on BTC/ETH ratio.',
    manager: '0xe9f0…1a2b',
    tvl: 3_100_000,
    apy: 14.1,
    allTimeReturn: 29.6,
    maxDrawdown: -5.8,
    followers: 145,
    tags: ['Pairs Trading', 'Low-Medium Risk'],
    myDeposit: 0,
    lockPeriod: '7d',
  },
]

function formatTvl(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(0) + 'K'
  return '$' + n.toFixed(0)
}

function RiskTag({ label }: { label: string }) {
  const color = label.includes('Very Low') ? 'var(--success)'
    : label.includes('Low') ? '#7dd3fc'
    : label.includes('Medium') ? '#fbbf24'
    : label.includes('High') ? 'var(--danger)'
    : 'var(--muted)'
  return (
    <span
      style={{
        fontSize: 10,
        padding: '2px 7px',
        borderRadius: 4,
        border: `1px solid ${color}44`,
        color,
        background: `${color}11`,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export default function VaultsPage() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [filter, setFilter] = useState<'all' | 'featured'>('all')
  const [depositVault, setDepositVault] = useState<Vault | null>(null)
  const [depositAmount, setDepositAmount] = useState('')

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

  const { writeContract, data: txHash, isPending: isSubmitting, reset: resetTx } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  if (isConfirmed && txHash && depositVault) {
    const explorerUrl = buildTxExplorerUrl(ARC_TESTNET_ID, txHash)
    toast.success(`Deposited ${depositAmount} USDC into ${depositVault.name}`, {
      description: (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
          View on Arc Explorer <ExternalLink size={12} />
        </a>
      ),
      duration: 8000,
    })
    void refetchBalance()
    setDepositVault(null)
    setDepositAmount('')
    resetTx()
  }

  const displayed = filter === 'featured' ? VAULTS.filter(v => v.featured) : VAULTS

  const handleDeposit = (vault: Vault) => {
    if (!isConnected) { toast.error('Connect your wallet first'); return }
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_ID }); return }
    setDepositVault(vault)
  }

  const handleConfirmDeposit = () => {
    if (!depositVault) { toast.error('No vault selected'); return }
    if (!usdcFact) { toast.error('USDC not found on Arc Testnet'); return }
    const vaultAddr = VAULT_ADDRESSES[depositVault.name]
    if (!vaultAddr) { toast.error('Vault address not configured'); return }
    try {
      assertTestnetOnly(chainId)
      const decimals = usdcDecimalsFor(ARC_TESTNET_ID)
      const rawAmt = parseAmountSafe(depositAmount, decimals)
      if (rawBalance != null) assertSufficientBalance(rawAmt, rawBalance, 'USDC')
      writeContract({
        address: usdcFact.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [vaultAddr, rawAmt],
        chainId: ARC_TESTNET_ID,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed')
    }
  }

  const isLoading = isSubmitting || isConfirming

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1
              className="display"
              style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.03em' }}
            >
              Vaults
            </h1>
            <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 600 }}>
              Deposit USDC into strategy vaults built on Arc. Vault managers execute onchain strategies via CoreWriter. Fully transparent, non-custodial accounting.
            </p>
          </div>

          {/* Filter */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {(['all', 'featured'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  background: filter === f ? 'var(--accent)' : 'var(--surface)',
                  border: filter === f ? 'none' : '1px solid var(--border)',
                  color: filter === f ? '#fff' : 'var(--muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  textTransform: 'capitalize',
                }}
              >
                {f === 'all' ? 'All Vaults' : 'Featured'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total TVL', value: formatTvl(VAULTS.reduce((s, v) => s + v.tvl, 0)), icon: <Lock size={18} color="var(--accent)" /> },
            { label: 'Active Vaults', value: String(VAULTS.length), icon: <Zap size={18} color="var(--success)" /> },
            { label: 'Total Depositors', value: String(VAULTS.reduce((s, v) => s + v.followers, 0)), icon: <Users size={18} color="var(--ink-2)" /> },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '18px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                <div className="display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Vault cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {displayed.map(vault => (
            <div
              key={vault.name}
              style={{
                background: 'var(--surface)',
                border: vault.featured ? '1px solid rgba(59,130,246,0.35)' : '1px solid var(--border)',
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color 0.15s, transform 0.15s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--border-strong)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = vault.featured ? 'rgba(59,130,246,0.35)' : 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Card header */}
              <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{vault.name}</span>
                      {vault.featured && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', fontWeight: 600, border: '1px solid rgba(59,130,246,0.3)' }}>
                          Featured
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      Manager: {vault.manager}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 12 }}>
                    <Users size={12} />
                    {vault.followers}
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{vault.description}</p>
              </div>

              {/* Stats */}
              <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'APY', value: vault.apy.toFixed(1) + '%', color: vault.apy > 0 ? 'var(--success)' : 'var(--muted)' },
                  { label: 'All-time Return', value: '+' + vault.allTimeReturn.toFixed(1) + '%', color: 'var(--success)' },
                  { label: 'Max DD', value: vault.maxDrawdown.toFixed(1) + '%', color: 'var(--danger)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: 'var(--subtle)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TrendingUp size={11} /> TVL: {formatTvl(vault.tvl)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} /> Lock: {vault.lockPeriod}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {vault.tags.slice(-1).map(t => <RiskTag key={t} label={t} />)}
                </div>
              </div>

              {/* Deposit button */}
              <div style={{ padding: '0 20px 16px' }}>
                <button
                  onClick={() => handleDeposit(vault)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 9,
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: 'DM Sans, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {isWrongChain ? 'Switch to Arc Testnet' : 'Deposit USDC'} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info footer */}
        <div
          style={{
            marginTop: 32,
            padding: '16px 20px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Shield size={16} color="var(--accent)" />
          <span style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
            Vaults operate via EVM CoreWriter precompiles with fully onchain accounting. Vault managers cannot withdraw depositor funds — only trade with them. All positions and PnL are publicly verifiable on Arc.
          </span>
        </div>

        {!isConnected && (
          <div style={{ marginTop: 16, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>Connect your wallet to deposit into vaults.</span>
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

      {/* Deposit modal */}
      {depositVault && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px', width: 360, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>Deposit into {depositVault.name}</h3>
              <button onClick={() => { setDepositVault(null); setDepositAmount('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--subtle)' }}>
              Available: <span style={{ color: 'var(--ink)' }}>{balanceFormatted} USDC</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <input
                type="number"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="0.00"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 16, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <button onClick={() => setDepositAmount(balanceFormatted)} style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 8px', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>MAX</button>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>USDC</span>
            </div>
            {depositAmount && parseFloat(depositAmount) > 0 && (
              <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--subtle)' }}>Est. APY</span>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{depositVault.apy.toFixed(1)}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--subtle)' }}>Lock period</span>
                  <span style={{ color: 'var(--ink)' }}>{depositVault.lockPeriod}</span>
                </div>
              </div>
            )}
            <button
              onClick={handleConfirmDeposit}
              disabled={isLoading}
              style={{ width: '100%', padding: '13px', borderRadius: 10, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif', marginBottom: 8 }}
            >
              {isSubmitting ? 'Confirm in wallet…' : isConfirming ? 'Confirming on Arc…' : 'Confirm Deposit'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--subtle)', textAlign: 'center', margin: 0 }}>
              This sends USDC on Arc Testnet. Transactions are irreversible.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
