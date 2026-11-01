import { useState, useEffect } from 'react'
import { useAccount, useReadContract, usePublicClient } from 'wagmi'
import { erc20Abi, parseAbiItem } from 'viem'
import { ConnectKitButton } from 'connectkit'
import { ChevronRight, ExternalLink, RefreshCw, Wallet, TrendingUp, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react'
import { getUsdc, requireChain, buildTxExplorerUrl } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

const ARC_TESTNET_ID = 5042002

interface TxRow {
  hash: string
  direction: 'in' | 'out'
  amount: string
  counterparty: string
  blockNumber: bigint
  timestamp?: number
}

function shortAddr(a: string) {
  return a.slice(0, 6) + '…' + a.slice(-4)
}

function timeAgo(ts?: number): string {
  if (!ts) return '—'
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)  return diff + 's ago'
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
  return Math.floor(diff / 86400) + 'd ago'
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: ARC_TESTNET_ID })

  const usdcFact = getUsdc(ARC_TESTNET_ID)
  const chain = requireChain(ARC_TESTNET_ID)

  // Live USDC balance
  const { data: rawBalance, refetch: refetchBalance, isLoading: balanceLoading } = useReadContract({
    address: usdcFact?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_ID,
    query: { enabled: !!address && !!usdcFact, refetchInterval: 10_000 },
  })

  const usdcBalance = rawBalance != null
    ? Amount.fromRaw(rawBalance, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2)
    : '0.00'

  // USDC Transfer history via eth_getLogs
  const [txRows, setTxRows] = useState<TxRow[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<number | null>(null)

  const fetchHistory = async () => {
    if (!address || !usdcFact || !publicClient) return
    setTxLoading(true)
    try {
      const head = await publicClient.getBlockNumber()
      const from = head > 5000n ? head - 5000n : 0n

      const [outLogs, inLogs] = await Promise.all([
        publicClient.getLogs({
          address: usdcFact.address as `0x${string}`,
          event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
          args: { from: address },
          fromBlock: from,
          toBlock: 'latest',
        }),
        publicClient.getLogs({
          address: usdcFact.address as `0x${string}`,
          event: parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)'),
          args: { to: address },
          fromBlock: from,
          toBlock: 'latest',
        }),
      ])

      const allLogs = [
        ...outLogs.map(l => ({ ...l, direction: 'out' as const })),
        ...inLogs.map(l => ({ ...l, direction: 'in'  as const })),
      ].sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber)).slice(0, 30)

      const rows: TxRow[] = allLogs.map(l => ({
        hash: l.transactionHash ?? '',
        direction: l.direction,
        amount: Amount.fromRaw(l.args.value ?? 0n, usdcDecimalsFor(ARC_TESTNET_ID)).toFixed(2),
        counterparty: l.direction === 'out' ? (l.args.to ?? '') : (l.args.from ?? ''),
        blockNumber: l.blockNumber ?? 0n,
      }))

      setTxRows(rows)
      setLastFetched(Date.now())
    } catch {
      // silently ignore RPC errors — user can retry with Refresh
    } finally {
      setTxLoading(false)
    }
  }

  useEffect(() => {
    if (isConnected && address) {
      void fetchHistory()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, isConnected])

  const totalIn  = txRows.filter(r => r.direction === 'in').reduce((s, r)  => s + parseFloat(r.amount), 0)
  const totalOut = txRows.filter(r => r.direction === 'out').reduce((s, r) => s + parseFloat(r.amount), 0)

  if (!isConnected) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 20, background: 'var(--bg)' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={28} color="var(--accent)" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 className="display" style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Connect to view Portfolio</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>See your USDC balance and transaction history on Arc Testnet.</p>
        </div>
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button onClick={show} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              Connect Wallet <ChevronRight size={16} />
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: '-0.03em' }}>Portfolio</h1>
            <a
              href={chain.explorerBase + '/address/' + address}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {shortAddr(address ?? '')} <ExternalLink size={12} />
            </a>
          </div>
          <button
            onClick={() => { void refetchBalance(); void fetchHistory() }}
            disabled={txLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: txLoading ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            <RefreshCw size={14} style={{ animation: txLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {/* Balance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            {
              label: 'USDC Balance',
              value: balanceLoading ? '…' : usdcBalance,
              sub: 'Arc Testnet',
              icon: <Wallet size={20} color="var(--accent)" />,
              color: 'var(--accent)',
            },
            {
              label: 'Total Received',
              value: totalIn > 0 ? totalIn.toFixed(2) : '0.00',
              sub: 'last 5,000 blocks',
              icon: <ArrowDownLeft size={20} color="var(--success)" />,
              color: 'var(--success)',
            },
            {
              label: 'Total Sent',
              value: totalOut > 0 ? totalOut.toFixed(2) : '0.00',
              sub: 'last 5,000 blocks',
              icon: <ArrowUpRight size={20} color="var(--danger)" />,
              color: 'var(--danger)',
            },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
              </div>
              <div className="display mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'var(--subtle)' }}>USDC · {sub}</div>
            </div>
          ))}
        </div>

        {/* Assets held */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 28 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Assets</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0 }}>
            {/* Header */}
            {['Asset', 'Balance', 'Price', 'Value (USD)'].map((h, i) => (
              <span key={h} style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, paddingBottom: 8, textAlign: i > 0 ? 'right' : 'left' }}>{h}</span>
            ))}
            {/* USDC row */}
            <div style={{ display: 'contents' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2775ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>UC</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>USDC</div>
                  <div style={{ fontSize: 11, color: 'var(--subtle)' }}>USD Coin</div>
                </div>
              </div>
              <div className="mono" style={{ fontSize: 14, color: 'var(--ink)', textAlign: 'right', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                {balanceLoading ? '…' : usdcBalance}
              </div>
              <div className="mono" style={{ fontSize: 14, color: 'var(--ink-2)', textAlign: 'right', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                $1.00
              </div>
              <div className="mono" style={{ fontSize: 14, color: 'var(--ink)', textAlign: 'right', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                ${balanceLoading ? '…' : usdcBalance}
              </div>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={15} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>USDC Transfer History</span>
            </div>
            {lastFetched && (
              <span style={{ fontSize: 11, color: 'var(--subtle)' }}>
                Updated {timeAgo(Math.floor(lastFetched / 1000))}
              </span>
            )}
          </div>

          {txLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              Loading transactions…
            </div>
          ) : txRows.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
              <div style={{ fontSize: 14, color: 'var(--muted)' }}>No USDC transfers found in the last 5,000 blocks.</div>
              <div style={{ fontSize: 12, color: 'var(--subtle)', marginTop: 4 }}>Make a transfer to see activity here.</div>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 120px 1fr', padding: '8px 20px', borderBottom: '1px solid var(--border)' }}>
                {['Type', 'Hash', 'Counterparty', 'Amount', 'Block'].map((h, i) => (
                  <span key={h} style={{ fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>
                ))}
              </div>

              {txRows.map((tx, i) => (
                <div
                  key={tx.hash + i}
                  style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 120px 1fr', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {/* Direction badge */}
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 4,
                      background: tx.direction === 'in' ? 'rgba(38,208,124,0.12)' : 'rgba(240,78,97,0.12)',
                      color: tx.direction === 'in' ? 'var(--success)' : 'var(--danger)',
                      border: `1px solid ${tx.direction === 'in' ? 'rgba(38,208,124,0.25)' : 'rgba(240,78,97,0.25)'}`,
                    }}>
                      {tx.direction === 'in' ? 'IN' : 'OUT'}
                    </span>
                  </div>

                  {/* Hash */}
                  <a
                    href={buildTxExplorerUrl(ARC_TESTNET_ID, tx.hash as `0x${string}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    {shortAddr(tx.hash)} <ExternalLink size={10} />
                  </a>

                  {/* Counterparty */}
                  <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {shortAddr(tx.counterparty)}
                  </span>

                  {/* Amount */}
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: tx.direction === 'in' ? 'var(--success)' : 'var(--danger)', textAlign: 'right' }}>
                    {tx.direction === 'in' ? '+' : '−'}{tx.amount} USDC
                  </span>

                  {/* Block */}
                  <span className="mono" style={{ fontSize: 12, color: 'var(--subtle)', textAlign: 'right' }}>
                    #{tx.blockNumber.toString()}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

      </div>
    </div>
  )
}
