import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Droplets, Plus, RefreshCw } from 'lucide-react'
import { getAddress, isAddress, toHex, type Address, type Hex } from 'viem'
import { useAccount, useBalance, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import { usePrivy, useWallets } from '@privy-io/react-auth'

import { SwapSettingsSheet } from '@/components/trade/SwapSettingsSheet'
import { Alert } from '@/components/ui/Alert'
import { VaultsPanel } from '@/components/swap/VaultsPanel'
import { SwapCard } from '@/components/swap/SwapCard'
import { SwapPageLayout } from '@/components/swap/SwapPageLayout'
import { TokenSelectorModal, type SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import { DEFAULT_CHAIN_ID, type SupportedChainId, getChainMeta } from '@/config/chains'
import { CONTRACTS } from '@/config/contracts'
import { useSwapExecution } from '@/hooks/useSwapExecution'
import { useSwapState } from '@/hooks/useSwapState'
import { useTokenIdentity } from '@/hooks/useTokenIdentity'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { apiFetch } from '@/lib/apiBase'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { readTelegramMiniAppLinkContext, stripTelegramMiniAppLinkParams } from '@/lib/telegramMiniAppLink'
import {
  claimLiquidityFees,
  createPosition,
  fetchLiquidityPositions,
  quoteCreatePosition,
  removeLiquidity,
} from '@/lib/uniswap/liquidityApi'
import { pickQuote } from '@/lib/uniswap/tradingApi'
import { type WalletMode } from '@/lib/uniswap/walletMode'
import {
  evaluateCanonicalSignerGate,
  type CanonicalAuthStatus,
  type CanonicalOwnerCheckStatus,
} from '@/lib/uniswap/canonicalSignerGate'
import {
  BASE_CHAIN_ID,
  NATIVE_TOKEN_ADDRESS,
  buildTokenOptions,
  getCoreTokensForChain,
  tokenLogoFallbacks,
  uniswapBaseLogo,
  type TokenOption,
} from '@/lib/uniswap/swapUtils'
import { useAccountContext } from '@/wallet/accountContext'
import { PageMeta } from '@/components/seo/PageMeta'

const CORE_TOKENS: TokenOption[] = [
  // Represent ETH as native for Uniswap Trading API + wagmi balances.
  // Keep ETH logo mapped to WETH assets while preserving native address execution.
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: NATIVE_TOKEN_ADDRESS,
    group: 'core',
    logoUrl: uniswapBaseLogo(CONTRACTS.weth),
    logoUrls: tokenLogoFallbacks(CONTRACTS.weth),
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: CONTRACTS.usdc,
    group: 'core',
    logoUrl: uniswapBaseLogo(CONTRACTS.usdc),
    logoUrls: tokenLogoFallbacks(CONTRACTS.usdc),
  },
  {
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
    group: 'core',
    logoUrl: 'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
    logoUrls: [
      'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
      ...tokenLogoFallbacks('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'),
    ],
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    group: 'core',
    logoUrl: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    logoUrls: [
      'https://assets.coingecko.com/coins/images/325/small/Tether.png',
      ...tokenLogoFallbacks('0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'),
    ],
  },
  {
    symbol: 'ZORA',
    name: 'Zora',
    address: CONTRACTS.zora,
    group: 'core',
    logoUrl: uniswapBaseLogo(CONTRACTS.zora),
    logoUrls: tokenLogoFallbacks(CONTRACTS.zora),
  },
]

type QuoteShape = Record<string, unknown>
type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type TelegramLinkCompleteResponse = {
  linked: boolean
}
const BASE_CHAIN_ID_HEX = '0x2105'
const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

let warnedSwapPrivyHookFailure = false
function warnSwapPrivyHookFailure(scope: string, error: unknown) {
  if (warnedSwapPrivyHookFailure) return
  warnedSwapPrivyHookFailure = true
  console.warn(`[swap] Privy hook unavailable in ${scope}; falling back to non-Privy mode`, error)
}

function useSafeSwapPrivyHook(enabled: boolean) {
  try {
    const value = usePrivy() as any
    if (!enabled) {
      return {
        ready: false,
        authenticated: false,
        user: null,
        getAccessToken: null as null | (() => Promise<string | null>),
      } as any
    }
    return value
  } catch (error) {
    warnSwapPrivyHookFailure('usePrivy', error)
    return {
      ready: false,
      authenticated: false,
      user: null,
      getAccessToken: null as null | (() => Promise<string | null>),
    } as any
  }
}

function useSafeSwapWalletsHook(enabled: boolean) {
  try {
    const value = useWallets() as any
    if (!enabled) return { wallets: [] } as any
    return value
  } catch (error) {
    warnSwapPrivyHookFailure('useWallets', error)
    return { wallets: [] } as any
  }
}

function isHexSignature(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)
}

function ensureSignatureHex(value: unknown, context: string): Hex {
  if (isHexSignature(value)) return value
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const direct = record?.signature ?? record?.sig
  if (isHexSignature(direct)) return direct
  const nested = record?.result
  if (nested && typeof nested === 'object') {
    const nestedSig = (nested as Record<string, unknown>).signature
    if (isHexSignature(nestedSig)) return nestedSig
  }
  throw new Error(`Invalid signature returned from ${context}`)
}

function normalizePrivyText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeAddressOrNull(value: unknown): Address | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw as Address)
}

function pickPrivyCrossAppEmbeddedEoaAddress(user: any): Address | null {
  const linked = Array.isArray(user?.linkedAccounts)
    ? (user.linkedAccounts as any[])
    : Array.isArray(user?.linked_accounts)
      ? (user.linked_accounts as any[])
      : []
  const crossAppAccounts = linked.filter((account) => normalizePrivyText(account?.type) === 'cross_app')
  for (const account of crossAppAccounts) {
    const embeddedWallets = Array.isArray((account as any)?.embedded_wallets)
      ? ((account as any).embedded_wallets as any[])
      : Array.isArray((account as any)?.embeddedWallets)
        ? ((account as any).embeddedWallets as any[])
        : []
    for (const wallet of embeddedWallets) {
      const address = normalizeAddressOrNull(wallet?.address)
      if (address) return address
    }
  }
  return null
}

function pickPrivyEmbeddedEoaAddressFromUser(user: any): Address | null {
  const walletCandidates = [
    ...(user?.wallet && typeof user.wallet === 'object' ? [user.wallet] : []),
    ...(Array.isArray(user?.wallets) ? user.wallets : []),
  ]
  for (const wallet of walletCandidates) {
    const chainType = normalizePrivyText((wallet as any)?.chain_type ?? (wallet as any)?.chainType)
    if (chainType.includes('solana')) continue
    const clientType = normalizePrivyText(
      (wallet as any)?.wallet_client_type ??
        (wallet as any)?.walletClientType ??
        (wallet as any)?.connector_type ??
        (wallet as any)?.connectorType ??
        (wallet as any)?.type,
    )
    if (!(clientType === 'privy' || clientType.includes('embedded') || clientType.includes('privy'))) continue
    const address = normalizeAddressOrNull((wallet as any)?.address)
    if (address) return address
  }

  const linked = Array.isArray(user?.linkedAccounts)
    ? (user.linkedAccounts as any[])
    : Array.isArray(user?.linked_accounts)
      ? (user.linked_accounts as any[])
      : []
  for (const account of linked) {
    const type = normalizePrivyText((account as any)?.type)
    const chainType = normalizePrivyText((account as any)?.chain_type ?? (account as any)?.chainType)
    if (chainType.includes('solana')) continue
    const clientType = normalizePrivyText(
      (account as any)?.wallet_client_type ??
        (account as any)?.walletClientType ??
        (account as any)?.connector_type ??
        (account as any)?.connectorType ??
        (account as any)?.provider,
    )
    if (!(type.includes('wallet') && (clientType === 'privy' || clientType.includes('embedded') || clientType.includes('privy')))) {
      continue
    }
    const address = normalizeAddressOrNull((account as any)?.address)
    if (address) return address
  }
  return null
}

function fmtBal(d: { formatted: string; symbol: string } | undefined): string | undefined {
  if (!d) return undefined
  const n = parseFloat(d.formatted)
  if (!Number.isFinite(n)) return undefined
  if (n === 0) return `0 ${d.symbol}`
  if (n < 0.0001) return `<0.0001 ${d.symbol}`
  return `${parseFloat(n.toPrecision(4))} ${d.symbol}`
}

