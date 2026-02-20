import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, Settings } from 'lucide-react'
import { erc20Abi, formatUnits, getAddress, isAddress, parseUnits } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'

import { ConnectButtonWeb3 } from '@/components/ConnectButtonWeb3'
import { CONTRACTS } from '@/config/contracts'
import { sendCoinbaseSmartWalletUserOperation } from '@/lib/aa/coinbaseErc4337'
import { resolveCdpPaymasterUrl } from '@/lib/aa/cdp'
import { apiFetch } from '@/lib/apiBase'
import {
  assertValidSwapTransaction,
  buildSwap,
  checkTradeApproval,
  fetchTradeQuote,
  pickSwapQuote,
  type TradeQuoteResponse,
  type TransactionRequest,
} from '@/lib/uniswap/tradingApi'

const BASE_CHAIN_ID = 8453
const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type WaitlistMeData = {
  cswAddress?: string | null
  primarySmartWallet?: string | null
  baseSubAccount?: string | null
  connectedAccounts?: Array<{
    address?: string | null
    walletType?: string | null
    provider?: string | null
    verifiedAt?: string | null
    isCanonicalSmartWallet?: boolean
  }>
}

type TokenOption = { symbol: string; address: string; group: 'core' | 'creator' | 'share' }

const CORE_TOKENS: TokenOption[] = [
  { symbol: 'ETH', address: CONTRACTS.weth, group: 'core' },
  { symbol: 'USDC', address: CONTRACTS.usdc, group: 'core' },
  { symbol: 'BTC', address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf', group: 'core' }, // cbBTC (Base)
  { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', group: 'core' },
  { symbol: 'ZORA', address: CONTRACTS.zora, group: 'core' },
]

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function asBigInt(v: unknown): bigint {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v))
  if (typeof v === 'string' && v.trim()) return BigInt(v)
  return 0n
}

function shortAddress(value: string): string {
  if (!isAddress(value)) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function getNestedAmountOut(input: unknown): string | null {
  const obj = input as any
  const candidates = [
    obj?.quote?.output?.amount,
    obj?.output?.amount,
    obj?.amountOut,
    obj?.outAmount,
    obj?.currencyAmountOut,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.floor(value))
  }
  return null
}

function formatDisplayAmount(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return n.toFixed(6)
}

