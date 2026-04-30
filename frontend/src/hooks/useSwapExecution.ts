import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { erc20Abi, formatUnits, isAddress, parseUnits } from 'viem'
import { debugLogsFlag } from '@/lib/flags/featureFlags'

import { CONTRACTS } from '@/config/contracts'
import {
  buildAndSendApproval,
  buildAndSendCalls,
  buildAndSendSwap,
  detectTxSendMode,
  type TxRouterContext,
  type TxRouterDebugEvent,
  type UserExecutionTrack,
} from '@/lib/tx/txRouter'
import {
  evaluateSwapPolicyInput,
  evaluateSwapPolicyRouting,
  readClientSwapPolicy,
  shouldEnable7702CanaryForAddress,
} from '@/lib/uniswap/policy'
import { normalizeUniswapError, type NormalizedUniswapError, type UniswapErrorCode } from '@/lib/uniswap/error'
import { areEquivalentSwapTokens, BASE_CHAIN_ID, getNestedAmountOut, NATIVE_TOKEN_ADDRESS } from '@/lib/uniswap/swapUtils'
import { isAllowedCanonicalSigner, isTargetCanonicalCsw, shouldApplyCanonicalEnforcement } from '@/wallet/canonicalWalletPolicy'
import type { components } from '@/lib/uniswap/generated/tradeApi'
import {
  assertValidSwapTransaction,
  buildSwap,
  buildSwap5792,
  buildSwap7702,
  checkTradeApproval,
  createOrder,
  fetchDelegationStatus,
  fetchTradeQuote,
  isUniswapXRouting,
  pickQuote,
  pickOrderQuote,
  pickSwapQuote,
  pickPermitData,
  toPermitSignPayload,
  type TradeQuoteResponse,
  type TransactionRequest,
} from '@/lib/uniswap/tradingApi'
import {
  getSwapProviderLabel,
  requiresCanonicalExecutionForSwapMode,
  resolveSwapProviderSelection,
} from '@/lib/swap/providerConfig'
import type { AccountCapabilities, SignerType } from '@/wallet/accountContext'

const QUOTE_TTL_MS = 30_000
const HARD_FAILURE_WINDOW_MS = 20_000
const HARD_FAILURE_THRESHOLD = 3
const HARD_FAILURE_COOLDOWN_MS = 15_000
const CALIBUR_DELEGATION_ADDRESS = '0x000000009B1D0aF20D8C6d0A44e162d11F9b8f00' as const
const WETH_DEPOSIT_SELECTOR = '0xd0e30db0'

type TxLifecycleState = 'idle' | 'review' | 'signing' | 'pending' | 'success' | 'error'

type Swap7702Diagnostics = {
  at: number
  chainId: number
  canaryEligible: boolean
  routing: string | null
  delegationOk: boolean
  swap5792Ok: boolean
  swap7702Ok: boolean
  notes: string[]
}

type SwapTxAttemptDebug = {
  stage: 'approval' | 'swap'
  mode: string
  method: string
  sender: string | null
  txHash: string | null
  callsId: string | null
  callTargets: string[]
  at: number
}

type CanonicalSignerDebugState = {
  required: boolean
  ready: boolean
  code: string | null
  reason: string | null
}

type PrivyDebugState = {
  clientStatus: string | null
  ready: boolean
  authenticated: boolean | null
  embeddedWalletAddress: string | null
  embeddedWalletSource: string | null
}

type CanonicalSubmitSessionInput = {
  executionMode: 'canonical' | 'eoa'
  sessionHydrated: boolean
  hasSession: boolean
  sessionAddress: string | null | undefined
  executionAddress: string | null | undefined
  expectedSessionAddress?: string | null | undefined
}

type CanonicalSubmitSessionResult =
  | { ok: true; code: 'ok' | 'not-required'; message: null; shouldAttemptRefresh: false }
  | {
      ok: false
      code: 'session-hydrating' | 'session-missing' | 'session-mismatch'
      message: string
      shouldAttemptRefresh: boolean
    }

type EnsureCanonicalSessionResult = boolean | string | null

type SwapSessionGateInput = {
  sessionHydrated?: boolean
  hasSession?: boolean
}

type SwapSessionGateResult =
  | { ok: true; code: 'ok'; message: null }
  | { ok: false; code: 'session-hydrating' | 'session-missing'; message: string }

function resolveExpectedSessionAddress(input: {
  expectedSessionAddress?: string | null | undefined
  executionAddress: string | null | undefined
}): string | null {
  return typeof input.expectedSessionAddress === 'string' && input.expectedSessionAddress.trim().length > 0
    ? input.expectedSessionAddress
    : typeof input.executionAddress === 'string' && input.executionAddress.trim().length > 0
      ? input.executionAddress
      : null
}

export async function resolveCanonicalSubmitSession(
  input: CanonicalSubmitSessionInput,
  ensureCanonicalSession?: (() => Promise<EnsureCanonicalSessionResult>) | null,
): Promise<CanonicalSubmitSessionResult> {
  const current = evaluateCanonicalSubmitSession(input)
  if (current.ok) return current
  if (!current.shouldAttemptRefresh || typeof ensureCanonicalSession !== 'function') return current

  const refreshed = await ensureCanonicalSession().catch(() => null)
  const refreshedAddress =
    typeof refreshed === 'string' && refreshed.trim().length > 0 && isAddress(refreshed) ? refreshed : null
  const refreshedOk = typeof refreshed === 'boolean' ? refreshed : Boolean(refreshedAddress)
  if (!refreshedOk) return current

  // Production hardening: never bypass a session mismatch unless we have an
  // explicit refreshed address that matches the expected canonical signer.
  if (current.code === 'session-mismatch') {
    const expectedSessionAddress = resolveExpectedSessionAddress({
      expectedSessionAddress: input.expectedSessionAddress,
      executionAddress: input.executionAddress,
    })
    if (!refreshedAddress) return current
    if (expectedSessionAddress && refreshedAddress.toLowerCase() !== expectedSessionAddress.toLowerCase()) return current
  }

  return {
    ok: true,
    code: 'ok',
    message: null,
    shouldAttemptRefresh: false,
  }
}

export function evaluateSwapSessionGate(input: SwapSessionGateInput): SwapSessionGateResult {
  if (!input.sessionHydrated) {
    return {
      ok: false,
      code: 'session-hydrating',
      message: 'Still restoring your 4626 session. Please wait a moment before requesting swap quotes.',
    }
  }

  if (!input.hasSession) {
    return {
      ok: false,
      code: 'session-missing',
      message: 'Sign in to 4626 to request swap quotes and submit trades.',
    }
  }

  return {
    ok: true,
    code: 'ok',
    message: null,
  }
}

export function deriveSwapExecutionReadiness(params: {
  quoteReady: boolean
  executionMode: 'canonical' | 'eoa'
  executionTrack?: UserExecutionTrack | null
  canonicalAddress?: string | null
  executionAddress?: string | null
  signerAddress?: string | null
  canonicalPolicyApplies?: boolean
  cdpCanonicalOnlyMode?: boolean
}): boolean {
  if (!params.quoteReady) return false

  const canonicalPolicyReady =
    params.executionMode !== 'canonical' ||
    (isTargetCanonicalCsw(params.canonicalAddress ?? null) &&
      (params.executionTrack === 'sub-account' ||
        (isTargetCanonicalCsw(params.executionAddress ?? null) && isAllowedCanonicalSigner(params.signerAddress ?? null))))

  if (params.cdpCanonicalOnlyMode && !canonicalPolicyReady) return false
  if (params.canonicalPolicyApplies && !canonicalPolicyReady) return false
  return true
}

export function shouldDisablePermit2ForSwap(params: {
  executionMode: 'canonical' | 'eoa'
  canonicalAddress?: string | null
  executionAddress?: string | null
}): boolean {
  if (params.executionMode === 'canonical') return true
  if (isTargetCanonicalCsw(params.executionAddress ?? null)) return true

  const canonical = params.canonicalAddress?.trim().toLowerCase()
  const execution = params.executionAddress?.trim().toLowerCase()
  return Boolean(canonical && execution && isAddress(canonical) && isAddress(execution) && canonical === execution)
}

