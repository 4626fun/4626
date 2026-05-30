import type { Address, Hex } from 'viem'
import {
  encodeAbiParameters,
  getAddress,
  hashTypedData,
  http,
  isAddress,
  toHex,
} from 'viem'
import { debugLogsFlag } from '@/lib/flags/featureFlags'
import { toAccount } from 'viem/accounts'
import {
  createBundlerClient,
  createPaymasterClient,
  entryPoint06Address,
  getUserOperationHash,
  sendUserOperation,
  toCoinbaseSmartAccount,
  waitForUserOperationReceipt,
} from 'viem/account-abstraction'
import { getProductionBaseReadClient } from '@/lib/base/productionBaseReadClient'
import {
  assertZoraRouterCallExecutesFromCsw,
  buildZoraBundlerSimulationMismatchError,
  formatZoraRouterSimulationFailure,
  isZoraBundlerSimulationMismatchError,
} from '@/lib/zora/zoraTradeApi'
import { logger } from '@/lib/observability/logger'
import { trackEvent } from '@/lib/analytics/analytics'
import { DATA_SUFFIX } from '@/lib/base/baseBuilderCodes'
import {
  TARGET_CANONICAL_CSW_ADDRESS,
  isAllowedAgentCswExecutionSigner,
} from '@/wallet/canonicalWalletPolicy'
import { applyBuilderDataSuffixToCalls } from './coinbaseErc4337BuilderSuffix'
import {
  ensureSignatureHex,
  isUserOpHashLike,
  runSignatureExtractionHarness,
  signatureMeta,
} from './coinbaseErc4337Signature'
import {
  isPaymasterProxyUrl,
  isSameOriginUrl,
  normalizeUrl,
  resolveBundlerUrlForNonPaymaster,
} from './coinbaseErc4337EndpointUtils'
import {
  classifyUserOpErrorCode,
  ensureUserOperationSucceeded,
  extractUserOpReceiptTxHash,
  extractRevertInfo,
  formatMetaMessages,
  getErrorDiagnosticMessage,
  getRpcErrorDetails,
  isAccountNonceMismatchError,
  isDeterministicUserOpExecutionError,
  isExecutionRevertedLikeError,
  buildUserOpGasEstimateFailureError,
  shouldAdvisorySkipBundlerGasEstimate,
  isExpectedUserOpTimeoutError,
  isImmediateUserOpRetrySuppressedError,
  isLikelyVerificationGasLimitError,
  buildPreflightSimulationRejectionError,
  extractExecutionFailedInnerSelector,
  mapUserOpExecutionFailureMessage,
  parseUserOpGasLimitField,
  resolveUserOpCallGasLimit,
  isPreflightSimulationRejection,
  isPaymasterAuthPolicyError,
  isPaymasterPolicyError,
  isPaymasterRoutingPolicyError,
  isPaymasterStakeError,
  isPaymasterUnavailableError,
} from './coinbaseErc4337ErrorUtils'
import {
  fetchCoinbaseSmartWalletOwners,
  findCoinbaseSmartWalletOwnerIndex,
  resetOwnerIndexCacheForTests,
} from './coinbaseErc4337Owners'
import { writePersistedCswOwnerIndex } from './cswOwnerIndexPersistence'
import { recordUserOpTelemetry, type UserOpTelemetrySample } from './coinbaseErc4337Telemetry'
import {
  hexByteLength,
  parseCoinbaseSignatureWrapper,
} from '@/lib/wallet/coinbaseSignatureWrapper'

// ============================================================================
// ENTRYPOINT v0.6 ENFORCEMENT
// ============================================================================
// This module ONLY supports ERC-4337 EntryPoint v0.6. This is enforced at:
// 1. Build time: We import entryPoint06Address from viem/account-abstraction
// 2. Runtime: We verify the bundler supports v0.6 before sending UserOps
// 3. Server: The /api/paymaster endpoint rejects non-v0.6 requests
// ============================================================================

const ENTRYPOINT_V06 = getAddress(entryPoint06Address)
const ENTRYPOINT_V06_EXPECTED = getAddress('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789')
const BUNDLER_PROBE_TIMEOUT_MS = 3_000
const RPC_READ_TIMEOUT_MS = 8_000

// Sanity check at module load time
if (ENTRYPOINT_V06 !== ENTRYPOINT_V06_EXPECTED) {
  throw new Error(
    `EntryPoint v0.6 address mismatch! Expected ${ENTRYPOINT_V06_EXPECTED}, got ${ENTRYPOINT_V06}. ` +
    'This could indicate a viem version mismatch or incorrect import.'
  )
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Verify the bundler supports EntryPoint v0.6.
 * Throws if the bundler doesn't support v0.6.
 */
export async function verifyBundlerSupportsV06(
  bundlerUrl: string,
  options?: { includeCredentials?: boolean; timeoutMs?: number },
): Promise<void> {
  const credentials = options?.includeCredentials ? 'include' : 'omit'
  const timeoutMs = options?.timeoutMs ?? BUNDLER_PROBE_TIMEOUT_MS
  try {
    const response = await fetchWithTimeout(
      bundlerUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_supportedEntryPoints',
          params: [],
        }),
      },
      timeoutMs,
      'bundler eth_supportedEntryPoints',
    )
    
    if (!response.ok) {
      // Don't fail on network errors - let the actual UserOp fail with a better message
      console.warn('[ERC-4337] Could not verify bundler EntryPoint support:', response.status)
      return
    }
    
    const data = await response.json() as {
      result?: unknown
      error?: { message?: unknown }
    }
    const rpcErrorMessage =
      typeof data?.error?.message === 'string' ? data.error.message.trim() : ''
    if (rpcErrorMessage) {
      const rpcMessageLower = rpcErrorMessage.toLowerCase()
      const shouldHardFailProbe =
        rpcMessageLower.includes('unsupported entrypoint') ||
        rpcMessageLower.includes('does not support entrypoint v0.6')
      if (!shouldHardFailProbe) {
        console.warn('[ERC-4337] Bundler entrypoint probe returned RPC error, continuing:', rpcErrorMessage)
        return
      }
      throw new Error(
        `Bundler entrypoint probe failed: ${rpcErrorMessage}. ` +
        'Check VITE_CDP_BUNDLER_URL / CDP_PAYMASTER_URL and ensure the endpoint exposes eth_supportedEntryPoints.'
      )
    }

    if (!Array.isArray(data?.result)) {
      // Some providers return non-standard responses for this probe.
      // Skip hard-failing here and let sendUserOperation surface the canonical failure.
      console.warn('[ERC-4337] Bundler entrypoint probe returned non-array result')
      return
    }

    const supportedEntryPoints = data.result
      .filter((ep): ep is string => typeof ep === 'string')
      .map((ep) => {
        try {
          return getAddress(ep)
        } catch {
          return null
        }
      })
      .filter((ep): ep is Address => ep !== null)

    const supportsV06 = supportedEntryPoints.some((ep) => ep === ENTRYPOINT_V06)
    
    if (!supportsV06) {
      throw new Error(
        `Bundler does not support EntryPoint v0.6 (${ENTRYPOINT_V06}). ` +
        `Supported: ${supportedEntryPoints.join(', ') || 'none'}. ` +
        'This deployment requires EntryPoint v0.6 for gas sponsorship.'
      )
    }
  } catch (e: unknown) {
    // If it's our own error, rethrow
    if (
      e instanceof Error &&
      (e.message.includes('EntryPoint v0.6') || e.message.includes('Bundler entrypoint probe failed'))
    ) {
      throw e
    }
    // Network errors - warn but don't block (let the UserOp fail with better context)
    console.warn('[ERC-4337] Could not verify bundler EntryPoint support:', e)
  }
}

// NOTE: Avoid tight coupling to a specific `viem` client instance/type.
// wagmi and other libs can surface structurally-compatible clients that TypeScript may treat as distinct.
export type PublicClientLike = {
  chain?: { id: number }
  readContract: (args: any) => Promise<any>
} & Record<string, any>

export type WalletClientLike = {
  request: (args: any) => Promise<any>
  signMessage?: (args: any) => Promise<any>
  signTypedData?: (args: any) => Promise<any>
  signTransaction?: (args: any) => Promise<any>
} & Record<string, any>

const SESSION_TOKEN_KEY = 'cv_siwe_session_token'

function isDebugEnabled(): boolean {
  if (debugLogsFlag()) return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug') === 'true'
  } catch {
    return false
  }
}

const AA_DEBUG = isDebugEnabled()

const PAYMASTER_DEBUG_HEADER_ENABLED =
  String((import.meta.env as Record<string, string | undefined>).VITE_PAYMASTER_DEBUG ?? '')
    .trim()
    .toLowerCase() === '1' ||
  String((import.meta.env as Record<string, string | undefined>).VITE_PAYMASTER_DEBUG ?? '')
    .trim()
    .toLowerCase() === 'true' ||
  AA_DEBUG

function formatGasValue(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Math.trunc(value).toString()
  if (typeof value === 'string') return value
  return null
}

function compactOwnerApprovalDebugValue(value: string, maxLen = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > maxLen ? `${compact.slice(0, maxLen)}...` : compact
}

function buildOwnerApprovalDebugTag(params: {
  approvalRunId?: string | null
  stage?: string | null
  attempt?: number | null
  errorCode?: string | null
  rpcDetails?: string | null
}): string {
  if (!params.approvalRunId) return ''
  const parts = [
    `runId=${compactOwnerApprovalDebugValue(String(params.approvalRunId), 80)}`,
    `stage=${compactOwnerApprovalDebugValue(String(params.stage ?? 'unknown'), 40)}`,
    `attempt=${params.attempt ?? 'na'}`,
    `code=${compactOwnerApprovalDebugValue(String(params.errorCode ?? 'unknown'), 48)}`,
  ]
  const rpcDetails = compactOwnerApprovalDebugValue(String(params.rpcDetails ?? ''), 220)
  if (rpcDetails) parts.push(`rpc=${rpcDetails}`)
  return `[oa-debug:${parts.join(';')}]`
}

function formatGasEstimate(estimate: any) {
  return {
    preVerificationGas: formatGasValue(estimate?.preVerificationGas),
    verificationGasLimit: formatGasValue(estimate?.verificationGasLimit),
    callGasLimit: formatGasValue(estimate?.callGasLimit),
    paymasterVerificationGasLimit: formatGasValue(estimate?.paymasterVerificationGasLimit),
    paymasterPostOpGasLimit: formatGasValue(estimate?.paymasterPostOpGasLimit),
  }
}

const ZORA_UNIVERSAL_ROUTER_ADDRESS = '0x6ff5693b99212da76ad316178a184ab56d299b43' as const
const ZORA_SWAP_EXECUTE_SELECTOR = '0x24856bc3' as const
const UNISWAP_UNIVERSAL_ROUTER_EXECUTE_SELECTOR = '0x3593564c' as const
const SWAP_PROXY_EXECUTE_SELECTOR = '0x2894adf9' as const
const SWAP_ROUTER_CALL_GAS_LIMIT = 4_000_000n
const SWAP_ROUTER_BATCH_CALL_GAS_LIMIT = 5_500_000n
const ZORA_SEND_CALL_GAS_BUFFER_NUMERATOR = 150n
const ZORA_SEND_CALL_GAS_BUFFER_DENOMINATOR = 100n

function isZoraUniversalRouterTarget(to: Address | undefined): boolean {
  return String(to ?? '').toLowerCase() === ZORA_UNIVERSAL_ROUTER_ADDRESS
}

function isSwapRouterHeavyCall(call: { to: Address; data?: Hex }): boolean {
  const dataPrefix = String(call.data ?? '').slice(0, 10).toLowerCase()
  const target = String(call.to ?? '').toLowerCase()
  if (
    target === ZORA_UNIVERSAL_ROUTER_ADDRESS &&
    (dataPrefix === ZORA_SWAP_EXECUTE_SELECTOR ||
      dataPrefix === UNISWAP_UNIVERSAL_ROUTER_EXECUTE_SELECTOR)
  ) {
    return true
  }
  return dataPrefix === SWAP_PROXY_EXECUTE_SELECTOR
}

function inferSwapRouterCallGasLimit(
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>,
): bigint | undefined {
  if (!calls.some(isSwapRouterHeavyCall)) return undefined
  return calls.length === 1 ? SWAP_ROUTER_CALL_GAS_LIMIT : SWAP_ROUTER_BATCH_CALL_GAS_LIMIT
}

type BundlerUserOpGasEstimate = {
  callGasLimit?: bigint
}

