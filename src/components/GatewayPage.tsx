import { useState, useEffect, useCallback } from 'react'
import { useAccount, useConnectorClient, useSwitchChain } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { AppKit, type UnifiedBalanceChainIdentifier } from '@circle-fin/app-kit'
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2'
import type { EIP1193Provider } from 'viem'
import { getProtocolContractByName, buildTxExplorerUrl } from '@/onchain-facts'
import {
  Globe,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'

// One AppKit instance for the whole page
const appKit = new AppKit()

// Supported testnet chains for the unified balance UI
const SUPPORTED_CHAINS: { label: string; id: UnifiedBalanceChainIdentifier; chainId: number; color: string }[] = [
  { label: 'Arc Testnet',        id: 'Arc_Testnet',          chainId: 5042002,   color: '#63cab7' },
  { label: 'Base Sepolia',       id: 'Base_Sepolia',          chainId: 84532,     color: '#0052ff' },
  { label: 'Ethereum Sepolia',   id: 'Ethereum_Sepolia',      chainId: 11155111,  color: '#627eea' },
  { label: 'Arbitrum Sepolia',   id: 'Arbitrum_Sepolia',      chainId: 421614,    color: '#28a0f0' },
  { label: 'Avalanche Fuji',     id: 'Avalanche_Fuji',        chainId: 43113,     color: '#e84142' },
  { label: 'OP Sepolia',         id: 'Optimism_Sepolia',      chainId: 11155420,  color: '#ff0420' },
  { label: 'Polygon Amoy',       id: 'Polygon_Amoy_Testnet',  chainId: 80002,     color: '#8247e5' },
]

interface ChainBalance {
  chain: string
  confirmedBalance: string
}

interface BalanceResult {
  totalConfirmedBalance: string
  breakdown: ChainBalance[]
}

type PageTab = 'balance' | 'deposit' | 'spend'

function ChainDot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0, boxShadow: `0 0 5px ${color}88`,
    }} />
  )
}