type SwapTxDebugState = {
  enabled: boolean
  chainId: number
  selectedAddress: string | null
  executionAddress: string | null
  canonicalAddress: string | null
  signerAddress: string | null
  signerType: string | null
  connectorId: string | null
  connectorName: string | null
  capabilities: AccountCapabilities
  smartWalletDetected: boolean
  selectedSendMode: string | null
  selectedSendReason: string | null
  lastMethod: string | null
  lastError: string | null
  allowanceCheck: { walletAddress: string; token: string; amount: string } | null
  approvalAttempt: SwapTxAttemptDebug | null
  swapAttempt: SwapTxAttemptDebug | null
  canonicalSigner: CanonicalSignerDebugState
  privy: PrivyDebugState
}

const EMPTY_CAPABILITIES: AccountCapabilities = {
  paymasterService: false,
  atomicStatus: 'unknown',
  supports5792: false,
}

export function evaluateCanonicalSubmitSession(input: CanonicalSubmitSessionInput): CanonicalSubmitSessionResult {
  if (input.executionMode !== 'canonical') {
    return {
      ok: true,
      code: 'not-required',
      message: null,
      shouldAttemptRefresh: false,
    }
  }

  if (!input.sessionHydrated) {
    return {
      ok: false,
      code: 'session-hydrating',
      message: 'Still restoring your 4626 session. Please wait a moment and try again.',
      shouldAttemptRefresh: false,
    }
  }

  if (!input.hasSession || !input.sessionAddress) {
    return {
      ok: false,
      code: 'session-missing',
      message: 'Your 4626 session expired. Restore your account connection and try again.',
      shouldAttemptRefresh: true,
    }
  }

  const expectedSessionAddress = resolveExpectedSessionAddress({
    expectedSessionAddress: input.expectedSessionAddress,
    executionAddress: input.executionAddress,
  })
  if (expectedSessionAddress && input.sessionAddress.toLowerCase() !== expectedSessionAddress.toLowerCase()) {
    return {
      ok: false,
      code: 'session-mismatch',
      message: 'Your restored 4626 session does not match the canonical owner signer. Restore your account connection and try again.',
      shouldAttemptRefresh: true,
    }
  }

  return {
    ok: true,
    code: 'ok',
    message: null,
    shouldAttemptRefresh: false,
  }
}

function isSwapDebugEnabled(): boolean {
  if (debugLogsFlag()) return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug') === 'true'
  } catch {
    return false
  }
}

function toParsableAmount(value: string): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const normalized = raw.endsWith('.') ? raw.slice(0, -1) : raw
  if (!normalized) return null
  const n = Number(normalized)
  if (!Number.isFinite(n) || n <= 0) return null
  return normalized
}

function buildRoutingQuotePayload(routing: unknown, quotePayload: Record<string, unknown>): Record<string, unknown> {
  const route = String(routing ?? '')
    .trim()
    .toUpperCase()
  if (route === 'CLASSIC') return { classicQuote: quotePayload }
  if (route === 'WRAP' || route === 'UNWRAP') return { wrapUnwrapQuote: quotePayload }
  if (route === 'BRIDGE') return { bridgeQuote: quotePayload }
  return { priorityQuote: quotePayload }
}

function hasApprovalTransaction(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const approval = (value as { approval?: unknown }).approval
  if (!approval || typeof approval !== 'object') return false
  const tx = approval as Record<string, unknown>
  return typeof tx.to === 'string' && tx.to.length > 0 && typeof tx.data === 'string' && tx.data.length > 0
}

function isCdpProviderQuote(value: TradeQuoteResponse | null | undefined): boolean {
  return String((value as any)?.provider ?? '')
    .trim()
    .toLowerCase() === 'cdp'
}

function readQuoteInputAmount(value: TradeQuoteResponse | null | undefined): string | null {
  const payload = pickQuote(value) ?? (value as Record<string, unknown> | null | undefined)
  if (!payload || typeof payload !== 'object') return null
  const input = (payload as any).input
  if (input && typeof input === 'object') {
    const amount = typeof input.amount === 'string' ? input.amount : typeof input.startAmount === 'string' ? input.startAmount : ''
    if (amount.trim()) return amount.trim()
  }
  const orderInput = (payload as any).orderInfo?.input
  if (orderInput && typeof orderInput === 'object') {
    const amount =
      typeof orderInput.startAmount === 'string'
        ? orderInput.startAmount
        : typeof orderInput.amount === 'string'
          ? orderInput.amount
          : ''
    if (amount.trim()) return amount.trim()
  }
  return null
}

function readQuoteInputToken(value: TradeQuoteResponse | null | undefined): string | null {
  const payload = pickQuote(value) ?? (value as Record<string, unknown> | null | undefined)
  if (!payload || typeof payload !== 'object') return null
  const token = (payload as any).input?.token ?? (payload as any).orderInfo?.input?.token
  return typeof token === 'string' && isAddress(token) ? token.toLowerCase() : null
}

