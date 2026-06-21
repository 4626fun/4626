import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAddress, isAddress, parseUnits, type Address } from 'viem'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAccount, useConnect, usePublicClient, useReconnect, useSwitchChain, useWalletClient } from 'wagmi'
import {
  usePrivy,
} from '@privy-io/react-auth'
import { useDebounceValue } from 'usehooks-ts'
import { AnimatePresence, motion } from 'framer-motion'

import { META, PageMeta } from '@/components/seo/PageMeta'
import { SwapSettingsModal } from '@/components/trade/SwapSettingsModal'
import { ExternalWalletOptions } from '@/components/account/ConnectButton'

import { SwapCard } from '@/components/swap/SwapCard'
import { SwapConnectGate } from '@/components/swap/SwapConnectGate'
import { SwapPageLayout } from '@/components/swap/SwapPageLayout'
import { TokenSelectorModal, type SwapTokenOption } from '@/components/swap/TokenSelectorModal'
import { LiquidityPanel } from '@/components/swap/LiquidityPanel'
import { SwapStatusAlerts } from '@/components/swap/SwapStatusAlerts'
import { useSwapEmbeddedEoa } from '@/lib/swap/useSwapEmbeddedEoa'
import { useSwapTokenOptions } from '@/lib/swap/useSwapTokenOptions'
import { useSwapRecentTokens } from '@/lib/swap/useSwapRecentTokens'
import { DEFAULT_CHAIN_ID, type SupportedChainId, getChainMeta } from '@/config/chains'
import { CONTRACTS } from '@/config/contracts'
import { shouldStartAutoQuote, useSwapExecution } from '@/hooks/useSwapExecution'
import { useSwapState } from '@/hooks/useSwapState'
import { useTokenIdentity } from '@/hooks/useTokenIdentity'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useAccountMe } from '@/hooks/useAccountMe'
import { usePrivyClientStatus } from '@/lib/privy/client'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'

import { deriveSwapConnectGate, isConnectorAlreadyConnectedError } from '@/lib/swap/connectGate'

import { deriveSwapUsdEstimates, isNativeEthToken, isUsdStablecoinToken } from '@/lib/swap/swapAmountUsd'
import { formatSlippagePctForDisplay } from '@/lib/swap/swapAutoSlippage'
import { extractSwapQuoteDetails } from '@/lib/swap/swapQuoteDetails'
import { amountUnitsFromBalancePercent, formatSwapTokenBalanceLabel } from '@/lib/swap/swapDisplayAmount'
import { useSwapAssetBalance } from '@/lib/swap/useSwapAssetBalance'
import { useSwapTokenUsdPrices } from '@/lib/swap/useSwapTokenUsdPrices'
import { buildWaitlistSetupUrl } from '@/lib/auth/waitlistEntry'
import {
  resolveEffectiveExecutionTrack,
  deriveAccountChromeExecution,
  type UserFrontendExecutionTrack,
} from '@/lib/wallet/userExecutionTrack'
import { resolveEmbeddedOwnerOnCanonicalCsw } from '@/lib/wallet/cswOwnerRead'
import { type WalletMode } from '@/lib/uniswap/walletMode'
import {
  evaluateCanonicalSignerGate,
  type CanonicalAuthStatus,
  type CanonicalOwnerCheckStatus,
} from '@/lib/uniswap/canonicalSignerGate'
import {
  BASE_CHAIN_ID,
  NATIVE_TOKEN_ADDRESS,
} from '@/lib/uniswap/swapUtils'
import { selectPreferredWalletConnector } from '@/lib/wallet/wagmiConnectorSelection'
import { detectEthereumProviderCollision } from '@/lib/wallet/providerCollision'
import { resolveCreatorTradeTokenAddress } from '@/lib/onchain/vaultResolve'
import { useAccountContext } from '@/wallet/accountContext'
import { isCanonicalCsw } from '@/wallet/canonicalWalletPolicy'
import { useScreenshotReady } from '@/lib/ui/screenshotMode'
import { normalizeSwapAddress } from '@/lib/swap/resolveSwapBalanceOwner'

let warnedSwapPrivyHookFailure = false
let canonicalSessionAutoRefreshAttemptedGlobal = false
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






function fmtBalFromAmount(amount: string | null | undefined, symbol: string): string | undefined {
  if (amount == null || amount === '') return undefined
  const formatted = formatSwapTokenBalanceLabel(amount, symbol)
  if (!formatted || formatted === '0') return `0 ${symbol}`
  return `${formatted} ${symbol}`
}

function parsePositiveAmountToUnits(value: string, decimals: number): bigint | null {
  const raw = String(value ?? '').trim()
  if (!raw || raw.endsWith('.')) return null
  const numeric = Number(raw)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  try {
    return parseUnits(raw, decimals)
  } catch {
    return null
  }
}



// ─── Main page ──────────────────────────────────────────────────────────────