/** Fail fast when bundler simulation rejects a UserOp (stricter than eth_call preflight). */
async function assertBundlerUserOpGasEstimate(params: {
  bundlerClient: any
  account: any
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  verificationGasLimit: bigint
  nonce?: bigint
  callGasLimit?: bigint
  paymasterClient?: { getPaymasterData: any; getPaymasterStubData: any }
  bundlerUrl?: string
  preflightDirectCallSucceeded?: boolean
}): Promise<BundlerUserOpGasEstimate> {
  const { bundlerClient, account, calls, verificationGasLimit, paymasterClient } = params
  const client: any = bundlerClient as any

  const originalAccount = client.account
  client.account = account
  try {
    const paymaster =
      paymasterClient && paymasterClient.getPaymasterData && paymasterClient.getPaymasterStubData
        ? {
            getPaymasterData: paymasterClient.getPaymasterData,
            getPaymasterStubData: paymasterClient.getPaymasterStubData,
          }
        : undefined
    const estimateParams = {
      account,
      calls,
      verificationGasLimit,
      entryPointAddress: ENTRYPOINT_V06,
      ...(typeof params.nonce === 'bigint' ? { nonce: params.nonce } : {}),
      ...(typeof params.callGasLimit === 'bigint' ? { callGasLimit: params.callGasLimit } : {}),
      ...(paymaster ? { paymaster } : {}),
    }

    if (typeof client?.estimateUserOperationGas !== 'function') {
      return {}
    }

    const firstCallTo = calls[0]?.to
    let estimate: unknown = null
    let estimateError: unknown = null
    try {
      estimate = await client.estimateUserOperationGas(estimateParams)
    } catch (e: unknown) {
      estimateError = e
      const hasSwapRouterCall = calls.some(isSwapRouterHeavyCall)
      const canRetryWithoutPaymaster = Boolean(paymaster) && hasSwapRouterCall
      if (canRetryWithoutPaymaster) {
        const { paymaster: _paymaster, ...estimateWithoutPaymaster } = estimateParams as {
          paymaster?: unknown
        }
        try {
          estimate = await client.estimateUserOperationGas(estimateWithoutPaymaster)
          estimateError = null
          if (AA_DEBUG) {
            logger.debug('[ERC-4337] estimateUserOperationGas succeeded without paymaster stub', {
              smartWallet: account.address,
            })
          }
        } catch (retryError: unknown) {
          estimateError = retryError
        }
      }
    }

    if (estimateError) {
      const revertInfo = extractRevertInfo(estimateError)
      const estimateExecutionFailed =
        revertInfo.revertData?.slice(0, 10).toLowerCase() === '0x2c4029e9' ||
        revertInfo.errorName === 'ExecutionFailed(uint256,bytes)'
      if (
        params.preflightDirectCallSucceeded &&
        calls.some(isSwapRouterHeavyCall) &&
        estimateExecutionFailed
      ) {
        throw buildZoraBundlerSimulationMismatchError()
      }
      if (
        shouldAdvisorySkipBundlerGasEstimate({
          error: estimateError,
          firstCallTo,
          floorCallGasLimit: params.callGasLimit,
          preflightDirectCallSucceeded: params.preflightDirectCallSucceeded,
        })
      ) {
        const callGasLimit = resolveUserOpCallGasLimit({
          floorCallGasLimit: params.callGasLimit,
          bufferNumerator: ZORA_SEND_CALL_GAS_BUFFER_NUMERATOR,
          bufferDenominator: ZORA_SEND_CALL_GAS_BUFFER_DENOMINATOR,
        })
        console.warn('[ERC-4337] estimateUserOperationGas advisory skip; using Zora callGas floor', {
          error: revertInfo.error,
          errorName: revertInfo.errorName,
          revertData: revertInfo.revertData,
          callGasLimit: callGasLimit?.toString() ?? null,
          ...(params.bundlerUrl
            ? { bundlerUsesProxy: isPaymasterProxyUrl(params.bundlerUrl) }
            : {}),
        })
        return callGasLimit ? { callGasLimit } : {}
      }
      console.warn('[ERC-4337] estimateUserOperationGas failed', {
        error: revertInfo.error,
        errorName: revertInfo.errorName,
        revertData: revertInfo.revertData,
        innerSelector: extractExecutionFailedInnerSelector(revertInfo.revertData),
        ...(params.bundlerUrl
          ? { bundlerUsesProxy: isPaymasterProxyUrl(params.bundlerUrl) }
          : {}),
      })
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] estimateUserOperationGas failed', {
          error: revertInfo.error,
          revertData: revertInfo.revertData,
          errorName: revertInfo.errorName,
        })
      }
      throw buildUserOpGasEstimateFailureError(estimateError, firstCallTo)
    }
    if (AA_DEBUG && estimate) {
      logger.debug('[ERC-4337] estimateUserOperationGas', formatGasEstimate(estimate))
    }

    const estimatedCallGas = parseUserOpGasLimitField((estimate as Record<string, unknown> | null)?.callGasLimit)
    const resolved = resolveUserOpCallGasLimit({
      estimatedCallGasLimit: estimatedCallGas,
      floorCallGasLimit: params.callGasLimit,
    })
    return resolved ? { callGasLimit: resolved } : {}
  } finally {
    if (originalAccount === undefined) {
      delete client.account
    } else {
      client.account = originalAccount
    }
  }
}

const TRANSIENT_USER_OP_RETRY_DELAYS_MS = [250, 750, 1500] as const
const NONCE_MISMATCH_WAIT_BUDGETS_MS = [8_000, 15_000, 30_000, 45_000] as const
const NONCE_MISMATCH_POLL_INTERVAL_MS = 2_000
const PENDING_USEROP_STORAGE_PREFIX = 'cv:canonical4337:pending:'
const REPLAYABLE_NONCE_KEY = 8453n
const UINT192_MASK = (1n << 192n) - 1n

/** Fresh EntryPoint nonce key when the owner-index lane is blocked by AA25. */
export function deriveEphemeralNonceKey(ownerIndex: number): bigint {
  let key =
    (BigInt(Date.now()) << 20n) |
    BigInt(Math.floor(Math.random() * 0xfffff)) |
    BigInt(ownerIndex & 0xff)
  key &= UINT192_MASK
  if (key === REPLAYABLE_NONCE_KEY) key = 8454n
  if (key === 0n) key = 1n
  return key
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pendingUserOpStorageKey(smartWallet: Address, ownerIndex: number): string {
  return `${PENDING_USEROP_STORAGE_PREFIX}${smartWallet.toLowerCase()}:${ownerIndex}`
}

function storePendingUserOpHash(smartWallet: Address, ownerIndex: number, userOpHash: Hex): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(pendingUserOpStorageKey(smartWallet, ownerIndex), userOpHash)
  } catch {
    // ignore quota / private mode
  }
}

function clearPendingUserOpHash(smartWallet: Address, ownerIndex: number): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(pendingUserOpStorageKey(smartWallet, ownerIndex))
  } catch {
    // ignore
  }
}

/** Last submitted UserOp hash for wallet + owner-index nonce lane (browser session). */
export function readPendingUserOpHash(smartWallet: Address, ownerIndex: number): Hex | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(pendingUserOpStorageKey(smartWallet, ownerIndex))
    if (!raw || !raw.startsWith('0x')) return null
    return raw as Hex
  } catch {
    return null
  }
}

/**
 * Prior UserOp to wait on before a new canonical swap (Permit2 nonce / on-chain state).
 * Prefers session storage; falls back to a confirming swap still polling for txHash.
 */
export function resolvePriorPendingUserOpForSubmit(params: {
  smartWallet: Address
  confirmingUserOpHash?: string | null
}): Hex | null {
  const fromSession = readAnyPendingUserOpHashForWallet(params.smartWallet)
  if (fromSession) return fromSession
  const raw = params.confirmingUserOpHash?.trim()
  if (raw?.startsWith('0x')) return raw as Hex
  return null
}

/** Any in-session pending UserOp for this smart wallet (owner-index lane storage). */
export function readAnyPendingUserOpHashForWallet(smartWallet: Address): Hex | null {
  if (typeof window === 'undefined') return null
  const prefix = `${PENDING_USEROP_STORAGE_PREFIX}${smartWallet.toLowerCase()}:`
  try {
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      const raw = sessionStorage.getItem(key)
      if (raw?.startsWith('0x')) return raw as Hex
    }
  } catch {
    // ignore
  }
  return null
}

export function clearAllPendingUserOpHashesForWallet(smartWallet: Address): void {
  if (typeof window === 'undefined') return
  const prefix = `${PENDING_USEROP_STORAGE_PREFIX}${smartWallet.toLowerCase()}:`
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key)
    }
  } catch {
    // ignore
  }
}

/** Wait for a prior swap UserOp before signing a new Permit2 payload (nonce must advance on-chain). */
export async function waitForPriorPendingUserOp(params: {
  publicClient: PublicClientLike
  bundlerUrl: string
  userOpHash: Hex
  maxWaitMs?: number
  onStatus?: (message: string) => void
}): Promise<'confirmed' | 'failed' | 'timeout'> {
  const normalizedBundlerUrl = normalizeUrl(params.bundlerUrl)
  const bundlerUrlForBundler = resolveBundlerUrlForNonPaymaster(
    normalizedBundlerUrl,
    (import.meta.env as Record<string, string | undefined>)['VITE_CDP_BUNDLER_URL'],
  )
  const shouldSendSessionToBundler = isPaymasterProxyUrl(bundlerUrlForBundler)
  const bundlerClient = createBundlerClient({
    client: params.publicClient as any,
    dataSuffix: '0x',
    transport: http(bundlerUrlForBundler, {
      fetchOptions: {
        credentials: shouldSendSessionToBundler ? 'include' : 'omit',
      },
    }),
  })

  params.onStatus?.('Waiting for your prior swap to confirm on Base…')
  const result = await pollUserOperationStatus({
    bundlerClient,
    userOpHash: params.userOpHash,
    options: {
      maxDurationMs: params.maxWaitMs ?? 90_000,
      pollIntervalMs: 2_000,
      perCheckTimeoutMs: 8_000,
    },
  })
  if (result.status === 'confirmed') return 'confirmed'
  if (result.status === 'failed') return 'failed'
  return 'timeout'
}

function transientUserOpRetryDelayMs(attemptIndex: number): number {
  return TRANSIENT_USER_OP_RETRY_DELAYS_MS[attemptIndex] ?? TRANSIENT_USER_OP_RETRY_DELAYS_MS.at(-1) ?? 1500
}

/** Poll EntryPoint nonce until it advances past a stuck in-flight UserOp. */
export async function waitForEntryPointNonceAdvance(params: {
  readNonce: () => Promise<bigint>
  startingNonce: bigint
  maxWaitMs?: number
  pollIntervalMs?: number
}): Promise<{ advanced: boolean; nonce: bigint }> {
  const maxWaitMs = params.maxWaitMs ?? 30_000
  const pollIntervalMs = params.pollIntervalMs ?? NONCE_MISMATCH_POLL_INTERVAL_MS
  const deadline = Date.now() + maxWaitMs
  let latest = params.startingNonce

  while (Date.now() < deadline) {
    await delay(pollIntervalMs)
    latest = await params.readNonce().catch(() => latest)
    if (latest !== params.startingNonce) {
      return { advanced: true, nonce: latest }
    }
  }

  latest = await params.readNonce().catch(() => latest)
  return { advanced: latest !== params.startingNonce, nonce: latest }
}

function isTransientUserOpSubmissionError(error: unknown): boolean {
  if (isUserRejection(error)) return false
  if (isImmediateUserOpRetrySuppressedError(error)) return false
  if (isAccountNonceMismatchError(error)) return false
  if (isDeterministicUserOpExecutionError(error)) return false
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  const code = (error as any)?.code
  if (code === -32016 || code === -32011 || code === 429) return true
  return (
    lc.includes('429') ||
    lc.includes('too many requests') ||
    lc.includes('over rate limit') ||
    lc.includes('rate limit') ||
    lc.includes('temporarily unavailable') ||
    lc.includes('no backend is currently healthy') ||
    lc.includes('gateway timeout') ||
    lc.includes('request timeout') ||
    lc.includes('network error') ||
    lc.includes('failed to fetch')
  )
}

function debugSignature(context: string, signature: Hex, source?: string | null) {
  if (!AA_DEBUG) return
  logger.debug(`[ERC-4337] ${context} signature`, {
    source: source ?? 'unknown',
    ...signatureMeta(signature),
  })
}