export function Swap() {
  const [searchParams] = useSearchParams()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [tokenIn, setTokenIn] = useState<string>(CONTRACTS.weth)
  const [tokenOut, setTokenOut] = useState<string>(CONTRACTS.usdc)
  const [amountInUnits, setAmountInUnits] = useState<string>('1')
  const [slippagePct, setSlippagePct] = useState<string>('0.5')
  const [estimatedOut, setEstimatedOut] = useState<string>('')
  const [quote, setQuote] = useState<TradeQuoteResponse | null>(null)
  const [approvalData, setApprovalData] = useState<Record<string, unknown> | null>(null)
  const [swapTx, setSwapTx] = useState<TransactionRequest | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [confirmIntent, setConfirmIntent] = useState<'approval' | 'swap' | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    const qToken = (searchParams.get('token') ?? '').trim()
    if (isAddress(qToken)) setTokenOut(qToken)
  }, [searchParams])

  const waitlistMeQuery = useQuery({
    queryKey: ['swap', 'waitlist-me'],
    queryFn: async (): Promise<WaitlistMeData | null> => {
      const res = await apiFetch('/api/waitlist/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeData | null> | null
      if (!res.ok || !json?.success) return null
      return json.data ?? null
    },
    staleTime: 15_000,
  })

  const canonicalSmartWalletAddress = useMemo(() => {
    const row = waitlistMeQuery.data
    if (!row) return null

    const canonicalFromAccounts = (row.connectedAccounts ?? [])
      .filter((item) => item?.isCanonicalSmartWallet && isAddressLike(item?.address))
      .sort((a, b) => {
        const aProvider = String(a.provider ?? '').toLowerCase()
        const bProvider = String(b.provider ?? '').toLowerCase()
        if (aProvider.includes('privy') !== bProvider.includes('privy')) {
          return aProvider.includes('privy') ? 1 : -1
        }
        const aMs = Date.parse(String(a.verifiedAt ?? ''))
        const bMs = Date.parse(String(b.verifiedAt ?? ''))
        if (Number.isFinite(aMs) && Number.isFinite(bMs)) return bMs - aMs
        if (Number.isFinite(aMs)) return -1
        if (Number.isFinite(bMs)) return 1
        return String(a.address ?? '').localeCompare(String(b.address ?? ''))
      })[0]

    const candidates: Array<string | null | undefined> = [
      canonicalFromAccounts?.address,
      row.cswAddress,
      row.primarySmartWallet,
      row.baseSubAccount,
    ]
    for (const value of candidates) {
      if (!isAddressLike(value)) continue
      return getAddress(value).toLowerCase()
    }
    return null
  }, [waitlistMeQuery.data])

  const connectedAddressLc = useMemo(() => {
    if (!address || !isAddress(address)) return null
    return getAddress(address).toLowerCase()
  }, [address])

  const connectedOwnerQuery = useQuery({
    queryKey: ['swap', 'can-operate-canonical', canonicalSmartWalletAddress, connectedAddressLc],
    enabled: Boolean(canonicalSmartWalletAddress && connectedAddressLc && publicClient),
    staleTime: 10_000,
    queryFn: async () => {
      if (!canonicalSmartWalletAddress || !connectedAddressLc || !publicClient) return false
      try {
        const isOwner = (await publicClient.readContract({
          address: canonicalSmartWalletAddress as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [connectedAddressLc as `0x${string}`],
        })) as boolean
        return isOwner === true
      } catch {
        return false
      }
    },
  })

  const parsedSlippage = useMemo(() => {
    const n = Number(slippagePct)
    if (!Number.isFinite(n) || n <= 0) return 0.5
    return Math.min(5, n)
  }, [slippagePct])

  const tokenOptions = useMemo<TokenOption[]>(() => {
    const creatorCoin = (searchParams.get('token') ?? '').trim()
    const shareCoin = (searchParams.get('share') ?? searchParams.get('shareToken') ?? '').trim()
    const base = [...CORE_TOKENS]

    if (isAddress(creatorCoin)) {
      base.push({ symbol: 'Creator Coin', address: getAddress(creatorCoin), group: 'creator' })
    }
    if (isAddress(shareCoin)) {
      base.push({ symbol: 'Share Token', address: getAddress(shareCoin), group: 'share' })
    }

    const seen = new Set<string>()
    return base.filter((token) => {
      const lc = token.address.toLowerCase()
      if (seen.has(lc)) return false
      seen.add(lc)
      return true
    })
  }, [searchParams])

  const tokenInSymbol = useMemo(() => {
    const match = tokenOptions.find((opt) => opt.address.toLowerCase() === tokenIn.toLowerCase())
    return match?.symbol ?? shortAddress(tokenIn)
  }, [tokenIn, tokenOptions])

  const tokenOutSymbol = useMemo(() => {
    const match = tokenOptions.find((opt) => opt.address.toLowerCase() === tokenOut.toLowerCase())
    return match?.symbol ?? shortAddress(tokenOut)
  }, [tokenOut, tokenOptions])

  const signerAddress = connectedAddressLc ? (connectedAddressLc as `0x${string}`) : null
  const canonicalAddress = canonicalSmartWalletAddress ? (canonicalSmartWalletAddress as `0x${string}`) : null
  const canOperateCanonical = connectedOwnerQuery.data === true
  const identityReady = Boolean(canonicalAddress && signerAddress && walletClient && publicClient && canOperateCanonical)
  const isReady = isAddress(tokenIn) && isAddress(tokenOut) && Number(amountInUnits) > 0 && Boolean(canonicalAddress)
  const approvalTx = approvalData?.approval as Record<string, unknown> | undefined
  const approvalRequired = Boolean(approvalTx?.to && approvalTx?.data)

  async function getTokenDecimals(token: string): Promise<number> {
    if (!publicClient || !isAddress(token)) return 18
    try {
      const decimals = await publicClient.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      return Number(decimals)
    } catch {
      return 18
    }
  }

  async function handleQuote() {
    if (!address || !isReady) return
    setBusy('quote')
    setError('')
    setStatus('')
    try {
      const tokenInDecimals = await getTokenDecimals(tokenIn)
      const amount = parseUnits(amountInUnits, tokenInDecimals).toString()
      const data = await fetchTradeQuote({
        tokenIn,
        tokenOut,
        tokenInChainId: BASE_CHAIN_ID,
        tokenOutChainId: BASE_CHAIN_ID,
        type: 'EXACT_INPUT',
        amount,
        swapper: canonicalAddress!,
        slippageTolerance: parsedSlippage,
      })
      setQuote(data)
      setApprovalData(null)
      setSwapTx(null)
      const outRaw = getNestedAmountOut(pickSwapQuote(data) ?? data)
      if (outRaw) {
        const tokenOutDecimals = await getTokenDecimals(tokenOut)
        setEstimatedOut(formatUnits(BigInt(outRaw), tokenOutDecimals))
      } else {
        setEstimatedOut('')
      }
      setStatus(`Quote ready for canonical CSW (routing=${String(data.routing ?? 'unknown')})`)
    } catch (e: any) {
      setEstimatedOut('')
      setError(e?.message || 'Quote failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleCheckApproval() {
    if (!canonicalAddress || !isReady) return
    setBusy('approval')
    setError('')
    setStatus('')
    try {
      const tokenInDecimals = await getTokenDecimals(tokenIn)
      const amount = parseUnits(amountInUnits, tokenInDecimals).toString()
      const data = await checkTradeApproval({
        walletAddress: canonicalAddress,
        token: tokenIn,
        amount,
        chainId: BASE_CHAIN_ID,
        tokenOut,
        tokenOutChainId: BASE_CHAIN_ID,
        includeGasInfo: true,
      })
      setApprovalData(data)
      setStatus('Approval check complete')
    } catch (e: any) {
      setError(e?.message || 'Approval check failed')
    } finally {
      setBusy(null)
    }
  }

  async function handleBuildSwap() {
    if (!quote) return
    setBusy('buildSwap')
    setError('')
    setStatus('')
    try {
      const selectedQuote = pickSwapQuote(quote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const data = await buildSwap({
        quote: selectedQuote,
        refreshGasPrice: true,
        simulateTransaction: true,
      })
      assertValidSwapTransaction(data.swap)
      setSwapTx(data.swap)
      setStatus('Swap transaction built')
    } catch (e: any) {
      setError(e?.message || 'Swap build failed')
    } finally {
      setBusy(null)
    }
  }

  function handleSwitchTokens() {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setQuote(null)
    setApprovalData(null)
    setSwapTx(null)
    setEstimatedOut('')
    setStatus('')
    setError('')
  }

  async function handleReviewTrade() {
    if (!canonicalAddress || !identityReady || !isReady) return
    setBusy('review')
    setError('')
    setStatus('')
    try {
      const tokenInDecimals = await getTokenDecimals(tokenIn)
      const tokenOutDecimals = await getTokenDecimals(tokenOut)
      const amount = parseUnits(amountInUnits, tokenInDecimals).toString()

      const nextQuote = await fetchTradeQuote({
        tokenIn,
        tokenOut,
        tokenInChainId: BASE_CHAIN_ID,
        tokenOutChainId: BASE_CHAIN_ID,
        type: 'EXACT_INPUT',
        amount,
        swapper: canonicalAddress,
        slippageTolerance: parsedSlippage,
      })
      setQuote(nextQuote)

      const outRaw = getNestedAmountOut(pickSwapQuote(nextQuote) ?? nextQuote)
      if (outRaw) setEstimatedOut(formatUnits(BigInt(outRaw), tokenOutDecimals))
      else setEstimatedOut('')

      const nextApproval = await checkTradeApproval({
        walletAddress: canonicalAddress,
        token: tokenIn,
        amount,
        chainId: BASE_CHAIN_ID,
        tokenOut,
        tokenOutChainId: BASE_CHAIN_ID,
        includeGasInfo: true,
      })
      setApprovalData(nextApproval)

      const selectedQuote = pickSwapQuote(nextQuote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const built = await buildSwap({
        quote: selectedQuote,
        refreshGasPrice: true,
        simulateTransaction: true,
      })
      assertValidSwapTransaction(built.swap)
      setSwapTx(built.swap)
      setStatus('Review ready')
      setConfirmIntent('swap')
    } catch (e: any) {
      setError(e?.message || 'Unable to prepare trade')
    } finally {
      setBusy(null)
    }
  }

  async function executeViaCanonical4337(params: {
    calls: Array<{ to: `0x${string}`; data?: `0x${string}`; value?: bigint }>
    successLabel: string
  }) {
    if (!canonicalAddress || !signerAddress || !walletClient || !publicClient) {
      throw new Error('Canonical smart wallet or owner signer is not ready')
    }
    const paymasterEnv = import.meta.env.VITE_CDP_PAYMASTER_URL as string | undefined
    const bundlerUrl = resolveCdpPaymasterUrl(paymasterEnv) || '/api/paymaster'
    const result = await sendCoinbaseSmartWalletUserOperation({
      publicClient: publicClient as any,
      walletClient: walletClient as any,
      bundlerUrl,
      smartWallet: canonicalAddress,
      ownerAddress: signerAddress,
      calls: params.calls,
      version: '1',
    })
    setStatus(`${params.successLabel}: ${result.transactionHash}`)
  }

  async function executeApprovalNow() {
    if (!approvalData) return
    const tx = approvalData.approval as Record<string, unknown> | undefined
    if (!tx?.to || !tx?.data) {
      setStatus('No approval transaction required')
      return
    }
    setBusy('executeApproval')
    setError('')
    try {
      await executeViaCanonical4337({
        calls: [
          {
            to: tx.to as `0x${string}`,
            data: tx.data as `0x${string}`,
            value: asBigInt(tx.value),
          },
        ],
        successLabel: 'Approval submitted via ERC-4337',
      })
    } catch (e: any) {
      const message = e?.message || 'Approval transaction failed'
      setError(message)
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }

  async function executeSwapNow() {
    if (!swapTx) return
    assertValidSwapTransaction(swapTx)
    setBusy('executeSwap')
    setError('')
    try {
      await executeViaCanonical4337({
        calls: [
          {
            to: swapTx.to as `0x${string}`,
            data: swapTx.data as `0x${string}`,
            value: asBigInt(swapTx.value),
          },
        ],
        successLabel: 'Swap submitted via canonical ERC-4337',
      })
    } catch (e: any) {
      const message = e?.message || 'Swap transaction failed'
      setError(message)
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }

  function openConfirm(intent: 'approval' | 'swap') {
    setConfirmIntent(intent)
  }

  function closeConfirm() {
    if (busy) return
    setConfirmIntent(null)
  }

  async function confirmAndExecute() {
    if (!confirmIntent || busy) return
    const action = confirmIntent
    setConfirmIntent(null)
    try {
      if (action === 'approval') await executeApprovalNow()
      if (action === 'swap') {
        if (approvalRequired) await executeApprovalNow()
        await executeSwapNow()
      }
    } catch {
      // Errors are already surfaced via `setError`.
    }
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-4"
          >
            <div className="rounded-[28px] border border-white/10 bg-black/45 p-6 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Uniswap routing</div>
                  <h1 className="mt-1 text-2xl font-semibold text-white">Trade</h1>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="rounded-full border border-white/15 p-2 text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
                  title="Trade settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#101114]/90 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Sell</div>
                <div className="flex items-end justify-between gap-3">
                  <input
                    className="w-full bg-transparent text-4xl leading-none font-medium text-white outline-none"
                    value={amountInUnits}
                    onChange={(e) => setAmountInUnits(e.target.value)}
                    placeholder="0.0"
                  />
                  <select
                    value={tokenIn}
                    onChange={(e) => setTokenIn(e.target.value)}
                    className="rounded-full border border-white/20 bg-[#15161b] px-3 py-2 text-sm font-medium text-white"
                  >
                    <optgroup label="Core tokens">
                      {tokenOptions.filter((opt) => opt.group === 'core').map((opt) => (
                        <option key={opt.address} value={opt.address}>{opt.symbol}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Creator ecosystem">
                      {tokenOptions.filter((opt) => opt.group !== 'core').map((opt) => (
                        <option key={opt.address} value={opt.address}>{opt.symbol}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="text-xs text-zinc-500 break-all">{tokenIn}</div>
              </div>

              <div className="relative z-10 -my-3 flex justify-center">
                <button
                  type="button"
                  onClick={handleSwitchTokens}
                  className="rounded-xl border border-white/20 bg-[#15161b] p-2 text-zinc-300 transition hover:text-white"
                  title="Switch tokens"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-[#101114]/90 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Buy</div>
                <div className="flex items-end justify-between gap-3">
                  <div className="w-full text-4xl leading-none font-medium text-white">
                    {estimatedOut ? formatDisplayAmount(estimatedOut) : '0.0'}
                  </div>
                  <select
                    value={tokenOut}
                    onChange={(e) => setTokenOut(e.target.value)}
                    className="rounded-full border border-white/20 bg-[#15161b] px-3 py-2 text-sm font-medium text-white"
                  >
                    <optgroup label="Core tokens">
                      {tokenOptions.filter((opt) => opt.group === 'core').map((opt) => (
                        <option key={opt.address} value={opt.address}>{opt.symbol}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Creator ecosystem">
                      {tokenOptions.filter((opt) => opt.group !== 'core').map((opt) => (
                        <option key={opt.address} value={opt.address}>{opt.symbol}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="text-xs text-zinc-500 break-all">{tokenOut}</div>
              </div>

              <button
                type="button"
                onClick={handleReviewTrade}
                disabled={!isConnected || !identityReady || !isReady || busy !== null}
                className="mt-4 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-lg font-semibold text-white transition hover:bg-fuchsia-400 disabled:opacity-50"
              >
                {busy === 'review' ? 'Reviewing…' : 'Review trade'}
              </button>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Pair: {tokenInSymbol} / {tokenOutSymbol}</div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">Slippage {parsedSlippage}%</div>
              </div>

              {status ? <div className="mt-2 text-xs text-emerald-300">{status}</div> : null}
              {error ? <div className="mt-2 text-xs text-rose-300">{error}</div> : null}
              {!isConnected ? <div className="mt-3"><ConnectButtonWeb3 /></div> : null}
              {isConnected && !identityReady ? (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  Connect an owner signer for your canonical smart wallet to trade.
                </div>
              ) : null}

              {showAdvanced ? (
                <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div>
                    <label className="label">Slippage %</label>
                    <input
                      className="mt-1 w-full rounded-xl border border-zinc-700 bg-black/30 px-3 py-2 text-xs"
                      value={slippagePct}
                      onChange={(e) => setSlippagePct(e.target.value)}
                      placeholder="0.5"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleQuote} disabled={busy !== null || !identityReady} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Quote</button>
                    <button type="button" onClick={handleCheckApproval} disabled={busy !== null || !identityReady} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Approval</button>
                    <button type="button" onClick={handleBuildSwap} disabled={busy !== null || !quote} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Build</button>
                    <button type="button" onClick={() => openConfirm('approval')} disabled={busy !== null || !approvalRequired} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Approve now</button>
                    <button type="button" onClick={() => openConfirm('swap')} disabled={busy !== null || !swapTx} className="rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] disabled:opacity-50">Swap now</button>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="space-y-3"
          >
            <div className="rounded-3xl border border-white/10 bg-black/35 p-5 backdrop-blur-xl">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">Supported assets</h2>
              <div className="mt-3 space-y-2 text-sm text-zinc-200">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">ETH · USDC · BTC · USDT · ZORA</div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Creator coins + share tokens (when opened from a creator page)</div>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/35 p-5 text-sm text-zinc-300 backdrop-blur-xl">
              Powered by Uniswap routing on Base and executed from your canonical smart wallet for a premium, secure trading experience.
            </div>
          </motion.aside>
        </div>
      </section>
      {confirmIntent ? (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-4">
            <div className="text-white font-semibold text-lg">Review trade</div>
            <div className="text-xs text-zinc-400 space-y-1">
              <div>Action: {confirmIntent === 'approval' ? 'Approval transaction' : 'Swap transaction'}</div>
              <div>Executor: {canonicalAddress ?? 'N/A'}</div>
              <div>Owner signer: {signerAddress ?? 'N/A'}</div>
              <div>Pair: {tokenInSymbol} → {tokenOutSymbol}</div>
              <div>Amount: {amountInUnits} {tokenInSymbol}</div>
              <div>Estimated out: {estimatedOut || 'N/A'} {tokenOutSymbol}</div>
              {approvalRequired && confirmIntent === 'swap' ? (
                <div className="text-amber-300">Approval required first. We will submit approval, then swap.</div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={busy !== null}
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmAndExecute()
                }}
                disabled={busy !== null}
                className="btn-accent rounded-full px-4 py-2 text-xs disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