function formatPercent(value: unknown): string | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return `${n.toFixed(2)}%`
}

// ─── Liquidity position card ────────────────────────────────────────────────

type LpPosition = {
  id?: string
  tokenId?: string
  token0Symbol?: string
  token1Symbol?: string
  feeTier?: number | string
  tickLower?: number | string
  tickUpper?: number | string
  tokensOwed0?: string
  tokensOwed1?: string
  liquidity?: string
}

function LpPositionCard(props: {
  position: LpPosition
  busy: string | null
  onClaim: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { position } = props
  const posId = String(position.id ?? position.tokenId ?? '')
  const pair = [position.token0Symbol, position.token1Symbol].filter(Boolean).join(' / ') || 'Unknown pair'
  const feeTier = position.feeTier ? `${(Number(position.feeTier) / 10000).toFixed(2)}%` : '--'
  const range =
    position.tickLower !== undefined && position.tickUpper !== undefined
      ? `${position.tickLower} → ${position.tickUpper}`
      : '--'
  const fees = [position.tokensOwed0, position.tokensOwed1].filter(Boolean).join(' / ') || '--'

  return (
    <div className="rounded-2xl border border-white/8 bg-vault-card/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{pair}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[10px] text-zinc-500">
              Fee {feeTier}
            </span>
            <span className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5 text-[10px] text-zinc-500">
              Range {range}
            </span>
          </div>
        </div>
        {posId && (
          <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 font-mono text-[10px] text-zinc-600 shrink-0">
            #{posId.slice(-6)}
          </span>
        )}
      </div>
      <div className="mt-2 text-[11px] text-zinc-500">
        Unclaimed fees: <span className="text-zinc-400">{fees}</span>
      </div>
      {posId && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => props.onClaim(posId)}
            disabled={props.busy !== null}
            className="flex-1 rounded-xl border border-emerald-400/25 bg-emerald-500/8 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
          >
            Claim fees
          </button>
          <button
            type="button"
            onClick={() => props.onRemove(posId)}
            disabled={props.busy !== null}
            className="flex-1 rounded-xl border border-rose-400/25 bg-rose-500/8 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────

export function Swap() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { address, isConnected, chainId: walletChainId, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const privyClientStatus = usePrivyClientStatus()
  const privyHooksEnabled = privyClientStatus === 'ready'
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    getAccessToken,
  } = useSafeSwapPrivyHook(privyHooksEnabled)
  const { wallets: privyWallets } = useSafeSwapWalletsHook(privyHooksEnabled)
  const auth = useSiweAuth()
  const {
    authAddress,
    hasSession,
    sessionHydrated,
    signInWithPrivyToken,
    signIn,
    busy: authBusy,
    error: authError,
  } = auth
  const publicClient = usePublicClient()
  const { switchChainAsync } = useSwitchChain()
  const [swapChainId, setSwapChainId] = useState<SupportedChainId>(DEFAULT_CHAIN_ID)
  const chainMeta = getChainMeta(swapChainId)
  const chainMismatch = isConnected && walletChainId != null && walletChainId !== swapChainId

  const {
    tokenIn,
    setTokenIn,
    tokenOut,
    setTokenOut,
    amountInUnits,
    setAmountInUnits,
    slippagePct,
    setSlippagePct,
    activePanel,
    setActivePanel,
    showAdvanced,
    setShowAdvanced,
    deadlineMinutes,
    setDeadlineMinutes,
    parsedSlippage,
    parsedDeadlineMinutes,
    switchTokens,
  } = useSwapState({
    initialTokenIn: NATIVE_TOKEN_ADDRESS,
    initialTokenOut: CONTRACTS.usdc,
  })
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false)
  const [tokenSelectorSide, setTokenSelectorSide] = useState<'input' | 'output'>('input')
  const [tokenSelectorQuery, setTokenSelectorQuery] = useState('')
  const [recentTokenAddresses, setRecentTokenAddresses] = useState<string[]>([])
  const [extraTokenOptions, setExtraTokenOptions] = useState<SwapTokenOption[]>([])
  const [unverifiedSelectionMode, setUnverifiedSelectionMode] = useState(false)
  const [unverifiedTokenLabel, setUnverifiedTokenLabel] = useState<string | null>(null)

  // ─── LP state ─────────────────────────────────────────────────────────────
  const [lpBusy, setLpBusy] = useState<string | null>(null)
  const [lpMode, setLpMode] = useState<'simple' | 'advanced'>('simple')
  const [lpFeeTier, setLpFeeTier] = useState<string>('3000')
  const [lpAmountA, setLpAmountA] = useState<string>('1')
  const [lpAmountB, setLpAmountB] = useState<string>('1')
  const [lpLowerTick, setLpLowerTick] = useState<string>('')
  const [lpUpperTick, setLpUpperTick] = useState<string>('')
  const [lpPositionId, setLpPositionId] = useState<string>('')
  const [lpStatus, setLpStatus] = useState<string>('')
  const [lpError, setLpError] = useState<string>('')
  const telegramLinkContext = useMemo(() => readTelegramMiniAppLinkContext(searchParams), [searchParams])
  const [telegramLinkState, setTelegramLinkState] = useState<'idle' | 'linking' | 'linked' | 'error'>('idle')
  const [telegramLinkMessage, setTelegramLinkMessage] = useState<string | null>(null)
  const telegramLinkAttemptRef = useRef<string>('')
  const telegramLinkFlowActive = Boolean(telegramLinkContext)

  const retryTelegramLink = useCallback(() => {
    telegramLinkAttemptRef.current = ''
    setTelegramLinkState('idle')
    setTelegramLinkMessage(null)
  }, [])

  // ─── URL params ───────────────────────────────────────────────────────────
  useEffect(() => {
    const qToken = (searchParams.get('token') ?? '').trim()
    if (isAddress(qToken)) setTokenOut(getAddress(qToken))
  }, [searchParams, setTokenOut])

  useEffect(() => {
    if (!telegramLinkContext) return
    if (telegramLinkState === 'linking' || telegramLinkState === 'linked') return
    if (!privyReady) return
    if (!getAccessToken) {
      setTelegramLinkState('error')
      setTelegramLinkMessage('Privy is not available. Reload and try Telegram linking again.')
      return
    }
    if (telegramLinkAttemptRef.current === telegramLinkContext.linkToken) return
    telegramLinkAttemptRef.current = telegramLinkContext.linkToken

    void (async () => {
      setTelegramLinkState('linking')
      setTelegramLinkMessage('Linking Telegram to your canonical 4626 wallet…')

      let accessToken = ''
      if (privyAuthenticated) {
        accessToken = (await getAccessToken().catch(() => null))?.trim() ?? ''
      }
      if (!accessToken) {
        await signIn({ method: 'privy' })
        accessToken = (await getAccessToken().catch(() => null))?.trim() ?? ''
      }
      if (!accessToken) {
        throw new Error('Could not read your Privy access token. Please retry linking.')
      }

      const res = await apiFetch('/api/telegram/link/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-privy-token': accessToken,
        },
        body: JSON.stringify({
          token: telegramLinkContext.linkToken,
          telegramUsername: telegramLinkContext.telegramUsername,
        }),
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<TelegramLinkCompleteResponse> | null
      if (!res.ok || !json?.success || json?.data?.linked !== true) {
        const message = typeof json?.error === 'string' && json.error.trim() ? json.error.trim() : 'Telegram linking failed.'
        throw new Error(message)
      }

      setTelegramLinkState('linked')
      setTelegramLinkMessage('Telegram linked successfully. Return to Telegram and run /linked.')
      const cleaned = stripTelegramMiniAppLinkParams(searchParams)
      const next = cleaned.toString()
      navigate(
        {
          pathname: '/swap',
          search: next ? `?${next}` : '',
        },
        { replace: true },
      )
    })().catch((error: unknown) => {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Could not complete Telegram linking. Retry in a moment.'
      setTelegramLinkState('error')
      setTelegramLinkMessage(message)
    })
  }, [
    getAccessToken,
    navigate,
    privyAuthenticated,
    privyReady,
    searchParams,
    signIn,
    telegramLinkContext,
    telegramLinkState,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('swap.recentTokens')
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const normalized = parsed
        .map((value) => (typeof value === 'string' ? value.toLowerCase() : ''))
        .filter((value) => isAddress(value))
        .slice(0, 10)
      setRecentTokenAddresses(Array.from(new Set(normalized)))
    } catch {}
  }, [])

  const accountContext = useAccountContext()
  const canonicalAddress = accountContext.cswAddress ?? null
  const signerAddress = accountContext.signerAddress ?? null

  const privyCrossAppEmbeddedEoaAddress = useMemo(() => pickPrivyCrossAppEmbeddedEoaAddress(privyUser), [privyUser])
  const privyEmbeddedEoaAddressFromUser = useMemo(() => pickPrivyEmbeddedEoaAddressFromUser(privyUser), [privyUser])

  const privyEmbeddedEoaWallet = useMemo(() => {
    const wallets = Array.isArray(privyWallets) ? (privyWallets as any[]) : []
    const fallbackAddresses = new Set(
      [privyCrossAppEmbeddedEoaAddress, privyEmbeddedEoaAddressFromUser]
        .filter((value): value is Address => Boolean(value))
        .map((value) => value.toLowerCase()),
    )
    return (
      wallets.find((wallet) => {
        const walletType = normalizePrivyText(
          wallet?.wallet_client_type ?? wallet?.walletClientType ?? wallet?.connector_type ?? wallet?.type ?? '',
        )
        const address = normalizeAddressOrNull(wallet?.address)
        if (!address) return false
        if (canonicalAddress && address.toLowerCase() === canonicalAddress.toLowerCase()) return false
        const isEmbeddedType = walletType === 'privy' || walletType.includes('privy') || walletType.includes('embedded')
        if (isEmbeddedType) return true
        return fallbackAddresses.has(address.toLowerCase())
      }) ?? null
    )
  }, [canonicalAddress, privyCrossAppEmbeddedEoaAddress, privyEmbeddedEoaAddressFromUser, privyWallets])

  const privyEmbeddedEoaAddressInfo = useMemo(() => {
    const fromWallet = normalizeAddressOrNull((privyEmbeddedEoaWallet as any)?.address)
    if (fromWallet && (!canonicalAddress || fromWallet.toLowerCase() !== canonicalAddress.toLowerCase())) {
      return {
        address: fromWallet,
        source: 'wallets' as const,
      }
    }

    if (
      privyCrossAppEmbeddedEoaAddress &&
      (!canonicalAddress || privyCrossAppEmbeddedEoaAddress.toLowerCase() !== canonicalAddress.toLowerCase())
    ) {
      return {
        address: privyCrossAppEmbeddedEoaAddress,
        source: 'cross-app-linked-account' as const,
      }
    }

    if (
      privyEmbeddedEoaAddressFromUser &&
      (!canonicalAddress || privyEmbeddedEoaAddressFromUser.toLowerCase() !== canonicalAddress.toLowerCase())
    ) {
      return {
        address: privyEmbeddedEoaAddressFromUser,
        source: 'privy-user' as const,
      }
    }

    return {
      address: null,
      source: null as null,
    }
  }, [canonicalAddress, privyCrossAppEmbeddedEoaAddress, privyEmbeddedEoaAddressFromUser, privyEmbeddedEoaWallet])

  const privyEmbeddedEoaAddress = privyEmbeddedEoaAddressInfo.address
  const privyEmbeddedEoaAddressSource = privyEmbeddedEoaAddressInfo.source

  const privyEmbeddedEoaCanSign = useMemo(() => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return false
    if (typeof walletAny?.request === 'function') return true
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return true
    if (typeof walletAny?.getEthereumProvider === 'function') return true
    if (typeof walletAny?.signMessage === 'function') return true
    return false
  }, [privyEmbeddedEoaWallet])

  const ensureProviderOnBase = useCallback(async (provider: any, label: string) => {
    if (!provider?.request) return
    const current = await provider.request({ method: 'eth_chainId' }).catch(() => null)
    if (typeof current === 'string' && current.toLowerCase() !== BASE_CHAIN_ID_HEX) {
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID_HEX }],
        })
      } catch {
        throw new Error(`Please switch ${label} to Base network to continue.`)
      }
    }
  }, [])

  const getPrivyEmbeddedEoaProvider = useCallback(async () => {
    const walletAny: any = privyEmbeddedEoaWallet as any
    if (!walletAny) return null
    if (walletAny?.provider && typeof walletAny.provider.request === 'function') return walletAny.provider
    if (typeof walletAny.getEthereumProvider === 'function') {
      const provider = await walletAny.getEthereumProvider().catch(() => null)
      if (provider && typeof provider.request === 'function') return provider
    }
    if (typeof walletAny.request === 'function') {
      return { request: walletAny.request.bind(walletAny) }
    }
    return null
  }, [privyEmbeddedEoaWallet])

  const privyEmbeddedEoaCanOperateCanonicalQuery = useQuery({
    queryKey: ['swap', 'privy-embedded-can-operate-canonical', canonicalAddress, privyEmbeddedEoaAddress, swapChainId],
    enabled: Boolean(canonicalAddress && privyEmbeddedEoaAddress && publicClient && swapChainId === BASE_CHAIN_ID),
    staleTime: 10_000,
    queryFn: async () => {
      if (!canonicalAddress || !privyEmbeddedEoaAddress || !publicClient) return false
      try {
        const isOwner = (await (publicClient as any).readContract({
          address: canonicalAddress as Address,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [privyEmbeddedEoaAddress as Address],
        })) as boolean
        return isOwner === true
      } catch {
        return false
      }
    },
  })

  const privyEmbeddedCanonicalWalletClient = useMemo(() => {
    if (!privyEmbeddedEoaAddress) return null
    return {
      request: async (args: { method: string; params?: any[] }) => {
        const provider = await getPrivyEmbeddedEoaProvider()
        if (!provider?.request) throw new Error('Privy embedded EOA provider not available')
        await ensureProviderOnBase(provider, 'Privy embedded EOA')
        if (args?.method === 'eth_sign') {
          const params = Array.isArray(args.params) ? args.params : []
          const hashCandidate = typeof params[1] === 'string' ? params[1] : ''
          if (/^0x[0-9a-fA-F]{64}$/.test(hashCandidate)) {
            try {
              const rawSig = await provider.request({
                method: 'secp256k1_sign',
                params: [hashCandidate],
              })
              return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.secp256k1_sign')
            } catch {
              // Fall through to provider eth_sign when secp256k1_sign is unavailable.
            }
          }
        }
        return await provider.request(args as any)
      },
      signMessage: async (args: { message: unknown }) => {
        const provider = await getPrivyEmbeddedEoaProvider()
        if (!provider?.request) throw new Error('Privy embedded EOA provider not available')
        await ensureProviderOnBase(provider, 'Privy embedded EOA')
        const raw =
          typeof args?.message === 'object' && args.message !== null && 'raw' in (args.message as Record<string, unknown>)
            ? (args.message as Record<string, unknown>).raw
            : args?.message
        const msgHex = typeof raw === 'string' && raw.startsWith('0x') ? raw : toHex(String(raw ?? ''))
        const rawSig = await provider.request({
          method: 'personal_sign',
          params: [msgHex, privyEmbeddedEoaAddress],
        })
        return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.personal_sign')
      },
      signTypedData: async (typedData: unknown) => {
        const provider = await getPrivyEmbeddedEoaProvider()
        if (!provider?.request) throw new Error('Privy embedded EOA provider not available')
        await ensureProviderOnBase(provider, 'Privy embedded EOA')
        const rawSig = await provider.request({
          method: 'eth_signTypedData_v4',
          params: [privyEmbeddedEoaAddress, JSON.stringify(typedData)],
        })
        return ensureSignatureHex(rawSig, 'privyEmbeddedEoa.signTypedData')
      },
    }
  }, [ensureProviderOnBase, getPrivyEmbeddedEoaProvider, privyEmbeddedEoaAddress])

  const preferredExecutionMode: WalletMode =
    accountContext.preferredMode === 'SMART_WALLET' ? 'canonical' : 'eoa'
  const executionMode: WalletMode =
    accountContext.activeAccountType === 'SMART_WALLET' ? 'canonical' : 'eoa'
  const canonicalAuthStatus = useMemo<CanonicalAuthStatus>(() => {
    if (privyClientStatus !== 'ready') return 'unknown'
    if (privyReady !== true) return 'unknown'
    if (privyAuthenticated === true) return 'authenticated'
    if (privyAuthenticated === false) return 'unauthenticated'
    return 'unknown'
  }, [privyAuthenticated, privyClientStatus, privyReady])
  const canonicalOwnerCheckStatus = useMemo<CanonicalOwnerCheckStatus>(() => {
    if (privyEmbeddedEoaCanOperateCanonicalQuery.isLoading || privyEmbeddedEoaCanOperateCanonicalQuery.isFetching) {
      return 'pending'
    }
    if (privyEmbeddedEoaCanOperateCanonicalQuery.data === true) return 'owner'
    if (privyEmbeddedEoaCanOperateCanonicalQuery.data === false) return 'not-owner'
    return 'unknown'
  }, [
    privyEmbeddedEoaCanOperateCanonicalQuery.data,
    privyEmbeddedEoaCanOperateCanonicalQuery.isFetching,
    privyEmbeddedEoaCanOperateCanonicalQuery.isLoading,
  ])
  const canonicalSignerGate = useMemo(
    () =>
      evaluateCanonicalSignerGate({
        executionMode,
        canonicalAddress,
        clientStatus: privyClientStatus,
        authStatus: canonicalAuthStatus,
        embeddedWalletDetected: Boolean(privyEmbeddedEoaAddress),
        embeddedWalletAddress: privyEmbeddedEoaAddress,
        embeddedWalletCanSign: privyEmbeddedEoaCanSign,
        ownerCheckStatus: canonicalOwnerCheckStatus,
      }),
    [
      executionMode,
      canonicalAddress,
      privyClientStatus,
      canonicalAuthStatus,
      privyEmbeddedEoaAddress,
      privyEmbeddedEoaCanSign,
      canonicalOwnerCheckStatus,
    ],
  )
  const usePrivyEmbeddedCanonicalSigner = executionMode === 'canonical' && canonicalSignerGate.ready
  const canonicalSignerAddress =
    executionMode === 'canonical' ? (usePrivyEmbeddedCanonicalSigner ? privyEmbeddedEoaAddress : null) : signerAddress
  const canonicalSignerWalletClient =
    executionMode === 'canonical'
      ? (usePrivyEmbeddedCanonicalSigner ? (privyEmbeddedCanonicalWalletClient as any) : null)
      : walletClient
  const executionSignerAddress = executionMode === 'canonical' ? canonicalSignerAddress : signerAddress
  const executionWalletClient = executionMode === 'canonical' ? canonicalSignerWalletClient : walletClient
  const executionSignerType =
    executionMode === 'canonical' ? (usePrivyEmbeddedCanonicalSigner ? 'EOA' : 'UNKNOWN') : accountContext.signerType
  const executionCapabilities = useMemo(
    () =>
      executionMode === 'canonical'
        ? ({ paymasterService: false, atomicStatus: 'unknown', supports5792: false } as const)
        : accountContext.capabilities,
    [executionMode, accountContext.capabilities],
  )
  const executionConnectorId =
    executionMode === 'canonical'
      ? usePrivyEmbeddedCanonicalSigner
        ? 'privy-embedded'
        : 'privy-embedded-required'
      : (connector?.id ?? null)
  const executionConnectorName =
    executionMode === 'canonical'
      ? usePrivyEmbeddedCanonicalSigner
        ? 'Privy Embedded EOA'
        : 'Privy Embedded EOA (required)'
      : (connector?.name ?? null)
  const executionAddress = accountContext.activeAccount ?? null
  const executionReady = Boolean(
    executionAddress &&
      executionWalletClient &&
      publicClient &&
      (executionMode !== 'canonical' || canonicalSignerGate.ready),
  )
  const executionFallbackActive = executionMode !== preferredExecutionMode
  const canonicalSignerGuardError =
    executionMode === 'canonical' && !canonicalSignerGate.ready ? canonicalSignerGate.reason : null
  const needsPrivyCanonicalAuth = useMemo(
    () =>
      executionMode === 'canonical' &&
      privyClientStatus === 'ready' &&
      (canonicalSignerGate.code === 'privy-auth-required' ||
        canonicalSignerGate.code === 'embedded-wallet-missing' ||
        canonicalSignerGate.code === 'embedded-wallet-cannot-sign'),
    [canonicalSignerGate.code, executionMode, privyClientStatus],
  )
  const showPrivyClientDisabledHint =
    executionMode === 'canonical' && canonicalSignerGate.code === 'privy-client-disabled'
  const showPrivyLoadingHint = executionMode === 'canonical' && canonicalSignerGate.code === 'privy-auth-loading'
  const canonicalSignInMethod = 'privy' as const
  const ensureCanonicalSession = useCallback(async (): Promise<boolean> => {
    if (executionMode !== 'canonical') return true
    if (!getAccessToken || typeof signInWithPrivyToken !== 'function') return false
    try {
      const token = await getAccessToken()
      if (!token) return false
      const bridgedAddress = await signInWithPrivyToken(token)
      return Boolean(bridgedAddress)
    } catch {
      return false
    }
  }, [executionMode, getAccessToken, signInWithPrivyToken])
  const identityReady = Boolean(
    canonicalAddress &&
      executionWalletClient &&
      publicClient &&
      (accountContext.signerType === 'SMART_WALLET' ||
        accountContext.eoaIsOwnerOfCsw === true ||
        canonicalSignerGate.ready),
  )

  // ─── Token options (chain-aware) ─────────────────────────────────────────
  const dynamicCoreTokens = useMemo(() => {
    if (swapChainId === BASE_CHAIN_ID) return CORE_TOKENS
    const meta = getChainMeta(swapChainId)
    if (!meta) return CORE_TOKENS
    return getCoreTokensForChain({
      chainId: meta.id,
      nativeSymbol: meta.nativeCurrency.symbol,
      nativeName: meta.nativeCurrency.name,
      weth: meta.weth,
      usdc: meta.usdc,
    })
  }, [swapChainId])

  const tokenOptions = useMemo<TokenOption[]>(() => {
    const creatorCoin = (searchParams.get('token') ?? '').trim()
    const shareCoin = (searchParams.get('share') ?? searchParams.get('shareToken') ?? '').trim()
    const shareSymbolParam = (searchParams.get('shareSymbol') ?? searchParams.get('shareTokenSymbol') ?? '').trim()
    const shareNameParam = (searchParams.get('shareName') ?? searchParams.get('shareTokenName') ?? '').trim()
    return buildTokenOptions({
      coreTokens: dynamicCoreTokens,
      creatorCoin: swapChainId === BASE_CHAIN_ID ? creatorCoin : '',
      shareCoin: swapChainId === BASE_CHAIN_ID ? shareCoin : '',
      shareSymbol: shareSymbolParam,
      shareName: shareNameParam,
      chainId: swapChainId,
    })
  }, [searchParams, dynamicCoreTokens, swapChainId])

  const allTokenOptions = useMemo<SwapTokenOption[]>(() => {
    return [...tokenOptions, ...extraTokenOptions]
  }, [extraTokenOptions, tokenOptions])

  const swapTokenOptions = useMemo<SwapTokenOption[]>(() => {
    return allTokenOptions.map((option) => ({
      ...option,
      verified: option.verified ?? (option.group === 'core' || option.group === 'creator' || option.group === 'share'),
      sectionTag:
        option.group === 'creator' ? 'creator' : option.group === 'share' ? 'content' : undefined,
    }))
  }, [allTokenOptions])

  const tokenInOption = useMemo(
    () => swapTokenOptions.find((opt) => opt.address.toLowerCase() === tokenIn.toLowerCase()) ?? null,
    [tokenIn, swapTokenOptions],
  )
  const tokenOutOption = useMemo(
    () => swapTokenOptions.find((opt) => opt.address.toLowerCase() === tokenOut.toLowerCase()) ?? null,
    [tokenOut, swapTokenOptions],
  )

  const tokenInIdentity = useTokenIdentity({ address: tokenIn, option: tokenInOption })
  const tokenOutIdentity = useTokenIdentity({ address: tokenOut, option: tokenOutOption })
  const tokenInDisplay = tokenInIdentity.display
  const tokenOutDisplay = tokenOutIdentity.display
  const tokenInSymbol = tokenInDisplay.symbol
  const tokenOutSymbol = tokenOutDisplay.symbol
  const registerTokenForIdentity = useCallback((option: SwapTokenOption) => {
    setExtraTokenOptions((previous) => {
      const normalized = option.address.toLowerCase()
      if (previous.some((entry) => entry.address.toLowerCase() === normalized)) return previous
      return [...previous, { ...option }]
    })
  }, [])

  useEffect(() => {
    const inputUnverified = tokenInOption?.verified === false
    const outputUnverified = tokenOutOption?.verified === false
    if (!inputUnverified && !outputUnverified) {
      setUnverifiedSelectionMode(false)
      setUnverifiedTokenLabel(null)
      return
    }
    const label = inputUnverified
      ? tokenInDisplay.symbol
      : outputUnverified
        ? tokenOutDisplay.symbol
        : null
    if (!unverifiedSelectionMode) {
      setUnverifiedTokenLabel(label)
    }
  }, [tokenInDisplay.symbol, tokenInOption?.verified, tokenOutDisplay.symbol, tokenOutOption?.verified, unverifiedSelectionMode])

  useEffect(() => {
    const address = tokenIn.toLowerCase()
    if (isAddress(address) && !tokenInOption && !extraTokenOptions.some((option) => option.address.toLowerCase() === address)) {
      registerTokenForIdentity({
        symbol: tokenInSymbol,
        name: tokenInSymbol,
        address,
        group: 'share',
        verified: false,
        decimals: 18,
        logoUrls: [],
      })
    }
  }, [extraTokenOptions, registerTokenForIdentity, tokenIn, tokenInOption, tokenInSymbol])

  useEffect(() => {
    const address = tokenOut.toLowerCase()
    if (isAddress(address) && !tokenOutOption && !extraTokenOptions.some((option) => option.address.toLowerCase() === address)) {
      registerTokenForIdentity({
        symbol: tokenOutSymbol,
        name: tokenOutSymbol,
        address,
        group: 'share',
        verified: false,
        decimals: 18,
        logoUrls: [],
      })
    }
  }, [extraTokenOptions, registerTokenForIdentity, tokenOut, tokenOutOption, tokenOutSymbol])

  // ─── Token balances ───────────────────────────────────────────────────────
  const isTokenInNative = tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS
  const isTokenOutNative = tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS
  const { data: tokenInBalData } = useBalance({
    address: executionAddress ?? undefined,
    token: isTokenInNative ? undefined : (tokenIn as `0x${string}`),
    chainId: swapChainId,
    query: { enabled: Boolean(executionAddress) && isAddress(tokenIn) },
  })
  const { data: tokenOutBalData } = useBalance({
    address: executionAddress ?? undefined,
    token: isTokenOutNative ? undefined : (tokenOut as `0x${string}`),
    chainId: swapChainId,
    query: { enabled: Boolean(executionAddress) && isAddress(tokenOut) },
  })
  const tokenInBalanceLabel = fmtBal(tokenInBalData)
  const tokenOutBalanceLabel = fmtBal(tokenOutBalData)

  // ─── Swap execution ───────────────────────────────────────────────────────
  const {
    estimatedOut,
    quote,
    busy,
    status,
    error,
    confirmIntent,
    quoteUpdatedAt,
    isReady,
    approvalRequired,
    quoteIsStale,
    diagnosticsEnabled,
    txDebug,
    canary7702Eligible,
    diagnosticsBusy,
    diagnosticsResult,
    canonicalSubmitSession,
    handleQuote,
    handleReviewTrade,
    confirmAndExecute,
    run7702DryRun,
    resetTradeState,
  } = useSwapExecution({
    address,
    walletClient: executionWalletClient,
    publicClient,
    canonicalAddress,
    signerAddress: executionSignerAddress,
    executionMode,
    executionAddress,
    executionReady,
    tokenIn,
    tokenOut,
    amountInUnits,
    parsedSlippage,
    parsedDeadlineMinutes,
    chainId: swapChainId,
    signerType: executionSignerType,
    capabilities: executionCapabilities,
    connectorId: executionConnectorId,
    connectorName: executionConnectorName,
    canonicalSignerDebug: {
      required: canonicalSignerGate.required,
      ready: canonicalSignerGate.ready,
      code: canonicalSignerGate.code,
      reason: canonicalSignerGate.reason,
    },
    privyDebug: {
      clientStatus: privyClientStatus,
      ready: privyReady === true,
      authenticated: typeof privyAuthenticated === 'boolean' ? privyAuthenticated : null,
      embeddedWalletAddress: privyEmbeddedEoaAddress,
      embeddedWalletSource: privyEmbeddedEoaAddressSource,
    },
    sessionHydrated,
    hasSession,
    sessionAddress: authAddress,
    ensureCanonicalSession,
  })
  const showCanonicalSessionGuardHint =
    activePanel === 'swap' &&
    executionMode === 'canonical' &&
    canonicalSignerGate.ready &&
    !canonicalSubmitSession.ok
  const canonicalSessionGuardTitle =
    canonicalSubmitSession.code === 'session-hydrating'
      ? 'Restoring 4626 session'
      : canonicalSubmitSession.code === 'session-mismatch'
        ? 'Canonical session needs refresh'
        : '4626 session required for submit'

  const selectedQuote = useMemo<QuoteShape | null>(() => {
    if (!quote) return null
    const candidate = pickQuote(quote) ?? quote
    return candidate as QuoteShape
  }, [quote])

  const routeSummary = useMemo(() => {
    const routeCandidate =
      selectedQuote?.route ?? selectedQuote?.routeString ?? selectedQuote?.routing ?? quote?.routing
    if (routeCandidate === null || routeCandidate === undefined) return null
    const text = String(routeCandidate).trim()
    return text || null
  }, [selectedQuote, quote])

  const priceImpactLabel = useMemo(() => {
    const priceImpactCandidate =
      selectedQuote?.priceImpact ??
      selectedQuote?.priceImpactPercent ??
      quote?.priceImpact ??
      quote?.priceImpactPercent
    return formatPercent(priceImpactCandidate)
  }, [selectedQuote, quote])

  const gasEstimateLabel = useMemo(() => {
    const gasCandidate =
      selectedQuote?.gasFeeUSD ??
      selectedQuote?.gasEstimateUSD ??
      quote?.gasFeeUSD ??
      quote?.gasEstimateUSD
    if (typeof gasCandidate === 'string' && gasCandidate.trim()) return gasCandidate
    const numeric = typeof gasCandidate === 'number' ? gasCandidate : Number(gasCandidate)
    if (!Number.isFinite(numeric)) return null
    return `$${numeric.toFixed(2)}`
  }, [selectedQuote, quote])

  const lpFeeUsd = useMemo(() => {
    const candidate = selectedQuote?.lpFee
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return `$${candidate.toFixed(2)}`
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
    return null
  }, [selectedQuote])

  const protocolFeeUsd = useMemo(() => {
    const candidate = selectedQuote?.protocolFee
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return `$${candidate.toFixed(2)}`
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
    return null
  }, [selectedQuote])

  const handleSwitchTokens = useCallback(() => {
    switchTokens()
    resetTradeState()
  }, [switchTokens, resetTradeState])

  const handleSelectSwapChain = useCallback(
    (nextChainId: SupportedChainId) => {
      setSwapChainId(nextChainId)
      resetTradeState()
      if (isConnected && walletChainId !== nextChainId && switchChainAsync) {
        void switchChainAsync({ chainId: nextChainId }).catch(() => {})
      }
    },
    [isConnected, resetTradeState, switchChainAsync, walletChainId],
  )

  const openTokenSelector = useCallback((side: 'input' | 'output') => {
    setTokenSelectorSide(side)
    setTokenSelectorQuery('')
    setTokenSelectorOpen(true)
  }, [])

  const persistRecentToken = useCallback((tokenAddress: string) => {
    const normalized = tokenAddress.toLowerCase()
    if (!isAddress(normalized)) return
    setRecentTokenAddresses((previous) => {
      const next = [normalized, ...previous.filter((candidate) => candidate !== normalized)].slice(0, 12)
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('swap.recentTokens', JSON.stringify(next))
        } catch {}
      }
      return next
    })
  }, [])

  const onSelectToken = useCallback(
    (option: SwapTokenOption) => {
      const address = option.address
      if (!isAddress(address)) return

      if (!option.verified) {
        registerTokenForIdentity(option)
      }
      if (tokenSelectorSide === 'input') {
        setTokenIn(address)
      } else {
        setTokenOut(address)
      }
      if (!option.verified) {
        setUnverifiedTokenLabel(option.symbol)
        setUnverifiedSelectionMode(true)
      } else {
        setUnverifiedSelectionMode(false)
        setUnverifiedTokenLabel(null)
      }
      persistRecentToken(address)
      setTokenSelectorOpen(false)
      resetTradeState()
    },
    [persistRecentToken, registerTokenForIdentity, resetTradeState, setTokenIn, setTokenOut, tokenSelectorSide],
  )

  const confirmUnverifiedSelection = useCallback(() => {
    setUnverifiedSelectionMode(false)
  }, [])

  // Reset when execution address changes
  useEffect(() => {
    resetTradeState()
  }, [executionAddress, resetTradeState])

  // Sync busy into a ref so the auto-quote timer can check it without becoming
  // a dependency — having `busy` in the deps list causes the effect to re-fire
  // every time a quote completes (null→'quote'→null), creating an infinite
  // request flood when the upstream API is unhealthy (e.g. 403/429).
  const busyRef = useRef(busy)
  busyRef.current = busy

  // Debounced auto-quote: only fires when actual swap inputs change.
  useEffect(() => {
    if (!executionReady || !isReady) return
    const timer = window.setTimeout(() => {
      if (busyRef.current) return
      void handleQuote()
    }, 450)
    return () => window.clearTimeout(timer)
    // `busy` intentionally omitted — use busyRef to check at call-time.
  }, [tokenIn, tokenOut, amountInUnits, parsedSlippage, executionReady, isReady, handleQuote])

  // One-click flow: after review/build, immediately execute without an extra in-app confirm modal.
  useEffect(() => {
    if (!confirmIntent) return
    void confirmAndExecute()
  }, [confirmAndExecute, confirmIntent])

  // ─── LP handlers ──────────────────────────────────────────────────────────
  async function handleLpQuote() {
    if (!canonicalAddress) return
    setLpBusy('lpQuote'); setLpError(''); setLpStatus('')
    try {
      const t0 = tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenIn
      const t1 = tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenOut
      await quoteCreatePosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: t0, token1: t1,
        amount0: lpAmountA, amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setLpStatus('Liquidity quote ready')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to quote liquidity')
    } finally { setLpBusy(null) }
  }

  async function handleCreatePosition() {
    if (!canonicalAddress) return
    setLpBusy('lpCreate'); setLpError(''); setLpStatus('')
    try {
      const t0 = tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenIn
      const t1 = tokenOut.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS ? CONTRACTS.weth : tokenOut
      const data = await createPosition({
        chainId: BASE_CHAIN_ID,
        walletAddress: canonicalAddress,
        token0: t0, token1: t1,
        amount0: lpAmountA, amount1: lpAmountB,
        feeTier: Number(lpFeeTier),
        lowerTick: lpMode === 'advanced' && lpLowerTick.trim() ? Number(lpLowerTick) : undefined,
        upperTick: lpMode === 'advanced' && lpUpperTick.trim() ? Number(lpUpperTick) : undefined,
      })
      setLpStatus(`Position submitted${(data as Record<string, unknown>)?.requestId ? ` (#${(data as Record<string, unknown>).requestId})` : ''}`)
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to create position')
    } finally { setLpBusy(null) }
  }

  async function handleClaimFees(posId?: string) {
    const id = posId ?? lpPositionId.trim()
    if (!canonicalAddress || !id) return
    setLpBusy('lpClaim'); setLpError('')
    try {
      await claimLiquidityFees({ chainId: BASE_CHAIN_ID, walletAddress: canonicalAddress, positionId: id })
      setLpStatus('Fee claim submitted')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to claim fees')
    } finally { setLpBusy(null) }
  }

  async function handleRemoveLiquidity(posId?: string) {
    const id = posId ?? lpPositionId.trim()
    if (!canonicalAddress || !id) return
    setLpBusy('lpRemove'); setLpError('')
    try {
      await removeLiquidity({ chainId: BASE_CHAIN_ID, walletAddress: canonicalAddress, positionId: id })
      setLpStatus('Remove liquidity submitted')
    } catch (e: unknown) {
      setLpError((e as Error)?.message || 'Unable to remove liquidity')
    } finally { setLpBusy(null) }
  }

  // ─── LP positions query ───────────────────────────────────────────────────
  const lpPositionsQuery = useQuery({
    queryKey: ['uniswap', 'lp-positions', canonicalAddress],
    enabled: Boolean(activePanel === 'liquidity' && canonicalAddress),
    queryFn: async () => fetchLiquidityPositions(canonicalAddress!, BASE_CHAIN_ID),
    refetchInterval:
      activePanel === 'liquidity'
        ? () => (typeof document !== 'undefined' && document.hidden ? false : 20_000)
        : false,
    staleTime: 10_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(30_000, 1_000 * 2 ** attempt),
    refetchOnWindowFocus: false,
  })

  const anyBusy = busy !== null || lpBusy !== null

  const positions: LpPosition[] = useMemo(() => {
    const data = lpPositionsQuery.data
    if (!data) return []
    if (Array.isArray((data as Record<string, unknown>)?.positions)) {
      return (data as { positions: LpPosition[] }).positions
    }
    if (Array.isArray(data)) return data as LpPosition[]
    return []
  }, [lpPositionsQuery.data])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title="Swap" description="Swap tokens on Base using 4626 — best-price routing via Uniswap." canonicalPath="/swap" />
      <SwapPageLayout
        swapPanel={
          activePanel === 'swap' ? (
            <SwapCard
              tokenInDisplay={tokenInDisplay}
              tokenOutDisplay={tokenOutDisplay}
              tokenInIdentityLoading={tokenInIdentity.isLoading}
              tokenOutIdentityLoading={tokenOutIdentity.isLoading}
              amountInUnits={amountInUnits}
              estimatedOut={estimatedOut}
              estimatedOutUsd={null}
              tokenInSymbol={tokenInSymbol}
              tokenOutSymbol={tokenOutSymbol}
              tokenInBalanceLabel={tokenInBalanceLabel}
              tokenOutBalanceLabel={tokenOutBalanceLabel}
              tokenInAddress={tokenIn}
              tokenOutAddress={tokenOut}
              isConnected={isConnected}
              isReady={isReady}
              busy={busy}
              status={status}
              error={error ?? canonicalSignerGuardError}
              quoteIsStale={quoteIsStale}
              quoteUpdatedAt={quoteUpdatedAt ? new Date(quoteUpdatedAt).toLocaleTimeString() : null}
              approvalRequired={approvalRequired}
              routeSummary={routeSummary}
              gasEstimateLabel={gasEstimateLabel}
              priceImpactLabel={priceImpactLabel}
              lpFeeUsd={lpFeeUsd}
              protocolFeeUsd={protocolFeeUsd}
              selectedChainId={swapChainId}
              walletChainId={walletChainId}
              onSelectChain={handleSelectSwapChain}
              slippagePct={slippagePct}
              onOpenTokenSelector={openTokenSelector}
              onAmountChange={setAmountInUnits}
              onQuickPercent={(pct, tokenBalance) => {
                if (!tokenInBalanceLabel || !tokenBalance) return
                const total = Number(tokenBalance.replace(/,/g, ''))
                if (!Number.isFinite(total)) return
                const next = ((pct / 100) * total).toFixed(6)
                setAmountInUnits(next)
              }}
              onSwitchTokens={handleSwitchTokens}
              onReviewTrade={() => {
                if (unverifiedSelectionMode) return
                void handleReviewTrade()
              }}
              onRefreshQuote={() => void handleQuote()}
              onSetSlippagePct={setSlippagePct}
              onResetUnverified={() => {
                setUnverifiedSelectionMode(false)
                setUnverifiedTokenLabel(null)
              }}
              onConfirmUnverified={confirmUnverifiedSelection}
              executionMode={executionMode}
              fallbackActive={executionFallbackActive}
              needsUnverifiedConfirmation={unverifiedSelectionMode}
              unverifiedTokenLabel={unverifiedTokenLabel}
            />
          ) : (
            <LiquidityPanel
              tokenInSymbol={tokenInSymbol}
              tokenOutSymbol={tokenOutSymbol}
              lpMode={lpMode}
              lpFeeTier={lpFeeTier}
              lpAmountA={lpAmountA}
              lpAmountB={lpAmountB}
              lpLowerTick={lpLowerTick}
              lpUpperTick={lpUpperTick}
              lpPositionId={lpPositionId}
              lpStatus={lpStatus}
              lpError={lpError}
              lpBusy={lpBusy}
              anyBusy={anyBusy}
              identityReady={identityReady}
              positions={positions}
              positionsLoading={lpPositionsQuery.isLoading}
              positionsError={lpPositionsQuery.isError ? 'Failed to load positions.' : null}
              onSetLpMode={setLpMode}
              onSetLpFeeTier={setLpFeeTier}
              onSetLpAmountA={setLpAmountA}
              onSetLpAmountB={setLpAmountB}
              onSetLpLowerTick={setLpLowerTick}
              onSetLpUpperTick={setLpUpperTick}
              onSetLpPositionId={setLpPositionId}
              onLpQuote={handleLpQuote}
              onCreatePosition={handleCreatePosition}
              onClaimFees={handleClaimFees}
              onRemoveLiquidity={handleRemoveLiquidity}
              onRefreshPositions={() => void lpPositionsQuery.refetch()}
              activePanel={activePanel}
              onSetActivePanel={setActivePanel}
              onOpenSettings={() => setShowAdvanced(true)}
            />
          )
        }
        vaultPanel={activePanel === 'swap' ? <VaultsPanel chainId={swapChainId} /> : null}
        title="Swap"
        subtitle="1-Click Swaps on Base"
      />

      {telegramLinkFlowActive ? (
        <div className="mx-auto mt-4 max-w-4xl">
          <Alert
            variant={telegramLinkState === 'error' ? 'warning' : telegramLinkState === 'linked' ? 'success' : 'info'}
            title={
              telegramLinkState === 'linking'
                ? 'Linking Telegram account'
                : telegramLinkState === 'linked'
                  ? 'Telegram account linked'
                  : telegramLinkState === 'error'
                    ? 'Telegram linking needs attention'
                    : 'Preparing Telegram link'
            }
          >
            {telegramLinkMessage ?? 'Finalizing your Telegram + 4626 account link.'}
            {telegramLinkState === 'error' ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={retryTelegramLink}
                  className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white transition hover:bg-white/10"
                >
                  Retry link
                </button>
              </div>
            ) : null}
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && needsPrivyCanonicalAuth ? (
        <div className="mx-auto mt-4 max-w-4xl">
          <Alert
            variant="warning"
            title="Privy sign-in required for canonical swaps"
            action={{
              label: authBusy ? 'Signing in...' : 'Sign in with Privy',
              onClick: () => {
                if (authBusy || privyClientStatus !== 'ready') return
                void signIn({ method: canonicalSignInMethod })
              },
            }}
          >
            Canonical mode uses your Privy embedded EOA as the owner signer. Sign in with Privy, then retry the swap.
            {authError ? <div className="mt-2 text-rose-300">{authError}</div> : null}
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && showPrivyClientDisabledHint ? (
        <div className="mx-auto mt-4 max-w-4xl">
          <Alert variant="warning" title="Privy is not configured for canonical swaps">
            Canonical mode requires Privy authentication and an embedded owner wallet. Enable Privy for this environment,
            then reload.
            <div className="mt-2 text-zinc-300">
              Set <span className="font-mono text-zinc-200">VITE_PRIVY_ENABLED=true</span> with a valid Privy app
              configuration.
            </div>
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && showPrivyLoadingHint ? (
        <div className="mx-auto mt-4 max-w-4xl">
          <Alert variant="warning" title="Initializing Privy for canonical signing">
            Waiting for the Privy client/session to finish loading before canonical signer checks can complete.
          </Alert>
        </div>
      ) : null}

      {showCanonicalSessionGuardHint ? (
        <div className="mx-auto mt-4 max-w-4xl">
          <Alert variant="warning" title={canonicalSessionGuardTitle}>
            {canonicalSubmitSession.message}
          </Alert>
        </div>
      ) : null}

      {activePanel === 'swap' && diagnosticsEnabled ? (
        <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-white/10 bg-zinc-950/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Internal 7702 Diagnostics</div>
              <div className="text-xs text-zinc-500">
                Canary eligible: <span className={canary7702Eligible ? 'text-emerald-300' : 'text-zinc-400'}>{canary7702Eligible ? 'yes' : 'no'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void run7702DryRun()}
              disabled={diagnosticsBusy || busy !== null}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {diagnosticsBusy ? 'Running…' : 'Run dry-run'}
            </button>
          </div>
          {diagnosticsResult ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/40 p-2 text-[11px] text-zinc-300">
              {JSON.stringify(diagnosticsResult, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {activePanel === 'swap' && txDebug.enabled ? (
        <div className="mx-auto mt-4 max-w-4xl rounded-xl border border-cyan-400/20 bg-cyan-950/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-cyan-200">Swap Tx Router Debug</div>
              <div className="text-xs text-cyan-100/80">
                mode={txDebug.selectedSendMode ?? '--'} method={txDebug.lastMethod ?? '--'} smartWallet=
                {txDebug.smartWalletDetected ? 'yes' : 'no'}
              </div>
            </div>
            <div className="text-right text-[11px] text-cyan-100/80">
              <div>connector: {txDebug.connectorName ?? '--'} ({txDebug.connectorId ?? '--'})</div>
              <div>signerType: {txDebug.signerType ?? '--'}</div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-cyan-100/90 md:grid-cols-2">
            <div className="rounded-lg border border-cyan-400/15 bg-black/30 p-2">
              <div>selected: {txDebug.selectedAddress ?? '--'}</div>
              <div>execution: {txDebug.executionAddress ?? '--'}</div>
              <div>signer: {txDebug.signerAddress ?? '--'}</div>
              <div>canonical: {txDebug.canonicalAddress ?? '--'}</div>
            </div>
            <div className="rounded-lg border border-cyan-400/15 bg-black/30 p-2">
              <div>supports5792: {txDebug.capabilities.supports5792 ? 'yes' : 'no'}</div>
              <div>paymasterService: {txDebug.capabilities.paymasterService ? 'yes' : 'no'}</div>
              <div>atomicStatus: {txDebug.capabilities.atomicStatus}</div>
              <div>canonicalSignerRequired: {txDebug.canonicalSigner.required ? 'yes' : 'no'}</div>
              <div>canonicalSignerReady: {txDebug.canonicalSigner.ready ? 'yes' : 'no'}</div>
              <div>canonicalSignerGate: {txDebug.canonicalSigner.code ?? '--'}</div>
              <div>privyClientStatus: {txDebug.privy.clientStatus ?? '--'}</div>
              <div>privyReady: {txDebug.privy.ready ? 'yes' : 'no'}</div>
              <div>
                privyAuthenticated:{' '}
                {txDebug.privy.authenticated === null ? '--' : txDebug.privy.authenticated ? 'yes' : 'no'}
              </div>
              <div>embeddedWalletSource: {txDebug.privy.embeddedWalletSource ?? '--'}</div>
              <div>embeddedWalletAddress: {txDebug.privy.embeddedWalletAddress ?? '--'}</div>
              <div>allowanceWallet: {txDebug.allowanceCheck?.walletAddress ?? '--'}</div>
            </div>
          </div>

          <div className="mt-2 rounded-lg border border-cyan-400/15 bg-black/30 p-2 text-[11px] text-cyan-100/90">
            <div>approval sender: {txDebug.approvalAttempt?.sender ?? '--'}</div>
            <div>swap sender: {txDebug.swapAttempt?.sender ?? '--'}</div>
            <div>
              sender match:{' '}
              {txDebug.approvalAttempt?.sender && txDebug.swapAttempt?.sender
                ? txDebug.approvalAttempt.sender.toLowerCase() === txDebug.swapAttempt.sender.toLowerCase()
                  ? 'yes'
                  : 'no'
                : '--'}
            </div>
            <div className={txDebug.lastError ? 'text-rose-300' : 'text-cyan-100/90'}>
              last error: {txDebug.lastError ?? '--'}
            </div>
            <div>canonical signer reason: {txDebug.canonicalSigner.reason ?? '--'}</div>
          </div>

          <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-cyan-400/15 bg-black/40 p-2 text-[11px] text-cyan-100/90">
            {JSON.stringify(txDebug, null, 2)}
          </pre>
        </div>
      ) : null}

      {chainMismatch ? (
        <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
          <div className="text-xs text-amber-200">
            Your wallet is on {walletChainId ? getChainMeta(walletChainId)?.name ?? `chain ${walletChainId}` : 'a different network'}. Switch to {chainMeta?.name ?? 'the selected network'} to trade.
          </div>
          <button
            type="button"
            onClick={() => {
              if (switchChainAsync) void switchChainAsync({ chainId: swapChainId }).catch(() => {})
            }}
            className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 transition"
          >
            Switch
          </button>
        </div>
      ) : null}

      <TokenSelectorModal
        open={tokenSelectorOpen}
        query={tokenSelectorQuery}
        selectedToken={tokenSelectorSide === 'input' ? tokenIn : tokenOut}
        tokenOptions={swapTokenOptions}
        recentTokenAddresses={recentTokenAddresses}
        chainId={swapChainId}
        onQueryChange={setTokenSelectorQuery}
        onClose={() => setTokenSelectorOpen(false)}
        onSelect={onSelectToken}
      />

      {/* ─── Sheets / Modals ────────────────────────────────────────────── */}
      <SwapSettingsSheet
        open={showAdvanced}
        busy={busy !== null}
        slippagePct={slippagePct}
        deadlineMinutes={deadlineMinutes}
        onClose={() => setShowAdvanced(false)}
        onSetSlippagePct={setSlippagePct}
        onSetDeadlineMinutes={setDeadlineMinutes}
      />

    </>
  )
}

// ─── Liquidity panel component ──────────────────────────────────────────────

function LiquidityPanel(props: {
  tokenInSymbol: string
  tokenOutSymbol: string
  lpMode: 'simple' | 'advanced'
  lpFeeTier: string
  lpAmountA: string
  lpAmountB: string
  lpLowerTick: string
  lpUpperTick: string
  lpPositionId: string
  lpStatus: string
  lpError: string
  lpBusy: string | null
  anyBusy: boolean
  identityReady: boolean
  positions: LpPosition[]
  positionsLoading: boolean
  positionsError: string | null
  activePanel: 'swap' | 'liquidity'
  onSetLpMode: (m: 'simple' | 'advanced') => void
  onSetLpFeeTier: (v: string) => void
  onSetLpAmountA: (v: string) => void
  onSetLpAmountB: (v: string) => void
  onSetLpLowerTick: (v: string) => void
  onSetLpUpperTick: (v: string) => void
  onSetLpPositionId: (v: string) => void
  onLpQuote: () => void
  onCreatePosition: () => void
  onClaimFees: (id?: string) => void
  onRemoveLiquidity: (id?: string) => void
  onRefreshPositions: () => void
  onSetActivePanel: (panel: 'swap' | 'liquidity') => void
  onOpenSettings: () => void
}) {
  return (
    <div className="space-y-4">
      <PageMeta title="Swap" description="Swap tokens on Base using 4626 — best-price routing via Uniswap." canonicalPath="/swap" />
      {/* ─── Execution bar (mirrors swap panel) ─── */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-full border border-white/12 bg-black/40 p-0.5 text-xs">
          {(['swap', 'liquidity'] as const).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => props.onSetActivePanel(panel)}
              className={`min-h-7 rounded-full px-3 py-1 transition-colors capitalize ${
                props.activePanel === panel
                  ? 'bg-white/15 text-white font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {panel}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={props.onOpenSettings}
          className="rounded-full border border-white/12 bg-white/4 p-2 text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
          aria-label="Swap settings"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <circle cx="8" cy="8" r="2" /><path d="M8 2v1M8 13v1M2 8H1m13 0h1M4.05 4.05l-.71-.71m9.32 9.32-.71-.71M4.05 11.95l-.71.71m9.32-9.32-.71.71" />
          </svg>
        </button>
      </div>

      {/* ─── Add liquidity form ─── */}
      <div className="rounded-2xl border border-white/8 bg-vault-card/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Add position</span>
          <button
            type="button"
            onClick={() => props.onSetLpMode(props.lpMode === 'simple' ? 'advanced' : 'simple')}
            className="rounded-full border border-white/12 bg-white/4 px-3 py-1 text-[11px] text-zinc-400 transition hover:bg-white/8 hover:text-zinc-200"
          >
            {props.lpMode === 'simple' ? 'Simple' : 'Advanced'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label mb-1 block">{props.tokenInSymbol} amount</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary/40"
              value={props.lpAmountA}
              onChange={(e) => props.onSetLpAmountA(e.target.value)}
              placeholder="0.0"
            />
          </div>
          <div>
            <label className="label mb-1 block">{props.tokenOutSymbol} amount</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-primary/40"
              value={props.lpAmountB}
              onChange={(e) => props.onSetLpAmountB(e.target.value)}
              placeholder="0.0"
            />
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="label mb-1 block">Fee tier</label>
            <select
              value={props.lpFeeTier}
              onChange={(e) => props.onSetLpFeeTier(e.target.value)}
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            >
              <option value="500">0.05%</option>
              <option value="3000">0.30%</option>
              <option value="10000">1.00%</option>
            </select>
          </div>
          <div>
            <label className="label mb-1 block">Position ID</label>
            <input
              className="min-h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={props.lpPositionId}
              onChange={(e) => props.onSetLpPositionId(e.target.value)}
              placeholder="For claim / remove"
            />
          </div>
        </div>

        {props.lpMode === 'advanced' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={props.lpLowerTick}
              onChange={(e) => props.onSetLpLowerTick(e.target.value)}
              placeholder="Lower tick"
            />
            <input
              className="min-h-10 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600"
              value={props.lpUpperTick}
              onChange={(e) => props.onSetLpUpperTick(e.target.value)}
              placeholder="Upper tick"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={props.onLpQuote}
            disabled={props.anyBusy || !props.identityReady}
            className="rounded-xl border border-white/12 bg-white/4 py-2 text-sm text-zinc-300 transition hover:bg-white/8 disabled:opacity-50"
          >
            {props.lpBusy === 'lpQuote' ? 'Quoting…' : 'Get quote'}
          </button>
          <button
            type="button"
            onClick={props.onCreatePosition}
            disabled={props.anyBusy || !props.identityReady}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary py-2 text-sm font-semibold text-white shadow-[0_4px_20px_-8px_rgba(0,82,255,0.5)] transition hover:bg-brand-hover disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {props.lpBusy === 'lpCreate' ? 'Adding…' : 'Add liquidity'}
          </button>
          <button
            type="button"
            onClick={() => props.onClaimFees()}
            disabled={props.anyBusy || !props.identityReady || !props.lpPositionId.trim()}
            className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
          >
            {props.lpBusy === 'lpClaim' ? 'Claiming…' : 'Claim fees'}
          </button>
          <button
            type="button"
            onClick={() => props.onRemoveLiquidity()}
            disabled={props.anyBusy || !props.identityReady || !props.lpPositionId.trim()}
            className="rounded-xl border border-rose-400/20 bg-rose-500/8 py-2 text-sm font-medium text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
          >
            {props.lpBusy === 'lpRemove' ? 'Removing…' : 'Remove'}
          </button>
        </div>

        {props.lpStatus && (
          <div className="mt-2"><Alert variant="success">{props.lpStatus}</Alert></div>
        )}
        {props.lpError && (
          <div className="mt-2"><Alert variant="error">{props.lpError}</Alert></div>
        )}
      </div>

      {/* ─── Positions ─── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
            <Droplets className="h-3.5 w-3.5" />
            Your positions
          </div>
          <button
            type="button"
            onClick={props.onRefreshPositions}
            disabled={props.positionsLoading}
            className="rounded-full border border-white/10 p-1.5 text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
            aria-label="Refresh positions"
          >
            <RefreshCw className={`h-3 w-3 ${props.positionsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {props.positionsLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/4" />
            ))}
          </div>
        )}

        {props.positionsError && !props.positionsLoading && (
          <Alert variant="error">{props.positionsError}</Alert>
        )}

        {!props.positionsLoading && !props.positionsError && props.positions.length === 0 && (
          <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-6 text-center">
            <Droplets className="mx-auto h-8 w-8 text-zinc-700 mb-2" aria-hidden="true" />
            <div className="text-sm text-zinc-500">No active liquidity positions</div>
            <div className="mt-1 text-xs text-zinc-600">Add liquidity above to start earning fees.</div>
          </div>
        )}

        {!props.positionsLoading && props.positions.length > 0 && (
          <div className="space-y-2">
            {props.positions.map((pos, i) => (
              <LpPositionCard
                key={pos.id ?? pos.tokenId ?? i}
                position={pos}
                busy={props.lpBusy}
                onClaim={props.onClaimFees}
                onRemove={props.onRemoveLiquidity}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