function debugSignatureReady(context: string, signature: Hex, details?: Record<string, unknown>) {
  if (!AA_DEBUG) return
  logger.debug('[ERC-4337] UserOp signature ready', {
    context,
    ...signatureMeta(signature),
    ...(details ?? {}),
  })
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const SIGN_TIMEOUT_MS = 30_000
const USEROP_POLL_INTERVAL_MS = 2_000
const USEROP_POLL_MAX_DURATION_MS = 180_000
const USEROP_POLL_TIMEOUT_MS = 10_000

export type UserOpStatus = 'pending' | 'confirmed' | 'failed' | 'timeout'

export type PollUserOperationStatusOptions = {
  pollIntervalMs?: number
  maxDurationMs?: number
  perCheckTimeoutMs?: number
  onStatusChange?: (status: UserOpStatus, txHash?: Hex) => void
  onError?: (error: Error) => void
  signal?: AbortSignal
}

function ensureSignatureHexWithDebug(value: unknown, context: string): Hex {
  return ensureSignatureHex(value, context, (signature, source) => {
    debugSignature(context, signature, source)
  })
}

if (AA_DEBUG && typeof window !== 'undefined') {
  const w = window as any
  if (typeof w.__cvSignatureHarness !== 'function') {
    w.__cvSignatureHarness = runSignatureExtractionHarness
    logger.debug('[ERC-4337] Signature harness attached to window.__cvSignatureHarness')
  }
}

function getStoredSessionToken(): string | null {
  try {
    const v = sessionStorage.getItem(SESSION_TOKEN_KEY)
    const t = typeof v === 'string' ? v.trim() : ''
    return t.length > 0 ? t : null
  } catch {
    return null
  }
}

/**
 * The canonical EntryPoint v0.6 address used by this module.
 * This is the ONLY EntryPoint version supported.
 */
export const ERC4337_ENTRYPOINT_V06 = ENTRYPOINT_V06

/**
 * Assert that a given address matches EntryPoint v0.6.
 * Use this to verify configuration matches expectations.
 */
export function assertEntryPointV06(address: Address): void {
  const normalized = getAddress(address)
  if (normalized !== ENTRYPOINT_V06) {
    throw new Error(
      `Expected EntryPoint v0.6 (${ENTRYPOINT_V06}), got ${normalized}. ` +
      'This module only supports ERC-4337 EntryPoint v0.6.'
    )
  }
}

export { fetchCoinbaseSmartWalletOwners, findCoinbaseSmartWalletOwnerIndex, resetOwnerIndexCacheForTests }

type UserOpSignMode = 'eth_sign' | 'signMessage' | 'auto'

// Patterns that indicate eth_sign is blocked/unsupported
const ETH_SIGN_BLOCKED_PATTERNS = [
  'eth_sign',
  'method not found',
  'method not supported',
  'unsupported method',
  'not supported',
  'method does not exist',
  'unknown method',
  'invalid method',
  'dangerous',
  'disabled',
  'blocked',
  'prohibited',
  'security',
] as const

// Error codes that indicate method not supported
const METHOD_NOT_SUPPORTED_CODES = [-32601, -32600, -32602, 4200] as const

// Patterns that indicate user rejection (should not retry or fallback)
const USER_REJECTION_PATTERNS = [
  'user rejected',
  'user denied',
  'user cancelled',
  'rejected by user',
  'denied by user',
  'cancelled by user',
  'request rejected',
  'transaction rejected',
  'action_rejected',
  'user refused',
] as const

function isUserRejection(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  const code = (error as any)?.code
  
  // Common user rejection error codes
  if (code === 4001 || code === 'ACTION_REJECTED') return true
  
  return USER_REJECTION_PATTERNS.some(p => lc.includes(p))
}

function isEthSignBlocked(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  const lc = msg.toLowerCase()
  const code = (error as any)?.code
  
  // Check error codes first
  if (typeof code === 'number' && METHOD_NOT_SUPPORTED_CODES.includes(code as any)) return true
  
  // Check message patterns
  return ETH_SIGN_BLOCKED_PATTERNS.some(p => lc.includes(p))
}

function createWalletBackedLocalAccount(params: {
  walletClient: WalletClientLike
  address: Address
  userOpSignMode?: UserOpSignMode
  allowSignMessageFallback?: boolean
}) {
  const { walletClient, address, userOpSignMode = 'auto', allowSignMessageFallback = true } = params
  // Avoid repeating blocked `eth_sign` attempts within the same UserOp submission flow.
  let preferPersonalSignForAutoMode = userOpSignMode === 'signMessage'

  return toAccount({
    address,
    // Required for Coinbase Smart Wallet userOp signatures (sign raw digest).
    sign: async ({ hash }) => {
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] sign called', {
          address,
          hashLength: typeof hash === 'string' ? hash.length : null,
          hashLooksValid: isUserOpHashLike(hash),
        })
      }
      
      const tryEthSign = async (): Promise<Hex> => {
        try {
          const rawSig = await withTimeout(
            (walletClient as any).request({
              method: 'eth_sign',
              params: [address, hash],
            }),
            SIGN_TIMEOUT_MS,
            'eth_sign',
          )
          const sig = ensureSignatureHexWithDebug(rawSig, 'eth_sign')
          debugSignatureReady('eth_sign', sig, { address })
          return sig
        } catch (e) {
          // Rethrow with context
          if (isUserRejection(e)) {
            throw new Error('User rejected the signature request.')
          }
          throw e
        }
      }
      
      const tryPersonalSign = async (): Promise<Hex> => {
        try {
          let rawSig: unknown
          if (typeof walletClient.signMessage === 'function') {
            rawSig = await withTimeout(
              walletClient.signMessage({
                account: address,
                // `raw` signs the 32-byte payload (EIP-191 prefixed at JSON-RPC layer).
                // Coinbase Smart Wallet accepts this via SignatureCheckerLib.
                message: { raw: hash },
              }),
              SIGN_TIMEOUT_MS,
              'signMessage',
            )
          } else if (typeof walletClient.request === 'function') {
            rawSig = await withTimeout(
              walletClient.request({
                method: 'personal_sign',
                params: [hash, address],
              }),
              SIGN_TIMEOUT_MS,
              'personal_sign',
            )
          } else {
            throw new Error('Wallet does not support signMessage or personal_sign')
          }
          const sig = ensureSignatureHexWithDebug(rawSig, 'signMessage')
          debugSignatureReady('signMessage', sig, { address })
          return sig
        } catch (e) {
          if (isUserRejection(e)) {
            throw new Error('User rejected the signature request.')
          }
          throw e
        }
      }

      // Force specific mode if requested
      if (userOpSignMode === 'eth_sign') {
        try {
          return await tryEthSign()
        } catch (ethSignError: unknown) {
          if (isUserRejection(ethSignError)) throw ethSignError
          if (!allowSignMessageFallback || !isEthSignBlocked(ethSignError)) throw ethSignError
          return await tryPersonalSign()
        }
      }
      if (userOpSignMode === 'signMessage') return await tryPersonalSign()

      // Auto mode: try eth_sign first, fall back to signMessage
      // This order is preferred because eth_sign produces a raw signature,
      // but most wallets block it for security reasons.
      if (preferPersonalSignForAutoMode) {
        return await tryPersonalSign()
      }
      try {
        return await tryEthSign()
      } catch (ethSignError: unknown) {
        // If user rejected, don't try fallback
        if (isUserRejection(ethSignError)) {
          throw ethSignError
        }
        
        // If eth_sign is blocked/unsupported, try signMessage (personal_sign) fallback.
        // Coinbase Smart Wallet uses Solady's SignatureCheckerLib which validates both
        // raw and EIP-191 prefixed signatures, so personal_sign works for EOA owners.
        if (isEthSignBlocked(ethSignError)) {
          preferPersonalSignForAutoMode = true
          if (!allowSignMessageFallback) {
            throw new Error(
              'eth_sign is blocked by your wallet and signMessage fallback is disabled.'
            )
          }
          try {
            return await tryPersonalSign()
          } catch (personalSignError: unknown) {
            // If user rejected the fallback, report that
            if (isUserRejection(personalSignError)) {
              throw personalSignError
            }
            // Both methods failed
            throw new Error(
              'Could not sign the UserOperation. Your wallet blocked eth_sign and signMessage also failed. ' +
              'Try using Coinbase Wallet or adding your Privy smart wallet as an owner.'
            )
          }
        }
        
        // Unknown error, rethrow with context
        const errMsg = ethSignError instanceof Error ? ethSignError.message : String(ethSignError)
        throw new Error(`Failed to sign UserOperation: ${errMsg}`)
      }
    },
    signMessage: async ({ message }) => {
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] signMessage called', {
          address,
          messageType: typeof message,
          isRaw: typeof message === 'object' && message !== null && 'raw' in message,
        })
      }
      let rawSig: unknown
      if (typeof walletClient.signMessage === 'function') {
        rawSig = await withTimeout(
          walletClient.signMessage({ account: address, message }),
          SIGN_TIMEOUT_MS,
          'signMessage',
        )
      } else if (typeof walletClient.request === 'function') {
        let msg: Hex
        if (typeof message === 'object' && message !== null && 'raw' in message) {
          const raw = (message as { raw?: unknown }).raw
          if (typeof raw === 'string') {
            msg = (raw.startsWith('0x') ? raw : toHex(raw)) as Hex
          } else {
            msg = toHex(raw as any) as Hex
          }
        } else if (typeof message === 'string') {
          msg = (message.startsWith('0x') ? message : toHex(message)) as Hex
        } else {
          msg = toHex(String(message)) as Hex
        }
        rawSig = await withTimeout(
          walletClient.request({
            method: 'personal_sign',
            params: [msg, address],
          }),
          SIGN_TIMEOUT_MS,
          'personal_sign',
        )
      } else {
        throw new Error('Wallet does not support signMessage or personal_sign')
      }
      return ensureSignatureHexWithDebug(rawSig, 'signMessage')
    },
    signTypedData: async (typedData: any) => {
      let rawSig: unknown
      if (typeof walletClient.signTypedData === 'function') {
        rawSig = await withTimeout(
          walletClient.signTypedData({ account: address, ...(typedData as any) }),
          SIGN_TIMEOUT_MS,
          'signTypedData',
        )
      } else if (typeof walletClient.request === 'function') {
        rawSig = await withTimeout(
          walletClient.request({
            method: 'eth_signTypedData_v4',
            params: [address, JSON.stringify(typedData)],
          }),
          SIGN_TIMEOUT_MS,
          'eth_signTypedData_v4',
        )
      } else {
        throw new Error('Wallet does not support signTypedData')
      }
      return ensureSignatureHexWithDebug(rawSig, 'signTypedData')
    },
    signTransaction: async (tx, options) => {
      const wc: any = walletClient as any
      if (typeof wc.signTransaction !== 'function') {
        throw new Error('Wallet does not support signTransaction')
      }
      return (await wc.signTransaction({ ...tx, ...options, account: address })) as Hex
    },
  })
}

/**
 * Pre-flight simulation: test if the calls would succeed when executed from the smart wallet.
 * This helps diagnose whether a UserOp failure is due to:
 * 1. ERC-4337 / signature issues (simulation passes but UserOp fails)
 * 2. Underlying call issues (simulation fails, meaning the contract call itself would revert)
 * 
 * Returns both the smart wallet execute simulation result AND a direct target call simulation.
 * The direct simulation helps identify if the target contract would revert even with correct msg.sender.
 */
export async function simulateSmartWalletCalls(params: {
  publicClient: PublicClientLike
  smartWallet: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
}): Promise<{ 
  success: boolean
  error?: string
  revertData?: Hex
  errorName?: string
  directCallResult?: { success: boolean; error?: string; revertData?: Hex; errorName?: string }
}> {
  const { publicClient, smartWallet, calls } = params
  const client = publicClient as any
  
  if (typeof client?.simulateContract !== 'function' && typeof client?.call !== 'function') {
    return { success: true } // Can't simulate, assume OK
  }
  
  // First, try to simulate the direct target call (as if smart wallet is msg.sender)
  // This bypasses the smart wallet's authorization checks and tests just the target contract
  let directCallResult: { success: boolean; error?: string; revertData?: Hex; errorName?: string } | undefined
  if (calls.length === 1 && calls[0]?.data && typeof client?.call === 'function') {
    const call = calls[0]!
    // Match bundler/UserOp simulation timing — `latest` can pass while paymaster estimate reverts.
    const blockNumber = 'pending'
    try {
      await client.call({
        to: call.to,
        data: call.data,
        value: call.value ?? 0n,
        account: smartWallet,
        blockNumber,
      })
      directCallResult = { success: true }
    } catch (e: unknown) {
      directCallResult = { success: false, ...extractRevertInfo(e) }
    }
  }

  if (
    calls.length === 1 &&
    isZoraUniversalRouterTarget(calls[0]?.to) &&
    directCallResult &&
    !directCallResult.success
  ) {
    return {
      success: false,
      error:
        directCallResult.error ??
        'Zora swap would revert on your smart wallet. Increase slippage, try a smaller size, and refresh the quote.',
      revertData: directCallResult.revertData,
      errorName: directCallResult.errorName,
      directCallResult,
    }
  }
  
  // Now try the full execute() simulation
  // This might fail with "Unauthorized" because we're calling execute() without going through EntryPoint
  const EXECUTE_ABI = [
    {
      type: 'function',
      name: 'execute',
      stateMutability: 'payable',
      inputs: [
        { name: 'target', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
      ],
      outputs: [],
    },
    {
      type: 'function',
      name: 'executeBatch',
      stateMutability: 'payable',
      inputs: [
        {
          name: 'calls',
          type: 'tuple[]',
          components: [
            { name: 'target', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
          ],
        },
      ],
      outputs: [],
    },
  ] as const
  
  try {
    if (typeof client?.simulateContract !== 'function') {
      // If we can't simulate the full execute, return the direct call result
      if (directCallResult) {
        const { success, error, revertData, errorName } = directCallResult
        return { success, error, revertData, errorName, directCallResult }
      }
      return { success: true }
    }
    
    if (calls.length === 1) {
      const call = calls[0]!
      await client.simulateContract({
        address: smartWallet,
        abi: EXECUTE_ABI,
        functionName: 'execute',
        args: [call.to, call.value ?? 0n, call.data ?? '0x'],
        account: smartWallet, // Note: This may fail with Unauthorized since smartWallet isn't an owner of itself
      })
    } else {
      const batchCalls = calls.map((c) => ({
        target: c.to,
        value: c.value ?? 0n,
        data: c.data ?? '0x' as Hex,
      }))
      await client.simulateContract({
        address: smartWallet,
        abi: EXECUTE_ABI,
        functionName: 'executeBatch',
        args: [batchCalls],
        account: smartWallet,
      })
    }
    
    if (calls.length === 1 && isZoraUniversalRouterTarget(calls[0]?.to)) {
      if (!directCallResult?.success) {
        return {
          success: false,
          error:
            directCallResult?.error ??
            'Zora router simulation did not complete. Refresh the quote and try again.',
          revertData: directCallResult?.revertData,
          errorName: directCallResult?.errorName,
          directCallResult,
        }
      }
    }

    return { success: true, directCallResult }
  } catch (e: unknown) {
    const revertInfo = extractRevertInfo(e)

    const unauthorizedExecute =
      revertInfo.errorName === 'Unauthorized()' ||
      /unauthorized/i.test(String(revertInfo.error ?? ''))

    // execute/executeBatch simulation is not routed through EntryPoint, so
    // Unauthorized can be expected on the wrapper — never treat that as success
    // unless the underlying router call already succeeded.
    if (unauthorizedExecute) {
      if (calls.length === 1 && isZoraUniversalRouterTarget(calls[0]?.to)) {
        return {
          success: false,
          error:
            directCallResult?.error ??
            'Zora swap simulation did not complete. Refresh the quote and try again.',
          revertData: directCallResult?.revertData,
          errorName: directCallResult?.errorName,
          directCallResult,
        }
      }
      if (calls.length === 1 && !directCallResult?.success) {
        return {
          success: false,
          error:
            directCallResult?.error ??
            'Underlying swap call simulation did not complete. Refresh the quote and try again.',
          revertData: directCallResult?.revertData,
          errorName: directCallResult?.errorName,
          directCallResult,
        }
      }
      return {
        success: true,
        directCallResult,
      }
    }

    return {
      success: false,
      ...revertInfo,
      directCallResult,
    }
  }
}

const CSW_EIP712_DOMAIN = {
  name: 'Coinbase Smart Wallet',
  version: '1',
} as const

const CSW_MESSAGE_TYPES = {
  CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
} as const

async function signUserOpViaTypedData(params: {
  walletClient: WalletClientLike
  ownerAddress: Address
  smartWallet: Address
  chainId: number
  userOpHash: Hex
}): Promise<Hex> {
  const { walletClient, ownerAddress, smartWallet, chainId, userOpHash } = params
  const domain = {
    ...CSW_EIP712_DOMAIN,
    chainId,
    verifyingContract: smartWallet,
  }

  let rawSig: unknown
  if (typeof walletClient.signTypedData === 'function') {
    rawSig = await withTimeout(
      walletClient.signTypedData({
        account: ownerAddress,
        domain,
        types: CSW_MESSAGE_TYPES,
        primaryType: 'CoinbaseSmartWalletMessage' as const,
        message: { hash: userOpHash },
      }),
      SIGN_TIMEOUT_MS,
      'signTypedData (CSW EIP-712)',
    )
  } else if (typeof walletClient.request === 'function') {
    rawSig = await withTimeout(
      walletClient.request({
        method: 'eth_signTypedData_v4',
        params: [
          ownerAddress,
          JSON.stringify({
            domain,
            types: CSW_MESSAGE_TYPES,
            primaryType: 'CoinbaseSmartWalletMessage',
            message: { hash: userOpHash },
          }),
        ],
      }),
      SIGN_TIMEOUT_MS,
      'eth_signTypedData_v4 (CSW EIP-712)',
    )
  } else {
    throw new Error('Wallet does not support signTypedData')
  }
  return ensureSignatureHexWithDebug(rawSig, 'signTypedData (CSW EIP-712)')
}

function wrapAccountWithTypedDataSigning(params: {
  account: any
  walletClient: WalletClientLike
  ownerAddress: Address
  smartWallet: Address
  ownerIndex: number
  chainId: number
  useTypedDataSigning: boolean
}): any {
  if (!params.useTypedDataSigning) return params.account
  const { account, walletClient, ownerAddress, smartWallet, ownerIndex, chainId } = params

  return {
    ...account,
    async signUserOperation(userOperation: any) {
      const userOpHash = getUserOperationHash({
        chainId,
        entryPointAddress: ENTRYPOINT_V06,
        entryPointVersion: '0.6',
        userOperation: {
          ...userOperation,
          sender: smartWallet,
        },
      })

      const signature = await signUserOpViaTypedData({
        walletClient,
        ownerAddress,
        smartWallet,
        chainId,
        userOpHash,
      })

      if (AA_DEBUG) {
        const expectedReplaySafe = hashTypedData({
          domain: { ...CSW_EIP712_DOMAIN, chainId, verifyingContract: smartWallet },
          types: CSW_MESSAGE_TYPES,
          primaryType: 'CoinbaseSmartWalletMessage',
          message: { hash: userOpHash },
        })
        logger.debug('[ERC-4337] signTypedData fallback', {
          userOpHash,
          expectedReplaySafe,
          ...signatureMeta(signature),
        })
      }

      // ── Pre-wrapped signature detection ──
      // The Coinbase Wallet extension, when signing for a CSW address, may return
      // a signature that is already wrapped as SignatureWrapper(ownerIndex, rawSig).
      // A raw ECDSA sig is exactly 65 bytes (130 hex chars + "0x"). If the returned
      // signature is longer, it's already a complete SignatureWrapper.
      // Wrapping it again produces a double-wrapped structure the contract cannot
      // validate → AA23.
      //
      // The CoinbaseSmartWallet contract does NOT enforce nonce_key == ownerIndex.
      // It only checks `key != REPLAYABLE_NONCE_KEY (8453)` for standard calls.
      // So we can safely pass through the extension's pre-wrapped signature as-is,
      // regardless of which ownerIndex it chose internally.
      const sigByteLength = typeof signature === 'string' ? (signature.length - 2) / 2 : 0
      if (sigByteLength > 65) {
        if (AA_DEBUG) {
          logger.debug('[ERC-4337] Signature > 65 bytes; already wrapped by wallet extension — returning as-is', {
            smartWallet,
            ownerIndex,
            sigByteLength,
          })
        }
        return signature
      }

      return encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'bytes' }],
        [BigInt(ownerIndex), signature],
      ) as Hex
    },
  }
}

