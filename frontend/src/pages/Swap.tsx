import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { erc20Abi, getAddress, isAddress, parseUnits } from 'viem'
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

function isAddressLike(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim())
}

function asBigInt(v: unknown): bigint {
  if (typeof v === 'bigint') return v
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.floor(v))
  if (typeof v === 'string' && v.trim()) return BigInt(v)
  return 0n
}

export function Swap() {
  const [searchParams] = useSearchParams()
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [tokenIn, setTokenIn] = useState<string>(CONTRACTS.usdc)
  const [tokenOut, setTokenOut] = useState<string>('')
  const [amountInUnits, setAmountInUnits] = useState<string>('1')
  const [slippagePct, setSlippagePct] = useState<string>('0.5')
  const [quote, setQuote] = useState<TradeQuoteResponse | null>(null)
  const [approvalData, setApprovalData] = useState<Record<string, unknown> | null>(null)
  const [swapTx, setSwapTx] = useState<TransactionRequest | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [confirmIntent, setConfirmIntent] = useState<'approval' | 'swap' | null>(null)

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

  const signerAddress = connectedAddressLc ? (connectedAddressLc as `0x${string}`) : null
  const canonicalAddress = canonicalSmartWalletAddress ? (canonicalSmartWalletAddress as `0x${string}`) : null
  const canOperateCanonical = connectedOwnerQuery.data === true
  const identityReady = Boolean(canonicalAddress && signerAddress && walletClient && publicClient && canOperateCanonical)
  const isReady = isAddress(tokenIn) && isAddress(tokenOut) && Number(amountInUnits) > 0 && Boolean(canonicalAddress)

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
      setStatus(`Quote ready for canonical CSW (routing=${String(data.routing ?? 'unknown')})`)
    } catch (e: any) {
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
      setError(e?.message || 'Approval transaction failed')
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
      setError(e?.message || 'Swap transaction failed')
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
    if (action === 'approval') await executeApprovalNow()
    if (action === 'swap') await executeSwapNow()
  }

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-8">
            <span className="label">Swap</span>
            <h1 className="headline text-4xl sm:text-6xl mt-4">Uniswap Trading API</h1>
            <p className="text-zinc-500 text-sm font-light mt-3 max-w-3xl">
              Creator coin and vault swaps execute through the canonical Coinbase Smart Wallet via ERC-4337 UserOps.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
              <div>
                <label className="label">Token In (Base)</label>
                <input
                  className="mt-1 w-full bg-black/30 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                  value={tokenIn}
                  onChange={(e) => setTokenIn(e.target.value.trim())}
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="label">Token Out (Base)</label>
                <input
                  className="mt-1 w-full bg-black/30 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                  value={tokenOut}
                  onChange={(e) => setTokenOut(e.target.value.trim())}
                  placeholder="0x..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount In (token units)</label>
                  <input
                    className="mt-1 w-full bg-black/30 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    value={amountInUnits}
                    onChange={(e) => setAmountInUnits(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="label">Slippage %</label>
                  <input
                    className="mt-1 w-full bg-black/30 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                    value={slippagePct}
                    onChange={(e) => setSlippagePct(e.target.value)}
                    placeholder="0.5"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleQuote}
                  disabled={!isReady || busy !== null || !identityReady}
                  className="btn-accent rounded-full px-4 py-2 text-xs disabled:opacity-50"
                >
                  {busy === 'quote' ? 'Quoting…' : '1) Get Quote'}
                </button>
                <button
                  type="button"
                  onClick={handleCheckApproval}
                  disabled={!isReady || busy !== null || !identityReady}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-xs disabled:opacity-50"
                >
                  {busy === 'approval' ? 'Checking…' : '2) Check Approval'}
                </button>
                <button
                  type="button"
                  onClick={handleBuildSwap}
                  disabled={!quote || busy !== null || !identityReady}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-xs disabled:opacity-50"
                >
                  {busy === 'buildSwap' ? 'Building…' : '3) Build Swap Tx'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openConfirm('approval')}
                  disabled={!approvalData || busy !== null || !identityReady}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-xs disabled:opacity-50"
                >
                  {busy === 'executeApproval' ? 'Sending…' : '4) Execute Approval (ERC-4337)'}
                </button>
                <button
                  type="button"
                  onClick={() => openConfirm('swap')}
                  disabled={!swapTx || busy !== null || !identityReady}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-xs disabled:opacity-50"
                >
                  {busy === 'executeSwap' ? 'Sending…' : '5) Execute Swap (ERC-4337)'}
                </button>
              </div>

              {status ? <div className="text-emerald-300 text-xs">{status}</div> : null}
              {error ? <div className="text-rose-300 text-xs">{error}</div> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-4">
              <div className="label">Execution Wallet</div>
              {isConnected ? (
                <div className="space-y-2 text-xs">
                  <div className="text-zinc-500">Connected signer</div>
                  <div className="text-zinc-300 break-all">{address}</div>
                  <div className="text-zinc-500 mt-2">Canonical smart wallet (executor)</div>
                  <div className="text-zinc-300 break-all">{canonicalAddress ?? 'Not detected'}</div>
                  <div className="text-zinc-500 mt-2">Owner check</div>
                  <div className={canOperateCanonical ? 'text-emerald-300' : 'text-amber-300'}>
                    {canOperateCanonical ? 'Connected signer can operate canonical CSW' : 'Signer is not an owner of canonical CSW'}
                  </div>
                </div>
              ) : (
                <ConnectButtonWeb3 />
              )}
              <div className="text-[11px] text-zinc-500">
                Swap execution is pinned to canonical ERC-4337 flow, matching Zora-style smart-wallet behavior.
              </div>
              {!canonicalAddress ? (
                <div className="text-[11px] text-amber-300">
                  Canonical smart wallet not detected from your profile. Complete account setup or reconnect your canonical wallet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <pre className="lg:col-span-1 rounded-2xl border border-white/10 bg-black/30 p-4 text-[11px] text-zinc-300 overflow-auto max-h-80">
              {quote ? JSON.stringify(quote, null, 2) : 'Quote response'}
            </pre>
            <pre className="lg:col-span-1 rounded-2xl border border-white/10 bg-black/30 p-4 text-[11px] text-zinc-300 overflow-auto max-h-80">
              {approvalData ? JSON.stringify(approvalData, null, 2) : 'Approval response'}
            </pre>
            <pre className="lg:col-span-1 rounded-2xl border border-white/10 bg-black/30 p-4 text-[11px] text-zinc-300 overflow-auto max-h-80">
              {swapTx ? JSON.stringify(swapTx, null, 2) : 'Swap transaction'}
            </pre>
          </div>
        </div>
      </section>
      {confirmIntent ? (
        <div className="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-4">
            <div className="text-white font-semibold text-lg">Confirm canonical ERC-4337 execution</div>
            <div className="text-xs text-zinc-400 space-y-1">
              <div>Action: {confirmIntent === 'approval' ? 'Approval transaction' : 'Swap transaction'}</div>
              <div>Executor: {canonicalAddress ?? 'N/A'}</div>
              <div>Owner signer: {signerAddress ?? 'N/A'}</div>
              <div>
                Pair: {tokenIn} → {tokenOut}
              </div>
              <div>Amount: {amountInUnits}</div>
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