export function useSwapExecution(params: {
  address: string | undefined
  walletClient: unknown
  publicClient: any
  canonicalAddress: `0x${string}` | null
  signerAddress: `0x${string}` | null
  executionMode: 'canonical' | 'eoa'
  executionTrack?: UserExecutionTrack | null
  executionAddress: `0x${string}` | null
  executionReady: boolean
  expectedSessionAddress?: string | null
  tokenIn: string
  tokenOut: string
  amountInUnits: string
  parsedSlippage: number
  parsedDeadlineMinutes: number
  chainId?: number
  signerType?: SignerType
  capabilities?: AccountCapabilities | null
  connectorId?: string | null
  connectorName?: string | null
  canonicalSignerDebug?: CanonicalSignerDebugState | null
  privyDebug?: PrivyDebugState | null
  sessionHydrated?: boolean
  hasSession?: boolean
  sessionAddress?: string | null
  ensureCanonicalSession?: (() => Promise<EnsureCanonicalSessionResult>) | null
}) {
  const swapDebugEnabled = useMemo(() => isSwapDebugEnabled(), [])
  const [estimatedOut, setEstimatedOut] = useState<string>('')
  const [quote, setQuote] = useState<TradeQuoteResponse | null>(null)
  const [quoteCooldownUntil, setQuoteCooldownUntil] = useState<number | null>(null)
  const [approvalData, setApprovalData] = useState<Record<string, unknown> | null>(null)
  const [swapTx, setSwapTx] = useState<TransactionRequest | null>(null)
  const [orderRequest, setOrderRequest] = useState<{
    quote: Record<string, unknown>
    signature: string
    routing?: TradeQuoteResponse['routing']
  } | null>(null)
  const [, setOrderStatus] = useState<{
    orderId: string
    orderStatus: string
  } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [confirmIntent, setConfirmIntent] = useState<'approval' | 'swap' | 'order' | null>(null)
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<number | null>(null)
  const [permitSignatureRequired, setPermitSignatureRequired] = useState(false)
  const [permitSignaturePending, setPermitSignaturePending] = useState(false)
  const [permitSignatureReady, setPermitSignatureReady] = useState(false)
  const [fallbackActive, setFallbackActive] = useState(false)
  const [swapProvider, setSwapProvider] = useState<'uniswap' | 'cdp'>('uniswap')
  const [txState, setTxState] = useState<TxLifecycleState>('idle')
  const [txHash, setTxHash] = useState<string | null>(null)
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false)
  const [diagnosticsResult, setDiagnosticsResult] = useState<Swap7702Diagnostics | null>(null)
  const [txDebug, setTxDebug] = useState<SwapTxDebugState>({
    enabled: swapDebugEnabled,
    chainId: Number(params.chainId ?? BASE_CHAIN_ID),
    selectedAddress: params.address ?? null,
    executionAddress: params.executionAddress ?? null,
    canonicalAddress: params.canonicalAddress ?? null,
    signerAddress: params.signerAddress ?? null,
    signerType: params.signerType ?? null,
    connectorId: params.connectorId ?? null,
    connectorName: params.connectorName ?? null,
    capabilities: params.capabilities ?? EMPTY_CAPABILITIES,
    smartWalletDetected: false,
    selectedSendMode: null,
    selectedSendReason: null,
    lastMethod: null,
    lastError: null,
    allowanceCheck: null,
    approvalAttempt: null,
    swapAttempt: null,
    canonicalSigner: {
      required: Boolean(params.canonicalSignerDebug?.required),
      ready: Boolean(params.canonicalSignerDebug?.ready),
      code: params.canonicalSignerDebug?.code ?? null,
      reason: params.canonicalSignerDebug?.reason ?? null,
    },
    privy: {
      clientStatus: params.privyDebug?.clientStatus ?? null,
      ready: Boolean(params.privyDebug?.ready),
      authenticated:
        typeof params.privyDebug?.authenticated === 'boolean' ? params.privyDebug.authenticated : null,
      embeddedWalletAddress: params.privyDebug?.embeddedWalletAddress ?? null,
      embeddedWalletSource: params.privyDebug?.embeddedWalletSource ?? null,
    },
  })
  const txDebugSnapshotRef = useRef<string>('')
  const quoteRunRef = useRef(0)
  const quoteFailureTrackerRef = useRef<{ count: number; windowStartedAt: number }>({
    count: 0,
    windowStartedAt: 0,
  })
  const getErrorDetails = useCallback((value: unknown, fallback: string): NormalizedUniswapError => {
    const normalized = normalizeUniswapError(value)
    const message = normalized.message.trim() || fallback
    return {
      ...normalized,
      message,
    }
  }, [])
  const getErrorMessage = useCallback((value: unknown, fallback: string): string => {
    return getErrorDetails(value, fallback).message
  }, [getErrorDetails])
  const quoteCooldownActive = Boolean(quoteCooldownUntil && quoteCooldownUntil > Date.now())
  const swapProviderSelection = useMemo(() => resolveSwapProviderSelection(), [])
  const cdpCanonicalOnlyMode = useMemo(
    () => requiresCanonicalExecutionForSwapMode(swapProviderSelection.mode),
    [swapProviderSelection.mode],
  )
  const swapSessionGate = useMemo(
    () =>
      evaluateSwapSessionGate({
        sessionHydrated: params.sessionHydrated,
        hasSession: params.hasSession,
      }),
    [params.hasSession, params.sessionHydrated],
  )
  const resetQuoteFailureTracker = useCallback(() => {
    quoteFailureTrackerRef.current = {
      count: 0,
      windowStartedAt: 0,
    }
  }, [])
  const registerQuoteHardFailure = useCallback((code: UniswapErrorCode) => {
    const hardFailureCodes = new Set<UniswapErrorCode>([
      'FORBIDDEN_ORIGIN',
      'RPC_UNAVAILABLE',
      'RATE_LIMITED',
    ])
    if (!hardFailureCodes.has(code)) {
      resetQuoteFailureTracker()
      return
    }
    const now = Date.now()
    const tracker = quoteFailureTrackerRef.current
    if (tracker.windowStartedAt <= 0 || now - tracker.windowStartedAt > HARD_FAILURE_WINDOW_MS) {
      tracker.windowStartedAt = now
      tracker.count = 1
      return
    }
    tracker.count += 1
    if (tracker.count >= HARD_FAILURE_THRESHOLD) {
      tracker.count = 0
      tracker.windowStartedAt = 0
      const cooldownEndsAt = now + HARD_FAILURE_COOLDOWN_MS
      setQuoteCooldownUntil(cooldownEndsAt)
      setStatus('Auto-quote paused briefly after repeated upstream failures.')
    }
  }, [resetQuoteFailureTracker])

  useEffect(() => {
    if (!quoteCooldownUntil) return
    const remaining = quoteCooldownUntil - Date.now()
    if (remaining <= 0) {
      setQuoteCooldownUntil(null)
      return
    }
    const timer = window.setTimeout(() => {
      setQuoteCooldownUntil(null)
    }, remaining)
    return () => {
      window.clearTimeout(timer)
    }
  }, [quoteCooldownUntil])
  const swapPolicy = useMemo(() => readClientSwapPolicy(), [])

  type ChainId = components['schemas']['ChainId']
  const swapChainId = (params.chainId ?? BASE_CHAIN_ID) as ChainId
  const canary7702Eligible = useMemo(
    () => shouldEnable7702CanaryForAddress(swapPolicy, params.executionAddress),
    [swapPolicy, params.executionAddress],
  )
  const diagnosticsEnabled = swapPolicy.diagnosticsEnabled || canary7702Eligible
  const normalizedPaymasterService = Boolean(params.capabilities?.paymasterService)
  const normalizedAtomicStatus = params.capabilities?.atomicStatus ?? 'unknown'
  const normalizedSupports5792 = Boolean(params.capabilities?.supports5792)
  const normalizedCapabilities = useMemo<AccountCapabilities>(
    () => ({
      paymasterService: normalizedPaymasterService,
      atomicStatus: normalizedAtomicStatus,
      supports5792: normalizedSupports5792,
    }),
    [normalizedAtomicStatus, normalizedPaymasterService, normalizedSupports5792],
  )
  const permit2DisabledForSwap = useMemo(
    () =>
      shouldDisablePermit2ForSwap({
        executionMode: params.executionMode,
        canonicalAddress: params.canonicalAddress,
        executionAddress: params.executionAddress,
      }),
    [params.canonicalAddress, params.executionAddress, params.executionMode],
  )
  const canonicalPolicyApplies = useMemo(
    () =>
      shouldApplyCanonicalEnforcement({
        canonicalAddress: params.canonicalAddress,
        executionAddress: params.executionAddress,
        signerAddress: params.signerAddress,
      }),
    [params.canonicalAddress, params.executionAddress, params.signerAddress],
  )
  const wrapNativeInputForSponsoredCanonical =
    params.executionMode === 'canonical' &&
    params.connectorId === 'privy-embedded' &&
    params.tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS
  const effectiveTokenIn = wrapNativeInputForSponsoredCanonical ? CONTRACTS.weth : params.tokenIn

  useEffect(() => {
    if (!swapDebugEnabled) return
    const nextChainId = Number(swapChainId)
    const nextSelectedAddress = params.address ?? null
    const nextExecutionAddress = params.executionAddress ?? null
    const nextCanonicalAddress = params.canonicalAddress ?? null
    const nextSignerAddress = params.signerAddress ?? null
    const nextSignerType = params.signerType ?? null
    const nextConnectorId = params.connectorId ?? null
    const nextConnectorName = params.connectorName ?? null
    const nextCapabilities = {
      paymasterService: normalizedPaymasterService,
      atomicStatus: normalizedAtomicStatus,
      supports5792: normalizedSupports5792,
    } as const
    const nextCanonicalSigner = {
      required: Boolean(params.canonicalSignerDebug?.required),
      ready: Boolean(params.canonicalSignerDebug?.ready),
      code: params.canonicalSignerDebug?.code ?? null,
      reason: params.canonicalSignerDebug?.reason ?? null,
    } as const
    const nextPrivy = {
      clientStatus: params.privyDebug?.clientStatus ?? null,
      ready: Boolean(params.privyDebug?.ready),
      authenticated:
        typeof params.privyDebug?.authenticated === 'boolean' ? params.privyDebug.authenticated : null,
      embeddedWalletAddress: params.privyDebug?.embeddedWalletAddress ?? null,
      embeddedWalletSource: params.privyDebug?.embeddedWalletSource ?? null,
    } as const
    const nextSnapshot = JSON.stringify({
      enabled: true,
      chainId: nextChainId,
      selectedAddress: nextSelectedAddress,
      executionAddress: nextExecutionAddress,
      canonicalAddress: nextCanonicalAddress,
      signerAddress: nextSignerAddress,
      signerType: nextSignerType,
      connectorId: nextConnectorId,
      connectorName: nextConnectorName,
      capabilities: nextCapabilities,
      canonicalSigner: nextCanonicalSigner,
      privy: nextPrivy,
    })
    if (txDebugSnapshotRef.current === nextSnapshot) return
    txDebugSnapshotRef.current = nextSnapshot

    setTxDebug((prev) => ({
      ...prev,
      enabled: true,
      chainId: nextChainId,
      selectedAddress: nextSelectedAddress,
      executionAddress: nextExecutionAddress,
      canonicalAddress: nextCanonicalAddress,
      signerAddress: nextSignerAddress,
      signerType: nextSignerType,
      connectorId: nextConnectorId,
      connectorName: nextConnectorName,
      capabilities: nextCapabilities,
      canonicalSigner: nextCanonicalSigner,
      privy: nextPrivy,
    }))
  }, [
    swapDebugEnabled,
    swapChainId,
    params.address,
    params.executionAddress,
    params.canonicalAddress,
    params.signerAddress,
    params.signerType,
    params.connectorId,
    params.connectorName,
    params.canonicalSignerDebug?.required,
    params.canonicalSignerDebug?.ready,
    params.canonicalSignerDebug?.code,
    params.canonicalSignerDebug?.reason,
    params.privyDebug?.clientStatus,
    params.privyDebug?.ready,
    params.privyDebug?.authenticated,
    params.privyDebug?.embeddedWalletAddress,
    params.privyDebug?.embeddedWalletSource,
    normalizedPaymasterService,
    normalizedAtomicStatus,
    normalizedSupports5792,
  ])

  const updateAttemptDebug = useCallback((attempt: SwapTxAttemptDebug) => {
    if (!swapDebugEnabled) return
    setTxDebug((prev) => ({
      ...prev,
      lastMethod: attempt.method,
      lastError: null,
      approvalAttempt: attempt.stage === 'approval' ? attempt : prev.approvalAttempt,
      swapAttempt: attempt.stage === 'swap' ? attempt : prev.swapAttempt,
    }))
  }, [swapDebugEnabled])

  const updateTxDebugError = useCallback((message: string) => {
    if (!swapDebugEnabled) return
    setTxDebug((prev) => ({
      ...prev,
      lastError: message,
    }))
  }, [swapDebugEnabled])

  const onTxRouterDebug = useCallback((event: TxRouterDebugEvent) => {
    if (!swapDebugEnabled) return
    setTxDebug((prev) => {
      if (event.event === 'route_selected') {
        return {
          ...prev,
          smartWalletDetected: Boolean(event.smartWalletDetected),
          selectedSendMode: event.mode,
          selectedSendReason: event.reason ?? null,
          lastMethod: event.method ?? prev.lastMethod,
          lastError: null,
        }
      }
      if (event.event === 'send_error') {
        return {
          ...prev,
          lastMethod: event.method ?? prev.lastMethod,
          lastError: event.error ?? null,
        }
      }
      if (event.event === 'send_attempt' || event.event === 'send_success' || event.event === 'send_fallback') {
        return {
          ...prev,
          lastMethod: event.method ?? prev.lastMethod,
        }
      }
      return prev
    })
    console.debug('[swap][tx-router]', event)
  }, [swapDebugEnabled])

  const assertCanonicalSwapExecutionContext = useCallback(() => {
    if (cdpCanonicalOnlyMode && params.executionMode !== 'canonical') {
      throw new Error('CDP swaps currently require canonical smart-wallet execution mode.')
    }
    if (!canonicalPolicyApplies) return
    if (params.executionMode !== 'canonical') {
      throw new Error('Canonical CSW policy requires canonical execution mode.')
    }
    if (!isTargetCanonicalCsw(params.canonicalAddress ?? null)) {
      throw new Error('Canonical CSW policy requires the configured canonical smart wallet identity.')
    }
    const subAccountExecution = params.executionTrack === 'sub-account'
    if (!subAccountExecution && !isTargetCanonicalCsw(params.executionAddress ?? null)) {
      throw new Error('Canonical CSW policy blocked non-canonical execution address.')
    }
    if (!subAccountExecution && !isAllowedCanonicalSigner(params.signerAddress ?? null)) {
      throw new Error('Canonical CSW policy requires an allowed owner signer.')
    }
    if (
      !subAccountExecution &&
      params.signerType === 'SMART_WALLET' &&
      !isTargetCanonicalCsw(params.signerAddress ?? null)
    ) {
      throw new Error('Canonical CSW policy blocked non-canonical smart-wallet signer usage.')
    }
  }, [
    cdpCanonicalOnlyMode,
    canonicalPolicyApplies,
    params.executionMode,
    params.executionTrack,
    params.canonicalAddress,
    params.executionAddress,
    params.signerAddress,
    params.signerType,
  ])

  const buildRouterContext = useCallback((): TxRouterContext => {
    assertCanonicalSwapExecutionContext()
    return {
      chainId: Number(swapChainId),
      executionMode: params.executionMode,
      executionTrack: params.executionTrack ?? null,
      walletClient: params.walletClient,
      publicClient: params.publicClient,
      canonicalAddress: params.canonicalAddress,
      signerAddress: params.signerAddress,
      executionAddress: params.executionAddress,
      signerType: params.signerType,
      connectorId: params.connectorId,
      connectorName: params.connectorName,
      capabilities: normalizedCapabilities,
      debug: onTxRouterDebug,
    }
  }, [
    assertCanonicalSwapExecutionContext,
    swapChainId,
    params.executionMode,
    params.executionTrack,
    params.walletClient,
    params.publicClient,
    params.canonicalAddress,
    params.signerAddress,
    params.executionAddress,
    params.signerType,
    params.connectorId,
    params.connectorName,
    normalizedCapabilities,
    onTxRouterDebug,
  ])

  const tokensEquivalent = useMemo(
    () => areEquivalentSwapTokens(params.tokenIn, params.tokenOut, CONTRACTS.weth),
    [params.tokenIn, params.tokenOut],
  )

  const quoteReady = useMemo(
    () =>
      isAddress(params.tokenIn) &&
      isAddress(params.tokenOut) &&
      !tokensEquivalent &&
      Number(params.amountInUnits) > 0 &&
      Boolean(params.executionAddress) &&
      swapSessionGate.ok,
    [
      params.tokenIn,
      params.tokenOut,
      params.amountInUnits,
      params.executionAddress,
      tokensEquivalent,
      swapSessionGate.ok,
    ],
  )
  const isReady = useMemo(
    () =>
      deriveSwapExecutionReadiness({
        quoteReady,
        executionMode: params.executionMode,
        executionTrack: params.executionTrack,
        canonicalAddress: params.canonicalAddress,
        executionAddress: params.executionAddress,
        signerAddress: params.signerAddress,
        canonicalPolicyApplies,
        cdpCanonicalOnlyMode,
      }),
    [
      quoteReady,
      params.executionMode,
      params.executionTrack,
      params.canonicalAddress,
      params.executionAddress,
      params.signerAddress,
      cdpCanonicalOnlyMode,
      canonicalPolicyApplies,
    ],
  )

  const guardInputPolicy = useCallback(
    (amountBaseUnits: string): boolean => {
      const decision = evaluateSwapPolicyInput({
        policy: swapPolicy,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountBaseUnits,
        slippageBps: Math.round(params.parsedSlippage * 100),
      })
      if (!decision.allowed) {
        console.warn('[swap][policy] input blocked', {
          code: decision.code,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          mode: params.executionMode,
        })
        setError(decision.message)
      }
      return decision.allowed
    },
    [swapPolicy, params.tokenIn, params.tokenOut, params.parsedSlippage, params.executionMode],
  )

  const guardRoutingPolicy = useCallback(
    (routing: unknown): boolean => {
      const decision = evaluateSwapPolicyRouting({
        policy: swapPolicy,
        routing,
      })
      if (!decision.allowed) {
        console.warn('[swap][policy] routing blocked', {
          code: decision.code,
          routing: String(routing ?? ''),
          mode: params.executionMode,
        })
        setError(decision.message)
      }
      return decision.allowed
    },
    [swapPolicy, params.executionMode],
  )

  const approvalTx = approvalData?.approval as Record<string, unknown> | undefined
  const approvalRequired = Boolean(approvalTx?.to && approvalTx?.data)
  const isQuoteStale = useCallback(
    (referenceTime = Date.now()): boolean => !quoteUpdatedAt || referenceTime - quoteUpdatedAt > QUOTE_TTL_MS,
    [quoteUpdatedAt],
  )
  const quoteIsStale = isQuoteStale()
  const canonicalSubmitSession = useMemo(
    () =>
      evaluateCanonicalSubmitSession({
        executionMode: params.executionMode,
        sessionHydrated: Boolean(params.sessionHydrated),
        hasSession: Boolean(params.hasSession),
        sessionAddress: params.sessionAddress ?? null,
        executionAddress: params.executionAddress ?? null,
        expectedSessionAddress: params.expectedSessionAddress ?? params.signerAddress ?? null,
      }),
    [
      params.executionAddress,
      params.executionMode,
      params.expectedSessionAddress,
      params.hasSession,
      params.sessionAddress,
      params.sessionHydrated,
      params.signerAddress,
    ],
  )

  const getTokenDecimals = useCallback(async (token: string): Promise<number> => {
    if (!params.publicClient || !isAddress(token)) return 18
    try {
      const decimals = await params.publicClient.readContract({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      })
      return Number(decimals)
    } catch {
      return 18
    }
  }, [params.publicClient])

  const syncPermitRequirement = useCallback((nextQuote: TradeQuoteResponse | null | undefined) => {
    const requiresPermit = Boolean(pickPermitData(nextQuote))
    const providerRaw = typeof (nextQuote as any)?.provider === 'string' ? String((nextQuote as any).provider).trim().toLowerCase() : ''
    const provider = providerRaw === 'cdp' ? 'cdp' : 'uniswap'
    const fallback = Boolean((nextQuote as any)?.fallbackUsed)
    setSwapProvider(provider)
    setFallbackActive(fallback)
    setPermitSignatureRequired(requiresPermit)
    setPermitSignaturePending(false)
    setPermitSignatureReady(false)
  }, [])

  const signPermitIfRequired = useCallback(async (nextQuote: TradeQuoteResponse): Promise<{
    permitData?: Record<string, unknown>
    signature?: string
  }> => {
    const permitData = pickPermitData(nextQuote)
    if (!permitData) {
      setPermitSignatureRequired(false)
      setPermitSignaturePending(false)
      setPermitSignatureReady(false)
      return {}
    }

    setPermitSignatureRequired(true)
    setPermitSignaturePending(true)
    setPermitSignatureReady(false)

    const typed = toPermitSignPayload(permitData)
    if (!typed) {
      setPermitSignaturePending(false)
      throw new Error('Permit2 payload is malformed. Please refresh the quote and try again.')
    }
    if (!params.walletClient || !params.signerAddress) {
      setPermitSignaturePending(false)
      throw new Error('Permit2 signature is required, but owner signer is not available.')
    }
    const signer = params.walletClient as any
    if (typeof signer.signTypedData !== 'function') {
      setPermitSignaturePending(false)
      throw new Error('Connected wallet does not support typed-data signatures required for Permit2.')
    }

    setStatus('Permit2 signature required. Confirm in wallet…')
    try {
      const signature = await signer.signTypedData({
        account: params.signerAddress,
        domain: typed.domain,
        types: typed.types,
        primaryType: typed.primaryType,
        message: typed.message,
      })
      if (typeof signature !== 'string' || !signature.startsWith('0x')) {
        throw new Error('Wallet returned an invalid Permit2 signature.')
      }
      setPermitSignaturePending(false)
      setPermitSignatureReady(true)
      setStatus('Permit2 signature captured. Building swap…')
      return { permitData, signature }
    } catch (error) {
      setPermitSignaturePending(false)
      setPermitSignatureReady(false)
      throw error
    }
  }, [params.walletClient, params.signerAddress])

  const resetTradeState = useCallback(() => {
    quoteRunRef.current += 1
    setQuote(null)
    setQuoteCooldownUntil(null)
    setApprovalData(null)
    setSwapTx(null)
    setOrderRequest(null)
    setOrderStatus(null)
    setEstimatedOut('')
    setQuoteUpdatedAt(null)
    setPermitSignatureRequired(false)
    setPermitSignaturePending(false)
    setPermitSignatureReady(false)
    setFallbackActive(false)
    setSwapProvider('uniswap')
    setDiagnosticsResult(null)
    setStatus('')
    setError('')
    setTxState('idle')
    setTxHash(null)
    resetQuoteFailureTracker()
    if (swapDebugEnabled) {
      setTxDebug((prev) => ({
        ...prev,
        selectedSendMode: null,
        selectedSendReason: null,
        lastMethod: null,
        lastError: null,
        allowanceCheck: null,
        approvalAttempt: null,
        swapAttempt: null,
      }))
    }
  }, [resetQuoteFailureTracker, swapDebugEnabled])

  const handleQuote = useCallback(async () => {
    if (!params.address || !params.executionAddress) return
    if (!swapSessionGate.ok) {
      if (swapSessionGate.code === 'session-hydrating') {
        setStatus(swapSessionGate.message)
      } else {
        setError(swapSessionGate.message)
      }
      return
    }
    if (!quoteReady) return
    if (quoteCooldownUntil && quoteCooldownUntil > Date.now()) {
      setStatus('Auto-quote is paused briefly after repeated API failures.')
      return
    }
    const runId = ++quoteRunRef.current
    setBusy('quote')
    setError('')
    setStatus('')
    try {
      const parsableAmount = toParsableAmount(params.amountInUnits)
      if (!parsableAmount) throw new Error('Enter a valid amount greater than 0.')
      const tokenInDecimals = await getTokenDecimals(effectiveTokenIn)
      if (runId !== quoteRunRef.current) return
      const amount = parseUnits(parsableAmount, tokenInDecimals).toString()
      if (!guardInputPolicy(amount)) return
      const data = await fetchTradeQuote({
        tokenIn: effectiveTokenIn,
        tokenOut: params.tokenOut,
        tokenInChainId: swapChainId,
        tokenOutChainId: swapChainId,
        type: 'EXACT_INPUT',
        amount,
        swapper: params.executionAddress,
        slippageTolerance: params.parsedSlippage,
        routingPreference: 'BEST_PRICE',
        permitAmount: permit2DisabledForSwap ? undefined : 'EXACT',
        walletModeKey: params.executionMode,
      })
      if (runId !== quoteRunRef.current) return
      const isCdpQuote = String((data as any).provider ?? '')
        .trim()
        .toLowerCase() === 'cdp'
      if (!isCdpQuote && !guardRoutingPolicy(data.routing)) return
      setQuote(data)
      setQuoteUpdatedAt(Date.now())
      syncPermitRequirement(data)
      setApprovalData(null)
      setSwapTx(null)
      setOrderRequest(null)
      setOrderStatus(null)
      resetQuoteFailureTracker()
      const outRaw = getNestedAmountOut(pickQuote(data) ?? data)
      if (outRaw) {
        const tokenOutDecimals = await getTokenDecimals(params.tokenOut)
        if (runId !== quoteRunRef.current) return
        setEstimatedOut(formatUnits(BigInt(outRaw), tokenOutDecimals))
      } else {
        setEstimatedOut('')
      }
      setTxState('review')
    } catch (e: any) {
      if (runId !== quoteRunRef.current) return
      setEstimatedOut('')
      const normalizedError = getErrorDetails(e, 'Quote failed')
      setError(normalizedError.message)
      registerQuoteHardFailure(normalizedError.code)
    } finally {
      if (runId === quoteRunRef.current) setBusy(null)
    }
  }, [
    params.address,
    params.executionAddress,
    params.executionMode,
    params.amountInUnits,
    params.parsedSlippage,
    effectiveTokenIn,
    params.tokenOut,
    swapChainId,
    quoteReady,
    quoteCooldownUntil,
    permit2DisabledForSwap,
    getTokenDecimals,
    getErrorDetails,
    guardInputPolicy,
    guardRoutingPolicy,
    registerQuoteHardFailure,
    resetQuoteFailureTracker,
    syncPermitRequirement,
    swapSessionGate,
  ])

  const handleCheckApproval = useCallback(async () => {
    if (!params.executionAddress) return
    if (!swapSessionGate.ok) {
      if (swapSessionGate.code === 'session-hydrating') {
        setStatus(swapSessionGate.message)
      } else {
        setError(swapSessionGate.message)
      }
      return
    }
    if (!isReady) return
    if (isCdpProviderQuote(quote)) {
      setError('')
      setApprovalData({ approval: null, cancel: null })
      setStatus('No token approval required for CDP swap path')
      return
    }
    // Native ETH normally does not require ERC20 approvals. In sponsored
    // canonical mode we quote WETH and wrap ETH inside the UserOp, so WETH
    // allowance still needs the regular approval check.
    if (!wrapNativeInputForSponsoredCanonical && params.tokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS) {
      setError('')
      setApprovalData({ approval: null, cancel: null })
      setStatus('No token approval required for ETH')
      return
    }
    setBusy('approval')
    setError('')
    setStatus('')
    try {
      const parsableAmount = toParsableAmount(params.amountInUnits)
      if (!parsableAmount) throw new Error('Enter a valid amount greater than 0.')
      const tokenInDecimals = await getTokenDecimals(effectiveTokenIn)
      const amount = parseUnits(parsableAmount, tokenInDecimals).toString()
      if (!guardInputPolicy(amount)) return
      if (swapDebugEnabled) {
        setTxDebug((prev) => ({
          ...prev,
          allowanceCheck: {
            walletAddress: params.executionAddress ?? '',
            token: effectiveTokenIn,
            amount,
          },
        }))
        console.debug('[swap][allowance-check]', {
          chainId: Number(swapChainId),
          walletAddress: params.executionAddress,
          token: effectiveTokenIn,
          amount,
          connectorId: params.connectorId ?? null,
          connectorName: params.connectorName ?? null,
          executionMode: params.executionMode,
        })
      }
      const data = await checkTradeApproval({
        walletAddress: params.executionAddress,
        token: effectiveTokenIn,
        amount,
        chainId: swapChainId,
        tokenOut: params.tokenOut,
        tokenOutChainId: swapChainId,
        includeGasInfo: true,
        permit2Disabled: permit2DisabledForSwap,
      })
      setApprovalData(data)
      setStatus('Approval check complete')
    } catch (e: any) {
      setError(getErrorMessage(e, 'Approval check failed'))
    } finally {
      setBusy(null)
    }
  }, [
    quote,
    params.executionAddress,
    params.executionMode,
    params.tokenIn,
    effectiveTokenIn,
    wrapNativeInputForSponsoredCanonical,
    params.tokenOut,
    params.amountInUnits,
    params.connectorId,
    params.connectorName,
    swapChainId,
    isReady,
    permit2DisabledForSwap,
    getTokenDecimals,
    getErrorMessage,
    guardInputPolicy,
    swapDebugEnabled,
    swapSessionGate,
  ])

  const handleBuildSwap = useCallback(async () => {
    if (!quote) return
    setBusy('buildSwap')
    setError('')
    setStatus('')
    try {
      const selectedQuote = pickSwapQuote(quote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const permitPayload = permit2DisabledForSwap ? {} : await signPermitIfRequired(quote)
      const requiresApprovalTx = hasApprovalTransaction(approvalData)
      const data = await buildSwap({
        quote: selectedQuote,
        ...permitPayload,
        includeGasInfo: false,
        refreshGasPrice: true,
        permit2Disabled: permit2DisabledForSwap,
        // Simulating before approval exists can fail with FAILED_TO_ESTIMATE_GAS.
        simulateTransaction: !requiresApprovalTx,
        deadline: Math.floor(Date.now() / 1000) + params.parsedDeadlineMinutes * 60,
      })
      assertValidSwapTransaction(data.swap)
      setSwapTx(data.swap)
      setStatus('Swap transaction built')
    } catch (e: any) {
      setError(getErrorMessage(e, 'Swap build failed'))
    } finally {
      setBusy(null)
    }
  }, [quote, approvalData, params.parsedDeadlineMinutes, getErrorMessage, signPermitIfRequired, permit2DisabledForSwap])

  const handleReviewTrade = useCallback(async () => {
    if (!params.executionAddress || !params.executionReady) return
    if (!swapSessionGate.ok) {
      if (swapSessionGate.code === 'session-hydrating') {
        setStatus(swapSessionGate.message)
      } else {
        setError(swapSessionGate.message)
      }
      return
    }
    if (!isReady) return
    const runId = ++quoteRunRef.current
    setBusy('review')
    setError('')
    setStatus('')
    try {
      const parsableAmount = toParsableAmount(params.amountInUnits)
      if (!parsableAmount) throw new Error('Enter a valid amount greater than 0.')
      const tokenInDecimals = await getTokenDecimals(params.tokenIn)
      const tokenOutDecimals = await getTokenDecimals(params.tokenOut)
      if (runId !== quoteRunRef.current) return
      const amount = parseUnits(parsableAmount, tokenInDecimals).toString()
      if (!guardInputPolicy(amount)) return
      if (swapDebugEnabled && effectiveTokenIn.trim().toLowerCase() !== NATIVE_TOKEN_ADDRESS) {
        setTxDebug((prev) => ({
          ...prev,
          allowanceCheck: {
            walletAddress: params.executionAddress ?? '',
            token: effectiveTokenIn,
            amount,
          },
        }))
      }

      const canReuseCurrentQuote =
        Boolean(quote) &&
        !isQuoteStale() &&
        (!permit2DisabledForSwap || !pickPermitData(quote)) &&
        readQuoteInputAmount(quote) === amount &&
        readQuoteInputToken(quote) === effectiveTokenIn.toLowerCase()
      const nextQuote = canReuseCurrentQuote
        ? quote!
        : await fetchTradeQuote({
            tokenIn: effectiveTokenIn,
            tokenOut: params.tokenOut,
            tokenInChainId: swapChainId,
            tokenOutChainId: swapChainId,
            type: 'EXACT_INPUT',
            amount,
            swapper: params.executionAddress,
            slippageTolerance: params.parsedSlippage,
            routingPreference: 'BEST_PRICE',
            permitAmount: permit2DisabledForSwap ? undefined : 'EXACT',
            walletModeKey: params.executionMode,
          })
      if (runId !== quoteRunRef.current) return
      const isCdpQuote = isCdpProviderQuote(nextQuote)
      if (!isCdpQuote && !guardRoutingPolicy(nextQuote.routing)) return
      const nextApproval =
        effectiveTokenIn.trim().toLowerCase() === NATIVE_TOKEN_ADDRESS || isCdpQuote
          ? ({ approval: null, cancel: null } as any)
          : await checkTradeApproval({
              walletAddress: params.executionAddress,
              token: effectiveTokenIn,
              amount,
              chainId: swapChainId,
              tokenOut: params.tokenOut,
              tokenOutChainId: swapChainId,
              includeGasInfo: true,
              permit2Disabled: permit2DisabledForSwap,
            })
      if (runId !== quoteRunRef.current) return
      setQuote(nextQuote)
      setQuoteUpdatedAt(Date.now())
      syncPermitRequirement(nextQuote)
      setApprovalData(nextApproval)

      const outRaw = getNestedAmountOut(pickQuote(nextQuote) ?? nextQuote)
      if (outRaw) setEstimatedOut(formatUnits(BigInt(outRaw), tokenOutDecimals))
      else setEstimatedOut('')

      if (isUniswapXRouting(nextQuote.routing)) {
        const orderQuote = pickOrderQuote(nextQuote)
        if (!orderQuote) throw new Error('Quote does not contain executable UniswapX order payload')
        const permitPayload = await signPermitIfRequired(nextQuote)
        if (runId !== quoteRunRef.current) return
        if (!permitPayload.signature) {
          throw new Error('UniswapX order requires a Permit2 signature. Please refresh and try again.')
        }

        setSwapTx(null)
        setOrderRequest({
          quote: orderQuote,
          signature: permitPayload.signature,
          routing: nextQuote.routing,
        })
        setOrderStatus(null)
        setStatus('Review ready')
        setTxState('review')
        setConfirmIntent('order')
        return
      }

      const selectedQuote = pickSwapQuote(nextQuote)
      if (!selectedQuote) throw new Error('Quote does not contain executable swap payload')
      const permitPayload = permit2DisabledForSwap ? {} : await signPermitIfRequired(nextQuote)
      if (runId !== quoteRunRef.current) return
      const requiresApprovalTx = hasApprovalTransaction(nextApproval)
      const built = await buildSwap({
        quote: selectedQuote,
        ...permitPayload,
        includeGasInfo: false,
        refreshGasPrice: true,
        permit2Disabled: permit2DisabledForSwap,
        // Simulating before approval exists can fail with FAILED_TO_ESTIMATE_GAS.
        simulateTransaction: !requiresApprovalTx,
        deadline: Math.floor(Date.now() / 1000) + params.parsedDeadlineMinutes * 60,
      })
      if (runId !== quoteRunRef.current) return
      assertValidSwapTransaction(built.swap)
      setSwapTx(built.swap)
      setOrderRequest(null)
      setOrderStatus(null)
      setStatus('Review ready')
      setTxState('review')
      setConfirmIntent('swap')
    } catch (e: any) {
      if (runId !== quoteRunRef.current) return
      const normalizedError = getErrorDetails(e, 'Unable to prepare trade')
      setError(normalizedError.message)
    } finally {
      if (runId === quoteRunRef.current) setBusy(null)
    }
  }, [
    params.tokenIn,
    effectiveTokenIn,
    params.tokenOut,
    params.amountInUnits,
    params.parsedDeadlineMinutes,
    params.parsedSlippage,
    params.executionMode,
    swapChainId,
    isReady,
    getTokenDecimals,
    getErrorDetails,
    guardInputPolicy,
    guardRoutingPolicy,
    syncPermitRequirement,
    signPermitIfRequired,
    params.executionAddress,
    params.executionReady,
    swapDebugEnabled,
    swapSessionGate,
    quote,
    isQuoteStale,
    permit2DisabledForSwap,
  ])

  const run7702DryRun = useCallback(
    async (options?: { silent?: boolean }): Promise<Swap7702Diagnostics | null> => {
      if (!quote || !params.executionAddress) {
        if (!options?.silent) {
          setDiagnosticsResult(null)
          setError('Diagnostics unavailable: quote and execution address are required.')
        }
        return null
      }
      const quotePayload = pickQuote(quote)
      if (!quotePayload) {
        if (!options?.silent) {
          setDiagnosticsResult(null)
          setError('Diagnostics unavailable: quote payload missing.')
        }
        return null
      }

      if (!options?.silent) setDiagnosticsBusy(true)
      const notes: string[] = []
      let delegationOk = false
      let swap5792Ok = false
      let swap7702Ok = false
      const deadline = Math.floor(Date.now() / 1000) + Math.max(60, params.parsedDeadlineMinutes * 60)
      const quoteShape = buildRoutingQuotePayload(quote.routing, quotePayload)

      try {
        await fetchDelegationStatus({
          chainIds: [Number(swapChainId)],
          walletAddresses: [params.executionAddress],
        } as any)
        delegationOk = true
      } catch (error) {
        notes.push(`delegation-check-failed:${getErrorMessage(error, 'delegation check failed')}`)
      }

      try {
        await buildSwap5792({
          ...quoteShape,
          deadline,
        })
        swap5792Ok = true
      } catch (error) {
        notes.push(`swap5792-failed:${getErrorMessage(error, 'swap5792 build failed')}`)
      }

      if (canary7702Eligible) {
        try {
          await buildSwap7702({
            ...quoteShape,
            smartContractDelegationAddress: CALIBUR_DELEGATION_ADDRESS,
          })
          swap7702Ok = true
        } catch (error) {
          notes.push(`swap7702-failed:${getErrorMessage(error, 'swap7702 build failed')}`)
        }
      } else {
        notes.push('swap7702-skipped:not-canary-eligible')
      }

      const result: Swap7702Diagnostics = {
        at: Date.now(),
        chainId: Number(swapChainId),
        canaryEligible: canary7702Eligible,
        routing: quote.routing ? String(quote.routing) : null,
        delegationOk,
        swap5792Ok,
        swap7702Ok,
        notes,
      }
      if (!options?.silent) {
        setDiagnosticsResult(result)
        setStatus('Internal diagnostics complete.')
        setDiagnosticsBusy(false)
      }
      console.info('[swap][7702] dry-run complete', {
        canaryEligible: canary7702Eligible,
        delegationOk,
        swap5792Ok,
        swap7702Ok,
        notes,
      })
      return result
    },
    [
      quote,
      params.executionAddress,
      params.parsedDeadlineMinutes,
      swapChainId,
      canary7702Eligible,
      getErrorMessage,
    ],
  )

  const toExecutionTransaction = useCallback((tx: Record<string, unknown>): TransactionRequest => ({
    to: tx.to as string,
    from: (tx.from as string) ?? params.signerAddress ?? '',
    data: tx.data as string,
    value: typeof tx.value === 'string' && tx.value.trim() ? tx.value : '0',
    chainId: swapChainId,
    gasLimit: typeof tx.gasLimit === 'string' ? tx.gasLimit : undefined,
    maxFeePerGas: typeof tx.maxFeePerGas === 'string' ? tx.maxFeePerGas : undefined,
    maxPriorityFeePerGas: typeof tx.maxPriorityFeePerGas === 'string' ? tx.maxPriorityFeePerGas : undefined,
    gasPrice: typeof tx.gasPrice === 'string' ? tx.gasPrice : undefined,
  }), [params.signerAddress, swapChainId])

  const getApprovalExecutionTx = useCallback((): TransactionRequest | null => {
    if (!approvalData) return null
    const tx = approvalData.approval as Record<string, unknown> | undefined
    if (!tx?.to || !tx?.data) return null
    return toExecutionTransaction(tx)
  }, [approvalData, toExecutionTransaction])

  const executeApprovalNow = useCallback(async () => {
    const approvalTx = getApprovalExecutionTx()
    if (!approvalTx) {
      setStatus('No approval transaction required')
      return
    }
    setBusy('executeApproval')
    setError('')
    try {
      const context = buildRouterContext()
      const routePreview = detectTxSendMode(context)
      if (swapDebugEnabled) {
        console.debug('[swap][send][approval]', {
          chainId: Number(swapChainId),
          executionMode: params.executionMode,
          selectedAddress: params.executionAddress,
          signerAddress: params.signerAddress,
          canonicalAddress: params.canonicalAddress,
          connectorId: params.connectorId ?? null,
          connectorName: params.connectorName ?? null,
          signerType: params.signerType ?? null,
          capabilities: normalizedCapabilities,
          detectedMode: routePreview.mode,
          detectedReason: routePreview.reason,
        })
      }
      const { routing, send } = await buildAndSendApproval({
        context,
        approvalTx,
      })
      const nextHash = send.transactionHash ?? send.txHashes[0] ?? null
      setTxHash(nextHash)
      setTxState('pending')
      setStatus(
        `Approval submitted via ${routing.mode} (${send.method})${nextHash ? `: ${nextHash}` : ''}`,
      )
      updateAttemptDebug({
        stage: 'approval',
        mode: routing.mode,
        method: send.method,
        sender: send.sender,
        txHash: nextHash,
        callsId: send.callsId,
        callTargets: [approvalTx.to],
        at: Date.now(),
      })
      setTxState('success')
    } catch (e: any) {
      const message = getErrorMessage(e, 'Approval transaction failed')
      setError(message)
      updateTxDebugError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }, [
    getApprovalExecutionTx,
    buildRouterContext,
    swapDebugEnabled,
    swapChainId,
    params.executionMode,
    params.executionAddress,
    params.signerAddress,
    params.canonicalAddress,
    params.connectorId,
    params.connectorName,
    params.signerType,
    normalizedCapabilities,
    getErrorMessage,
    updateAttemptDebug,
    updateTxDebugError,
  ])

  const executeSwapNow = useCallback(async (options?: { approvalTx?: TransactionRequest | null }) => {
    if (!swapTx) return
    assertValidSwapTransaction(swapTx)
    setBusy('executeSwap')
    setError('')
    try {
      const approvalTx = options?.approvalTx ?? null
      if (params.executionMode === 'canonical') {
        const sessionGuard = await resolveCanonicalSubmitSession(
          {
          executionMode: params.executionMode,
          sessionHydrated: Boolean(params.sessionHydrated),
          hasSession: Boolean(params.hasSession),
          sessionAddress: params.sessionAddress ?? null,
          executionAddress: params.executionAddress ?? null,
          expectedSessionAddress: params.expectedSessionAddress ?? params.signerAddress ?? null,
        },
          params.ensureCanonicalSession,
        )
        if (!sessionGuard.ok) {
          throw new Error(sessionGuard.message)
        }
      }
      // Canary users get a best-effort 7702 preflight; send path still falls
      // back to canonical ERC-4337 on any issue.
      if (params.executionMode === 'canonical' && canary7702Eligible) {
        await run7702DryRun({ silent: true }).catch(() => null)
      }
      const context = buildRouterContext()
      const routePreview = detectTxSendMode(context)
      if (swapDebugEnabled) {
        console.debug('[swap][send][swap]', {
          chainId: Number(swapChainId),
          executionMode: params.executionMode,
          selectedAddress: params.executionAddress,
          signerAddress: params.signerAddress,
          canonicalAddress: params.canonicalAddress,
          connectorId: params.connectorId ?? null,
          connectorName: params.connectorName ?? null,
          signerType: params.signerType ?? null,
          capabilities: normalizedCapabilities,
          detectedMode: routePreview.mode,
          detectedReason: routePreview.reason,
          bundledApproval: Boolean(approvalTx),
        })
      }
      const wrapTx = wrapNativeInputForSponsoredCanonical
        ? ({
            to: CONTRACTS.weth,
            from: params.signerAddress ?? '',
            data: WETH_DEPOSIT_SELECTOR,
            value: parseUnits(toParsableAmount(params.amountInUnits) ?? '0', 18).toString(),
            chainId: swapChainId,
          } satisfies TransactionRequest)
        : null
      if (wrapTx && BigInt(wrapTx.value ?? '0') <= 0n) {
        throw new Error('Enter a valid amount greater than 0.')
      }
      const { routing, send } = wrapTx
        ? await buildAndSendCalls({
            context,
            calls: [wrapTx, ...(approvalTx ? [approvalTx] : []), swapTx],
          })
        : await buildAndSendSwap({
            context,
            swapTx,
            approvalTx,
          })
      const nextHash = send.transactionHash ?? send.txHashes[send.txHashes.length - 1] ?? null
      setTxHash(nextHash)
      setTxState('pending')
      setStatus(
        `Swap submitted via ${routing.mode} (${send.method})${nextHash ? `: ${nextHash}` : ''}`,
      )

      const approvalHash = approvalTx ? send.txHashes[0] ?? nextHash : null
      if (approvalTx) {
        updateAttemptDebug({
          stage: 'approval',
          mode: routing.mode,
          method: send.method,
          sender: send.sender,
          txHash: approvalHash,
          callsId: send.callsId,
          callTargets: [approvalTx.to],
          at: Date.now(),
        })
      }
      updateAttemptDebug({
        stage: 'swap',
        mode: routing.mode,
        method: send.method,
        sender: send.sender,
        txHash: nextHash,
        callsId: send.callsId,
        callTargets: [wrapTx?.to, swapTx.to].filter(Boolean) as string[],
        at: Date.now(),
      })
      setTxState('success')
    } catch (e: any) {
      const message = getErrorMessage(e, 'Swap transaction failed')
      setError(message)
      updateTxDebugError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }, [
    swapTx,
    buildRouterContext,
    canary7702Eligible,
    run7702DryRun,
    swapDebugEnabled,
    swapChainId,
    params.executionMode,
    params.executionAddress,
    params.amountInUnits,
    params.ensureCanonicalSession,
    params.hasSession,
    params.signerAddress,
    params.expectedSessionAddress,
    params.canonicalAddress,
    params.connectorId,
    params.connectorName,
    params.sessionAddress,
    params.sessionHydrated,
    params.signerType,
    wrapNativeInputForSponsoredCanonical,
    normalizedCapabilities,
    getErrorMessage,
    updateAttemptDebug,
    updateTxDebugError,
  ])

  const executeOrderNow = useCallback(async () => {
    if (!orderRequest) return
    if (!orderRequest.signature || !orderRequest.signature.startsWith('0x')) {
      throw new Error('Order is missing a valid Permit2 signature. Please refresh the quote and try again.')
    }
    setBusy('executeOrder')
    setError('')
    try {
      setTxHash(null)
      setTxState('pending')
      setStatus('Submitting UniswapX order…')
      const result = await createOrder({
        quote: orderRequest.quote,
        signature: orderRequest.signature,
        routing: orderRequest.routing,
      })
      const orderId = typeof (result as any).orderId === 'string' ? String((result as any).orderId) : ''
      const orderStatusValue =
        typeof (result as any).orderStatus === 'string' ? String((result as any).orderStatus) : ''

      setOrderStatus(orderId ? { orderId, orderStatus: orderStatusValue || 'OPEN' } : null)
      setTxState('success')
      setStatus(orderId ? `Order submitted (id=${orderId})` : 'Order submitted')
    } catch (e: any) {
      const message = getErrorMessage(e, 'Order submission failed')
      setError(message)
      setTxState('error')
      throw new Error(message)
    } finally {
      setBusy(null)
    }
  }, [getErrorMessage, orderRequest])

  const openConfirm = useCallback((intent: 'approval' | 'swap' | 'order') => {
    setConfirmIntent(intent)
  }, [])

  const closeConfirm = useCallback(() => {
    if (busy) return
    setConfirmIntent(null)
  }, [busy])

  const confirmAndExecute = useCallback(async () => {
    if (!confirmIntent || busy) return
    const action = confirmIntent
    if ((action === 'swap' || action === 'order') && isQuoteStale()) {
      setConfirmIntent(null)
      setError('')
      setStatus('Quote expired. Refreshing quote and rebuilding review…')
      setTxState('review')
      await handleReviewTrade()
      return
    }
    setConfirmIntent(null)
    try {
      setTxState('signing')
      if (action === 'approval') await executeApprovalNow()
      if (action === 'swap') {
        const bundledApprovalTx = approvalRequired ? getApprovalExecutionTx() : null
        if (approvalRequired && !bundledApprovalTx) {
          const message = 'Approval is required, but no approval transaction is available. Refresh the quote and try again.'
          setError(message)
          setTxState('error')
          throw new Error(message)
        }
        await executeSwapNow({
          approvalTx: bundledApprovalTx,
        })
      }
      if (action === 'order') {
        if (approvalRequired) await executeApprovalNow()
        await executeOrderNow()
      }
    } catch {
      // Errors are already surfaced in state.
    }
  }, [
    approvalRequired,
    busy,
    confirmIntent,
    executeApprovalNow,
    executeOrderNow,
    executeSwapNow,
    getApprovalExecutionTx,
    handleReviewTrade,
    isQuoteStale,
  ])

  return {
    estimatedOut,
    quote,
    approvalData,
    swapTx,
    busy,
    status,
    error,
    confirmIntent,
    quoteUpdatedAt,
    txState,
    txHash,
    fallbackActive,
    swapProvider,
    swapProviderLabel: getSwapProviderLabel(swapProvider),
    quoteReady,
    isReady,
    canonicalSubmitSession,
    approvalRequired,
    tokensEquivalent,
    quoteIsStale,
    quoteCooldownActive,
    quoteCooldownUntil,
    permitSignatureRequired,
    permitSignaturePending,
    permitSignatureReady,
    diagnosticsEnabled,
    txDebug,
    canary7702Eligible,
    diagnosticsBusy,
    diagnosticsResult,
    setStatus,
    setError,
    setTxState,
    handleQuote,
    handleCheckApproval,
    handleBuildSwap,
    handleReviewTrade,
    openConfirm,
    closeConfirm,
    confirmAndExecute,
    run7702DryRun,
    resetTradeState,
  }
}