export async function sendCoinbaseSmartWalletUserOperation(params: {
  publicClient: PublicClientLike
  walletClient: WalletClientLike
  bundlerUrl: string
  paymasterUrl?: string
  smartWallet: Address
  ownerAddress: Address
  ownerIndexLookupAddress?: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  version?: '1' | '1.1'
  userOpSignMode?: UserOpSignMode
  ownerIsContract?: boolean
  allowContractSignMessageFallback?: boolean
  allowEoaSignMessageFallback?: boolean
  verificationGasLimits?: bigint[]
  skipPreflightSimulation?: boolean
  skipPaymaster?: boolean
  retryOnInvalidSignature?: boolean
  retryOnPrefund?: boolean
  retryWithLowGasContractSigner?: boolean
  useTypedDataSigning?: boolean
  retryWithTypedDataSigning?: boolean
  bypassOwnerIndexCache?: boolean
  ownerIndexOverride?: number
  /** When true, skip owner index 0 during self-auth CSW probe (WebAuthn passkey slot). */
  skipPasskeyOwnerSlotsInProbe?: boolean
  ownerApprovalContext?: {
    approvalRunId?: string | null
    stage?: string | null
    executionMode?: string | null
    attempt?: number | null
    customOwnerPolicyToken?: string | null
  }
  onSubmissionStatus?: (message: string) => void
  /** When false, return after bundler accepts the UserOp; receipt can be polled separately. */
  waitForOnChainReceipt?: boolean
  /**
   * Use a fresh EntryPoint nonce key instead of ownerIndex (avoids AA25 when a prior
   * swap UserOp is still in the bundler mempool on the owner-index lane).
   */
  preferEphemeralNonceLane?: boolean
}): Promise<{ userOpHash: Hex; transactionHash: Hex | null }> {
  const {
    publicClient,
    walletClient,
    bundlerUrl: bundlerUrlInput,
    paymasterUrl: paymasterUrlInput,
    smartWallet,
    ownerAddress,
    ownerIndexLookupAddress: ownerIndexLookupAddressRaw,
    calls,
    version = '1',
    userOpSignMode = 'auto',
    ownerIsContract: ownerIsContractOverride,
    allowContractSignMessageFallback = true,
    allowEoaSignMessageFallback = true,
    verificationGasLimits: verificationGasLimitsOverride,
    skipPreflightSimulation,
    skipPaymaster = false,
    retryOnInvalidSignature = true,
    retryOnPrefund = true,
    retryWithLowGasContractSigner = true,
    bypassOwnerIndexCache = false,
    ownerIndexOverride: ownerIndexOverrideRaw,
    skipPasskeyOwnerSlotsInProbe = false,
    ownerApprovalContext,
    waitForOnChainReceipt = true,
  } = params

  // Hard safety gate for the agent / project canonical CSW.
  // Only the currently active automation + admin execution owners are permitted
  // to sign UserOps against it. The historical embedded EOA is intentionally
  // excluded from execution even if it passes broader legacy identity checks.
  if (getAddress(smartWallet) === getAddress(TARGET_CANONICAL_CSW_ADDRESS)) {
    if (!isAllowedAgentCswExecutionSigner(ownerAddress)) {
      const msg =
        'Unauthorized signer for agent canonical CSW. Only active automation owners may execute canonical4337 actions on the agent wallet. Historical embedded EOAs are no longer permitted for execution.'
      logger.error('[ERC-4337] Agent CSW execution signer rejected', {
        smartWallet,
        ownerAddress,
        reason: 'historical-or-unauthorized-owner',
      })
      throw new Error(msg)
    }
  }

  const submissionStartedAt = Date.now()
  let telemetryStatus: UserOpTelemetrySample['status'] = 'error'
  let telemetryVerificationGasLimit: string | null = null
  let telemetryPaymasterMode: UserOpTelemetrySample['paymasterMode'] = skipPaymaster
    ? 'self_funded'
    : 'sponsored'
  let telemetrySignatureMode: UserOpTelemetrySample['signatureMode'] = userOpSignMode
  let telemetryOwnerIsContract = typeof ownerIsContractOverride === 'boolean' ? ownerIsContractOverride : false
  let telemetryErrorCode: string | null = null

  try {
  // Input validation
  if (!bundlerUrlInput) throw new Error('Missing bundler URL')
  if (!smartWallet) throw new Error('Missing smart wallet address')
  if (!ownerAddress) throw new Error('Missing owner address')
  if (!publicClient) throw new Error('Missing public client')
  if (!walletClient) throw new Error('Missing wallet client')
  if (!calls || calls.length === 0) throw new Error('No calls provided')
  const chainId = (publicClient as any).chain?.id ?? 8453
  const attributedCalls = applyBuilderDataSuffixToCalls(calls, chainId, DATA_SUFFIX, AA_DEBUG, smartWallet)
  const ownerIndexLookupAddress =
    typeof ownerIndexLookupAddressRaw === 'string' && isAddress(ownerIndexLookupAddressRaw)
      ? getAddress(ownerIndexLookupAddressRaw)
      : null
  let ownerAddressForLookup = ownerIndexLookupAddress ?? ownerAddress
  let usingExplicitOwnerLookupAddress = ownerIndexLookupAddress !== null

  const normalizedBundlerUrl = normalizeUrl(bundlerUrlInput)
  const paymasterUrl = normalizeUrl(paymasterUrlInput ?? bundlerUrlInput)
  // Keep same-origin paymaster proxy for bundler RPC in dev so estimate/send match receipt polling.
  let bundlerUrlForBundler = isPaymasterProxyUrl(normalizedBundlerUrl)
    ? normalizedBundlerUrl
    : resolveBundlerUrlForNonPaymaster(
        normalizedBundlerUrl,
        (import.meta.env as Record<string, string | undefined>)['VITE_CDP_BUNDLER_URL'],
      )
  let shouldSendSessionToBundler = isPaymasterProxyUrl(bundlerUrlForBundler)
  const shouldSendSessionToPaymaster = isSameOriginUrl(paymasterUrl)
  const canFallbackBundlerProbeToProxy =
    bundlerUrlForBundler !== normalizedBundlerUrl && isPaymasterProxyUrl(normalizedBundlerUrl)
  if (AA_DEBUG) {
    logger.debug('[ERC-4337] Resolved endpoints', {
      bundlerUrlInput,
      bundlerUrlForBundler,
      paymasterUrl,
      canFallbackBundlerProbeToProxy,
      shouldSendSessionToBundler,
      shouldSendSessionToPaymaster,
    })
  }

  // Pre-flight simulation: fail fast when the underlying call would revert on-chain.
  let preflightDirectCallSucceeded = false
  if (!skipPreflightSimulation) {
    try {
      const preflightClient =
        attributedCalls.length === 1 && isZoraUniversalRouterTarget(attributedCalls[0]?.to)
          ? getProductionBaseReadClient()
          : publicClient
      const simResult = await simulateSmartWalletCalls({
        publicClient: preflightClient as PublicClientLike,
        smartWallet,
        calls: attributedCalls,
      })
      if (!simResult.success) {
        if (AA_DEBUG) {
          logger.warn('[ERC-4337] Pre-flight simulation FAILED - underlying call would revert', {
            smartWallet,
            callCount: calls.length,
            error: simResult.error,
            revertData: simResult.revertData,
            errorName: simResult.errorName,
            directCallError: simResult.directCallResult?.error,
            directCallRevertData: simResult.directCallResult?.revertData,
            directCallErrorName: simResult.directCallResult?.errorName,
            firstCallTo: attributedCalls[0]?.to,
            firstCallData: attributedCalls[0]?.data?.slice(0, 10),
          })
        }
        throw buildPreflightSimulationRejectionError({
          simResult,
          firstCallTo: attributedCalls[0]?.to,
        })
      }
      preflightDirectCallSucceeded =
        simResult.directCallResult?.success === true ||
        (attributedCalls.length > 1 && simResult.success)
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] Pre-flight simulation passed', {
          smartWallet,
          callCount: attributedCalls.length,
          preflightDirectCallSucceeded,
        })
      }
    } catch (preflightError: unknown) {
      if (isPreflightSimulationRejection(preflightError)) {
        throw preflightError
      }
      if (AA_DEBUG) {
        const msg = preflightError instanceof Error ? preflightError.message : String(preflightError ?? '')
        logger.debug('[ERC-4337] Pre-flight simulation failed unexpectedly', {
          smartWallet,
          error: msg,
        })
      }
    }
  }

  const ownerIndexOverride =
    Number.isInteger(ownerIndexOverrideRaw) && Number(ownerIndexOverrideRaw) >= 0
      ? Math.floor(Number(ownerIndexOverrideRaw))
      : null

  // Find owner index
  let ownerIndex: number | null = ownerIndexOverride
  let ownerCount = 0
  const ownerAddressIsSmartWallet =
    ownerAddress.toLowerCase() === smartWallet.toLowerCase()
  if (ownerIndexOverride === null) {
    if (ownerAddressIsSmartWallet && !usingExplicitOwnerLookupAddress) {
      // Self-auth Base App signs personal_sign [hash, csw]. The CSW address is never an
      // ownerAtIndex entry — scanning all slots (starting with WebAuthn owner[0]) is slow
      // and can RPC-timeout before we reach the session-key owner slot.
      const countRaw = (await withTimeout(
        publicClient.readContract({
          address: smartWallet,
          abi: [{
            type: 'function' as const,
            name: 'ownerCount' as const,
            inputs: [],
            outputs: [{ type: 'uint256' as const }],
            stateMutability: 'view' as const,
          }],
          functionName: 'ownerCount',
        }),
        RPC_READ_TIMEOUT_MS,
        'ownerCount read',
      )) as bigint
      ownerCount = Number(countRaw)
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] Skipped owner-index scan for self-auth CSW sender', {
          smartWallet,
          ownerCount,
        })
      }
    } else {
    let ownerLookup = await findCoinbaseSmartWalletOwnerIndex({
      publicClient,
      smartWallet,
      ownerAddress: ownerAddressForLookup,
      useCache: !bypassOwnerIndexCache,
    })
    if (
      ownerLookup.ownerIndex === null &&
      usingExplicitOwnerLookupAddress &&
      ownerAddressForLookup.toLowerCase() !== ownerAddress.toLowerCase()
    ) {
      ownerAddressForLookup = ownerAddress
      usingExplicitOwnerLookupAddress = false
      ownerLookup = await findCoinbaseSmartWalletOwnerIndex({
        publicClient,
        smartWallet,
        ownerAddress: ownerAddressForLookup,
        useCache: !bypassOwnerIndexCache,
      })
      if (AA_DEBUG) {
        logger.warn('[ERC-4337] Explicit owner lookup address is not an owner; falling back to signer address lookup', {
          smartWallet,
          ownerAddress,
          ownerIndexLookupAddress,
        })
      }
    }
    ownerIndex = ownerLookup.ownerIndex
    ownerCount = ownerLookup.ownerCount
    if (AA_DEBUG) {
      logger.debug('[ERC-4337] Owner index lookup', {
        smartWallet,
        ownerAddress,
        ownerAddressForLookup,
        ownerIndex,
        ownerCount,
      })
    }
    }
  } else if (AA_DEBUG) {
    logger.debug('[ERC-4337] Owner index override', {
      smartWallet,
      ownerAddress,
      ownerIndex: ownerIndexOverride,
    })
  }

  if (ownerIndex === null) {
    const ownerLooksLikeSmartWallet = ownerAddressForLookup.toLowerCase() === smartWallet.toLowerCase()
    const maxProbeOwners = 16
    const probeOwnerCount = Math.min(ownerCount, maxProbeOwners)
    const canProbeOwnerIndex =
      ownerLooksLikeSmartWallet &&
      probeOwnerCount > 0 &&
      (!usingExplicitOwnerLookupAddress || ownerIndexLookupAddress === null)
    if (canProbeOwnerIndex) {
      let lastSignatureMismatch: unknown = null
      const probeStartIndex = skipPasskeyOwnerSlotsInProbe ? 1 : 0
      if (skipPasskeyOwnerSlotsInProbe && probeStartIndex > 0 && AA_DEBUG) {
        logger.debug('[ERC-4337] Skipping WebAuthn owner[0] during self-auth owner-index probe', {
          smartWallet,
          ownerCount,
        })
      }
      for (let probeIndex = probeStartIndex; probeIndex < probeOwnerCount; probeIndex += 1) {
        try {
          if (AA_DEBUG) {
            logger.debug('[ERC-4337] Probing smart-wallet owner index', {
              smartWallet,
              ownerAddress,
              probeIndex,
              ownerCount,
            })
          }
          return await sendCoinbaseSmartWalletUserOperation({
            ...params,
            ownerIndexOverride: probeIndex,
            bypassOwnerIndexCache: true,
          })
        } catch (probeErr: unknown) {
          const probeMsg = getErrorDiagnosticMessage(probeErr).toLowerCase()
          const signatureMismatch =
            probeMsg.includes('invalid signature') ||
            probeMsg.includes('signature check failed') ||
            probeMsg.includes('userop signature verification failed') ||
            // AA23 ("reverted or OOG") during gas estimation often means the
            // stub signature format doesn't match the owner type at this index
            // (e.g. ECDSA stub vs WebAuthn passkey owner). Treat as mismatch
            // so the probe continues to the next index.
            probeMsg.includes('aa23') ||
            probeMsg.includes('reverted (or oog)')
          if (!signatureMismatch) throw probeErr
          lastSignatureMismatch = probeErr
          if (AA_DEBUG) {
            logger.debug('[ERC-4337] Owner index probe rejected', {
              smartWallet,
              probeIndex,
              error: probeMsg.slice(0, 220),
            })
          }
        }
      }
      if (lastSignatureMismatch) throw lastSignatureMismatch
    }

    throw new Error(
      `Connected wallet (${ownerAddressForLookup}) is not an onchain owner of the smart wallet (${smartWallet}). ` +
      'Add this wallet as an owner first, or connect with a wallet that is already an owner.'
    )
  }

  const resolvedChainId = Number((publicClient as any)?.chain?.id ?? 0)
  if (resolvedChainId > 0 && ownerIndex !== null) {
    writePersistedCswOwnerIndex({
      chainId: resolvedChainId,
      smartWallet,
      ownerAddress: ownerAddressForLookup,
      ownerIndex,
      ownerCountSnapshot: Math.max(ownerCount, 1),
    })
  }

  // Detect smart wallet owners (EIP-1271) to tune gas + sign mode.
  let ownerIsContract = typeof ownerIsContractOverride === 'boolean' ? ownerIsContractOverride : false
  if (typeof ownerIsContractOverride !== 'boolean') {
    try {
      if (typeof (publicClient as any)?.getBytecode === 'function') {
        const bytecode = await withTimeout(
          (publicClient as any).getBytecode({ address: ownerAddress }),
          RPC_READ_TIMEOUT_MS,
          'owner getBytecode',
        )
        ownerIsContract = typeof bytecode === 'string' && bytecode !== '0x'
      }
    } catch {
      // ignore; fallback to ownerCount probe
    }
    if (!ownerIsContract) {
      try {
        const ownerBytecode = await withTimeout(
          publicClient.readContract({
            address: ownerAddress,
            abi: [{ type: 'function', name: 'ownerCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' }],
            functionName: 'ownerCount',
          }).catch(() => null),
          RPC_READ_TIMEOUT_MS,
          'owner ownerCount probe',
        )
        // If we can call ownerCount, it's likely a Coinbase Smart Wallet
        ownerIsContract = ownerBytecode !== null
      } catch {
        // Ignore - assume EOA if we can't determine
      }
    }
  }
  telemetryOwnerIsContract = ownerIsContract

  const shouldCoerceToEthSign =
    !ownerIsContract && userOpSignMode === 'signMessage' && !allowEoaSignMessageFallback

  const effectiveUserOpSignMode =
    shouldCoerceToEthSign
      ? 'eth_sign'
      : ownerIsContract && userOpSignMode === 'auto'
        ? 'signMessage'
        : userOpSignMode
  if (shouldCoerceToEthSign) {
    logger.warn('[ERC-4337] Coercing sign mode for EOA owner', {
      requested: userOpSignMode,
      effective: effectiveUserOpSignMode,
      ownerAddress,
    })
  }
  telemetrySignatureMode = effectiveUserOpSignMode
  const usedSignMessageFallback = userOpSignMode === 'auto' && effectiveUserOpSignMode === 'signMessage'
  const useTypedDataSigning = params.useTypedDataSigning ?? false

  // Create the owner account for signing
  const owner = createWalletBackedLocalAccount({ 
    walletClient, 
    address: ownerAddress, 
    userOpSignMode: effectiveUserOpSignMode,
    allowSignMessageFallback: ownerIsContract ? allowContractSignMessageFallback : allowEoaSignMessageFallback,
  })
  
  // Create the Coinbase Smart Account
  const baseAccount = await toCoinbaseSmartAccount({
    client: publicClient as any,
    address: smartWallet,
    owners: [owner],
    ownerIndex,
    version,
  })

  // ── Passkey stub override ──
  // When the signer is the CSW itself (self-auth / ownerIsContract), the actual
  // authentication happens via a passkey inside the Coinbase extension. The SDK's
  // getStubSignature() returns an ECDSA dummy because it sees `owner.type === 'local'`,
  // but the contract validates the stub against `ownerAtIndex(ownerIndex)`. If that
  // slot holds a WebAuthn passkey (64 bytes of x,y), the ECDSA stub (65 bytes) will
  // fail format checks during eth_estimateUserOperationGas → validateUserOp → AA23.
  // Detect this case and patch getStubSignature to return the WebAuthn-format stub.
  if (ownerIsContract) {
    try {
      const ownerBytesAtIndex = await withTimeout(
        publicClient.readContract({
          address: smartWallet,
          abi: [{
            type: 'function' as const,
            name: 'ownerAtIndex' as const,
            inputs: [{ name: 'index', type: 'uint256' as const }],
            outputs: [{ type: 'bytes' as const }],
            stateMutability: 'view' as const,
          }],
          functionName: 'ownerAtIndex',
          args: [BigInt(ownerIndex)],
        }),
        RPC_READ_TIMEOUT_MS,
        `ownerAtIndex(${ownerIndex}) passkey probe`,
      ) as Hex
      const ownerBytesLength = typeof ownerBytesAtIndex === 'string'
        ? (ownerBytesAtIndex.length - 2) / 2
        : 0
      if (ownerBytesLength === 64) {
        // Owner at this index is a WebAuthn passkey (64 bytes = x,y coordinates).
        // Replace the ECDSA stub with the canonical WebAuthn stub from the SDK.
        ;(baseAccount as any).getStubSignature = async function () {
          if (AA_DEBUG) {
            logger.debug('[ERC-4337] Using WebAuthn passkey stub for gas estimation', {
              smartWallet,
              ownerIndex,
              ownerBytesLength,
            })
          }
          // Canonical WebAuthn stub signature from viem's toCoinbaseSmartAccount.
          // This is the exact value used by the SDK when owner.type === 'webAuthn'.
          return '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000012000000000000000000000000000000000000000000000000000000000000000170000000000000000000000000000000000000000000000000000000000000001949fc7c88032b9fcb5f6efc7a7b8c63668eae9871b765e23123bb473ff57aa831a7c0d9276168ebcc29f2875a0239cffdf2a9cd1c2007c5c77c071db9264df1d000000000000000000000000000000000000000000000000000000000000002549960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008a7b2274797065223a22776562617574686e2e676574222c226368616c6c656e6765223a2273496a396e6164474850596759334b7156384f7a4a666c726275504b474f716d59576f4d57516869467773222c226f726967696e223a2268747470733a2f2f7369676e2e636f696e626173652e636f6d222c2263726f73734f726967696e223a66616c73657d00000000000000000000000000000000000000000000' as Hex
        }
        if (AA_DEBUG) {
          logger.debug('[ERC-4337] Passkey owner detected at ownerIndex; stub patched', {
            smartWallet,
            ownerIndex,
          })
        }
      } else if (AA_DEBUG) {
        logger.debug('[ERC-4337] Owner at index is not a passkey; using default ECDSA stub', {
          smartWallet,
          ownerIndex,
          ownerBytesLength,
        })
      }
    } catch (passkeyProbeError: unknown) {
      if (AA_DEBUG) {
        const msg = passkeyProbeError instanceof Error ? passkeyProbeError.message : String(passkeyProbeError ?? '')
        logger.warn('[ERC-4337] Failed to probe owner type at ownerIndex; using default stub', {
          smartWallet,
          ownerIndex,
          error: msg,
        })
      }
    }
  }

  // ── Pre-wrapped signature guard (non-typed-data path) ──
  // When useTypedDataSigning is false, viem's baseAccount.signUserOperation calls
  // our localAccount.sign() → gets whatever the wallet returns → then wraps it
  // via wrapSignature(). If the CSW extension already returned a pre-wrapped
  // SignatureWrapper (>65 bytes), viem would double-wrap it → AA23.
  // Override signUserOperation to detect pre-wrapped sigs and return them as-is.
  const origSignUserOp = (baseAccount as any).signUserOperation?.bind(baseAccount)
  if (origSignUserOp) {
    ;(baseAccount as any).signUserOperation = async function (userOperation: any) {
      if (ownerIsContract) {
        try {
          const userOpHash = getUserOperationHash({
            chainId,
            entryPointAddress: entryPoint06Address,
            entryPointVersion: '0.6',
            userOperation: {
              ...userOperation,
              sender: smartWallet,
            },
          })
          const rawSig = (await owner.sign!({ hash: userOpHash })) as Hex
          const parsed = parseCoinbaseSignatureWrapper(rawSig)
          if (
            parsed &&
            parsed.ownerIndex === ownerIndex &&
            hexByteLength(rawSig) > 65
          ) {
            if (AA_DEBUG) {
              logger.debug('[ERC-4337] signUserOperation: wallet returned pre-wrapped signature; using as-is', {
                smartWallet,
                ownerIndex,
                signatureByteLength: hexByteLength(rawSig),
              })
            }
            return rawSig
          }
        } catch (preWrappedProbeError: unknown) {
          if (AA_DEBUG) {
            const msg =
              preWrappedProbeError instanceof Error
                ? preWrappedProbeError.message
                : String(preWrappedProbeError ?? '')
            logger.debug('[ERC-4337] signUserOperation: pre-wrapped probe failed; falling back to viem wrap', {
              smartWallet,
              ownerIndex,
              error: msg,
            })
          }
        }
      }

      const wrapped: Hex = await origSignUserOp(userOperation)
      // For contract-owner/self-auth flows, long signature payloads are expected.
      // Do not attempt "double-wrap" unwrapping here or we can strip a valid
      // contract-owner signature envelope and cause AA23 signature failures.
      if (ownerIsContract) {
        if (AA_DEBUG) {
          logger.debug('[ERC-4337] signUserOperation: skipping unwrap for contract owner', {
            smartWallet,
            ownerIndex,
          })
        }
        return wrapped
      }
      // viem's wrapSignature always produces a SignatureWrapper. If the inner sig
      // from the wallet was already wrapped, the result is double-wrapped.
      // Detect: try to ABI-decode the outer wrapper and check if signatureData
      // is itself longer than 65 bytes (indicating a nested wrapper).
      try {
        const hex = wrapped.slice(2)
        // ABI-encoded tuple(uint8 ownerIndex, bytes signatureData):
        //   word[0] = 0x20 (offset to tuple)
        //   word[1] = ownerIndex
        //   word[2] = offset to bytes
        //   word[3] = bytes length
        //   word[4..] = bytes data
        const innerSigLen = parseInt(hex.slice(192, 256), 16)
        if (innerSigLen > 65) {
          // The inner signatureData is itself a pre-wrapped SignatureWrapper.
          // Extract it and return as the top-level signature.
          const innerSigHex = ('0x' + hex.slice(256, 256 + innerSigLen * 2)) as Hex
          if (AA_DEBUG) {
            logger.debug('[ERC-4337] signUserOperation: detected double-wrapped sig; unwrapping to inner', {
              smartWallet,
              outerSigByteLength: (hex.length) / 2,
              innerSigByteLength: innerSigLen,
            })
          }
          return innerSigHex
        }
      } catch {
        // Decoding failed; return as-is
      }
      return wrapped
    }
  }

  const account = wrapAccountWithTypedDataSigning({
    account: baseAccount,
    walletClient,
    ownerAddress,
    smartWallet,
    ownerIndex,
    chainId,
    useTypedDataSigning,
  })

  // CDP can use separate endpoints for bundler + paymaster JSON-RPC methods.
  // If `bundlerUrl` is our same-origin proxy (`/api/paymaster`), we MUST include cookies
  // so the backend can validate the SIWE session (`cv_auth_session`).
  const sessionToken = typeof window !== 'undefined' ? getStoredSessionToken() : null
  const buildTransport = (
    url: string,
    options: { includeSession: boolean; includeDebug?: boolean },
  ) => {
    const sameOrigin = isSameOriginUrl(url)
    const sendSession = options.includeSession && sameOrigin
    const ownerApprovalDebugMode = Boolean(ownerApprovalContext?.approvalRunId)
    const shouldIncludePaymasterDebugHeader =
      sendSession &&
      options.includeDebug &&
      (PAYMASTER_DEBUG_HEADER_ENABLED || ownerApprovalDebugMode)
    const customOwnerPolicyToken =
      sendSession &&
      typeof ownerApprovalContext?.customOwnerPolicyToken === 'string' &&
      ownerApprovalContext.customOwnerPolicyToken.trim()
        ? ownerApprovalContext.customOwnerPolicyToken.trim()
        : null
    const headers: Record<string, string> = {
      ...(sendSession && sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(shouldIncludePaymasterDebugHeader ? { 'X-CV-Paymaster-Debug': '1' } : {}),
      ...(customOwnerPolicyToken ? { 'X-CV-Custom-Owner-Policy': customOwnerPolicyToken } : {}),
    }
    return http(url, {
      fetchOptions: {
        credentials: sendSession ? 'include' : 'omit',
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      },
    })
  }
  const paymasterTransport = buildTransport(paymasterUrl, { includeSession: shouldSendSessionToPaymaster, includeDebug: true })
  const paymasterClient = createPaymasterClient({ transport: paymasterTransport })
  let bundlerClient = createBundlerClient({
    client: publicClient as any,
    // Avoid inheriting wagmi/global dataSuffix on the bundler client.
    // We control per-call attribution in `applyBuilderDataSuffixToCalls`.
    dataSuffix: '0x',
    transport: buildTransport(bundlerUrlForBundler, { includeSession: shouldSendSessionToBundler }),
  })

  // ENFORCE: Verify bundler supports EntryPoint v0.6 before sending.
  // If a client-side override is configured and fails the probe, retry via the
  // same-origin paymaster proxy so one-click deploy does not hard-fail on env drift.
  try {
    await verifyBundlerSupportsV06(bundlerUrlForBundler, { includeCredentials: shouldSendSessionToBundler })
  } catch (probeError: unknown) {
    const probeMsg = probeError instanceof Error ? probeError.message : String(probeError ?? '')
    const probeLc = probeMsg.toLowerCase()
    const isUnsupportedMethodProbe =
      probeLc.includes('bundler entrypoint probe failed') &&
      (probeLc.includes('method not found') ||
        probeLc.includes('method not allowed') ||
        probeLc.includes('unsupported method'))
    const isMissingV06Probe = probeLc.includes('bundler does not support entrypoint v0.6')
    if (!canFallbackBundlerProbeToProxy || (!isUnsupportedMethodProbe && !isMissingV06Probe)) {
      throw probeError
    }
    logger.warn('[ERC-4337] Bundler override probe failed; retrying via paymaster proxy', {
      error: probeMsg,
    })
    bundlerUrlForBundler = normalizedBundlerUrl
    shouldSendSessionToBundler = isPaymasterProxyUrl(bundlerUrlForBundler)
    bundlerClient = createBundlerClient({
      client: publicClient as any,
      dataSuffix: '0x',
      transport: buildTransport(bundlerUrlForBundler, { includeSession: shouldSendSessionToBundler }),
    })
    await verifyBundlerSupportsV06(bundlerUrlForBundler, { includeCredentials: shouldSendSessionToBundler })
  }

  // Send the UserOperation via EntryPoint v0.6 with CDP paymaster
  // toCoinbaseSmartAccount uses entryPoint06Address by default
  // 
  // Gas limits:
  // - verificationGasLimit: Higher for smart wallet signers (EIP-1271 can exceed 2M)
  // - paymaster validation can also push EOA flows above 150k in larger batches
  // - callGasLimit: Auto-estimated, but we don't override since batcher calls vary
  // NOTE: Bundler enforces a 5,000,000 cap on verificationGasLimit.
  const normalizedVerificationGasLimits = Array.isArray(verificationGasLimitsOverride)
    ? verificationGasLimitsOverride.filter((v): v is bigint => typeof v === 'bigint' && v > 0n && v <= 5_000_000n)
    : []
  const verificationGasLimits = normalizedVerificationGasLimits.length > 0
    ? normalizedVerificationGasLimits
    : ownerIsContract
      ? [1_500_000n, 3_000_000n, 5_000_000n]
      : [400_000n, 800_000n, 1_500_000n, 3_000_000n, 5_000_000n]
  const uniqueVerificationGasLimits = Array.from(new Set(verificationGasLimits))
  telemetryVerificationGasLimit = String(uniqueVerificationGasLimits[0] ?? 0n)
  if (AA_DEBUG) {
    logger.debug('[ERC-4337] verificationGasLimit', {
      ownerIsContract,
      verificationGasLimit: String(uniqueVerificationGasLimits[0] ?? 0n),
    })
  }

  // ── Fetch the correct nonce using ownerIndex as the key ──
  // viem's toCoinbaseSmartAccount does not override getNonce, so the default
  // nonceKeyManager uses Date.now() as the key which produces extremely large
  // nonce keys that can collide or confuse bundlers.
  // CoinbaseSmartWallet.validateUserOp only checks that the nonce key != 8453
  // (REPLAYABLE_NONCE_KEY) for standard calls; it does NOT require key == ownerIndex.
  // We use ownerIndex as a stable, deterministic key to avoid the Date.now() problem.
  // We read the nonce directly from the EntryPoint to ensure correctness.
  //
  // This is a function rather than a one-shot read so that transient retries
  // can re-read the nonce. If a previous attempt was received by the bundler
  // but the client timed out, the sequence may have advanced.
  const ENTRYPOINT_GET_NONCE_ABI = [{
    type: 'function' as const,
    name: 'getNonce' as const,
    inputs: [
      { name: 'sender', type: 'address' as const },
      { name: 'key', type: 'uint192' as const },
    ],
    outputs: [{ type: 'uint256' as const }],
    stateMutability: 'view' as const,
  }]
  let activeNonceKey = BigInt(ownerIndex)
  let triedEphemeralNonceKey = false
  const pendingOwnerLaneHash = readAnyPendingUserOpHashForWallet(smartWallet)
  if (params.preferEphemeralNonceLane || pendingOwnerLaneHash) {
    triedEphemeralNonceKey = true
    activeNonceKey = deriveEphemeralNonceKey(ownerIndex)
    if (pendingOwnerLaneHash) {
      clearPendingUserOpHash(smartWallet, ownerIndex)
    }
    if (AA_DEBUG) {
      logger.debug('[ERC-4337] Using ephemeral nonce lane up front', {
        smartWallet,
        ownerIndex,
        ephemeralNonceKey: String(activeNonceKey),
        reason: params.preferEphemeralNonceLane
          ? 'preferEphemeralNonceLane'
          : 'pending_owner_lane_userop',
        pendingOwnerLaneHash,
      })
    }
  }
  const readEntryPointNonceForKey = async (nonceKey: bigint): Promise<bigint | undefined> => {
    try {
      const entryPointNonce = await withTimeout(
        (publicClient as any).readContract({
          address: entryPoint06Address,
          abi: ENTRYPOINT_GET_NONCE_ABI,
          functionName: 'getNonce',
          args: [smartWallet, nonceKey],
        }),
        RPC_READ_TIMEOUT_MS,
        'EntryPoint getNonce',
      ) as bigint
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] EntryPoint nonce read', {
          smartWallet,
          ownerIndex,
          nonce: String(entryPointNonce),
          nonceKey: String(nonceKey),
        })
      }
      return entryPointNonce
    } catch (nonceError: unknown) {
      if (AA_DEBUG) {
        const msg = nonceError instanceof Error ? nonceError.message : String(nonceError ?? '')
        logger.warn('[ERC-4337] Failed to read EntryPoint nonce', {
          smartWallet,
          ownerIndex,
          nonceKey: String(nonceKey),
          error: msg,
        })
      }
      return undefined
    }
  }
  const readEntryPointNonceForKeyRequired = async (nonceKey: bigint): Promise<bigint> => {
    const maxAttempts = 3
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const nonce = await readEntryPointNonceForKey(nonceKey)
      if (typeof nonce === 'bigint') return nonce
      if (attempt < maxAttempts - 1) await delay(250 * (attempt + 1))
    }
    throw new Error('Could not read smart wallet transaction nonce. Refresh the page and try again.')
  }
  let correctNonce = await readEntryPointNonceForKeyRequired(activeNonceKey)

  let userOpHash: Hex | null = null
  let lastError: unknown = null
  let attemptedWithoutPaymaster = false
  const allowPaymasterFallback = import.meta.env.VITE_ALLOW_PAYMASTER_FALLBACK === 'true'
  let smartWalletBalance: bigint | null = null
  try {
    if (typeof (publicClient as any)?.getBalance === 'function') {
      smartWalletBalance = await withTimeout(
        (publicClient as any).getBalance({ address: smartWallet }),
        RPC_READ_TIMEOUT_MS,
        'smart wallet balance read',
      )
      if (AA_DEBUG) {
        logger.debug('[ERC-4337] smart wallet balance', {
          smartWallet,
          balance: formatGasValue(smartWalletBalance),
        })
      }
    }
  } catch (e: unknown) {
    if (AA_DEBUG) {
      const msg = e instanceof Error ? e.message : String(e ?? '')
      logger.debug('[ERC-4337] Failed to read smart wallet balance', { smartWallet, error: msg })
    }
  }
  const swapRouterCallGasLimit = inferSwapRouterCallGasLimit(attributedCalls)
  if (attributedCalls.some((call) => isZoraUniversalRouterTarget(call.to))) {
    for (const call of attributedCalls) {
      if (!isZoraUniversalRouterTarget(call.to) || !call.data) continue
      await assertZoraRouterCallExecutesFromCsw({
        executionAddress: smartWallet,
        call: {
          target: call.to,
          data: call.data,
          value: call.value != null ? String(call.value) : '0',
        },
      })
    }
  }
  const sendWithVerificationGasLimit = async (verificationGasLimit: bigint, usePaymaster: boolean) => {
    const bundlerGasEstimate = await assertBundlerUserOpGasEstimate({
      bundlerClient,
      account,
      calls: attributedCalls,
      verificationGasLimit,
      nonce: correctNonce,
      callGasLimit: swapRouterCallGasLimit,
      paymasterClient: usePaymaster ? paymasterClient : undefined,
      bundlerUrl: bundlerUrlForBundler,
      preflightDirectCallSucceeded,
    })
    const sendCallGasLimit = resolveUserOpCallGasLimit({
      estimatedCallGasLimit: bundlerGasEstimate.callGasLimit,
      floorCallGasLimit: swapRouterCallGasLimit,
      bufferNumerator: swapRouterCallGasLimit ? ZORA_SEND_CALL_GAS_BUFFER_NUMERATOR : undefined,
      bufferDenominator: swapRouterCallGasLimit ? ZORA_SEND_CALL_GAS_BUFFER_DENOMINATOR : undefined,
    })
    if (AA_DEBUG && sendCallGasLimit) {
      logger.debug('[ERC-4337] send callGasLimit', {
        sendCallGasLimit: sendCallGasLimit.toString(),
        swapRouterFloor: swapRouterCallGasLimit?.toString() ?? null,
        fromEstimate: bundlerGasEstimate.callGasLimit?.toString() ?? null,
      })
    }
    return await sendUserOperation(bundlerClient, {
      account,
      calls: attributedCalls,
      verificationGasLimit,
      nonce: correctNonce,
      ...(typeof sendCallGasLimit === 'bigint' ? { callGasLimit: sendCallGasLimit } : {}),
      ...(usePaymaster
        ? {
            paymaster: {
              getPaymasterData: paymasterClient.getPaymasterData,
              getPaymasterStubData: paymasterClient.getPaymasterStubData,
            },
          }
        : {}),
    })
  }

  const shouldRetryVerificationGas = (error: unknown): boolean => {
    const errMsg = getErrorDiagnosticMessage(error)
    return isLikelyVerificationGasLimitError(errMsg)
  }

  const attemptSend = async (usePaymaster: boolean) => {
    for (let i = 0; i < uniqueVerificationGasLimits.length; i++) {
      const limit = uniqueVerificationGasLimits[i]!
      try {
        let sent = false
        let nonceWaitAttempt = 0
        for (let transientAttempt = 0; ; transientAttempt += 1) {
          try {
            userOpHash = await sendWithVerificationGasLimit(limit, usePaymaster)
            storePendingUserOpHash(smartWallet, ownerIndex, userOpHash)
            sent = true
            break
          } catch (e: unknown) {
            lastError = e
            if (isAccountNonceMismatchError(e)) {
              params.onSubmissionStatus?.(
                'Prior swap still confirming. Waiting for your smart wallet nonce…',
              )
              let nonceAdvanced = false
              while (nonceWaitAttempt < NONCE_MISMATCH_WAIT_BUDGETS_MS.length) {
                const waitBudgetMs = NONCE_MISMATCH_WAIT_BUDGETS_MS[nonceWaitAttempt]!
                nonceWaitAttempt += 1
                if (AA_DEBUG) {
                  logger.debug('[ERC-4337] AA25 nonce mismatch; waiting for in-flight UserOp', {
                    attempt: nonceWaitAttempt,
                    waitBudgetMs,
                    startingNonce: String(correctNonce),
                    activeNonceKey: String(activeNonceKey),
                    ownerIndex,
                    smartWallet,
                  })
                }
                const waitResult = await waitForEntryPointNonceAdvance({
                  readNonce: () => readEntryPointNonceForKeyRequired(activeNonceKey),
                  startingNonce: correctNonce,
                  maxWaitMs: waitBudgetMs,
                })
                if (waitResult.advanced) {
                  correctNonce = waitResult.nonce
                  nonceAdvanced = true
                  break
                }
              }
              if (nonceAdvanced) {
                continue
              }
              if (!triedEphemeralNonceKey) {
                triedEphemeralNonceKey = true
                clearPendingUserOpHash(smartWallet, ownerIndex)
                activeNonceKey = deriveEphemeralNonceKey(ownerIndex)
                correctNonce = await readEntryPointNonceForKeyRequired(activeNonceKey)
                nonceWaitAttempt = 0
                params.onSubmissionStatus?.(
                  'Retrying swap on a fresh smart wallet nonce lane…',
                )
                if (AA_DEBUG) {
                  logger.debug('[ERC-4337] AA25 persisted; switching to ephemeral nonce key', {
                    smartWallet,
                    ownerIndex,
                    ephemeralNonceKey: String(activeNonceKey),
                    nonce: String(correctNonce),
                  })
                }
                continue
              }
              break
            }
            const executionReverted = isExecutionRevertedLikeError(e)
            const hasNextTransientAttempt = transientAttempt < TRANSIENT_USER_OP_RETRY_DELAYS_MS.length
            if (
              executionReverted ||
              !hasNextTransientAttempt ||
              !isTransientUserOpSubmissionError(e)
            ) {
              break
            }
            const retryInMs = transientUserOpRetryDelayMs(transientAttempt)
            if (AA_DEBUG) {
              logger.debug('[ERC-4337] retrying transient UserOp submission error', {
                attempt: transientAttempt + 1,
                retryInMs,
                usePaymaster,
                verificationGasLimit: String(limit),
                error: e instanceof Error ? e.message : String(e ?? ''),
              })
            }
            await delay(retryInMs)
            correctNonce = await readEntryPointNonceForKeyRequired(activeNonceKey).catch(() => correctNonce)
          }
        }
        if (!sent) throw lastError ?? new Error('UserOp submission failed')
        lastError = null
        return
      } catch (e: unknown) {
        lastError = e
        const hasNext = i + 1 < uniqueVerificationGasLimits.length
        if (!hasNext || !shouldRetryVerificationGas(e)) break
        if (AA_DEBUG) {
          logger.debug('[ERC-4337] retrying with higher verificationGasLimit', {
            base: String(limit),
            retry: String(uniqueVerificationGasLimits[i + 1]),
          })
        }
      }
    }
  }

  const usePaymaster = !skipPaymaster
  if (usePaymaster) {
    await attemptSend(true)
  } else {
    await attemptSend(false)
  }

  const shouldFallbackWithoutPaymaster = (error: unknown): boolean => {
    const hasPrefundBalance = typeof smartWalletBalance === 'bigint' && smartWalletBalance > 0n
    // If the paymaster rejects (policy/availability), allow a non-sponsored fallback.
    // This is required for non-deploy flows (e.g. legacy withdrawals) that the paymaster denies.
    if (isPaymasterPolicyError(error)) {
      // Auth/session or routing policy denials should not fall back to an unsponsored send.
      // Retrying without sponsorship here just burns user attempts and obscures the root cause.
      if (isPaymasterAuthPolicyError(error) || isPaymasterRoutingPolicyError(error)) return false
      return hasPrefundBalance
    }
    if (!allowPaymasterFallback && (isPaymasterStakeError(error) || isPaymasterUnavailableError(error))) return false
    if (isPaymasterUnavailableError(error) && hasPrefundBalance) return true
    if (isPaymasterStakeError(error) || isPaymasterUnavailableError(error)) return true
    if (!ownerIsContract && shouldRetryVerificationGas(error)) return true
    return false
  }

  if (usePaymaster && lastError && shouldFallbackWithoutPaymaster(lastError)) {
    attemptedWithoutPaymaster = true
    telemetryPaymasterMode = 'fallback_to_self_funded'
    const hasPrefundBalance = typeof smartWalletBalance === 'bigint' && smartWalletBalance > 0n
    const paymasterErrorMsg = getErrorDiagnosticMessage(lastError)
    const paymasterDetails = getRpcErrorDetails(lastError)
    const paymasterMeta = formatMetaMessages(lastError)
    if (isPaymasterUnavailableError(lastError) && !allowPaymasterFallback && hasPrefundBalance) {
      logger.warn('[ERC-4337] Paymaster unavailable; retrying with smart wallet balance', {
        smartWallet,
        balance: formatGasValue(smartWalletBalance),
        paymasterError: paymasterErrorMsg.slice(0, 300),
        paymasterDetails: paymasterDetails ? paymasterDetails.slice(0, 200) : null,
        paymasterMeta,
      })
    } else {
      logger.warn('[ERC-4337] Retrying without sponsorship', {
        paymasterError: paymasterErrorMsg.slice(0, 300),
        paymasterDetails: paymasterDetails ? paymasterDetails.slice(0, 200) : null,
        paymasterMeta,
        isPolicyError: isPaymasterPolicyError(lastError),
        isAuthPolicyError: isPaymasterAuthPolicyError(lastError),
        isRoutingPolicyError: isPaymasterRoutingPolicyError(lastError),
        isStakeError: isPaymasterStakeError(lastError),
        isUnavailableError: isPaymasterUnavailableError(lastError),
        isGasRetry: shouldRetryVerificationGas(lastError),
      })
    }
    // Refresh nonce before paymaster-fallback retry in case the sponsored
    // attempt was partially processed and the sequence advanced.
    correctNonce = await readEntryPointNonceForKeyRequired(activeNonceKey).catch(() => correctNonce)
    await attemptSend(false)
  }

  if (lastError) {
    if (isPreflightSimulationRejection(lastError)) {
      throw lastError
    }
    const errMsg = getErrorDiagnosticMessage(lastError)
    const lc = errMsg.toLowerCase()
    const isExpectedTimeoutFailure = isExpectedUserOpTimeoutError(lastError)
    const errorDetails = getRpcErrorDetails(lastError)
    const metaDetail = formatMetaMessages(lastError)
    const metaSuffix = metaDetail ? ` (CDP: ${metaDetail})` : ''
    const ownerApprovalDebugTag = buildOwnerApprovalDebugTag({
      approvalRunId: ownerApprovalContext?.approvalRunId ?? null,
      stage: ownerApprovalContext?.stage ?? null,
      attempt: ownerApprovalContext?.attempt ?? null,
      errorCode: classifyUserOpErrorCode(lastError),
      rpcDetails: errorDetails || errMsg,
    })
    const debugSuffix = ownerApprovalDebugTag ? ` ${ownerApprovalDebugTag}` : ''
    const isPrefundError =
      lc.includes('sender balance and deposit together') ||
      lc.includes('prefund') ||
      lc.includes('must be at least')

    try {
      const logPayload = {
        smartWallet,
        ownerAddress,
        ownerIsContract,
        userOpSignMode,
        calls: attributedCalls.map((call) => ({
          to: call.to,
          value: typeof call.value === 'bigint' ? call.value.toString() : call.value,
          data: typeof call.data === 'string' ? call.data.slice(0, 18) : null,
        })),
        bundlerUrl: bundlerUrlInput,
        bundlerUsesProxy: isPaymasterProxyUrl(bundlerUrlForBundler),
        bundlerOverrideActive: bundlerUrlForBundler !== normalizedBundlerUrl,
        paymasterUrl: paymasterUrlInput ?? bundlerUrlInput,
        skipPaymaster,
        attemptedWithoutPaymaster,
        verificationGasLimits: uniqueVerificationGasLimits.map((v) => v.toString()),
        error: errMsg,
        errorDetails,
        metaDetail,
      }
      if (!isExpectedTimeoutFailure || AA_DEBUG) {
        console.error(
          `[ERC-4337] UserOp failed: ${errMsg}${errorDetails ? ` (${errorDetails})` : ''}`,
          logPayload,
        )
      } else {
        logger.debug('[ERC-4337] UserOp timeout (expected transient)', {
          smartWallet,
          ownerAddress,
          error: errMsg.slice(0, 220),
        })
      }
    } catch {
      // ignore logging failures
    }

    const retryWithTypedData = params.retryWithTypedDataSigning ?? true
    if (
      retryWithTypedData &&
      !useTypedDataSigning &&
      !ownerIsContract &&
      isEthSignBlocked(lastError)
    ) {
      logger.warn('[ERC-4337] eth_sign blocked by wallet; retrying with EIP-712 signTypedData', {
        ownerAddress,
        smartWallet,
      })
      return await sendCoinbaseSmartWalletUserOperation({
        ...params,
        useTypedDataSigning: true,
        retryWithTypedDataSigning: false,
      })
    }

    if (retryOnPrefund && skipPaymaster && isPrefundError) {
      return await sendCoinbaseSmartWalletUserOperation({
        publicClient,
        walletClient,
        bundlerUrl: bundlerUrlInput,
        paymasterUrl: paymasterUrlInput,
        smartWallet,
        ownerAddress,
        ownerIndexLookupAddress: ownerIndexLookupAddress ?? undefined,
        calls,
        version,
        userOpSignMode,
        ownerIsContract: ownerIsContractOverride,
        allowEoaSignMessageFallback,
        skipPreflightSimulation,
        skipPaymaster: false,
        retryOnInvalidSignature,
        retryOnPrefund: false,
        ownerIndexOverride: ownerIndexOverride ?? undefined,
      })
    }

    if (
      retryOnInvalidSignature &&
      userOpSignMode === 'auto' &&
      !usedSignMessageFallback &&
      (lc.includes('invalid signature') || lc.includes('signature check failed'))
    ) {
      // Only retry with signMessage if the owner is a contract (ERC-1271) or
      // the caller explicitly allows the EOA signMessage fallback.
      // Solady's SignatureCheckerLib.isValidSignatureNowCalldata tries both
      // ecrecover(hash, sig) AND ecrecover(toEthSignedMessageHash(hash), sig),
      // so personal_sign signatures ARE valid for Coinbase Smart Wallet EOA owners.
      if (ownerIsContract || allowEoaSignMessageFallback) {
        return await sendCoinbaseSmartWalletUserOperation({
          publicClient,
          walletClient,
          bundlerUrl: bundlerUrlInput,
          paymasterUrl: paymasterUrlInput,
          smartWallet,
          ownerAddress,
          ownerIndexLookupAddress: ownerIndexLookupAddress ?? undefined,
          calls,
          version,
          userOpSignMode: 'signMessage',
          ownerIsContract: ownerIsContractOverride,
          allowEoaSignMessageFallback,
          skipPreflightSimulation,
          skipPaymaster,
          retryOnInvalidSignature: false,
          bypassOwnerIndexCache: true,
          ownerIndexOverride: ownerIndexOverride ?? undefined,
        })
      }
    }
    if (
      retryWithLowGasContractSigner &&
      ownerIsContract &&
      userOpSignMode === 'auto' &&
      lc.includes('total gas used by the user operation') &&
      lc.includes('allowed limit')
    ) {
      logger.warn('[ERC-4337] Retrying with low-gas contract-owner signer path', {
        ownerAddress,
        smartWallet,
        previousMode: effectiveUserOpSignMode,
      })
      return await sendCoinbaseSmartWalletUserOperation({
        publicClient,
        walletClient,
        bundlerUrl: bundlerUrlInput,
        paymasterUrl: paymasterUrlInput,
        smartWallet,
        ownerAddress,
        ownerIndexLookupAddress: ownerIndexLookupAddress ?? undefined,
        calls,
        version,
        userOpSignMode: 'eth_sign',
        ownerIsContract: ownerIsContractOverride,
        allowContractSignMessageFallback: false,
        allowEoaSignMessageFallback,
        verificationGasLimits: [900_000n, 1_200_000n, 1_500_000n, 2_000_000n, 2_500_000n, 3_000_000n],
        skipPreflightSimulation,
        skipPaymaster,
        retryOnInvalidSignature: false,
        retryOnPrefund,
        retryWithLowGasContractSigner: false,
        ownerIndexOverride: ownerIndexOverride ?? undefined,
      })
    }

    // Provide helpful error messages for common failures
    if (isPrefundError) {
      throw new Error(
        'Smart wallet does not have enough ETH for gas. ' +
          `Add ETH to the canonical CSW or enable gas sponsorship.${debugSuffix}`
      )
    }
    if (lc.includes('insufficient funds') || lc.includes('insufficient balance')) {
      throw new Error(`Paymaster rejected: insufficient sponsorship funds. Contact support.${debugSuffix}`)
    }
    if (lc.includes('max sponsorship cost') || lc.includes('sponsorship cost per user op exceeded')) {
      // Extract the cost and limit from the error if possible
      const costMatch = errMsg.match(/(\d+\.?\d*)\s*USD.*limit:\s*(\d+\.?\d*)\s*USD/i)
      if (costMatch) {
        throw new Error(
          `Gas sponsorship limit exceeded: this operation costs $${costMatch[1]} but the limit is $${costMatch[2]}. ` +
          `Increase your per-UserOp limit in the CDP Dashboard (portal.cdp.coinbase.com).${debugSuffix}`
        )
      }
      throw new Error(
        `Gas sponsorship limit exceeded. Increase your per-UserOp limit in the CDP Dashboard (portal.cdp.coinbase.com).${debugSuffix}`
      )
    }
    if (lc.includes('total gas used by the user operation') && lc.includes('allowed limit')) {
      const gasCapMatch = errMsg.match(/total gas used by the user operation\s+(\d+)\s+is greater than the allowed limit:\s*(\d+)/i)
      if (gasCapMatch) {
        throw new Error(
          `Sponsored UserOp exceeds paymaster total gas cap: used ${gasCapMatch[1]}, limit ${gasCapMatch[2]}. ` +
            `Increase the paymaster per-UserOp gas limit in CDP, or use a lower-gas deploy path.${debugSuffix}`
        )
      }
      throw new Error(
        'Sponsored UserOp exceeds paymaster total gas cap. ' +
          `Increase the paymaster per-UserOp gas limit in CDP, or use a lower-gas deploy path.${debugSuffix}`
      )
    }
    if (lc.includes('invalid signature') || lc.includes('signature check failed')) {
      throw new Error(
        'UserOp signature verification failed. This usually means the signer is not a valid owner. ' +
          `Try reconnecting your wallet or adding it as an owner of the smart wallet.${debugSuffix}`
      )
    }
    if (lc.includes('aa21') || lc.includes('didn\'t pay prefund')) {
      if (attemptedWithoutPaymaster) {
        throw new Error(
          `Smart wallet could not pay gas (no prefund). Add ETH to the smart wallet or re-enable gas sponsorship.${debugSuffix}`
        )
      }
      throw new Error(`Paymaster did not sponsor this operation. Check paymaster configuration.${metaSuffix}${debugSuffix}`)
    }
    if (isAccountNonceMismatchError(lastError)) {
      throw new Error(
        'A swap is already pending for your Coinbase Smart Wallet, or the last one is still confirming. ' +
          'Wait about 30 seconds, then try again once. Do not click Swap repeatedly.',
      )
    }
    const mappedExecutionFailure = mapUserOpExecutionFailureMessage(lastError, {
      firstCallTo: attributedCalls[0]?.to,
    })
    if (mappedExecutionFailure) {
      throw mappedExecutionFailure
    }
    if (isZoraBundlerSimulationMismatchError(lastError)) {
      throw lastError
    }
    if (lc.includes('reverted for an unknown reason')) {
      const zoraCall = attributedCalls.find(
        (call) => isZoraUniversalRouterTarget(call.to) && call.data,
      )
      if (zoraCall?.data) {
        try {
          await assertZoraRouterCallExecutesFromCsw({
            executionAddress: smartWallet,
            call: {
              target: zoraCall.to,
              data: zoraCall.data,
              value: zoraCall.value != null ? String(zoraCall.value) : '0',
            },
          })
        } catch (zoraReplayError: unknown) {
          throw zoraReplayError
        }
        const mappedBundler = mapUserOpExecutionFailureMessage(lastError, {
          firstCallTo: zoraCall.to,
        })
        if (mappedBundler) throw mappedBundler
        throw buildZoraBundlerSimulationMismatchError()
      }
      const formatted = formatZoraRouterSimulationFailure(lastError)
      if (formatted.message.toLowerCase().includes('would revert')) {
        throw formatted
      }
      if (
        triedEphemeralNonceKey ||
        isDeterministicUserOpExecutionError(lastError) ||
        lc.includes('execution reverted')
      ) {
        throw new Error(
          'Swap simulation passed but the sponsored UserOp was rejected by the bundler. ' +
            'Refresh the quote and try again once. If a prior swap is still pending on Base, wait for it to confirm first.',
        )
      }
    }
    if (lc.includes('aa10') || lc.includes('sender already constructed')) {
      throw new Error('Smart wallet already exists at this address.')
    }
    if (lc.includes('request denied -')) {
      const reason = errMsg.replace(/^.*request denied -\s*/i, '').trim()
      if (reason.includes('not authenticated')) {
        throw new Error(`Session expired or missing. Reconnect your wallet and try again.${metaSuffix}${debugSuffix}`)
      }
      if (reason.includes('creator not approved')) {
        throw new Error(
          `Creator not approved for gas sponsorship. Request access or join the allowlist, then retry.${metaSuffix}${debugSuffix}`,
        )
      }
      if (reason.includes('allowlist unavailable')) {
        throw new Error(`Paymaster allowlist is unavailable. Please retry shortly.${metaSuffix}${debugSuffix}`)
      }
      if (reason.includes('unsupported chainid')) {
        throw new Error(`Paymaster rejected this chain. Switch to Base mainnet and retry.${metaSuffix}${debugSuffix}`)
      }
      if (reason.includes('unsupported entrypoint')) {
        throw new Error(`Paymaster rejected the EntryPoint version. Please retry.${metaSuffix}${debugSuffix}`)
      }
      throw new Error(`Paymaster rejected this request: ${reason}.${metaSuffix}${debugSuffix}`)
    }
    if (isPaymasterUnavailableError(lastError)) {
      if (typeof smartWalletBalance === 'bigint' && smartWalletBalance <= 0n) {
        throw new Error(
          'Paymaster unavailable and smart wallet has no ETH for fallback. ' +
            `Add ETH to the smart wallet or fix the paymaster configuration.${debugSuffix}`
        )
      }
      throw new Error(
        `Paymaster unavailable. Check CDP paymaster configuration, sponsorship limits, and allowlist, then retry.${metaSuffix}${debugSuffix}`
      )
    }
    if (isLikelyVerificationGasLimitError(errMsg)) {
      throw new Error(
        'Signature verification used more gas than estimated. ' +
        `This can happen with smart wallet signers (EIP-1271). Please try again.${debugSuffix}`
      )
    }
    if (lc.includes('aa41') || lc.includes('over paymasterverificationgaslimit')) {
      throw new Error(`Paymaster verification gas limit exceeded. Please try again.${debugSuffix}`)
    }
    if (lc.includes('banned opcode') || lc.includes('stake/unstake delay') || lc.includes('unstake delay too low')) {
      throw new Error(
        'Bundler rejected sponsored UserOp: paymaster stake/unstake delay too low. ' +
          `Retry with a funded smart wallet or contact support to fix paymaster stake.${debugSuffix}`
      )
    }
    
    throw new Error(`UserOperation failed: ${errMsg}${debugSuffix}`)
  }

  // Wait for on-chain confirmation with extended timeout
  if (!userOpHash) {
    throw new Error('UserOperation did not return a hash.')
  }

  if (!waitForOnChainReceipt) {
    clearAllPendingUserOpHashesForWallet(smartWallet)
    telemetryStatus = 'success'
    return {
      userOpHash,
      transactionHash: null,
    }
  }

  const receipt = await waitForUserOperationReceipt(bundlerClient, {
    hash: userOpHash, 
    timeout: 180_000 // 3 minutes for complex operations
  })
  ensureUserOperationSucceeded(receipt, 'ERC-4337 submission')
  if (AA_DEBUG) {
    logger.debug('[ERC-4337] UserOp receipt', {
      actualGasUsed: formatGasValue((receipt as any)?.actualGasUsed),
      actualGasCost: formatGasValue((receipt as any)?.actualGasCost),
      txHash: (receipt as any)?.receipt?.transactionHash,
    })
  }
  
  clearAllPendingUserOpHashesForWallet(smartWallet)
  telemetryStatus = 'success'
  return { 
    userOpHash, 
    transactionHash: receipt.receipt.transactionHash as Hex 
  }
  } catch (error) {
    telemetryStatus = isExpectedUserOpTimeoutError(error) ? 'timeout' : 'error'
    telemetryErrorCode = classifyUserOpErrorCode(error)
    throw error
  } finally {
    const ownerApprovalTelemetry = {
      approvalRunId: ownerApprovalContext?.approvalRunId ?? null,
      approvalStage: ownerApprovalContext?.stage ?? null,
      executionMode: ownerApprovalContext?.executionMode ?? null,
      approvalAttempt: ownerApprovalContext?.attempt ?? null,
    }
    recordUserOpTelemetry({
      status: telemetryStatus,
      durationMs: Math.max(0, Date.now() - submissionStartedAt),
      verificationGasLimit: telemetryVerificationGasLimit,
      paymasterMode: telemetryPaymasterMode,
      signatureMode: telemetrySignatureMode,
      ownerIsContract: telemetryOwnerIsContract,
      ...ownerApprovalTelemetry,
      errorCode: telemetryErrorCode,
    })
    if (ownerApprovalTelemetry.approvalRunId) {
      trackEvent('owner_approval_userop_lane', {
        runId: ownerApprovalTelemetry.approvalRunId,
        stage: ownerApprovalTelemetry.approvalStage,
        executionMode: ownerApprovalTelemetry.executionMode,
        attempt: ownerApprovalTelemetry.approvalAttempt,
        status: telemetryStatus,
        paymasterMode: telemetryPaymasterMode,
        signatureMode: telemetrySignatureMode,
        ownerIsContract: telemetryOwnerIsContract,
        verificationGasLimit: telemetryVerificationGasLimit,
        durationMs: Math.max(0, Date.now() - submissionStartedAt),
        errorCode: telemetryErrorCode,
      })
    }
  }
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error ?? 'Unknown error'))
}

