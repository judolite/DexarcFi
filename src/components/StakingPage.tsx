import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ChevronRight, CheckCircle, AlertCircle, Search } from 'lucide-react'
import { toast } from 'sonner'

interface Validator {
  name: string
  description: string
  stake: number
  yourStake: number
  uptime: number
  estApr: number
  status: 'Active' | 'Jailed'
  commission: number
}

const VALIDATORS: Validator[] = [
  { name: 'ArcStake Foundation', description: 'Official Arc Foundation validator. Zero slashing history.', stake: 51_826_609, yourStake: 0, uptime: 100, estApr: 2.16, status: 'Active', commission: 3.00 },
  { name: 'Nansen x HypurrCollective', description: 'HypurrCollective x Nansen — trusted institutional validator.', stake: 21_683_669, yourStake: 0, uptime: 100, estApr: 2.19, status: 'Active', commission: 2.00 },
  { name: 'Hypurrscanning', description: 'L1 Explorer — transparent and reliable.', stake: 23_214_439, yourStake: 0, uptime: 100, estApr: 2.21, status: 'Active', commission: 1.00 },
  { name: 'Anchorage By Figment', description: 'Anchorage and Figment have partnered for institutional-grade validation.', stake: 28_191_549, yourStake: 0, uptime: 100, estApr: 2.12, status: 'Active', commission: 5.00 },
  { name: 'Alphaticks', description: 'High performance HFT infrastructure running Arc validators.', stake: 4_687_890, yourStake: 0, uptime: 100, estApr: 2.21, status: 'Active', commission: 1.00 },
  { name: 'Asymmetric Research', description: 'High integrity validation and crypto research boutique.', stake: 3_829_847, yourStake: 0, uptime: 100, estApr: 2.20, status: 'Active', commission: 1.50 },
  { name: 'Bitwise', description: 'Trusted infrastructure for institutional digital asset investors.', stake: 3_791_450, yourStake: 0, uptime: 100, estApr: 2.16, status: 'Active', commission: 3.00 },
  { name: 'ValiDAO', description: "The People's Validator. Zero slash record.", stake: 6_516_956, yourStake: 0, uptime: 100, estApr: 2.14, status: 'Active', commission: 4.00 },
  { name: 'HyperStake', description: 'Secure Arc with the most trusted community validator.', stake: 8_779_160, yourStake: 0, uptime: 100, estApr: 2.23, status: 'Active', commission: 0.00 },
  { name: 'Flowdex', description: 'Flowdesk is a leading global liquidity provider.', stake: 3_572_506, yourStake: 0, uptime: 100, estApr: 2.23, status: 'Active', commission: 0.00 },
]

const TOTAL_STAKED = 441_943_287

function formatStake(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return n.toFixed(0)
}

