import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatUnits, getAddress, isAddress, parseUnits, erc20Abi, type Address } from 'viem'
import { base } from 'viem/chains'
import { toast } from 'sonner'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  Clock,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { AccountModeIndicator } from '@/components/ui/AccountModeIndicator'
import { AKITA, CONTRACTS } from '../config/contracts'
import { ClaimPrizeToSolana } from '../components/ClaimPrizeToSolana'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageMeta, META } from '@/components/seo/PageMeta'
import { CcaAuctionPanel } from '@/components/cca/CcaAuctionPanel'
import { useTokenMetadata } from '@/hooks/useTokenMetadata'
import { useZoraCoin } from '@/lib/zora/hooks'
import { resolveVaultByAnyAddress } from '@/lib/onchain/vaultResolve'
import { OrbBorder } from '@/components/brand/OrbBorder'
import { TokenOrb } from '@/components/brand/TokenOrb'
import { SHARE_SYMBOL_PREFIX, toShareSymbol } from '@/lib/tokenSymbols'

// ABIs
const WRAPPER_ABI = [
  { name: 'deposit', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
  { name: 'withdraw', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'uint256' }], stateMutability: 'nonpayable' },
] as const

const SHARE_OFT_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'totalSupply', type: 'function', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
] as const

const CCA_STRATEGY_ABI = [
  {
    name: 'getAuctionStatus',
    type: 'function',
    inputs: [],
    outputs: [
      { name: 'auction', type: 'address' },
      { name: 'isActive', type: 'bool' },
      { name: 'isGraduated', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' },
      { name: 'currencyRaised', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

const tabs = ['Deposit', 'Withdraw'] as const
type TabType = typeof tabs[number]
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as Address
const ZERO_ADDRESS = addr('0000000000000000000000000000000000000000')

function TokenAvatar({
  image,
  symbol,
  badge,
}: {
  image: string
  symbol: string
  badge?: string
}) {
  return (
    <div className="relative w-11 h-11 shrink-0">
      <div className="absolute inset-0 rounded-full overflow-hidden bg-black border border-white/10 shadow-[inset_0_0_24px_rgba(0,0,0,0.9)]">
        {image ? (
          <img src={image} alt={symbol} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-white/6 via-black to-black">
            <span className="font-serif text-white/80 select-none">{symbol.trim()?.[0]?.toUpperCase() || '?'}</span>
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_32px_rgba(0,0,0,0.85)]" />
        <div className="absolute inset-0 pointer-events-none opacity-35 mix-blend-overlay bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.75)_0%,transparent_60%)]" />
      </div>

      {badge ? (
        <div
          className="absolute -bottom-1 -right-1 rounded-full backdrop-blur-md border border-brand-primary/20 bg-black/70 text-brand-accent font-mono leading-none text-[10px] px-2 py-0.5"
          aria-label={badge === SHARE_SYMBOL_PREFIX ? `Share token (${SHARE_SYMBOL_PREFIX}TOKEN)` : badge}
          title={badge === SHARE_SYMBOL_PREFIX ? `Share token (${SHARE_SYMBOL_PREFIX}TOKEN)` : badge}
        >
          {badge}
        </div>
      ) : null}
    </div>
  )
}

function VaultChatCard() {
  return (
    <div className="card p-5 space-y-3 opacity-60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-primary" />
          <span className="label">Vault Chat</span>
        </div>
        <span className="text-[10px] rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-zinc-500">
          Coming soon
        </span>
      </div>
      <p className="text-xs text-zinc-600 leading-relaxed">
        Group chat for vault holders will be available here once messaging is live.
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/4 text-zinc-600 text-xs font-medium py-2.5 cursor-not-allowed"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Chat not yet available
      </button>
    </div>
  )
}

export function Vault() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const addressParamRaw = typeof params.address === 'string' ? params.address.trim() : ''
  const addressParam = addressParamRaw && isAddress(addressParamRaw) ? (getAddress(addressParamRaw) as Address) : null

  // Solana claim deep-link: ?claim=solana&solanaPubkey=...&prizeAmount=...
  const solanaClaimMode = searchParams.get('claim') === 'solana'
  const solanaPubkeyParam = searchParams.get('solanaPubkey')
  const prizeAmountParam = searchParams.get('prizeAmount') ?? ''

  const akitaFallback = useMemo(() => {
    if (!addressParam) return false
    const lc = addressParam.toLowerCase()
    return (
      lc === String(AKITA.vault).toLowerCase() ||
      lc === String(AKITA.wrapper).toLowerCase() ||
      lc === String(AKITA.shareOFT).toLowerCase() ||
      lc === String(AKITA.token).toLowerCase() ||
      lc === String(AKITA.ccaStrategy).toLowerCase()
    )
  }, [addressParam])

  const publicClient = usePublicClient({ chainId: base.id })
  const { data: resolved, isLoading: resolveLoading, error: resolveError } = useQuery({
    queryKey: ['vaultResolve', base.id, addressParam ?? ''],
    queryFn: async () => {
      if (!publicClient || !addressParam) return null
      return await resolveVaultByAnyAddress(publicClient, addressParam)
    },
    enabled: Boolean(publicClient && addressParam),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  })

  const queryClient = useQueryClient()
  const { address: userAddress } = useAccount()
  const [activeTab, setActiveTab] = useState<TabType>('Deposit')
  const [amount, setAmount] = useState('')
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [lastSuccess, setLastSuccess] = useState<string | null>(null)

  const tokenAddress = (resolved?.token ?? (akitaFallback ? (AKITA.token as Address) : null)) as Address | null
  const wrapperAddress = (resolved?.info.wrapper ?? (akitaFallback ? (AKITA.wrapper as Address) : null)) as Address | null
  const shareOFTAddress = (resolved?.info.shareOFT ?? (akitaFallback ? (AKITA.shareOFT as Address) : null)) as Address | null
  const vaultAddress = (resolved?.info.vault ?? (akitaFallback ? (AKITA.vault as Address) : null)) as Address | null
  const ccaStrategy = (resolved?.ccaStrategy ?? (akitaFallback ? (AKITA.ccaStrategy as Address) : null)) as Address | null

  const underlyingSymbol = useMemo(() => {
    const s = (resolved?.info.symbol ?? '').trim()
    if (s) return s
    return akitaFallback ? 'AKITA' : 'TOKEN'
  }, [akitaFallback, resolved?.info.symbol])

  const shareSymbol = useMemo(() => toShareSymbol(underlyingSymbol), [underlyingSymbol])

  const tokenDecimalsEnabled = Boolean(tokenAddress)
  const shareDecimalsEnabled = Boolean(shareOFTAddress)

  const { data: tokenDecimals } = useReadContract({
    address: (tokenAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: tokenDecimalsEnabled },
  })

  const { data: shareDecimals } = useReadContract({
    address: (shareOFTAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: shareDecimalsEnabled },
  })

  const creatorDecimals = typeof tokenDecimals === 'number' ? tokenDecimals : 18
  const shareTokenDecimals = typeof shareDecimals === 'number' ? shareDecimals : 18

  const prizeAmountRaw = useMemo(() => {
    if (!prizeAmountParam) return 0n
    const trimmed = prizeAmountParam.trim()
    if (!trimmed) return 0n

    try {
      if (trimmed.includes('.')) {
        return parseUnits(trimmed, shareTokenDecimals ?? 18)
      }
      if (/^\d+$/.test(trimmed)) {
        return BigInt(trimmed)
      }
      return 0n
    } catch {
      return 0n
    }
  }, [prizeAmountParam, shareTokenDecimals])

  const prizeAmountDisplay = useMemo(() => {
    if (!prizeAmountParam) return '0'
    const trimmed = prizeAmountParam.trim()
    if (!trimmed) return '0'
    if (trimmed.includes('.')) return trimmed
    if (!/^\d+$/.test(trimmed)) return '0'
    return formatUnits(BigInt(trimmed), shareTokenDecimals ?? 18)
  }, [prizeAmountParam, shareTokenDecimals])

  const { data: tokenBalance } = useReadContract({
    address: (tokenAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress && Boolean(tokenAddress) },
  })

  const { data: shareBalance } = useReadContract({
    address: (shareOFTAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'balanceOf',
    args: [userAddress!],
    query: { enabled: !!userAddress && Boolean(shareOFTAddress) },
  })

  const { data: totalShareSupply } = useReadContract({
    address: (shareOFTAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: SHARE_OFT_ABI,
    functionName: 'totalSupply',
    query: { enabled: Boolean(shareOFTAddress) },
  })

  const { data: auctionStatus } = useReadContract({
    address: (ccaStrategy ?? ZERO_ADDRESS) as `0x${string}`,
    abi: CCA_STRATEGY_ABI,
    functionName: 'getAuctionStatus',
    query: { enabled: Boolean(ccaStrategy) },
  })

  const { data: tokenAllowance } = useReadContract({
    address: (tokenAddress ?? ZERO_ADDRESS) as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress!, (wrapperAddress ?? ZERO_ADDRESS) as `0x${string}`],
    query: { enabled: !!userAddress && activeTab === 'Deposit' && Boolean(wrapperAddress) && Boolean(tokenAddress) },
  })

  const { writeContract: writeApprove, data: approveHash } = useWriteContract()
  const { writeContract: writeDeposit, data: depositHash } = useWriteContract()
  const { writeContract: writeWithdraw, data: withdrawHash } = useWriteContract()

  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isDepositing, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash })
  const { isLoading: isWithdrawing, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash })

  // Refresh balances and show success messages after confirmed transactions
  useEffect(() => {
    if (!approveSuccess) return
    void queryClient.invalidateQueries()
    toast.success('Token approval confirmed')
  }, [approveSuccess, queryClient])

  useEffect(() => {
    if (!depositSuccess) return
    void queryClient.invalidateQueries()
    setLastSuccess(`Deposit confirmed — your ${shareSymbol} balance has been updated.`)
    setAmount('')
    toast.success('Deposit confirmed')
  }, [depositSuccess, queryClient, shareSymbol])

  useEffect(() => {
    if (!withdrawSuccess) return
    void queryClient.invalidateQueries()
    setLastSuccess(`Withdrawal confirmed — your ${underlyingSymbol} balance has been updated.`)
    setAmount('')
    toast.success('Withdrawal confirmed')
  }, [withdrawSuccess, queryClient, underlyingSymbol])

  const isAuctionActive = auctionStatus?.[1] || false
  const isGraduated = auctionStatus?.[2] || false
  const isUnlocked = isAuctionActive || isGraduated
  const canManageVault = isGraduated
  const phaseLabel = isAuctionActive ? 'Auction Phase' : isGraduated ? 'Vault Active' : 'Not Launched'

  // Prefer Zora indexed preview image (fast), then onchain tokenURI metadata.
  const { data: zoraCoin } = useZoraCoin(tokenAddress ?? undefined)
  const zoraPreview =
    zoraCoin?.mediaContent?.previewImage?.medium ||
    zoraCoin?.mediaContent?.previewImage?.small ||
    undefined
  const { imageUrl } = useTokenMetadata(shareOFTAddress ?? tokenAddress ?? undefined)
  const heroImage = imageUrl || zoraPreview || '/logo.svg'

  const formatAmount = (value: bigint, decimals: number = 18) => {
    if (!value) return '0'
    return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    })
  }

  // Amount validation
  const amountError = useMemo((): string | null => {
    if (!amount) return null
    const n = parseFloat(amount)
    if (Number.isNaN(n) || n < 0) return 'Enter a valid amount'
    if (n === 0) return 'Amount must be greater than zero'
    if (activeTab === 'Deposit' && tokenBalance !== undefined) {
      try {
        const maxRaw = parseUnits(amount, creatorDecimals)
        if (maxRaw > tokenBalance) return `Exceeds your ${underlyingSymbol} balance`
      } catch { /* ignore parse error */ }
    }
    if (activeTab === 'Withdraw' && shareBalance !== undefined) {
      try {
        const maxRaw = parseUnits(amount, shareTokenDecimals)
        if (maxRaw > shareBalance) return `Exceeds your ${shareSymbol} balance`
      } catch { /* ignore parse error */ }
    }
    return null
  }, [amount, activeTab, tokenBalance, shareBalance, creatorDecimals, shareTokenDecimals, underlyingSymbol, shareSymbol])

  const handleApprove = () => {
    if (!amount || !tokenAddress || !wrapperAddress || amountError) return
    setVaultError(null)
    writeApprove(
      {
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [wrapperAddress as `0x${string}`, parseUnits(amount, creatorDecimals)],
      },
      {
        onError: (err) => {
          const msg = err?.message?.includes('rejected') || err?.message?.includes('denied')
            ? 'Approval cancelled.'
            : `Approval failed: ${err?.message?.slice(0, 80) ?? 'Unknown error'}`
          setVaultError(msg)
          toast.error(msg)
        },
      },
    )
  }

  const handleDeposit = () => {
    if (!amount || !tokenAddress || !wrapperAddress || amountError) return
    setVaultError(null)
    setLastSuccess(null)
    writeDeposit(
      {
        address: wrapperAddress as `0x${string}`,
        abi: WRAPPER_ABI,
        functionName: 'deposit',
        args: [parseUnits(amount, creatorDecimals)],
      },
      {
        onError: (err) => {
          const msg = err?.message?.includes('rejected') || err?.message?.includes('denied')
            ? 'Transaction cancelled.'
            : `Deposit failed: ${err?.message?.slice(0, 80) ?? 'Unknown error'}`
          setVaultError(msg)
          toast.error(msg)
        },
      },
    )
  }

  const handleWithdraw = () => {
    if (!amount || !wrapperAddress || amountError) return
    setVaultError(null)
    setLastSuccess(null)
    writeWithdraw(
      {
        address: wrapperAddress as `0x${string}`,
        abi: WRAPPER_ABI,
        functionName: 'withdraw',
        args: [parseUnits(amount, shareTokenDecimals)],
      },
      {
        onError: (err) => {
          const msg = err?.message?.includes('rejected') || err?.message?.includes('denied')
            ? 'Transaction cancelled.'
            : `Withdrawal failed: ${err?.message?.slice(0, 80) ?? 'Unknown error'}`
          setVaultError(msg)
          toast.error(msg)
        },
      },
    )
  }

  const needsApproval =
    activeTab === 'Deposit' &&
    Boolean(tokenAddress && wrapperAddress) &&
    (!tokenAllowance || tokenAllowance < parseUnits(amount || '0', creatorDecimals))

  const canResolve = Boolean(publicClient && addressParam)
  const showResolveError = canResolve && !akitaFallback && Boolean(resolveError)
  const showNotFound = canResolve && !akitaFallback && !resolveLoading && !resolved && !showResolveError

  if (!addressParam) {
    return (
      <div className="relative pb-24 md:pb-0">
        <section className="cinematic-section">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/5 bg-vault-bg/60 backdrop-blur-2xl px-6 py-10 sm:p-10">
              <span className="label">Vault</span>
              <h1 className="headline text-3xl sm:text-5xl mt-4">Invalid vault address</h1>
              <p className="text-zinc-600 text-sm font-light mt-4">Check the URL and try again.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/explore/creators" className="btn-accent btn-compact inline-flex items-center justify-center rounded-full text-xs">
                  Back to Explore
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (showResolveError || showNotFound) {
    return (
      <div className="relative pb-24 md:pb-0">
        <section className="cinematic-section">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/5 bg-vault-bg/60 backdrop-blur-2xl px-6 py-10 sm:p-10">
              <span className="label">Vault</span>
              <h1 className="headline text-3xl sm:text-5xl mt-4">
                {showResolveError ? 'Could not load vault' : 'Vault not registered'}
              </h1>
              <p className="text-zinc-600 text-sm font-light mt-4">
                {showResolveError
                  ? 'We could not resolve this vault from the onchain registry right now.'
                  : 'This address is not recognized by the onchain registry.'}
              </p>
              <div className="mt-3 text-[11px] font-mono text-zinc-600 break-all">{addressParam}</div>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/explore/creators" className="btn-accent btn-compact inline-flex items-center justify-center rounded-full text-xs">
                  Back to Explore
                </Link>
                <a
                  href={`https://basescan.org/address/${addressParam}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary btn-compact inline-flex items-center justify-center gap-2 rounded-full text-xs"
                >
                  View on Basescan <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (resolveLoading && !resolved && !akitaFallback) {
    return (
      <div className="relative pb-24 md:pb-0">
        <section className="cinematic-section">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="rounded-3xl border border-white/5 bg-[#080808]/50 backdrop-blur-2xl px-6 py-10 sm:p-10">
              <div className="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8 items-center">
                <div className="mx-auto lg:mx-0">
                  <Skeleton className="w-56 h-56 sm:w-64 sm:h-64 rounded-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-10 w-64" />
                  <Skeleton className="h-4 w-40" />
                  <div className="flex gap-3 mt-6">
                    <Skeleton className="h-9 w-32 rounded-full" />
                    <Skeleton className="h-9 w-32 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const vaultMeta = META.vault(underlyingSymbol)

  return (
    <div className="relative pb-24 md:pb-0">
      <PageMeta
        title={vaultMeta.title}
        description={vaultMeta.description}
        canonicalPath={vaultAddress ? `/vault/${vaultAddress}` : undefined}
      />
      {/* Particle atmosphere */}
      <div className="particles">
        <div className="absolute top-1/3 right-1/4 w-px h-px bg-amber-500 rounded-full" style={{ animation: 'particle-float 10s ease-in-out infinite' }} />
      </div>

      {/* Header */}
      <section className="cinematic-section">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative overflow-hidden rounded-3xl border border-white/5 bg-vault-bg/60 backdrop-blur-2xl px-6 py-10 sm:p-10"
          >
            {/* Atmosphere */}
            <motion.div
              aria-hidden
              animate={{ scale: [1, 1.12, 1], opacity: isUnlocked ? [0.18, 0.28, 0.18] : [0.08, 0.12, 0.08], x: [0, 40, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-32 -right-24 w-[640px] h-[640px] bg-brand-primary/10 rounded-full blur-[140px] pointer-events-none"
            />
            <motion.div
              aria-hidden
              animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.1, 0.06], y: [0, -30, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute -top-32 -left-24 w-[520px] h-[520px] bg-zinc-500/10 rounded-full blur-[140px] pointer-events-none"
            />

            <div className="relative z-10 grid lg:grid-cols-[260px_minmax(0,1fr)] gap-8 sm:gap-12 items-center">
              {/* Vessel */}
              <div className="mx-auto lg:mx-0">
                <div className="relative w-56 h-56 sm:w-64 sm:h-64">
                  <OrbBorder intensity={isUnlocked ? 'high' : 'medium'}>
                    <div className="w-full h-full p-[6px] bg-obsidian rounded-full">
                      <div className="w-full h-full rounded-full overflow-hidden relative shadow-[inset_0_0_20px_black]">
                        <TokenOrb image={heroImage} isUnlocked={isUnlocked} symbol={underlyingSymbol} />
                      </div>
                    </div>
                  </OrbBorder>

                  {/* Corner mark */}
                  <div className="absolute -bottom-2 -right-2 rounded-full backdrop-blur-md border border-brand-primary/20 bg-black/75 text-brand-accent font-mono leading-none text-xs px-2.5 py-1 min-w-[40px] text-center shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                    {shareSymbol || SHARE_SYMBOL_PREFIX}
                  </div>
                </div>
              </div>

              {/* HUD */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ opacity: isUnlocked ? [1, 0.55, 1] : 1 }}
                    transition={{ duration: 2.2, repeat: isUnlocked ? Infinity : 0, ease: 'easeInOut' }}
                    className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(212,175,55,0.35)] ${
                      isUnlocked ? 'bg-emerald-400' : 'bg-zinc-700'
                    }`}
                  />
                  <span className="text-[10px] tracking-[0.34em] uppercase font-medium text-zinc-500">
                    {phaseLabel}
                  </span>
                </div>

                <div className="mt-3 flex items-start justify-between gap-6">
                  <div className="min-w-0 max-w-2xl">
                    <span className="label mt-2 block">Creator Vault</span>
                    <h1 className="headline mt-3 text-4xl leading-[0.94] sm:text-6xl sm:leading-[0.92]">
                      {underlyingSymbol}{' '}
                      <span className="text-transparent bg-clip-text bg-linear-to-r from-brand-primary to-brand-accent italic">
                        Vault
                      </span>
                    </h1>
                    <p className="mt-4 max-w-[40ch] text-sm font-light leading-relaxed text-zinc-500 mono">
                      Deposit {underlyingSymbol || 'underlying token'} to mint {shareSymbol || 'vault shares'}
                    </p>
                    <p className="mt-1 max-w-[40ch] text-xs font-light leading-relaxed text-zinc-600 mono">
                      Redeem {shareSymbol || 'vault shares'} to withdraw {underlyingSymbol || 'underlying token'}
                    </p>
                  </div>

                  <div className="shrink-0 hidden sm:flex flex-col items-end gap-3">
                    <div className="bg-black/20 px-3 py-1.5 rounded-full border border-white/5 flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                      <span className="text-[10px] font-mono text-zinc-400">ERC-4626 • Base</span>
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex flex-col gap-3 border-t border-white/6 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  {wrapperAddress ? (
                    <a
                      href={`https://basescan.org/address/${wrapperAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                    >
                      View wrapper <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : null}
                  {vaultAddress ? (
                    <Link
                      to={`/status?vault=${encodeURIComponent(vaultAddress)}`}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                      title="Verification checks"
                    >
                      Status checks <ShieldCheck className="w-3 h-3 text-zinc-500" />
                    </Link>
                  ) : null}
                  {canManageVault ? (
                    <a
                      href="#manage"
                      className="inline-flex items-center justify-center gap-2 rounded-full btn-accent btn-compact text-xs text-center"
                    >
                      Manage position
                    </a>
                  ) : (
                    <a
                      href="#auction"
                      className="inline-flex items-center justify-center gap-2 rounded-full btn-accent btn-compact text-xs text-center"
                    >
                      Auction panel
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Auction Banner */}
      {isAuctionActive && (
        <section className="border-y border-cyan-500/20 bg-cyan-500/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-cyan-400" />
                <div>
                  <div className="status-active mb-2">
                    <span className="label text-cyan-400">CCA Auction Active</span>
                  </div>
                  <p className="text-zinc-500 text-sm font-light">Get {shareSymbol} before anyone else</p>
                </div>
              </div>
              <Link to={`/auction/bid/${ccaStrategy}`} className="btn-accent w-full sm:w-auto text-center">
                Join Auction <ArrowDownToLine className="w-4 h-4 inline ml-2" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="cinematic-section bg-zinc-950/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {canManageVault ? (
            <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5">
                <div className="bg-vault-bg/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">Total Supply</span>
                  <div className="value mono text-2xl sm:text-3xl">
                    {totalShareSupply !== undefined
                      ? formatAmount(totalShareSupply, shareTokenDecimals)
                      : <Skeleton className="h-8 w-24 mt-1" />}
                  </div>
                </div>
                <div className="bg-vault-bg/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">APY</span>
                  <div className="value mono text-2xl sm:text-3xl text-zinc-600" title="Coming soon">
                    —
                  </div>
                </div>
                <div className="bg-vault-bg/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">Global Jackpot</span>
                  <div className="value mono text-2xl sm:text-3xl text-zinc-600" title="Coming soon">
                    —
                  </div>
                </div>
                <div className="bg-vault-bg/70 backdrop-blur-xl p-5 sm:p-8 space-y-3 sm:space-y-4">
                  <span className="label">Trade Fee</span>
                  <div className="value mono text-2xl sm:text-3xl text-zinc-600" title="Coming soon">
                    —
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div id="auction" className="mt-10">
            {ccaStrategy && vaultAddress ? (
              <CcaAuctionPanel
                ccaStrategy={ccaStrategy}
                wsSymbol={shareSymbol}
                vaultAddress={vaultAddress}
              />
            ) : (
              <Alert variant="info" className="mt-2">
                <span className="font-medium">Auction not yet active.</span> The CCA auction panel becomes available once the vault launches. Check back after the creator deploys their strategy.
              </Alert>
            )}
          </div>
        </div>
      </section>

      {/* Solana Lottery Prize Claim — deep-linked from Solana frontend */}
      {solanaClaimMode && solanaPubkeyParam && shareOFTAddress && (
        <section id="solana-claim" className="cinematic-section">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="mb-10 sm:mb-16"
            >
              <span className="label">Lottery Prize</span>
              <h2 className="headline text-3xl sm:text-5xl mt-4 sm:mt-6">Claim to Solana</h2>
            </motion.div>
            <ClaimPrizeToSolana
              solanaPubkey={solanaPubkeyParam}
              prizeToken={shareOFTAddress}
              prizeAmount={prizeAmountDisplay}
              prizeAmountRaw={prizeAmountRaw}
              tokenSymbol={shareSymbol ?? 'SHARE'}
              tokenDecimals={shareTokenDecimals}
              adapterAddress={CONTRACTS.solanaBridgeAdapter as `0x${string}`}
            />
          </div>
        </section>
      )}

      {/* Deposit/Withdraw */}
      {canManageVault ? (
      <section id="manage" className="cinematic-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-10 sm:mb-16"
          >
            <span className="label">Vault Operations</span>
            <h2 className="headline text-3xl sm:text-5xl mt-4 sm:mt-6">Manage Position</h2>
          </motion.div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-3 space-y-10 sm:space-y-12">
              {/* Mode Selector */}
              <div className="w-full inline-flex items-center gap-0.5 rounded-full border border-white/5 bg-black/30 p-0.5 backdrop-blur-sm">
                {tabs.map((tab) => {
                  const active = activeTab === tab
                  const Icon = tab === 'Deposit' ? ArrowDownToLine : ArrowUpFromLine
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      aria-pressed={active}
                      className={`flex-1 h-10 rounded-full flex items-center justify-center gap-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary ${
                        active ? 'bg-white/8 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{tab}</span>
                    </button>
                  )
                })}
              </div>

              {/* Account Mode Indicator */}
              <AccountModeIndicator compact />

              {/* Amount Input */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                  <div>
                    <span className="label block mb-1">Amount</span>
                    <p className="text-zinc-600 text-xs font-light">Enter the amount to {activeTab.toLowerCase()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAmount(
                        activeTab === 'Deposit'
                          ? formatUnits(tokenBalance || 0n, creatorDecimals)
                          : formatUnits(shareBalance || 0n, shareTokenDecimals)
                      )
                    }
                    className="label text-zinc-600 hover:text-cyan-400 transition-colors text-left sm:text-right focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
                  >
                    Max:{' '}
                    {activeTab === 'Deposit'
                      ? tokenBalance !== undefined
                        ? formatAmount(tokenBalance, creatorDecimals)
                        : '…'
                      : shareBalance !== undefined
                        ? formatAmount(shareBalance, shareTokenDecimals)
                        : '…'}
                  </button>
                </div>
                
                <div className={`card p-5 sm:p-8 ${amountError ? 'border-rose-500/30' : ''}`}>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`${activeTab} amount`}
                    aria-invalid={amountError ? 'true' : undefined}
                    aria-describedby={amountError ? 'amount-error' : undefined}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      setVaultError(null)
                      setLastSuccess(null)
                    }}
                    placeholder="0.0"
                    className="input-field w-full text-4xl sm:text-5xl font-light text-center bg-transparent border-0 outline-none focus:ring-0 placeholder:text-zinc-700"
                  />
                  <div className="mt-3 text-center">
                    <span className="label">{activeTab === 'Deposit' ? underlyingSymbol : shareSymbol}</span>
                  </div>
                </div>

                {amountError && (
                  <p id="amount-error" role="alert" className="text-xs text-rose-400">
                    {amountError}
                  </p>
                )}

                {amount && !amountError && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-y border-zinc-900/50">
                    <span className="label">You will receive</span>
                    <div className="value mono text-lg sm:text-xl glow-cyan sm:text-right whitespace-nowrap">
                      {amount} {activeTab === 'Deposit' ? shareSymbol : underlyingSymbol}
                    </div>
                  </div>
                )}
              </div>

              {/* Transaction feedback */}
              {vaultError && (
                <Alert variant="error" onDismiss={() => setVaultError(null)}>
                  {vaultError}
                </Alert>
              )}

              {lastSuccess && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-3 text-sm text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" aria-hidden="true" />
                  <div>
                    <p>{lastSuccess}</p>
                    <button
                      type="button"
                      onClick={() => setLastSuccess(null)}
                      className="mt-1 text-xs text-emerald-400/70 hover:text-emerald-400 underline underline-offset-2 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Action Button */}
              {needsApproval ? (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleApprove}
                  loading={isApproving}
                  disabled={!amount || Boolean(amountError)}
                  className="w-full flex-col h-auto py-4"
                >
                  <span>Approve {underlyingSymbol}</span>
                  <span className="text-xs opacity-70 font-normal">Step 1 of 2 — no gas required</span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={activeTab === 'Deposit' ? handleDeposit : handleWithdraw}
                  loading={activeTab === 'Deposit' ? isDepositing : isWithdrawing}
                  disabled={!amount || Boolean(amountError)}
                  className="w-full flex-col h-auto py-4"
                >
                  <span>{activeTab}</span>
                  <span className="text-xs opacity-70 font-normal">Confirm in your wallet</span>
                </Button>
              )}
            </div>

            {/* Position Panel */}
            <div className="lg:col-span-2 space-y-8">
              {/* Chat with Creator */}
              <VaultChatCard />

              <div>
                <span className="label mb-4 block">Your Holdings</span>
                
                <div className="card p-5 sm:p-8">
                  <div className="space-y-5">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                      <TokenAvatar image={heroImage} symbol={underlyingSymbol} badge={SHARE_SYMBOL_PREFIX} />
                      <div className="min-w-0">
                        <div className="text-[10px] tracking-[0.34em] uppercase text-zinc-600">Vault token</div>
                        <div className="text-sm text-zinc-200 mt-1 font-light truncate">{shareSymbol}</div>
                      </div>
                      <div className="text-right">
                        {shareBalance !== undefined ? (
                          <>
                            <div className="font-mono text-xl sm:text-2xl text-zinc-200 tabular-nums glow-cyan">
                              {formatAmount(shareBalance, shareTokenDecimals)}
                            </div>
                            <div className="text-[10px] text-zinc-700 mt-1">Balance</div>
                          </>
                        ) : (
                          <Skeleton className="h-7 w-20" />
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                      <TokenAvatar image={heroImage} symbol={underlyingSymbol} />
                      <div className="min-w-0">
                        <div className="text-[10px] tracking-[0.34em] uppercase text-zinc-600">Creator token</div>
                        <div className="text-sm text-zinc-200 mt-1 font-light truncate">{underlyingSymbol}</div>
                      </div>
                      <div className="text-right">
                        {tokenBalance !== undefined ? (
                          <>
                            <div className="font-mono text-lg sm:text-xl text-zinc-200 tabular-nums">
                              {formatAmount(tokenBalance, creatorDecimals)}
                            </div>
                            <div className="text-[10px] text-zinc-700 mt-1">Balance</div>
                          </>
                        ) : (
                          <Skeleton className="h-6 w-20" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}
    </div>
  )
}