async function readOnchainTransactionSucceeded(
  publicClient: PublicClientLike | undefined,
  txHash: Hex,
): Promise<boolean> {
  const client = publicClient as any
  if (!client || typeof client.getTransactionReceipt !== 'function') return false
  try {
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    return receipt?.status === 'success'
  } catch {
    return false
  }
}

async function readUserOperationReceipt(params: {
  bundlerClient: any
  publicClient?: PublicClientLike
  userOpHash: Hex
  perCheckTimeoutMs: number
}): Promise<unknown | null> {
  const { bundlerClient, publicClient, userOpHash, perCheckTimeoutMs } = params

  if (typeof bundlerClient?.getUserOperationReceipt === 'function') {
    try {
      return await withTimeout(
        bundlerClient.getUserOperationReceipt({ hash: userOpHash }),
        perCheckTimeoutMs,
        'eth_getUserOperationReceipt',
      )
    } catch {
      // fall through to public RPC
    }
  } else if (bundlerClient) {
    try {
      return await withTimeout(
        waitForUserOperationReceipt(bundlerClient, {
          hash: userOpHash,
          timeout: perCheckTimeoutMs,
        }),
        perCheckTimeoutMs,
        'waitForUserOperationReceipt poll',
      )
    } catch {
      // fall through
    }
  }

  const client = publicClient as any
  if (!client) return null
  if (typeof client.getUserOperationReceipt === 'function') {
    try {
      return await withTimeout(
        client.getUserOperationReceipt({ hash: userOpHash }),
        perCheckTimeoutMs,
        'publicClient.getUserOperationReceipt',
      )
    } catch {
      return null
    }
  }
  if (typeof client.request === 'function') {
    try {
      return await withTimeout(
        client.request({
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        }),
        perCheckTimeoutMs,
        'eth_getUserOperationReceipt',
      )
    } catch {
      return null
    }
  }
  return null
}