export default function StakingPage() {
  const { isConnected } = useAccount()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [stakeAmount, setStakeAmount] = useState('')
  const [sortBy, setSortBy] = useState<'stake' | 'apr' | 'commission'>('stake')

  const filtered = VALIDATORS
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.description.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'stake') return b.stake - a.stake
      if (sortBy === 'apr') return b.estApr - a.estApr
      return a.commission - b.commission
    })

  const handleDelegate = () => {
    if (!isConnected) { toast.error('Connect your wallet first'); return }
    if (!selected) { toast.error('Select a validator first'); return }
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) { toast.error('Enter stake amount'); return }
    toast.success(`Delegated ${stakeAmount} USDC to ${selected}`, { description: 'Demo mode — no real funds moved on Arc Testnet' })
    setStakeAmount('')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 className="display" style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px', letterSpacing: '-0.03em' }}>
            Staking
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 700 }}>
            Arc is a proof-of-stake blockchain. Delegate USDC to validators to earn staking rewards. Rewards are earned only when your validator participates in consensus — delegate to reputable validators.
          </p>
        </div>

        {/* Stats + delegate panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, marginBottom: 32 }}>
          {/* Network stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {[
              { label: 'Total Staked', value: formatStake(TOTAL_STAKED) + ' USDC', sub: 'Network-wide' },
              { label: 'Your Stake', value: '0.00 USDC', sub: 'Not staking' },
              { label: 'Est. APR', value: '~2.20%', sub: 'Network average' },
              { label: 'Validators', value: String(VALIDATORS.length), sub: 'Active' },
              { label: 'Available to Stake', value: '0.00 USDC', sub: 'Wallet balance' },
              { label: 'Pending Rewards', value: '0.00 USDC', sub: 'Claimable' },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div className="mono display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Delegate panel */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Delegate Stake</h3>

            <div>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Validator</div>
              <div style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, color: selected ? 'var(--ink)' : 'var(--muted)' }}>
                {selected ?? 'Select a validator below'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--subtle)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount (USDC)</div>
              <div style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={e => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }}
                />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>USDC</span>
              </div>
            </div>

            {selected && stakeAmount && (
              <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--subtle)' }}>Est. weekly rewards</span>
                  <span className="mono" style={{ color: 'var(--success)' }}>
                    {((parseFloat(stakeAmount) || 0) * 0.022 / 52).toFixed(4)} USDC
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--subtle)' }}>Est. APR</span>
                  <span className="mono" style={{ color: 'var(--success)' }}>~2.20%</span>
                </div>
              </div>
            )}

            {!isConnected ? (
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button onClick={show} style={{ width: '100%', padding: '12px', borderRadius: 9, background: 'var(--accent)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    Connect Wallet <ChevronRight size={14} />
                  </button>
                )}
              </ConnectKitButton.Custom>
            ) : (
              <button
                onClick={handleDelegate}
                style={{ width: '100%', padding: '12px', borderRadius: 9, background: selected ? 'var(--accent)' : 'var(--surface-strong)', border: selected ? 'none' : '1px solid var(--border)', color: selected ? '#fff' : 'var(--subtle)', fontSize: 14, fontWeight: 700, cursor: selected ? 'pointer' : 'default', fontFamily: 'DM Sans, sans-serif' }}
              >
                Delegate Stake
              </button>
            )}
          </div>
        </div>

        {/* Validator table */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table toolbar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 7, padding: '7px 12px' }}>
              <Search size={13} color="var(--muted)" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search validators…"
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--subtle)' }}>Sort by:</span>
            {(['stake', 'apr', 'commission'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                style={{ padding: '5px 10px', borderRadius: 6, background: sortBy === s ? 'var(--accent)' : 'var(--surface-strong)', border: sortBy === s ? 'none' : '1px solid var(--border)', color: sortBy === s ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: sortBy === s ? 700 : 400, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', textTransform: 'capitalize' }}
              >
                {s === 'apr' ? 'APR' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Col headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            {['Validator', 'Stake', 'Uptime', 'Est. APR', 'Commission', 'Status'].map((h, i) => (
              <span key={h} style={{ fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {filtered.map(v => {
            const isSelected = selected === v.name
            return (
              <div
                key={v.name}
                onClick={() => setSelected(isSelected ? null : v.name)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(59,130,246,0.07)' : 'transparent',
                  transition: 'background 0.1s',
                  alignItems: 'center',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{v.name}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{v.description.slice(0, 55)}{v.description.length > 55 ? '…' : ''}</span>
                </div>
                <span className="mono" style={{ fontSize: 13, color: 'var(--ink-2)', textAlign: 'right' }}>{formatStake(v.stake)}</span>
                <span className="mono" style={{ fontSize: 13, color: v.uptime === 100 ? 'var(--success)' : 'var(--danger)', textAlign: 'right' }}>
                  {v.uptime.toFixed(2)}%
                </span>
                <span className="mono" style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, textAlign: 'right' }}>{v.estApr.toFixed(2)}%</span>
                <span className="mono" style={{ fontSize: 13, color: v.commission === 0 ? 'var(--success)' : 'var(--muted)', textAlign: 'right' }}>
                  {v.commission.toFixed(2)}%
                </span>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  {v.status === 'Active'
                    ? <><CheckCircle size={13} color="var(--success)" /><span style={{ fontSize: 12, color: 'var(--success)' }}>Active</span></>
                    : <><AlertCircle size={13} color="var(--danger)" /><span style={{ fontSize: 12, color: 'var(--danger)' }}>Jailed</span></>
                  }
                </div>
              </div>
            )
          })}
        </div>

        {/* 7d performance note */}
        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--subtle)', textAlign: 'center' }}>
          Performance shown over 7-day window. Staking rewards distributed every epoch (~1 hour). Undelegation takes 7 days.
        </p>
      </div>
    </div>
  )
}