export default function GatewayPage() {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const { data: connectorClient } = useConnectorClient()
  const { switchChainAsync } = useSwitchChain()

  const [tab, setTab] = useState<PageTab>('balance')
  const [balances, setBalances] = useState<BalanceResult | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  // Deposit state
  const [depositChain, setDepositChain] = useState<typeof SUPPORTED_CHAINS[0]>(SUPPORTED_CHAINS[0])
  const [depositAmount, setDepositAmount] = useState('')
  const [depositLoading, setDepositLoading] = useState(false)
  const [depositTx, setDepositTx] = useState<{ hash: string; explorerUrl: string } | null>(null)

  // Spend state
  const [spendSourceChain, setSpendSourceChain] = useState<typeof SUPPORTED_CHAINS[0]>(SUPPORTED_CHAINS[0])
  const [spendDestChain, setSpendDestChain] = useState<typeof SUPPORTED_CHAINS[0]>(SUPPORTED_CHAINS[1])
  const [spendAmount, setSpendAmount] = useState('')
  const [spendRecipient, setSpendRecipient] = useState('')
  const [spendLoading, setSpendLoading] = useState(false)
  const [spendResult, setSpendResult] = useState<{ txHash: string; explorerUrl: string } | null>(null)

  // Gateway contract addresses (testnet)
  const gatewayWallet = getProtocolContractByName('GatewayWallet', 'testnet')
  const gatewayMinter = getProtocolContractByName('GatewayMinter', 'testnet')

  const fetchBalances = useCallback(async () => {
    if (!address) return
    setBalanceLoading(true)
    setBalanceError(null)
    try {
      const result = await appKit.unifiedBalance.getBalances({
        sources: { address },
        networkType: 'testnet',
      })
      const breakdown: ChainBalance[] = []
      for (const account of result.breakdown) {
        for (const chain of account.breakdown) {
          breakdown.push({ chain: chain.chain, confirmedBalance: chain.confirmedBalance })
        }
      }
      setBalances({ totalConfirmedBalance: result.totalConfirmedBalance, breakdown })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch balances'
      setBalanceError(msg)
    } finally {
      setBalanceLoading(false)
    }
  }, [address])

  // Trigger balance fetch when the balance tab becomes active
  const [balanceTrigger, setBalanceTrigger] = useState(0)
  useEffect(() => {
    if (isConnected && address && tab === 'balance') {
      setBalanceTrigger(t => t + 1)
    }
  }, [isConnected, address, tab])
  useEffect(() => {
    if (balanceTrigger > 0) void fetchBalances()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balanceTrigger])

  const getAdapter = useCallback(async (requiredChainId: number) => {
    if (!connectorClient?.transport) throw new Error('Wallet not connected')
    if (walletChainId !== requiredChainId) {
      await switchChainAsync({ chainId: requiredChainId })
    }
    // Obtain the EIP-1193 provider from the connector
    const transport = connectorClient.transport as { request?: (...args: unknown[]) => Promise<unknown> }
    const provider = transport as unknown as EIP1193Provider
    return await createViemAdapterFromProvider({ provider })
  }, [connectorClient, walletChainId, switchChainAsync])

  const handleDeposit = async () => {
    if (!isConnected) { toast.error('Connect your wallet first'); return }
    const amt = parseFloat(depositAmount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setDepositLoading(true)
    setDepositTx(null)
    try {
      const adapter = await getAdapter(depositChain.chainId)
      const result = await appKit.unifiedBalance.deposit({
        from: { adapter, chain: depositChain.id },
        amount: depositAmount,
      })
      setDepositTx({ hash: result.txHash, explorerUrl: result.explorerUrl ?? buildTxExplorerUrl(depositChain.chainId, result.txHash) })
      toast.success(`Deposited ${depositAmount} USDC from ${depositChain.label}`)
      setDepositAmount('')
      // Refresh balances
      setTimeout(() => { void fetchBalances() }, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Deposit failed'
      toast.error(msg.length > 80 ? msg.slice(0, 80) + '…' : msg)
    } finally {
      setDepositLoading(false)
    }
  }

  const handleSpend = async () => {
    if (!isConnected) { toast.error('Connect your wallet first'); return }
    const amt = parseFloat(spendAmount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (!spendRecipient || !/^0x[0-9a-fA-F]{40}$/.test(spendRecipient)) {
      toast.error('Enter a valid recipient address (0x…)')
      return
    }
    if (spendSourceChain.id === spendDestChain.id) {
      toast.error('Source and destination chains must differ')
      return
    }
    setSpendLoading(true)
    setSpendResult(null)
    try {
      const adapter = await getAdapter(spendSourceChain.chainId)
      const result = await appKit.unifiedBalance.spend({
        from: {
          adapter,
          allocations: { amount: spendAmount, chain: spendSourceChain.id },
        },
        to: { chain: spendDestChain.id, recipientAddress: spendRecipient, useForwarder: true },
        amount: spendAmount,
      })
      setSpendResult({ txHash: result.txHash, explorerUrl: result.explorerUrl ?? buildTxExplorerUrl(spendSourceChain.chainId, result.txHash) })
      toast.success(`Spending ${spendAmount} USDC → ${spendDestChain.label}`)
      setSpendAmount('')
      setTimeout(() => { void fetchBalances() }, 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Spend failed'
      toast.error(msg.length > 80 ? msg.slice(0, 80) + '…' : msg)
    } finally {
      setSpendLoading(false)
    }
  }

  const teal = '#63cab7'

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${teal}22`, border: `1px solid ${teal}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Globe size={18} color={teal} />
            </div>
            <h1 className="display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', margin: 0, letterSpacing: '-0.03em' }}>
              Circle Gateway
            </h1>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${teal}15`, color: teal, border: `1px solid ${teal}33`, fontWeight: 600 }}>
              Unified Balance
            </span>
          </div>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 640, lineHeight: 1.6 }}>
            Hold one unified USDC balance across {SUPPORTED_CHAINS.length} chains simultaneously. Deposit from any chain, spend to any chain in under 500ms — no bridging wait times.
          </p>
        </div>

        {/* Contract info bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Gateway Wallet (Testnet)', address: gatewayWallet?.address ?? '—' },
            { label: 'Gateway Minter (Testnet)', address: gatewayMinter?.address ?? '—' },
          ].map(({ label, address: addr }) => (
            <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={14} color={teal} />
              <div>
                <div style={{ fontSize: 10, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{addr}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {([
            { id: 'balance' as PageTab, label: 'Unified Balance', icon: <Globe size={13} /> },
            { id: 'deposit' as PageTab, label: 'Deposit', icon: <ArrowDownToLine size={13} /> },
            { id: 'spend' as PageTab, label: 'Spend / Transfer', icon: <ArrowUpFromLine size={13} /> },
          ]).map(({ id, label, icon }) => (
            <button
              key={id}
              className={`tab-base ${tab === id ? 'tab-active' : ''}`}
              onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* ── BALANCE TAB ── */}
        {tab === 'balance' && (
          <div>
            {!isConnected ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <Globe size={36} color="var(--muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
                <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Connect your wallet to view your unified USDC balance.</p>
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <button onClick={show} style={{ background: teal, border: 'none', color: '#0b1320', padding: '10px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      Connect Wallet
                    </button>
                  )}
                </ConnectKitButton.Custom>
              </div>
            ) : (
              <>
                {/* Total balance card */}
                <div style={{ background: `linear-gradient(135deg, ${teal}18 0%, rgba(255,255,255,0.04) 100%)`, border: `1px solid ${teal}33`, borderRadius: 14, padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, color: teal, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600 }}>Unified USDC Balance</div>
                    <div className="display mono" style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                      {balanceLoading ? '…' : balances ? `$${parseFloat(balances.totalConfirmedBalance || '0').toFixed(2)}` : '—'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      Across {SUPPORTED_CHAINS.length} supported testnet chains
                    </div>
                  </div>
                  <button
                    onClick={() => { void fetchBalances() }}
                    disabled={balanceLoading}
                    style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' }}
                  >
                    <RefreshCw size={13} style={{ animation: balanceLoading ? 'spin 1s linear infinite' : 'none' }} />
                    Refresh
                  </button>
                </div>

                {balanceError && (
                  <div style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--danger)' }}>
                    {balanceError}
                  </div>
                )}

                {/* Per-chain breakdown */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '2fr 1fr' }}>
                    <span style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Chain</span>
                    <span style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>USDC Balance</span>
                  </div>
                  {SUPPORTED_CHAINS.map(chain => {
                    const entry = balances?.breakdown.find(b => b.chain === (chain.id as string))
                    const bal = entry ? parseFloat(entry.confirmedBalance) : 0
                    const total = balances ? parseFloat(balances.totalConfirmedBalance || '0') : 0
                    const pct = total > 0 && bal > 0 ? (bal / total) * 100 : 0
                    return (
                      <div
                        key={chain.label}
                        style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', position: 'relative' }}
                      >
                        {pct > 0 && (
                          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: `${chain.color}0a`, pointerEvents: 'none' }} />
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                          <ChainDot color={chain.color} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>{chain.label}</span>
                        </div>
                        <span className="mono" style={{ fontSize: 13, color: bal > 0 ? 'var(--ink)' : 'var(--subtle)', textAlign: 'right', position: 'relative' }}>
                          {balanceLoading ? '…' : bal.toFixed(2)} USDC
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Info size={13} color="var(--subtle)" />
                  <span style={{ fontSize: 12, color: 'var(--subtle)' }}>
                    Gateway balances are updated in real time via the Circle Gateway REST API. Deposit on any chain to add to your unified balance.
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── DEPOSIT TAB ── */}
        {tab === 'deposit' && (
          <div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', maxWidth: 520 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Deposit USDC to Unified Balance</h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
                Move USDC from your wallet on any chain into the Gateway. Your unified balance increases instantly.
              </p>

              {/* Source chain */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Source Chain</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUPPORTED_CHAINS.map(c => (
                    <button
                      key={c.label}
                      onClick={() => setDepositChain(c)}
                      style={{
                        padding: '5px 10px', borderRadius: 7,
                        background: depositChain.id === c.id ? `${c.color}22` : 'var(--surface-strong)',
                        border: `1px solid ${depositChain.id === c.id ? c.color + '88' : 'var(--border)'}`,
                        color: depositChain.id === c.id ? c.color : 'var(--muted)',
                        fontSize: 11, fontWeight: depositChain.id === c.id ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <ChainDot color={c.color} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Amount</div>
                <div style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={e => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>USDC</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--subtle)', marginTop: 5 }}>
                  Depositing to Gateway Wallet: <span className="mono">{gatewayWallet?.address.slice(0, 10)}…</span>
                </div>
              </div>

              {/* Preview row */}
              {depositAmount && parseFloat(depositAmount) > 0 && (
                <div style={{ background: 'var(--surface-strong)', borderRadius: 9, padding: '12px 14px', marginBottom: 18, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: 'var(--subtle)' }}>From</span>
                    <span style={{ color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}><ChainDot color={depositChain.color} />{depositChain.label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: 'var(--subtle)' }}>Amount</span>
                    <span className="mono" style={{ color: 'var(--ink)' }}>{depositAmount} USDC</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--subtle)' }}>Authorization</span>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>EIP-3009 (single tx)</span>
                  </div>
                </div>
              )}

              {!isConnected ? (
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <button onClick={show} style={{ width: '100%', padding: '13px', borderRadius: 10, background: teal, border: 'none', color: '#0b1320', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      Connect Wallet
                    </button>
                  )}
                </ConnectKitButton.Custom>
              ) : (
                <button
                  onClick={() => { void handleDeposit() }}
                  disabled={depositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 10,
                    background: depositLoading ? 'var(--surface-strong)' : teal,
                    border: 'none', color: depositLoading ? 'var(--muted)' : '#0b1320',
                    fontSize: 14, fontWeight: 700, cursor: depositLoading ? 'default' : 'pointer',
                    fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {depositLoading ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Depositing…</> : <><ArrowDownToLine size={14} /> Deposit to Unified Balance</>}
                </button>
              )}

              {depositTx && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 9 }}>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 4 }}>Deposit confirmed</div>
                  <a href={depositTx.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="mono">{depositTx.hash.slice(0, 18)}…</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SPEND TAB ── */}
        {tab === 'spend' && (
          <div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px', maxWidth: 560 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Spend — Cross-chain Transfer</h3>
              <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--muted)' }}>
                Burn USDC from your unified balance on the source chain and mint it on the destination chain in under 500ms via the Forwarding Service. You sign once on the source chain only.
              </p>

              {/* Source chain */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Source Chain (burn from)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUPPORTED_CHAINS.map(c => (
                    <button
                      key={c.label}
                      onClick={() => setSpendSourceChain(c)}
                      style={{
                        padding: '5px 10px', borderRadius: 7,
                        background: spendSourceChain.id === c.id ? `${c.color}22` : 'var(--surface-strong)',
                        border: `1px solid ${spendSourceChain.id === c.id ? c.color + '88' : 'var(--border)'}`,
                        color: spendSourceChain.id === c.id ? c.color : 'var(--muted)',
                        fontSize: 11, fontWeight: spendSourceChain.id === c.id ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <ChainDot color={c.color} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dest chain */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Destination Chain (mint to)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SUPPORTED_CHAINS.filter(c => c.id !== spendSourceChain.id).map(c => (
                    <button
                      key={c.label}
                      onClick={() => setSpendDestChain(c)}
                      style={{
                        padding: '5px 10px', borderRadius: 7,
                        background: spendDestChain.id === c.id ? `${c.color}22` : 'var(--surface-strong)',
                        border: `1px solid ${spendDestChain.id === c.id ? c.color + '88' : 'var(--border)'}`,
                        color: spendDestChain.id === c.id ? c.color : 'var(--muted)',
                        fontSize: 11, fontWeight: spendDestChain.id === c.id ? 600 : 400,
                        cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <ChainDot color={c.color} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Amount</div>
                <div style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="number"
                    value={spendAmount}
                    onChange={e => setSpendAmount(e.target.value)}
                    placeholder="0.00"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 18, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>USDC</span>
                </div>
              </div>

              {/* Recipient */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Recipient Address</div>
                <div style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 14px' }}>
                  <input
                    type="text"
                    value={spendRecipient}
                    onChange={e => setSpendRecipient(e.target.value)}
                    placeholder="0x…"
                    style={{ width: '100%', background: 'none', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
                {isConnected && address && (
                  <button
                    onClick={() => setSpendRecipient(address)}
                    style={{ background: 'none', border: 'none', fontSize: 11, color: teal, cursor: 'pointer', padding: '4px 0', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Use my address
                  </button>
                )}
              </div>

              {/* Route preview */}
              {spendAmount && parseFloat(spendAmount) > 0 && spendRecipient && (
                <div style={{ background: 'var(--surface-strong)', borderRadius: 9, padding: '12px 14px', marginBottom: 18, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ChainDot color={spendSourceChain.color} /><span style={{ color: 'var(--ink-2)' }}>{spendSourceChain.label}</span></div>
                    <ChevronRight size={12} color="var(--muted)" />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ChainDot color={spendDestChain.color} /><span style={{ color: 'var(--ink-2)' }}>{spendDestChain.label}</span></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--subtle)' }}>Amount</span>
                    <span className="mono" style={{ color: 'var(--ink)' }}>{spendAmount} USDC</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--subtle)' }}>Recipient</span>
                    <span className="mono" style={{ color: 'var(--ink-2)', fontSize: 11 }}>{spendRecipient.slice(0, 10)}…{spendRecipient.slice(-6)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--subtle)' }}>Finality</span>
                    <span style={{ color: teal, fontWeight: 600 }}>&lt; 500ms (Forwarding Service)</span>
                  </div>
                </div>
              )}

              {!isConnected ? (
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <button onClick={show} style={{ width: '100%', padding: '13px', borderRadius: 10, background: teal, border: 'none', color: '#0b1320', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                      Connect Wallet
                    </button>
                  )}
                </ConnectKitButton.Custom>
              ) : (
                <button
                  onClick={() => { void handleSpend() }}
                  disabled={spendLoading}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 10,
                    background: spendLoading ? 'var(--surface-strong)' : teal,
                    border: 'none', color: spendLoading ? 'var(--muted)' : '#0b1320',
                    fontSize: 14, fontWeight: 700, cursor: spendLoading ? 'default' : 'pointer',
                    fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {spendLoading
                    ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Spending…</>
                    : <><ArrowUpFromLine size={14} /> Spend — Send Crosschain</>}
                </button>
              )}

              {spendResult && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 9 }}>
                  <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600, marginBottom: 4 }}>Spend submitted</div>
                  <a href={spendResult.explorerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="mono">{spendResult.txHash.slice(0, 18)}…</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