export async function pollUserOperationStatus(params: {
  bundlerClient: any
  userOpHash: Hex
  publicClient?: PublicClientLike
  options?: PollUserOperationStatusOptions
}): Promise<{ status: UserOpStatus; txHash?: Hex }> {
  const { bundlerClient, userOpHash, publicClient, options } = params
  const pollIntervalMs = options?.pollIntervalMs ?? USEROP_POLL_INTERVAL_MS
  const maxDurationMs = options?.maxDurationMs ?? USEROP_POLL_MAX_DURATION_MS
  const perCheckTimeoutMs = options?.perCheckTimeoutMs ?? USEROP_POLL_TIMEOUT_MS
  const startedAt = Date.now()
  let lastStatus: UserOpStatus | null = null

  const emitStatus = (status: UserOpStatus, txHash?: Hex) => {
    if (status === lastStatus && status === 'pending') return
    lastStatus = status
    options?.onStatusChange?.(status, txHash)
  }

  while (Date.now() - startedAt < maxDurationMs) {
    if (options?.signal?.aborted) {
      const aborted = new Error('UserOp status polling aborted')
      options?.onError?.(aborted)
      emitStatus('failed')
      return { status: 'failed' }
    }

    try {
      const receipt = await readUserOperationReceipt({
        bundlerClient,
        publicClient,
        userOpHash,
        perCheckTimeoutMs,
      })

      const txHash = extractUserOpReceiptTxHash(receipt)
      if (txHash) {
        try {
          ensureUserOperationSucceeded(receipt, 'ERC-4337 status poll')
          emitStatus('confirmed', txHash)
          return { status: 'confirmed', txHash }
        } catch (error) {
          const onchainOk = await readOnchainTransactionSucceeded(publicClient, txHash)
          if (onchainOk) {
            emitStatus('confirmed', txHash)
            return { status: 'confirmed', txHash }
          }
          const normalized = asError(error)
          options?.onError?.(normalized)
          emitStatus('failed')
          return { status: 'failed' }
        }
      }

      emitStatus('pending')
    } catch (error) {
      const msg = getErrorDiagnosticMessage(error).toLowerCase()
      const expectedPending =
        msg.includes('timed out') ||
        msg.includes('timeout') ||
        msg.includes('not found') ||
        msg.includes('pending')
      if (!expectedPending) {
        const normalized = asError(error)
        options?.onError?.(normalized)
        emitStatus('failed')
        return { status: 'failed' }
      }
      emitStatus('pending')
    }

    await delay(pollIntervalMs)
  }

  emitStatus('timeout')
  return { status: 'timeout' }
}