export function Swap() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const { address, isConnected, chainId: walletChainId, connector } = useAccount()
  const { data: walletClient } = useWalletClient()
  const privyClientStatus = usePrivyClientStatus()
  const privyHooksEnabled = privyClientStatus === 'ready'
  const {
    ready: privyReady,
    authenticated: privyAuthenticated,
    user: privyUser,
    getAccessToken,
    logout: privyLogout,
  } = useSafeSwapPrivyHook(privyHooksEnabled)
  const { connectors: wagmiConnectors } = useConnect()
  const { reconnectAsync } = useReconnect()
  const [swapConnectBusy, setSwapConnectBusy] = useState(false)
  const [swapConnectError, setSwapConnectError] = useState<string | null>(null)
  const [showSwapWalletOptions, setShowSwapWalletOptions] = useState(false)
  const walletRecoveryAttemptKeyRef = useRef('')
  const accountMe = useAccountMe()
  const { embeddedEoaAddress: ensuredEmbeddedEoaAddress, ensureEmbeddedWallet } = useEnsurePrivyEmbeddedWallet()
  const auth = useSiweAuth()
  const {
    authAddress,
    hasSession,
    sessionHydrated,
    refresh: refreshAuthSession,
    signInWithPrivyToken,
    signIn,
    busy: authBusy,
    error: authError,
  } = auth
  const { switchChainAsync } = useSwitchChain()
  const [swapChainId, setSwapChainId] = useState<SupportedChainId>(DEFAULT_CHAIN_ID)
  const publicClient = usePublicClient({ chainId: swapChainId })
  const chainMeta = getChainMeta(swapChainId)
  const chainMismatch = isConnected && walletChainId != null && walletChainId !== swapChainId
  const providerCollision = useMemo(() => detectEthereumProviderCollision(), [])
  const { hasMultipleInjectedProviders, lockedEthereumProviderGlobal } = providerCollision
  const shouldHideInjectedConnector = providerCollision.shouldDisableInjectedConnector

  const {
    tokenIn,
    setTokenIn,
    tokenOut,
    setTokenOut,
    amountInUnits,
    setAmountInUnits,
    slippageAuto,
    setSlippageAuto,
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
  const [debouncedTokenSelectorQuery] = useDebounceValue(tokenSelectorQuery, 250)
  const normalizedTokenSelectorQuery = debouncedTokenSelectorQuery.trim().toLowerCase()

  const { recentTokenAddresses, persistRecentToken } = useSwapRecentTokens()
  const requestedTokenParam = (searchParams.get('token') ?? '').trim()
  const requestedShareTokenParam = (searchParams.get('share') ?? searchParams.get('shareToken') ?? '').trim()
  const normalizedRequestedToken = isAddress(requestedTokenParam)
    ? getAddress(requestedTokenParam)
    : null
  const normalizedRequestedShareToken = isAddress(requestedShareTokenParam)
    ? getAddress(requestedShareTokenParam)
    : null
  const requestedTradeTokenQuery = useQuery({
    queryKey: ['swap', 'requested-trade-token', swapChainId, normalizedRequestedToken ?? ''],
    enabled: Boolean(publicClient && swapChainId === BASE_CHAIN_ID && normalizedRequestedToken),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      if (!publicClient || !normalizedRequestedToken) return null
      return await resolveCreatorTradeTokenAddress(publicClient as any, normalizedRequestedToken)
    },
  })
  const requestedTradeToken = useMemo(() => {
    if (!normalizedRequestedToken) return null
    if (swapChainId !== BASE_CHAIN_ID || !publicClient) return normalizedRequestedToken
    if (requestedTradeTokenQuery.data) return requestedTradeTokenQuery.data
    if (requestedTradeTokenQuery.isError || requestedTradeTokenQuery.isFetched) return normalizedRequestedToken
    return null
  }, [
    normalizedRequestedToken,
    publicClient,
    requestedTradeTokenQuery.data,
    requestedTradeTokenQuery.isError,
    requestedTradeTokenQuery.isFetched,
    swapChainId,
  ])

  // ─── URL params ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (requestedTradeToken) setTokenOut(requestedTradeToken)
  }, [requestedTradeToken, setTokenOut])

  // Account + embedded EOA are hoisted early. balanceOwnerAddress is set directly to the
  // parent/main/zora csw (accountContext.cswAddress) so the token selector shows holdings
  // and per-token balances for the actual asset-holding CSW.
  const accountContext = useAccountContext()
  const refreshAccountContext = accountContext.actions.refresh
  const canonicalAddress = accountContext.cswAddress ?? null
  const signerAddress = accountContext.signerAddress ?? null
  const accountSignals = accountMe.me?.accountSignals ?? null
  const executionTrack = (accountSignals?.executionTrack ?? null) as UserFrontendExecutionTrack | null

  // Use dedicated hook for the (now much simpler, post cross-app/sub removal) embedded EOA resolution.
  // This removes a large amount of inline Privy wallet merging, address picking, canSign, provider getter,
  // hydration recovery effect, ensure effect, and the custom signer client from the main component.
  const embeddedEoa = useSwapEmbeddedEoa({
    privyUser,
    privyAuthenticated,
    ensuredEmbeddedEoaAddress,
    ensureEmbeddedWallet,
    authAddress: authAddress as Address | null,
    canonicalAddress: canonicalAddress as Address | null,
  })

  const privyEmbeddedEoaAddress = embeddedEoa.privyEmbeddedEoaAddress
  const privyEmbeddedEoaAddressSource = embeddedEoa.privyEmbeddedEoaAddressSource
  const privyEmbeddedEoaCanSign = embeddedEoa.privyEmbeddedEoaCanSign
  const privyEmbeddedCanonicalWalletClient = embeddedEoa.privyEmbeddedCanonicalWalletClient
  const hydrationRecoveryBusy = embeddedEoa.hydrationRecoveryBusy

  // Use the parent/main/zora CSW (accountContext.cswAddress) as the asset holder for
  // selector holdings + balance labels. This ensures Zora creator/content coin balances
  // and holdings shown in the e/token selector reflect the CSW that actually owns them
  // (not the embedded EOA or external signer).
  const balanceOwnerAddress = normalizeSwapAddress(
    canonicalAddress ?? accountSignals?.canonicalCswAddress ?? null,
  )

  const {
    swapTokenOptions,
    tokenInOption,
    tokenOutOption,
    registerTokenForIdentity,
    discoveredCreatorTokenOptionsQuery,
    preferZoraTradeRoute,
    holdingsUsdByAddress,
  } = useSwapTokenOptions({
    swapChainId,
    tokenIn,
    tokenOut,
    tokenSelectorOpen,
    normalizedTokenSelectorQuery,
    requestedTradeToken,
    normalizedRequestedShareToken,
    balanceOwnerAddress,
  })

  const privyEmbeddedEoaCanOperateCanonicalQuery = useQuery({
    queryKey: ['swap', 'privy-embedded-can-operate-canonical', canonicalAddress, privyEmbeddedEoaAddress, swapChainId],
    enabled: Boolean(
      canonicalAddress &&
        privyEmbeddedEoaAddress &&
        publicClient &&
        swapChainId === BASE_CHAIN_ID,
    ),
    staleTime: 10_000,
    queryFn: async (): Promise<boolean | null> => {
      if (!canonicalAddress || !privyEmbeddedEoaAddress || !publicClient) return null
      return resolveEmbeddedOwnerOnCanonicalCsw({
        publicClient,
        cswAddress: canonicalAddress as Address,
        ownerAddress: privyEmbeddedEoaAddress as Address,
      })
    },
  })

  const effectiveExecutionTrack = useMemo(() => {
    const resolved = resolveEffectiveExecutionTrack({
      executionTrack: executionTrack ?? undefined,
      parentEmbeddedOwnerOnChain: privyEmbeddedEoaCanOperateCanonicalQuery.data === true,
      privyEmbeddedEoaIsOwnerOfCanonicalCsw: accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw,
    })
    // Avoid flashing "Open waitlist setup" while `/api/accounts/me` is still in flight.
    // The gate treats an unset track differently from explicit `none-yet`.
    if (accountMe.loading && executionTrack == null && resolved === 'none-yet') {
      return undefined
    }
    return resolved
  }, [
    executionTrack,
    accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw,
    privyEmbeddedEoaCanOperateCanonicalQuery.data,
    accountMe.loading,
  ])
  const swapExecutionChrome = useMemo(
    () =>
      deriveAccountChromeExecution({
        executionTrack: executionTrack ?? undefined,
        parentEmbeddedOwnerOnChain: privyEmbeddedEoaCanOperateCanonicalQuery.data === true,
        privyEmbeddedEoaIsOwnerOfCanonicalCsw: accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw,
        canonicalCswAddress: canonicalAddress,
      }),
    [
      executionTrack,
      accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw,
      privyEmbeddedEoaCanOperateCanonicalQuery.data,
      canonicalAddress,
    ],
  )

  // Historical sub-account and Zora cross-app signer paths removed.
  // Resolution now focuses on the primary embedded EOA (from live wallets, user metadata, ensured hook, or session).



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
    if (accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw === true) return 'owner'
    if (privyEmbeddedEoaCanOperateCanonicalQuery.data === null) return 'pending'
    return 'unknown'
  }, [
    accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw,
    privyEmbeddedEoaCanOperateCanonicalQuery.data,
    privyEmbeddedEoaCanOperateCanonicalQuery.isFetching,
    privyEmbeddedEoaCanOperateCanonicalQuery.isLoading,
  ])
  const canonicalSignerGate = useMemo(
    () =>
      evaluateCanonicalSignerGate({
        executionMode,
        executionTrack: effectiveExecutionTrack,
        canonicalAddress,
        clientStatus: privyClientStatus,
        authStatus: canonicalAuthStatus,
        embeddedWalletDetected: Boolean(privyEmbeddedEoaAddress),
        embeddedWalletAddress: privyEmbeddedEoaAddress,
        embeddedWalletCanSign: privyEmbeddedEoaCanSign,
        ownerCheckStatus: canonicalOwnerCheckStatus,
      }),
    [
      effectiveExecutionTrack,
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
  // P3: When the embedded-EOA gate is not ready but a connected external EOA is a confirmed
  // owner of a user-owned (non-platform) CSW, fall back to the external EOA as the canonical
  // signer so routing stays on the canonical sender path (canonicalDirect). Platform canonical
  // CSW (CANONICAL_CSW_ADDRESS) keeps strict embedded-signer enforcement — this fallback never
  // activates for the platform account.
  const useExternalEoaCanonicalSigner =
    executionMode === 'canonical' &&
    !usePrivyEmbeddedCanonicalSigner &&
    accountContext.eoaIsOwnerOfCsw === true &&
    !isCanonicalCsw(canonicalAddress)
  const canonicalSignerAddress = usePrivyEmbeddedCanonicalSigner
    ? privyEmbeddedEoaAddress
    : useExternalEoaCanonicalSigner
      ? signerAddress
      : null
  const canonicalSignerWalletClient = usePrivyEmbeddedCanonicalSigner
    ? (privyEmbeddedCanonicalWalletClient as any)
    : useExternalEoaCanonicalSigner
      ? walletClient
      : null
  const executionSignerAddress = executionMode === 'canonical' ? canonicalSignerAddress : signerAddress
  const executionWalletClient = executionMode === 'canonical' ? canonicalSignerWalletClient : walletClient
  const executionSignerType =
    executionMode === 'canonical' && (usePrivyEmbeddedCanonicalSigner || useExternalEoaCanonicalSigner)
      ? 'EOA'
      : accountContext.signerType
  const executionCapabilities = useMemo(
    () =>
      executionMode === 'canonical'
        ? ({
            paymasterService: false,
            atomicStatus: 'unknown',
            supports5792: false,
          } as const)
        : accountContext.capabilities,
    [executionMode, accountContext.capabilities],
  )
  const executionConnectorId =
    executionMode === 'canonical'
      ? usePrivyEmbeddedCanonicalSigner
        ? 'privy-embedded'
        : useExternalEoaCanonicalSigner
          ? (connector?.id ?? null)
          : 'privy-embedded-required'
      : (connector?.id ?? null)
  const executionConnectorName =
    executionMode === 'canonical'
      ? usePrivyEmbeddedCanonicalSigner
        ? 'Privy Embedded EOA'
        : useExternalEoaCanonicalSigner
          ? (connector?.name ?? null)
          : 'Privy Embedded EOA (required)'
      : (connector?.name ?? null)
  // Ensure the swap execution (sender, asset owner for approvals/swaps, and balance checks)
  // uses the parent/main/zora csw (the same balanceOwnerAddress we resolved for the token selector
  // holdings and per-token balances). This makes sure "my Zora CSW holdings" shown in the selector
  // are the ones actually spent/signed for in the swap tx.
  const executionAddress = balanceOwnerAddress ?? (executionMode === 'canonical' ? canonicalAddress : (accountContext.activeAccount ?? null))
  const executionReady = Boolean(
    executionAddress &&
      executionWalletClient &&
      publicClient &&
      (executionMode !== 'canonical' || canonicalSignerGate.ready || useExternalEoaCanonicalSigner),
  )

  const canonicalSignerGuardError =
    executionMode === 'canonical' && !canonicalSignerGate.ready ? canonicalSignerGate.reason : null
  const canonicalSetupGateCodes = useMemo(
    () =>
      new Set([
        'execution-setup-required',
        'embedded-wallet-not-owner',
        'owner-removed-stale-track',
      ]),
    [],
  )
  const needsCanonicalSetupAction =
    executionMode === 'canonical' &&
    !accountMe.loading &&
    !canonicalSignerGate.ready &&
    canonicalSetupGateCodes.has(canonicalSignerGate.code) &&
    !(
      canonicalSignerGate.code === 'embedded-wallet-not-owner' &&
      effectiveExecutionTrack === 'legacy-owner-install'
    )
  const canonicalSetupActionLabel = 'Enable 4626 signing'
  const handleEnableCanonicalSigning = useCallback(() => {
    window.location.assign(buildWaitlistSetupUrl('owner-install'))
  }, [])
  const needsPrivyCanonicalAuth = useMemo(
    () =>
      executionMode === 'canonical' &&
      privyClientStatus === 'ready' &&
      (canonicalSignerGate.code === 'privy-auth-required' ||
        canonicalSignerGate.code === 'embedded-wallet-missing'),
    [canonicalSignerGate.code, executionMode, privyClientStatus],
  )
  // Separate from `needsPrivyCanonicalAuth` because the remediation is
  // different — the user is already signed in; the embedded wallet object
  // just hasn't been hydrated with an EIP-1193 provider yet. Auto-recovery
  // already runs in an effect above; this surface offers the user a manual
  // retry if the auto path didn't take.
  const needsEmbeddedWalletReconnect = useMemo(
    () =>
      executionMode === 'canonical' &&
      privyClientStatus === 'ready' &&
      canonicalSignerGate.code === 'embedded-wallet-cannot-sign',
    [canonicalSignerGate.code, executionMode, privyClientStatus],
  )
  const showPrivyClientDisabledHint =
    executionMode === 'canonical' && canonicalSignerGate.code === 'privy-client-disabled'
  const showPrivyLoadingHint = executionMode === 'canonical' && canonicalSignerGate.code === 'privy-auth-loading'
  const canonicalSignInMethod = 'privy' as const
  const connectGate = useMemo(
    () =>
      deriveSwapConnectGate({
        sessionHydrated,
        hasSession,
        executionAddress,
        authBusy,
      }),
    [authBusy, executionAddress, hasSession, sessionHydrated],
  )
  const recoverExistingWalletConnection = useCallback(async (connectorToRecover?: unknown): Promise<boolean> => {
    let recovered = false
    try {
      const variables = connectorToRecover ? { connectors: [connectorToRecover] } : undefined
      const results = await reconnectAsync(variables as never)
      recovered =
        !Array.isArray(results) ||
        results.some((entry: unknown) => {
          const candidate = entry as { accounts?: unknown; connector?: unknown } | null
          const accounts = Array.isArray(candidate?.accounts) ? candidate.accounts : []
          return accounts.length > 0 || Boolean(candidate?.connector)
        })
    } catch (error) {
      recovered = isConnectorAlreadyConnectedError(error)
    }
    if (recovered) {
      try {
        await refreshAccountContext()
      } catch {
        // Account context refresh is best-effort after reconnect.
      }
    }
    return recovered
  }, [reconnectAsync, refreshAccountContext])
  useEffect(() => {
    if (connectGate.state !== 'wallet-required' || authBusy || swapConnectBusy) return

    const preferred = selectPreferredWalletConnector(wagmiConnectors)
    const connectorKey = preferred ? `${preferred.id}:${preferred.name}` : 'any'
    const attemptKey = `${authAddress ?? 'session'}:${executionMode}:${connectorKey}`
    if (walletRecoveryAttemptKeyRef.current === attemptKey) return

    walletRecoveryAttemptKeyRef.current = attemptKey
    setSwapConnectError(null)
    setSwapConnectBusy(true)
    void recoverExistingWalletConnection(preferred).finally(() => {
      setSwapConnectBusy(false)
    })
  }, [
    authAddress,
    authBusy,
    connectGate.state,
    executionMode,
    recoverExistingWalletConnection,
    swapConnectBusy,
    wagmiConnectors,
  ])
  const handleConnectGateAction = useCallback(() => {
    if (authBusy || swapConnectBusy) return

    setSwapConnectError(null)

    if (connectGate.state === 'wallet-required') {
      setShowSwapWalletOptions((current) => !current)
      return
    }

    setShowSwapWalletOptions(false)
    void signIn({
      method: executionMode === 'canonical' ? canonicalSignInMethod : 'auto',
      preferBaseAccountWallet: executionMode === 'canonical',
    })
  }, [
    authBusy,
    canonicalSignInMethod,
    connectGate.state,
    executionMode,
    signIn,
    swapConnectBusy,
  ])

  useEffect(() => {
    if (!connectGate.ready) return
    walletRecoveryAttemptKeyRef.current = ''
    setSwapConnectError(null)
    setShowSwapWalletOptions(false)
  }, [connectGate.ready])
  const visibleSwapConnectError =
    swapConnectError ?? (authError && !isConnectorAlreadyConnectedError(authError) ? authError : null)

  const ensureCanonicalSession = useCallback(async (): Promise<string | null> => {
    if (executionMode !== 'canonical') return null
    if (!getAccessToken || typeof signInWithPrivyToken !== 'function') return null
    try {
      const token = await getAccessToken()
      if (!token) return null
      // Background refresh only: avoid foreground auth churn/kickout behavior.
      const bridgedAddress = await signInWithPrivyToken(token, { background: true })
      return typeof bridgedAddress === 'string' && bridgedAddress.trim().length > 0 ? bridgedAddress : null
    } catch {
      return null
    }
  }, [executionMode, getAccessToken, signInWithPrivyToken])
  const handlePrivyCanonicalSignIn = useCallback(async () => {
    if (authBusy || privyClientStatus !== 'ready') return
    setSwapConnectError(null)
    const bridged = await ensureCanonicalSession()
    if (bridged) return
    await signIn({ method: 'privy' })
  }, [authBusy, ensureCanonicalSession, privyClientStatus, signIn])
  // Keep canonical-session recovery user-driven. Auto-attempt loops can feel
  // like repeated sign-outs when Privy client/session wiring is unstable.
  const identityReady = Boolean(
    canonicalAddress &&
      executionWalletClient &&
      publicClient &&
      (accountContext.signerType === 'SMART_WALLET' ||
        accountContext.eoaIsOwnerOfCsw === true ||
        canonicalSignerGate.ready),
  )

  const balanceReadsEnabled = Boolean(hasSession && sessionHydrated && balanceOwnerAddress)

  const tokenInIdentity = useTokenIdentity({ address: tokenIn, option: tokenInOption })
  const tokenOutIdentity = useTokenIdentity({ address: tokenOut, option: tokenOutOption })
  const tokenInDisplay = tokenInIdentity.display
  const tokenOutDisplay = tokenOutIdentity.display
  const tokenInSymbol = tokenInDisplay.symbol
  const tokenOutSymbol = tokenOutDisplay.symbol

  const tokenInBalanceQuery = useSwapAssetBalance({
    ownerAddress: balanceOwnerAddress,
    tokenAddress: tokenIn,
    chainId: swapChainId,
    enabled: balanceReadsEnabled,
  })
  const tokenOutBalanceQuery = useSwapAssetBalance({
    ownerAddress: balanceOwnerAddress,
    tokenAddress: tokenOut,
    chainId: swapChainId,
    enabled: balanceReadsEnabled,
  })
  const tokenInBalanceLabel = useMemo(() => {
    if (tokenInBalanceQuery.isSuccess && tokenInBalanceQuery.data) {
      return fmtBalFromAmount(tokenInBalanceQuery.data.formatted, tokenInSymbol)
    }
    return undefined
  }, [tokenInBalanceQuery.data, tokenInBalanceQuery.isSuccess, tokenInSymbol])
  const tokenInAmountExceedsBalance = useMemo(() => {
    const bal = tokenInBalanceQuery.data
    if (!bal) return false
    const amount = parsePositiveAmountToUnits(amountInUnits, bal.decimals)
    if (amount === null) return false
    return amount > bal.raw
  }, [amountInUnits, tokenInBalanceQuery.data])
  const tokenInBalanceError = tokenInAmountExceedsBalance
    ? `Insufficient ${tokenInSymbol} balance. You have ${tokenInBalanceLabel ?? 'less than the amount entered'}.`
    : null

  // ─── Swap execution ───────────────────────────────────────────────────────
  const {
    estimatedOut,
    effectiveSlippagePct,
    quote,
    busy,
    status,
    error,
    confirmIntent,
    quoteUpdatedAt,
    quoteReady,
    isReady,
    quoteCooldownActive,
    quoteCooldownUntil,
    txState,
    approvalRequired,
    fallbackActive,
    swapProviderLabel,
    canonicalSubmitSession,
    handleQuote,
    handleReviewTrade,
    confirmAndExecute,
    resetTradeState,
    swapCompletion,
    clearSwapCompletion,
  } = useSwapExecution({
    // Pass the csw (parent/main/zora csw) as the primary "address" / asset owner for the swap
    // execution path. This ensures that when the selector shows holdings/balances from the Zora CSW,
    // the actual quote build, preflight, approval, and swap tx use that same CSW as the from/sender/owner.
    address: balanceOwnerAddress ?? address,
    walletClient: executionWalletClient,
    publicClient,
    canonicalAddress: canonicalAddress as Address | null,
    signerAddress:
      executionSignerAddress && isAddress(executionSignerAddress)
        ? getAddress(executionSignerAddress)
        : null,
    executionMode,
    executionTrack: effectiveExecutionTrack,
    executionAddress,
    executionReady,
    expectedSessionAddress: executionMode === 'canonical' ? (privyEmbeddedEoaAddress ?? executionSignerAddress) : executionSignerAddress,
    tokenIn,
    tokenOut,
    amountInUnits,
    parsedSlippage,
    slippageAuto,
    parsedDeadlineMinutes,
    preferZoraTradeRoute,
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

  // ─── Stale embedded-signer session recovery ──────────────────────────────
  // "Missing auth token" from the Privy embedded-wallet iframe cannot be fixed
  // by page-side token refresh (custom auth-domain cookies are third-party on
  // localhost). Only a real Privy logout + fresh interactive login re-seeds
  // the iframe session.
  const signingSessionExpired = useMemo(() => {
    const text = String(error ?? '')
    return (
      /signing session (was refreshed but|could not be refreshed)/i.test(text) ||
      /missing auth token/i.test(text)
    )
  }, [error])
  const [signingRecoveryBusy, setSigningRecoveryBusy] = useState(false)
  const handleSigningSessionRecovery = useCallback(async () => {
    if (signingRecoveryBusy) return
    setSigningRecoveryBusy(true)
    try {
      if (typeof privyLogout === 'function') {
        await Promise.resolve(privyLogout()).catch(() => null)
      }
      const bridged = await signIn({ method: 'privy' })
      if (bridged) resetTradeState()
    } finally {
      setSigningRecoveryBusy(false)
    }
  }, [privyLogout, resetTradeState, signIn, signingRecoveryBusy])

  const buyAmountDisplay = useMemo(() => {
    if (swapCompletion?.estimatedOut) return swapCompletion.estimatedOut
    return estimatedOut
  }, [estimatedOut, swapCompletion?.estimatedOut])

  const buyQuoteLoading = busy === 'quote' && !buyAmountDisplay

  const { prices: swapUsdPrices } = useSwapTokenUsdPrices(tokenIn, tokenOut)
  const swapUsdEstimates = useMemo(
    () =>
      deriveSwapUsdEstimates({
        amountInUnits,
        estimatedOut: buyAmountDisplay,
        tokenIn,
        tokenOut,
        prices: swapUsdPrices,
      }),
    [amountInUnits, buyAmountDisplay, tokenIn, tokenOut, swapUsdPrices],
  )

  const tokenOutUsdPrice = useMemo(() => {
    const normalized = tokenOut.trim().toLowerCase()
    if (isUsdStablecoinToken(tokenOut)) return 1
    if (isNativeEthToken(tokenOut)) return swapUsdPrices.ethUsd > 0 ? swapUsdPrices.ethUsd : null
    return swapUsdPrices.tokenUsdByAddress.get(normalized) ?? null
  }, [swapUsdPrices.ethUsd, swapUsdPrices.tokenUsdByAddress, tokenOut])

  const swapQuoteDetails = useMemo(
    () =>
      extractSwapQuoteDetails({
        quote,
        ethUsd: swapUsdPrices.ethUsd,
        tokenOutDecimals: tokenOutBalanceQuery.data?.decimals ?? 18,
        tokenOutUsd: tokenOutUsdPrice,
        sponsoredExecution: executionMode === 'canonical',
      }),
    [
      quote,
      swapUsdPrices.ethUsd,
      tokenOutBalanceQuery.data?.decimals,
      tokenOutUsdPrice,
      executionMode,
    ],
  )

  const tokenOutBalanceLabel = useMemo(() => {
    if (!tokenOutBalanceQuery.isSuccess || !tokenOutBalanceQuery.data) return undefined
    return fmtBalFromAmount(tokenOutBalanceQuery.data.formatted, tokenOutSymbol)
  }, [tokenOutBalanceQuery.data, tokenOutBalanceQuery.isSuccess, tokenOutSymbol])

  const handleClearSwapCompletion = useCallback(() => {
    clearSwapCompletion()
    void tokenOutBalanceQuery.refetch()
    void tokenInBalanceQuery.refetch()
  }, [clearSwapCompletion, tokenInBalanceQuery, tokenOutBalanceQuery])

  useEffect(() => {
    if (!swapCompletion?.txHash) return
    void queryClient.invalidateQueries({ queryKey: ['swap', 'asset-balance'] })
    void tokenOutBalanceQuery.refetch()
    void tokenInBalanceQuery.refetch()
  }, [queryClient, swapCompletion?.txHash, tokenInBalanceQuery, tokenOutBalanceQuery])

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
  const [canonicalSessionRefreshBusy, setCanonicalSessionRefreshBusy] = useState(false)
  const canonicalSessionAutoRefreshAttemptedRef = useRef(false)
  const canonicalSessionAutoRefreshInFlightRef = useRef(false)

  useEffect(() => {
    if (executionMode !== 'canonical' || !canonicalSignerGate.ready) return
    if (canonicalSubmitSession.ok) {
      setCanonicalSessionRefreshBusy(false)
      return
    }
    if (!canonicalSubmitSession.shouldAttemptRefresh) return
    if (canonicalSessionAutoRefreshAttemptedGlobal) return
    if (canonicalSessionAutoRefreshAttemptedRef.current) return
    if (canonicalSessionAutoRefreshInFlightRef.current) return

    canonicalSessionAutoRefreshAttemptedGlobal = true
    canonicalSessionAutoRefreshAttemptedRef.current = true
    canonicalSessionAutoRefreshInFlightRef.current = true

    let cancelled = false
    setCanonicalSessionRefreshBusy(true)
    void (async () => {
      try {
        await ensureCanonicalSession()
        await refreshAuthSession()
      } catch {
        // Keep banner fallback behavior when auto-refresh fails.
      } finally {
        canonicalSessionAutoRefreshInFlightRef.current = false
        if (!cancelled) setCanonicalSessionRefreshBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    canonicalSignerGate.ready,
    canonicalSubmitSession.ok,
    canonicalSubmitSession.shouldAttemptRefresh,
    ensureCanonicalSession,
    executionMode,
    refreshAuthSession,
  ])


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
      persistRecentToken(address)
      setTokenSelectorOpen(false)
      resetTradeState()
    },
    [persistRecentToken, registerTokenForIdentity, resetTradeState, setTokenIn, setTokenOut, tokenSelectorSide],
  )

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

  const autoQuoteSlippagePct = slippageAuto ? effectiveSlippagePct : parsedSlippage

  // Debounced auto-quote: only fires when actual swap inputs change.
  useEffect(() => {
    // Quotes are read-only and only need a session plus execution address.
    // Keep submit/build gated by `executionReady`, but still show pricing while
    // the account needs 4626 signing setup.
    if (!executionAddress || !quoteReady || quoteCooldownActive) return
    if (txState === 'signing') return
    if (tokenInAmountExceedsBalance) return
    const timer = window.setTimeout(() => {
      // FIX H-3: never fire an auto-quote while any quote/review/build/execute
      // phase is in flight — restarting handleQuote mid-review clobbers the
      // quote the user is actively reviewing.
      if (!shouldStartAutoQuote({ busy: busyRef.current, txState })) return
      void handleQuote()
    }, 450)
    return () => window.clearTimeout(timer)
    // `busy` intentionally omitted — use busyRef to check at call-time.
  }, [
    tokenIn,
    tokenOut,
    amountInUnits,
    autoQuoteSlippagePct,
    slippageAuto,
    executionAddress,
    quoteReady,
    quoteCooldownActive,
    tokenInAmountExceedsBalance,
    txState,
    handleQuote,
  ])

  const slippageDisplayPct = slippageAuto
    ? formatSlippagePctForDisplay(effectiveSlippagePct)
    : slippagePct

  // One-click flow: after review/build, immediately execute without an extra in-app confirm modal.
  useEffect(() => {
    if (!confirmIntent) return
    void confirmAndExecute()
  }, [confirmAndExecute, confirmIntent])

  const screenshotReady = !tokenInIdentity.isLoading && !tokenOutIdentity.isLoading && tokenInSymbol.length > 0 && tokenOutSymbol.length > 0

  useScreenshotReady(screenshotReady)
  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <PageMeta title={META.swap.title} description={META.swap.description} canonicalPath="/swap" />
      <SwapPageLayout
        swapPanel={
          activePanel === 'swap' ? (
            !connectGate.ready ? (
              <div className="relative">
                <SwapConnectGate
                  gate={connectGate}
                  busy={authBusy || swapConnectBusy}
                  errorMessage={visibleSwapConnectError}
                  onPrimaryAction={handleConnectGateAction}
                />
                {showSwapWalletOptions && connectGate.state === 'wallet-required' ? (
                  <div className="absolute left-1/2 top-full z-30 mt-3 w-64 -translate-x-1/2 rounded-2xl border border-white/10 bg-[rgba(10,10,12,0.96)] p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    <ExternalWalletOptions
                      authBusy={authBusy}
                      hasMultipleInjectedProviders={hasMultipleInjectedProviders}
                      lockedEthereumProviderGlobal={lockedEthereumProviderGlobal}
                      shouldHideInjectedConnector={shouldHideInjectedConnector}
                      onClose={() => setShowSwapWalletOptions(false)}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ perspective: 1200 }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key="swap-card"
                    initial={{ rotateY: 90, opacity: 0, scale: 0.98 }}
                    animate={{ rotateY: 0, opacity: 1, scale: 1 }}
                    exit={{ rotateY: -90, opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
                    className="space-y-3"
                  >
                    <SwapCard
                      tokenInDisplay={tokenInDisplay}
                      tokenOutDisplay={tokenOutDisplay}
                      tokenInIdentityLoading={tokenInIdentity.isLoading}
                      tokenOutIdentityLoading={tokenOutIdentity.isLoading}
                        amountInUnits={amountInUnits}
                        estimatedOut={buyAmountDisplay}
                        buyQuoteLoading={buyQuoteLoading}
                        amountInUsd={swapUsdEstimates.amountInUsd}
                        estimatedOutUsd={swapUsdEstimates.estimatedOutUsd}
                        tokenInSymbol={tokenInSymbol}
                        tokenOutSymbol={tokenOutSymbol}
                        tokenInBalanceLabel={tokenInBalanceLabel}
                        tokenOutBalanceLabel={tokenOutBalanceLabel}
                        tokenInAddress={tokenIn}
                        tokenOutAddress={tokenOut}
                        isConnected={isConnected}
                        isReady={isReady && !tokenInAmountExceedsBalance}
                        busy={busy}
                        status={swapCompletion ? null : status}
                        error={
                          swapCompletion
                            ? null
                            : tokenInBalanceError ??
                              error ??
                              (needsCanonicalSetupAction ? null : canonicalSignerGuardError)
                        }
                        quoteUpdatedAt={quoteUpdatedAt ? new Date(quoteUpdatedAt).toLocaleTimeString() : null}
                        approvalRequired={approvalRequired}
                        routeSummary={swapQuoteDetails.routeSummary}
                        routeLegs={swapQuoteDetails.routeLegs}
                        gasEstimateLabel={swapQuoteDetails.gasEstimateLabel}
                        priceImpactLabel={swapQuoteDetails.priceImpactLabel}
                        lpFeeUsd={swapQuoteDetails.lpFeeUsd}
                        protocolFeeUsd={swapQuoteDetails.protocolFeeUsd}
                        quoteAggregatorLabel={swapQuoteDetails.aggregatorLabel}
                        selectedChainId={swapChainId}
                        walletChainId={walletChainId}
                        onSelectChain={handleSelectSwapChain}
                        slippagePct={slippageDisplayPct}
                        slippageIsAuto={slippageAuto}
                        onSetSlippageAuto={setSlippageAuto}
                        onOpenTokenSelector={openTokenSelector}
                        onAmountChange={setAmountInUnits}
                        onQuickPercent={(pct) => {
                          const bal = tokenInBalanceQuery.data
                          if (!bal) return
                          setAmountInUnits(amountUnitsFromBalancePercent(bal, pct))
                        }}
                        onSwitchTokens={handleSwitchTokens}
                        onReviewTrade={() => {
                          void handleReviewTrade()
                        }}
                        onSetSlippagePct={setSlippagePct}
                        executionMode={executionMode}
                        fallbackActive={fallbackActive}
                        swapProviderLabel={swapProviderLabel}
                        primaryActionLabel={
                          signingSessionExpired
                            ? signingRecoveryBusy
                              ? 'Signing in…'
                              : 'Sign in again to fix signing'
                            : needsCanonicalSetupAction
                              ? canonicalSetupActionLabel
                              : undefined
                        }
                        onPrimaryAction={
                          signingSessionExpired
                            ? () => {
                                void handleSigningSessionRecovery()
                              }
                            : needsCanonicalSetupAction
                              ? handleEnableCanonicalSigning
                              : undefined
                        }
                        forcePrimaryActionEnabled={
                          (signingSessionExpired && !signingRecoveryBusy) || needsCanonicalSetupAction
                        }
                        primaryActionHint={
                          signingSessionExpired
                            ? 'Your embedded signing session expired. Sign in again (email code) to restore it, then retry the swap.'
                            : needsCanonicalSetupAction
                              ? canonicalSignerGate.reason ??
                                'Finish one-time account setup before canonical swaps can execute.'
                              : executionMode === 'canonical' && swapExecutionChrome.swapSenderLabel
                                ? swapExecutionChrome.swapSenderLabel
                                : null
                        }
                      />
                    </motion.div>
                  </AnimatePresence>
              </div>
            )
          ) : (
            <LiquidityPanel
              tokenInSymbol={tokenInSymbol}
              tokenOutSymbol={tokenOutSymbol}
              identityReady={identityReady}
              activePanel={activePanel}
              onSetActivePanel={setActivePanel}
              onOpenSettings={() => setShowAdvanced(true)}
              canonicalAddress={canonicalAddress}
              tokenIn={tokenIn}
              tokenOut={tokenOut}
            />
          )
        }
        vaultPanel={null}
        title="Swap"
        subtitle="1-Click Swaps on Base"
      />

      <SwapStatusAlerts
        activePanel={activePanel}
        needsPrivyCanonicalAuth={needsPrivyCanonicalAuth}
        authBusy={authBusy}
        privyClientStatus={privyClientStatus}
        handlePrivyCanonicalSignIn={handlePrivyCanonicalSignIn}
        authError={authError}
        needsEmbeddedWalletReconnect={needsEmbeddedWalletReconnect}
        hydrationRecoveryBusy={hydrationRecoveryBusy}
        manualRecover={embeddedEoa.manualRecover}
        privyEmbeddedEoaAddress={privyEmbeddedEoaAddress}
        privyEmbeddedEoaAddressSource={privyEmbeddedEoaAddressSource}
        showPrivyClientDisabledHint={showPrivyClientDisabledHint}
        showPrivyLoadingHint={showPrivyLoadingHint}
        quoteCooldownActive={quoteCooldownActive}
        quoteCooldownUntil={quoteCooldownUntil}
        showCanonicalSessionGuardHint={showCanonicalSessionGuardHint}
        canonicalSessionGuardTitle={canonicalSessionGuardTitle}
        canonicalSubmitSession={canonicalSubmitSession}
        canonicalSessionRefreshBusy={canonicalSessionRefreshBusy}
        chainMismatch={chainMismatch}
        walletChainId={walletChainId}
        chainMeta={chainMeta}
        swapChainId={swapChainId}
        switchChainAsync={switchChainAsync}
        swapCompletion={swapCompletion}
        tokenInSymbol={tokenInSymbol}
        tokenOutSymbol={tokenOutSymbol}
        handleClearSwapCompletion={handleClearSwapCompletion}
      />















      <TokenSelectorModal
        open={tokenSelectorOpen}
        query={tokenSelectorQuery}
        selectedToken={tokenSelectorSide === 'input' ? tokenIn : tokenOut}
        tokenOptions={swapTokenOptions}
        recentTokenAddresses={recentTokenAddresses}
        chainId={swapChainId}
        balanceOwnerAddress={balanceOwnerAddress ?? null}
        usdValueByAddress={holdingsUsdByAddress}
        isSearchLoading={
          discoveredCreatorTokenOptionsQuery.isFetching && Boolean(normalizedTokenSelectorQuery)
        }
        onQueryChange={setTokenSelectorQuery}
        onClose={() => setTokenSelectorOpen(false)}
        onSelect={onSelectToken}
      />



      {/* ─── Sheets / Modals ────────────────────────────────────────────── */}
      <SwapSettingsModal
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