export async function pollCanonicalUserOpTransactionHash(params: {
  publicClient: PublicClientLike
  bundlerUrl: string
  userOpHash: Hex
  maxDurationMs?: number
  signal?: AbortSignal
  onStatusChange?: (status: UserOpStatus, txHash?: Hex) => void
}): Promise<Hex> {
  const normalizedBundlerUrl = normalizeUrl(params.bundlerUrl)
  // Prefer same-origin paymaster proxy for receipt polling (session + server-side CDP forward).
  const bundlerUrlForBundler = isPaymasterProxyUrl(normalizedBundlerUrl)
    ? normalizedBundlerUrl
    : resolveBundlerUrlForNonPaymaster(
        normalizedBundlerUrl,
        (import.meta.env as Record<string, string | undefined>)['VITE_CDP_BUNDLER_URL'],
      )
  const shouldSendSessionToBundler = isPaymasterProxyUrl(bundlerUrlForBundler)
  const bundlerClient = createBundlerClient({
    client: params.publicClient as any,
    dataSuffix: '0x',
    transport: http(bundlerUrlForBundler, {
      fetchOptions: {
        credentials: shouldSendSessionToBundler ? 'include' : 'omit',
      },
    }),
  })

  const result = await pollUserOperationStatus({
    bundlerClient,
    publicClient: params.publicClient,
    userOpHash: params.userOpHash,
    options: {
      maxDurationMs: params.maxDurationMs ?? 180_000,
      signal: params.signal,
      onStatusChange: params.onStatusChange,
    },
  })

  if (result.status === 'confirmed' && result.txHash) {
    return result.txHash
  }
  if (result.status === 'failed') {
    throw new Error('UserOperation failed during confirmation polling')
  }
  throw new Error('Timed out waiting for UserOperation confirmation')
}
