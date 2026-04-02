import type { Address, Hex } from 'viem'
import {
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  hashTypedData,
  http,
  isAddress,
  toHex,
} from 'viem'
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
import { trackEvent } from '@/lib/analytics'
import { apiFetch } from '@/lib/apiBase'
import { logger } from '@/lib/logger'
import { appendBuilderSuffixToHex, DATA_SUFFIX, isBaseChain } from '@/lib/baseBuilderCodes'

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
const UNIVERSAL_ROUTER_EXECUTE_SELECTOR = '0x3593564c' as const
const UNIVERSAL_ROUTER_BASE_CURRENT = getAddress('0x6ff5693b99212da76ad316178a184ab56d299b43').toLowerCase()
const UNIVERSAL_ROUTER_BASE_LEGACY = getAddress('0x2626664c2603336e57b271c5c0b26f421741e481').toLowerCase()
const UNISWAP_UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

function isUniversalRouterTarget(to: Address): boolean {
  const target = String(to).toLowerCase()
  return target === UNIVERSAL_ROUTER_BASE_CURRENT || target === UNIVERSAL_ROUTER_BASE_LEGACY
}

function stripKnownBuilderDataSuffix(data: Hex | undefined, dataSuffix: Hex | undefined): Hex | undefined {
  if (!data || data === '0x' || !dataSuffix) return data
  const payload = data.slice(2)
  const suffix = dataSuffix.slice(2)
  if (!suffix) return data
  if (payload.length <= suffix.length) return data
  if (!payload.toLowerCase().endsWith(suffix.toLowerCase())) return data
  return `0x${payload.slice(0, payload.length - suffix.length)}` as Hex
}

function canonicalizeUniversalRouterExecuteCalldata(data: Hex | undefined): Hex | undefined {
  if (!data || data === '0x') return data
  if (!data.toLowerCase().startsWith(UNIVERSAL_ROUTER_EXECUTE_SELECTOR)) return data

  try {
    const decoded = decodeFunctionData({
      abi: UNISWAP_UNIVERSAL_ROUTER_ABI,
      data,
    })
    if (decoded.functionName !== 'execute') return data
    return encodeFunctionData({
      abi: UNISWAP_UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: decoded.args,
    })
  } catch {
    // If decode fails, preserve original payload rather than mutating semantics.
    return data
  }
}

export function applyBuilderDataSuffixToCalls(
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>,
  chainId: number,
  dataSuffix: Hex | undefined = DATA_SUFFIX,
): Array<{ to: Address; value?: bigint; data?: Hex }> {
  if (!dataSuffix || !isBaseChain(chainId)) return calls

  return calls.map((c) => {
    if (isUniversalRouterTarget(c.to)) {
      const cleanedData = stripKnownBuilderDataSuffix(c.data, dataSuffix)
      const candidateData = canonicalizeUniversalRouterExecuteCalldata(cleanedData ?? c.data)
      const isCanonical =
        !!candidateData &&
        candidateData !== '0x' &&
        candidateData.toLowerCase().startsWith(UNIVERSAL_ROUTER_EXECUTE_SELECTOR)

      if (AA_DEBUG) {
        logger.debug('[Builder] Universal Router call detected', {
          target: c.to,
          originalDataPrefix: String(c.data ?? '').slice(0, 30),
          cleanedDataPrefix: cleanedData?.slice(0, 30) ?? 'none',
          willPreserveCanonical: isCanonical,
        })
      }

      if (isCanonical) {
        if (AA_DEBUG) logger.info('[Builder] Preserving canonical Universal Router calldata (no suffix)')
      } else if (AA_DEBUG) {
        logger.warn('[Builder] Universal Router calldata is non-canonical; preserving without suffix mutation', {
          target: c.to,
          cleanedDataPrefix: cleanedData?.slice(0, 30) ?? 'none',
        })
      }

      // Never append builder suffix to Universal Router calls.
      return {
        ...c,
        data: candidateData ?? cleanedData ?? c.data,
      }
    }

    return {
      ...c,
      data: appendBuilderSuffixToHex(c.data, { chainId, dataSuffix }),
    }
  })
}

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
  chain: { id: number }
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
  if (import.meta.env.VITE_DEBUG_LOGS === 'true') return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug') === 'true'
  } catch {
    return false
  }
}

const AA_DEBUG = isDebugEnabled()
const USEROP_TELEMETRY_BATCH_SIZE = 20
const USEROP_TELEMETRY_FLUSH_INTERVAL_MS = 60_000
const USEROP_TELEMETRY_SAMPLE_RATE = 0.2
const USEROP_TELEMETRY_SLOW_MS = 2_500

type UserOpTelemetrySample = {
  status: 'success' | 'error' | 'timeout'
  durationMs: number
  verificationGasLimit: string | null
  paymasterMode: 'sponsored' | 'self_funded' | 'fallback_to_self_funded'
  signatureMode: 'eth_sign' | 'signMessage' | 'auto'
  ownerIsContract: boolean
}

const userOpTelemetrySamples: UserOpTelemetrySample[] = []
let userOpTelemetryLastFlushAt = 0

function isUserOpTelemetryEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.VITE_USEROP_TELEMETRY === 'true') return true
  if (import.meta.env.PROD) return true
  try {
    return window.localStorage.getItem('cv:debug:userop-telemetry') === 'true'
  } catch {
    return false
  }
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((p / 100) * sorted.length)
  const index = Math.max(0, Math.min(sorted.length - 1, rank - 1))
  return sorted[index] ?? null
}

function flushUserOpTelemetry(reason: 'batch' | 'interval' | 'timeout'): void {
  if (typeof window === 'undefined') return
  if (userOpTelemetrySamples.length === 0) return

  const samples = userOpTelemetrySamples.splice(0, userOpTelemetrySamples.length)
  userOpTelemetryLastFlushAt = Date.now()

  const durations = samples.map((sample) => sample.durationMs)
  const timeoutCount = samples.filter((sample) => sample.status === 'timeout').length
  const errorCount = samples.filter((sample) => sample.status === 'error').length
  const successCount = samples.length - timeoutCount - errorCount

  const signatureModes = {
    eth_sign: samples.filter((sample) => sample.signatureMode === 'eth_sign').length,
    signMessage: samples.filter((sample) => sample.signatureMode === 'signMessage').length,
    auto: samples.filter((sample) => sample.signatureMode === 'auto').length,
  }

  const paymasterUsage = {
    sponsored: samples.filter((sample) => sample.paymasterMode === 'sponsored').length,
    selfFunded: samples.filter((sample) => sample.paymasterMode === 'self_funded').length,
    fallbackToSelfFunded: samples.filter((sample) => sample.paymasterMode === 'fallback_to_self_funded').length,
  }

  const ownerType = {
    contract: samples.filter((sample) => sample.ownerIsContract).length,
    eoa: samples.filter((sample) => !sample.ownerIsContract).length,
  }

  const verificationGasLimitUsed = Object.fromEntries(
    [...new Set(samples.map((sample) => sample.verificationGasLimit ?? 'unknown'))].map((limit) => [
      limit,
      samples.filter((sample) => (sample.verificationGasLimit ?? 'unknown') === limit).length,
    ]),
  )

  const payload = {
    source: 'coinbaseErc4337',
    reason,
    sampleCount: samples.length,
    successCount,
    errorCount,
    timeoutCount,
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    signatureModes,
    paymasterUsage,
    ownerType,
    verificationGasLimitUsed,
  }

  trackEvent('xmtp_userop_submission_batch', payload)
  void apiFetch('/api/v1/chat/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'xmtp_userop_submission_batch',
      ...payload,
    }),
  }).catch(() => undefined)

  if (AA_DEBUG) logger.debug('[ERC-4337] UserOp telemetry batch', payload)
}

function recordUserOpTelemetry(sample: UserOpTelemetrySample): void {
  if (!isUserOpTelemetryEnabled()) return
  const interestingSample =
    sample.status !== 'success' || sample.durationMs >= USEROP_TELEMETRY_SLOW_MS
  const shouldSample = interestingSample || Math.random() < USEROP_TELEMETRY_SAMPLE_RATE
  if (!shouldSample) return

  userOpTelemetrySamples.push(sample)
  const now = Date.now()
  const shouldFlushByInterval =
    userOpTelemetryLastFlushAt > 0 &&
    now - userOpTelemetryLastFlushAt >= USEROP_TELEMETRY_FLUSH_INTERVAL_MS

  if (sample.status === 'timeout') {
    flushUserOpTelemetry('timeout')
    return
  }
  if (userOpTelemetrySamples.length >= USEROP_TELEMETRY_BATCH_SIZE) {
    flushUserOpTelemetry('batch')
    return
  }
  if (shouldFlushByInterval) flushUserOpTelemetry('interval')
}

const PAYMASTER_DEBUG_HEADER_ENABLED =
  String((import.meta.env as Record<string, string | undefined>).VITE_PAYMASTER_DEBUG ?? '')
    .trim()
    .toLowerCase() === '1' ||
  String((import.meta.env as Record<string, string | undefined>).VITE_PAYMASTER_DEBUG ?? '')
    .trim()
    .toLowerCase() === 'true' ||
  AA_DEBUG

function normalizeUrl(value: string): string {
  const v = value.trim()
  if (!v) return v
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined
    const u = base ? new URL(v, base) : new URL(v)
    return u.toString()
  } catch {
    return v
  }
}

function isSameOriginUrl(value: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const u = new URL(value, window.location.origin)
    return u.origin === window.location.origin
  } catch {
    return false
  }
}

function isPaymasterProxyUrl(value: string): boolean {
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : undefined
    const u = base ? new URL(value, base) : new URL(value)
    return u.pathname === '/api/paymaster'
  } catch {
    return false
  }
}

function resolveBundlerUrlForNonPaymaster(bundlerUrl: string): string {
  const envBundler = (import.meta.env as Record<string, string | undefined>)['VITE_CDP_BUNDLER_URL']
  if (!envBundler?.trim()) return bundlerUrl
  if (!isPaymasterProxyUrl(bundlerUrl)) return bundlerUrl
  return normalizeUrl(envBundler)
}

const HEX_STRING_RE = /^0x[0-9a-fA-F]+$/

function formatGasValue(value: unknown): string | null {
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'number') return Math.trunc(value).toString()
  if (typeof value === 'string') return value
  return null
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

// Known error selectors for decoding revert reasons
const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  '0x08c379a0': 'Error(string)',
  '0x4e487b71': 'Panic(uint256)',
  // Coinbase Smart Wallet errors
  '0x82b42900': 'Unauthorized()',
  // Deployment-batcher errors
  '0x30cd7471': 'NotOwner()',
  '0xd92e233d': 'ZeroAddress()',
  '0xb92e9c7a': 'InvalidPercent()',
  '0x1375159e': 'InvalidCodeId()',
  '0x02058db0': 'Phase1Missing()',
  '0x7c604444': 'Phase1CoreMissing()',
  '0x8d8721fc': 'Phase1StateMismatch()',
  '0x585b9263': 'InvalidWeight()',
  '0xe10fdfee': 'V3PoolMissing()',
  '0x24c0a9e0': 'MissingInitialSqrtPriceX96()',
  '0x18b789e6': 'AuctionAlreadyPending()',
  '0x0fd83a8b': 'NoPendingAuction()',
  '0x56a694d2': 'AuctionShareOFTMismatch()',
  '0x8284e8bf': 'AuctionAmountMismatch()',
  '0xf79c143b': 'Phase2Missing()',
  // UniversalCreate2DeployerFromStore
  '0xb4f54111': 'DeployFailed()',
}

function extractRevertInfo(e: unknown): { error: string; revertData?: Hex; errorName?: string } {
  const errAny = e as any
  const msg = e instanceof Error ? e.message : String(e ?? '')
  const result: { error: string; revertData?: Hex; errorName?: string } = { error: msg }
  
  // Extract revert data from various error structures
  const revertData = errAny?.cause?.cause?.data ?? errAny?.cause?.data ?? errAny?.data
  if (revertData && typeof revertData === 'string' && revertData.startsWith('0x')) {
    result.revertData = revertData as Hex
    const selector = revertData.slice(0, 10).toLowerCase()
    if (KNOWN_ERROR_SELECTORS[selector]) {
      result.errorName = KNOWN_ERROR_SELECTORS[selector]
    }
  }
  
  // Extract error reason from viem's parsed errors
  if (errAny?.cause?.reason) result.error = errAny.cause.reason
  if (errAny?.shortMessage) result.error = errAny.shortMessage
  
  return result
}

function isLikelyVerificationGasLimitError(message: string): boolean {
  const lc = message.toLowerCase()
  return (
    lc.includes('aa40') ||
    lc.includes('signature verification used more gas') ||
    lc.includes('over verificationgaslimit') ||
    lc.includes('over verification gas limit')
  )
}

async function logUserOpEstimate(params: {
  bundlerClient: any
  account: any
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
  verificationGasLimit: bigint
  paymasterClient?: { getPaymasterData: any; getPaymasterStubData: any }
}) {
  if (!AA_DEBUG) return
  const { bundlerClient, account, calls, verificationGasLimit, paymasterClient } = params
  const client: any = bundlerClient as any
  if (typeof client?.prepareUserOperation !== 'function') {
    logger.debug('[ERC-4337] estimateUserOperationGas unavailable', { reason: 'prepareUserOperation not supported' })
    return
  }
  const originalAccount = client.account
  if (!originalAccount) {
    client.account = account
  }
  try {
    const paymaster =
      paymasterClient && paymasterClient.getPaymasterData && paymasterClient.getPaymasterStubData
        ? {
            getPaymasterData: paymasterClient.getPaymasterData,
            getPaymasterStubData: paymasterClient.getPaymasterStubData,
          }
        : undefined
    const prepared = await client.prepareUserOperation({
      account,
      calls,
      verificationGasLimit,
      ...(paymaster ? { paymaster } : {}),
    })
    const userOperation = prepared?.userOperation ?? prepared
    let estimate: any = null
    if (typeof client?.estimateUserOperationGas === 'function') {
      estimate = await client.estimateUserOperationGas({ userOperation, entryPoint: ENTRYPOINT_V06 })
    } else if (typeof client?.request === 'function') {
      estimate = await client.request({
        method: 'eth_estimateUserOperationGas',
        params: [userOperation, ENTRYPOINT_V06],
      })
    }
    if (estimate) {
      logger.debug('[ERC-4337] estimateUserOperationGas', formatGasEstimate(estimate))
    }
  } catch (e: unknown) {
    const revertInfo = extractRevertInfo(e)
    const lowerError = String(revertInfo.error ?? '').toLowerCase()
    if (lowerError.includes('could not find an account to execute')) {
      logger.debug('[ERC-4337] estimateUserOperationGas skipped', {
        reason: 'Missing local account context in debug pre-estimate path',
      })
      return
    }
    const errDetails: Record<string, unknown> = { 
      error: revertInfo.error,
      revertData: revertInfo.revertData,
      errorName: revertInfo.errorName,
    }
    // Also include metaMessages if available (viem often includes helpful context)
    const errAny = e as any
    if (errAny?.metaMessages) errDetails.metaMessages = errAny.metaMessages
    logger.debug('[ERC-4337] estimateUserOperationGas failed', errDetails)
  } finally {
    if (!originalAccount) {
      delete client.account
    } else {
      client.account = originalAccount
    }
  }
}

function isHexString(value: unknown): value is Hex {
  return typeof value === 'string' && HEX_STRING_RE.test(value)
}

function getHexByteLength(hex: string): number | null {
  if (!hex.startsWith('0x')) return null
  const body = hex.slice(2)
  if (body.length % 2 !== 0) return null
  return body.length / 2
}

function signatureMeta(signature: Hex) {
  const byteLength = getHexByteLength(signature)
  return {
    signatureLength: signature.length,
    byteLength,
    is64Bytes: byteLength === 64,
    is65Bytes: byteLength === 65,
  }
}

function isPaymasterStakeError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return (
    lc.includes('banned opcode') ||
    lc.includes('stake/unstake delay') ||
    lc.includes('entity stake') ||
    lc.includes('unstake delay too low')
  )
}

function getErrorDiagnosticMessage(error: unknown): string {
  const err = error as any
  const parts: string[] = []
  const push = (value: unknown) => {
    if (typeof value !== 'string') return
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (!normalized) return
    parts.push(normalized)
  }

  push(err?.message)
  push(err?.shortMessage)
  push(err?.details)
  push(err?.cause?.message)
  push(err?.cause?.shortMessage)
  push(err?.cause?.details)

  const appendMetaMessages = (meta: unknown) => {
    if (!Array.isArray(meta)) return
    for (const entry of meta) {
      if (typeof entry === 'string') {
        push(entry)
      } else {
        try {
          push(JSON.stringify(entry))
        } catch {
          // ignore non-serializable entries
        }
      }
    }
  }

  appendMetaMessages(err?.metaMessages)
  appendMetaMessages(err?.cause?.metaMessages)

  const deduped: string[] = []
  for (const item of parts) {
    if (!deduped.includes(item)) deduped.push(item)
  }
  if (deduped.length === 0) {
    return error instanceof Error ? error.message : String(error ?? '')
  }
  return deduped.join(' | ')
}

function getRpcErrorDetails(error: unknown): string | null {
  const err = error as any
  const details = typeof err?.details === 'string' ? err.details.trim() : ''
  if (details) return details
  const causeDetails = typeof err?.cause?.details === 'string' ? err.cause.details.trim() : ''
  return causeDetails || null
}

function ensureUserOperationSucceeded(receipt: unknown, context: string): void {
  const r = receipt as any
  const success = r?.success
  const txStatus = r?.receipt?.status
  const reason =
    (typeof r?.reason === 'string' && r.reason) ||
    (typeof r?.revertReason === 'string' && r.revertReason) ||
    (typeof r?.error === 'string' && r.error) ||
    null

  const txReverted =
    txStatus === 'reverted' ||
    txStatus === 0 ||
    txStatus === '0x0' ||
    txStatus === false

  // Bundlers can return a transaction hash even when the specific UserOp reverted.
  // Guard phase progression on UserOp-level success, not just tx inclusion.
  if (success === false || txReverted) {
    const reasonSuffix = reason ? ` Reason: ${reason}` : ''
    throw new Error(`UserOperation reverted during ${context}.${reasonSuffix}`)
  }
}

function isPaymasterUnavailableError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  // NOTE: Do NOT match generic viem wrapper text like 'resource not available' /
  // 'requested resource not available'. Viem uses that shortMessage for ALL -32002
  // JSON-RPC errors, so matching it would misclassify upstream CDP policy rejections
  // as "paymaster unavailable" and trigger unwanted no-paymaster fallback.
  // Only match our own specific error strings that indicate genuine unavailability.
  return (
    lc.includes('cdp paymaster endpoint is not configured') ||
    lc.includes('server misconfigured') ||
    lc.includes('upstream request failed') ||
    lc.includes('method not allowed')
  )
}

function isPaymasterPolicyError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return lc.includes('request denied') || lc.includes('not authenticated')
}

function isPaymasterAuthPolicyError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return (
    lc.includes('request denied - no_session') ||
    lc.includes('request denied - not authenticated') ||
    lc.includes('not authenticated') ||
    lc.includes('session expired')
  )
}

function isPaymasterRoutingPolicyError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  return lc.includes('unsupported chainid') || lc.includes('unsupported entrypoint')
}

function formatMetaMessages(error: unknown): string | null {
  const meta = (error as any)?.metaMessages
  if (!Array.isArray(meta) || meta.length === 0) return null
  const messages = meta
    .map((m) => (typeof m === 'string' ? m : JSON.stringify(m)))
    .map((m) => String(m).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (messages.length === 0) return null
  const limited = messages.slice(0, 3)
  return limited.join(' | ') + (messages.length > limited.length ? ' | ...' : '')
}

const TRANSIENT_USER_OP_RETRY_DELAYS_MS = [250, 750, 1500] as const

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTransientUserOpSubmissionError(error: unknown): boolean {
  if (isUserRejection(error)) return false
  const msg = getErrorDiagnosticMessage(error)
  const lc = msg.toLowerCase()
  const code = (error as any)?.code
  if (code === -32016 || code === -32011 || code === 429) return true
  return (
    lc.includes('429') ||
    lc.includes('too many requests') ||
    lc.includes('over rate limit') ||
    lc.includes('rate limit') ||
    lc.includes('resource not available') ||
    lc.includes('temporarily unavailable') ||
    lc.includes('no backend is currently healthy') ||
    lc.includes('gateway timeout') ||
    lc.includes('request timeout') ||
    lc.includes('network error') ||
    lc.includes('failed to fetch')
  )
}

function isExpectedUserOpTimeoutError(error: unknown): boolean {
  const msg = getErrorDiagnosticMessage(error).toLowerCase()
  if (!msg) return false
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('request took too long') ||
    msg.includes('gateway timeout')
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

function isUserOpHashLike(value: unknown): boolean {
  return isHexString(value) && value.length === 66
}

type SignatureExtraction = { signature: Hex | null; source: string | null }

function extractSignatureHex(value: unknown, depth = 0): SignatureExtraction {
  if (isHexString(value)) {
    return { signature: value as Hex, source: depth === 0 ? 'string' : `nested.${depth}` }
  }
  if (!value || typeof value !== 'object' || depth > 2) {
    return { signature: null, source: null }
  }
  const record = value as Record<string, unknown>
  const direct = record.signature ?? record.sig
  if (isHexString(direct)) {
    return { signature: direct as Hex, source: 'object.signature' }
  }
  const candidates: Array<[string, unknown]> = [
    ['data', record.data],
    ['result', record.result],
    ['response', record.response],
    ['signature', record.signature],
    ['sig', record.sig],
  ]
  for (const [key, candidate] of candidates) {
    if (isHexString(candidate)) {
      return { signature: candidate as Hex, source: `object.${key}` }
    }
    if (candidate && typeof candidate === 'object') {
      const nested = extractSignatureHex(candidate, depth + 1)
      if (nested.signature) {
        return { signature: nested.signature, source: `object.${key}.${nested.source ?? 'nested'}` }
      }
    }
  }
  return { signature: null, source: null }
}

function ensureSignatureHex(value: unknown, context: string): Hex {
  const { signature, source } = extractSignatureHex(value)
  if (!signature) {
    throw new Error(`Invalid signature returned from ${context}`)
  }
  debugSignature(context, signature, source)
  return signature
}

export function runSignatureExtractionHarness() {
  const sig65 = `0x${'11'.repeat(65)}`
  const sig64 = `0x${'22'.repeat(64)}`
  const cases = [
    { name: 'raw string', input: sig65 },
    { name: 'object signature', input: { signature: sig65, encoding: 'hex' } },
    { name: 'nested data signature', input: { data: { signature: sig65 } } },
    { name: 'nested result signature (64-byte)', input: { result: { signature: sig64 } } },
  ]
  return cases.map((t) => {
    const { signature, source } = extractSignatureHex(t.input)
    const meta = signature ? signatureMeta(signature) : null
    return {
      name: t.name,
      ok: Boolean(signature),
      source,
      signatureLength: meta?.signatureLength ?? null,
      byteLength: meta?.byteLength ?? null,
    }
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

const COINBASE_SMART_WALLET_OWNERS_ABI = [
  {
    type: 'function',
    name: 'ownerCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

const OWNER_INDEX_CACHE_TTL_MS = 5 * 60_000

type OwnerIndexCacheEntry = {
  ownerIndex: number
  ownerCountSnapshot: number
  expiresAt: number
}

const OWNER_INDEX_CACHE = new Map<string, OwnerIndexCacheEntry>()

function getOwnerIndexCacheKey(params: {
  chainId: number
  smartWallet: Address
  ownerAddress: Address
}): string {
  return `${params.chainId}:${params.smartWallet.toLowerCase()}:${params.ownerAddress.toLowerCase()}`
}

export function resetOwnerIndexCacheForTests(): void {
  OWNER_INDEX_CACHE.clear()
}

function asOwnerBytes(owner: Address): Hex {
  // Coinbase Smart Wallet stores EOA owners as 32-byte left-padded address bytes.
  return encodeAbiParameters([{ type: 'address' }], [owner]) as Hex
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

export async function findCoinbaseSmartWalletOwnerIndex(params: {
  publicClient: PublicClientLike
  smartWallet: Address
  ownerAddress: Address
  maxScan?: number
  useCache?: boolean
}): Promise<{ ownerIndex: number | null; ownerCount: number }> {
  const { publicClient, smartWallet, ownerAddress, maxScan = 256, useCache = true } = params
  const chainId = Number((publicClient as any)?.chain?.id ?? 0)
  const cacheKey = getOwnerIndexCacheKey({ chainId, smartWallet, ownerAddress })
  if (!useCache) OWNER_INDEX_CACHE.delete(cacheKey)

  const countRaw = (await withTimeout(
    publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'ownerCount',
    }),
    RPC_READ_TIMEOUT_MS,
    'ownerCount read',
  )) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) {
    OWNER_INDEX_CACHE.delete(cacheKey)
    return { ownerIndex: null, ownerCount: 0 }
  }

  const scanLimit = Math.max(1, maxScan)
  if (useCache) {
    const cached = OWNER_INDEX_CACHE.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.ownerCountSnapshot === count && cached.ownerIndex >= 0 && cached.ownerIndex < scanLimit) {
        return { ownerIndex: cached.ownerIndex, ownerCount: count }
      }
      OWNER_INDEX_CACHE.delete(cacheKey)
    }
  }

  // Use nextOwnerIndex when available to avoid missing owners after removals.
  let upperBound = count
  try {
    const nextRaw = (await withTimeout(
      publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'nextOwnerIndex',
      }),
      RPC_READ_TIMEOUT_MS,
      'nextOwnerIndex read',
    )) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // ignore; fallback to ownerCount
  }

  const expected = asOwnerBytes(ownerAddress).toLowerCase()
  const limit = Math.min(upperBound, scanLimit)
  for (let i = 0; i < limit; i++) {
    const b = (await withTimeout(
      publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      }),
      RPC_READ_TIMEOUT_MS,
      `ownerAtIndex(${i}) read`,
    )) as Hex
    if (String(b).toLowerCase() === expected) {
      if (useCache) {
        OWNER_INDEX_CACHE.set(cacheKey, {
          ownerIndex: i,
          ownerCountSnapshot: count,
          expiresAt: Date.now() + OWNER_INDEX_CACHE_TTL_MS,
        })
      }
      return { ownerIndex: i, ownerCount: count }
    }
  }
  OWNER_INDEX_CACHE.delete(cacheKey)
  return { ownerIndex: null, ownerCount: count }
}

export async function fetchCoinbaseSmartWalletOwners(params: {
  publicClient: PublicClientLike
  smartWallet: Address
  maxOwners?: number
}): Promise<Address[]> {
  const { publicClient, smartWallet, maxOwners = 32 } = params
  const countRaw = (await publicClient.readContract({
    address: smartWallet,
    abi: COINBASE_SMART_WALLET_OWNERS_ABI,
    functionName: 'ownerCount',
  })) as bigint
  const count = Number(countRaw)
  if (!Number.isFinite(count) || count <= 0) return []

  let upperBound = count
  try {
    const nextRaw = (await publicClient.readContract({
      address: smartWallet,
      abi: COINBASE_SMART_WALLET_OWNERS_ABI,
      functionName: 'nextOwnerIndex',
    })) as bigint
    const next = Number(nextRaw)
    if (Number.isFinite(next) && next > 0) upperBound = next
  } catch {
    // ignore; fallback to ownerCount
  }

  const limit = Math.min(upperBound, Math.max(1, maxOwners))
  const owners: Address[] = []
  for (let i = 0; i < limit; i += 1) {
    try {
      const raw = (await publicClient.readContract({
        address: smartWallet,
        abi: COINBASE_SMART_WALLET_OWNERS_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as `0x${string}`
      const decoded = decodeAbiParameters([{ type: 'address' }], raw)[0] as string
      if (!isAddress(decoded)) continue
      const addr = getAddress(decoded)
      if (addr === getAddress('0x0000000000000000000000000000000000000000')) continue
      if (!owners.includes(addr)) owners.push(addr)
    } catch {
      continue
    }
  }
  return owners
}

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
          const sig = ensureSignatureHex(rawSig, 'eth_sign')
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
          const sig = ensureSignatureHex(rawSig, 'signMessage')
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
      return ensureSignatureHex(rawSig, 'signMessage')
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
      return ensureSignatureHex(rawSig, 'signTypedData')
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
  if (calls.length === 1 && calls[0].data && typeof client?.call === 'function') {
    const call = calls[0]
    try {
      await client.call({
        to: call.to,
        data: call.data,
        value: call.value ?? 0n,
        account: smartWallet, // Simulate as if smart wallet is the caller
      })
      directCallResult = { success: true }
    } catch (e: unknown) {
      directCallResult = { success: false, ...extractRevertInfo(e) }
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
      const call = calls[0]
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
    
    return { success: true, directCallResult }
  } catch (e: unknown) {
    const revertInfo = extractRevertInfo(e)

    const unauthorizedExecute =
      revertInfo.errorName === 'Unauthorized()' ||
      /unauthorized/i.test(String(revertInfo.error ?? ''))

    // execute/executeBatch simulation is not routed through EntryPoint, so
    // Unauthorized can be expected even when real ERC-4337 execution succeeds.
    if (unauthorizedExecute) {
      if (directCallResult && !directCallResult.success) {
        return {
          success: false,
          error: directCallResult.error,
          revertData: directCallResult.revertData,
          errorName: directCallResult.errorName,
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
  return ensureSignatureHex(rawSig, 'signTypedData (CSW EIP-712)')
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
}): Promise<{ userOpHash: Hex; transactionHash: Hex }> {
  const {
    publicClient,
    walletClient,
    bundlerUrl: bundlerUrlInput,
    paymasterUrl: paymasterUrlInput,
    smartWallet,
    ownerAddress,
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
  } = params

  const submissionStartedAt = Date.now()
  let telemetryStatus: UserOpTelemetrySample['status'] = 'error'
  let telemetryVerificationGasLimit: string | null = null
  let telemetryPaymasterMode: UserOpTelemetrySample['paymasterMode'] = skipPaymaster
    ? 'self_funded'
    : 'sponsored'
  let telemetrySignatureMode: UserOpTelemetrySample['signatureMode'] = userOpSignMode
  let telemetryOwnerIsContract = typeof ownerIsContractOverride === 'boolean' ? ownerIsContractOverride : false

  try {
  // Input validation
  if (!bundlerUrlInput) throw new Error('Missing bundler URL')
  if (!smartWallet) throw new Error('Missing smart wallet address')
  if (!ownerAddress) throw new Error('Missing owner address')
  if (!publicClient) throw new Error('Missing public client')
  if (!walletClient) throw new Error('Missing wallet client')
  if (!calls || calls.length === 0) throw new Error('No calls provided')
  const chainId = (publicClient as any).chain?.id ?? 8453
  const attributedCalls = applyBuilderDataSuffixToCalls(calls, chainId)

  const normalizedBundlerUrl = normalizeUrl(bundlerUrlInput)
  const paymasterUrl = normalizeUrl(paymasterUrlInput ?? bundlerUrlInput)
  let bundlerUrlForBundler = resolveBundlerUrlForNonPaymaster(normalizedBundlerUrl)
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

  // Pre-flight simulation: check if the underlying call would succeed
  // This helps diagnose contract-level reverts vs ERC-4337 issues
  if (!skipPreflightSimulation && AA_DEBUG) {
    void simulateSmartWalletCalls({ publicClient, smartWallet, calls: attributedCalls })
      .then((simResult) => {
        if (!simResult.success) {
          logger.warn('[ERC-4337] Pre-flight simulation FAILED - underlying call would revert', {
            smartWallet,
            callCount: calls.length,
            error: simResult.error,
            revertData: simResult.revertData,
            errorName: simResult.errorName,
            firstCallTo: attributedCalls[0]?.to,
            firstCallData: attributedCalls[0]?.data?.slice(0, 10), // Just selector
          })
          return
        }
        logger.debug('[ERC-4337] Pre-flight simulation passed', {
          smartWallet,
          callCount: attributedCalls.length,
        })
      })
      .catch((error: unknown) => {
        if (AA_DEBUG) {
          const msg = error instanceof Error ? error.message : String(error ?? '')
          logger.debug('[ERC-4337] Pre-flight simulation failed unexpectedly', {
            smartWallet,
            error: msg,
          })
        }
      })
  }

  const ownerIndexOverride =
    Number.isInteger(ownerIndexOverrideRaw) && Number(ownerIndexOverrideRaw) >= 0
      ? Math.floor(Number(ownerIndexOverrideRaw))
      : null

  // Find owner index
  let ownerIndex: number | null = ownerIndexOverride
  let ownerCount = 0
  if (ownerIndexOverride === null) {
    const ownerLookup = await findCoinbaseSmartWalletOwnerIndex({
      publicClient,
      smartWallet,
      ownerAddress,
      useCache: !bypassOwnerIndexCache,
    })
    ownerIndex = ownerLookup.ownerIndex
    ownerCount = ownerLookup.ownerCount
    if (AA_DEBUG) {
      logger.debug('[ERC-4337] Owner index lookup', {
        smartWallet,
        ownerAddress,
        ownerIndex,
        ownerCount,
      })
    }
  } else if (AA_DEBUG) {
    logger.debug('[ERC-4337] Owner index override', {
      smartWallet,
      ownerAddress,
      ownerIndex: ownerIndexOverride,
    })
  }

  if (ownerIndex === null) {
    const ownerLooksLikeSmartWallet = ownerAddress.toLowerCase() === smartWallet.toLowerCase()
    const maxProbeOwners = 16
    const probeOwnerCount = Math.min(ownerCount, maxProbeOwners)
    if (ownerLooksLikeSmartWallet && probeOwnerCount > 0) {
      let lastSignatureMismatch: unknown = null
      for (let probeIndex = 0; probeIndex < probeOwnerCount; probeIndex += 1) {
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
            probeMsg.includes('userop signature verification failed')
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
      `Connected wallet (${ownerAddress}) is not an onchain owner of the smart wallet (${smartWallet}). ` +
      'Add this wallet as an owner first, or connect with a wallet that is already an owner.'
    )
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
    const headers: Record<string, string> = {
      ...(sendSession && sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(sendSession && options.includeDebug && PAYMASTER_DEBUG_HEADER_ENABLED ? { 'X-CV-Paymaster-Debug': '1' } : {}),
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
  const sendWithVerificationGasLimit = async (verificationGasLimit: bigint, usePaymaster: boolean) => {
    await logUserOpEstimate({
      bundlerClient,
      account,
      calls: attributedCalls,
      verificationGasLimit,
      paymasterClient: usePaymaster ? paymasterClient : undefined,
    })
    return await sendUserOperation(bundlerClient, {
      account,
      calls: attributedCalls,
      verificationGasLimit,
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
      const limit = uniqueVerificationGasLimits[i]
      try {
        let sent = false
        const maxTransientAttempts = 1 + TRANSIENT_USER_OP_RETRY_DELAYS_MS.length
        for (let transientAttempt = 0; transientAttempt < maxTransientAttempts; transientAttempt += 1) {
          try {
            userOpHash = await sendWithVerificationGasLimit(limit, usePaymaster)
            sent = true
            break
          } catch (e: unknown) {
            lastError = e
            const hasNextTransientAttempt = transientAttempt < TRANSIENT_USER_OP_RETRY_DELAYS_MS.length
            if (!hasNextTransientAttempt || !isTransientUserOpSubmissionError(e)) {
              break
            }
            const retryInMs = TRANSIENT_USER_OP_RETRY_DELAYS_MS[transientAttempt] ?? 0
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
    await attemptSend(false)
  }

  if (lastError) {
    const errMsg = getErrorDiagnosticMessage(lastError)
    const lc = errMsg.toLowerCase()
    const isExpectedTimeoutFailure = isExpectedUserOpTimeoutError(lastError)
    const errorDetails = getRpcErrorDetails(lastError)
    const metaDetail = formatMetaMessages(lastError)
    const metaSuffix = metaDetail ? ` (CDP: ${metaDetail})` : ''
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
        console.error('[ERC-4337] UserOp failed', logPayload)
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
          'Add ETH to the canonical CSW or enable gas sponsorship.'
      )
    }
    if (lc.includes('insufficient funds') || lc.includes('insufficient balance')) {
      throw new Error('Paymaster rejected: insufficient sponsorship funds. Contact support.')
    }
    if (lc.includes('max sponsorship cost') || lc.includes('sponsorship cost per user op exceeded')) {
      // Extract the cost and limit from the error if possible
      const costMatch = errMsg.match(/(\d+\.?\d*)\s*USD.*limit:\s*(\d+\.?\d*)\s*USD/i)
      if (costMatch) {
        throw new Error(
          `Gas sponsorship limit exceeded: this operation costs $${costMatch[1]} but the limit is $${costMatch[2]}. ` +
          'Increase your per-UserOp limit in the CDP Dashboard (portal.cdp.coinbase.com).'
        )
      }
      throw new Error(
        'Gas sponsorship limit exceeded. Increase your per-UserOp limit in the CDP Dashboard (portal.cdp.coinbase.com).'
      )
    }
    if (lc.includes('total gas used by the user operation') && lc.includes('allowed limit')) {
      const gasCapMatch = errMsg.match(/total gas used by the user operation\s+(\d+)\s+is greater than the allowed limit:\s*(\d+)/i)
      if (gasCapMatch) {
        throw new Error(
          `Sponsored UserOp exceeds paymaster total gas cap: used ${gasCapMatch[1]}, limit ${gasCapMatch[2]}. ` +
            'Increase the paymaster per-UserOp gas limit in CDP, or use a lower-gas deploy path.'
        )
      }
      throw new Error(
        'Sponsored UserOp exceeds paymaster total gas cap. ' +
          'Increase the paymaster per-UserOp gas limit in CDP, or use a lower-gas deploy path.'
      )
    }
    if (lc.includes('invalid signature') || lc.includes('signature check failed')) {
      throw new Error(
        'UserOp signature verification failed. This usually means the signer is not a valid owner. ' +
          'Try reconnecting your wallet or adding it as an owner of the smart wallet.'
      )
    }
    if (lc.includes('aa21') || lc.includes('didn\'t pay prefund')) {
      if (attemptedWithoutPaymaster) {
        throw new Error(
          'Smart wallet could not pay gas (no prefund). Add ETH to the smart wallet or re-enable gas sponsorship.'
        )
      }
      throw new Error(`Paymaster did not sponsor this operation. Check paymaster configuration.${metaSuffix}`)
    }
    if (lc.includes('aa25') || lc.includes('invalid account nonce')) {
      throw new Error('Account nonce mismatch. A pending transaction may exist. Wait and retry.')
    }
    if (lc.includes('aa10') || lc.includes('sender already constructed')) {
      throw new Error('Smart wallet already exists at this address.')
    }
    if (lc.includes('request denied -')) {
      const reason = errMsg.replace(/^.*request denied -\s*/i, '').trim()
      if (reason.includes('not authenticated')) {
        throw new Error(`Session expired or missing. Reconnect your wallet and try again.${metaSuffix}`)
      }
      if (reason.includes('creator not approved')) {
        throw new Error(
          `Creator not approved for gas sponsorship. Request access or join the allowlist, then retry.${metaSuffix}`,
        )
      }
      if (reason.includes('allowlist unavailable')) {
        throw new Error(`Paymaster allowlist is unavailable. Please retry shortly.${metaSuffix}`)
      }
      if (reason.includes('unsupported chainid')) {
        throw new Error(`Paymaster rejected this chain. Switch to Base mainnet and retry.${metaSuffix}`)
      }
      if (reason.includes('unsupported entrypoint')) {
        throw new Error(`Paymaster rejected the EntryPoint version. Please retry.${metaSuffix}`)
      }
      throw new Error(`Paymaster rejected this request: ${reason}.${metaSuffix}`)
    }
    if (isPaymasterUnavailableError(lastError)) {
      if (typeof smartWalletBalance === 'bigint' && smartWalletBalance <= 0n) {
        throw new Error(
          'Paymaster unavailable and smart wallet has no ETH for fallback. ' +
            'Add ETH to the smart wallet or fix the paymaster configuration.'
        )
      }
      throw new Error(
        `Paymaster unavailable. Check CDP paymaster configuration, sponsorship limits, and allowlist, then retry.${metaSuffix}`
      )
    }
    if (isLikelyVerificationGasLimitError(errMsg)) {
      throw new Error(
        'Signature verification used more gas than estimated. ' +
        'This can happen with smart wallet signers (EIP-1271). Please try again.'
      )
    }
    if (lc.includes('aa41') || lc.includes('over paymasterverificationgaslimit')) {
      throw new Error('Paymaster verification gas limit exceeded. Please try again.')
    }
    if (lc.includes('banned opcode') || lc.includes('stake/unstake delay') || lc.includes('unstake delay too low')) {
      throw new Error(
        'Bundler rejected sponsored UserOp: paymaster stake/unstake delay too low. ' +
          'Retry with a funded smart wallet or contact support to fix paymaster stake.'
      )
    }
    
    throw new Error(`UserOperation failed: ${errMsg}`)
  }

  // Wait for on-chain confirmation with extended timeout
  if (!userOpHash) {
    throw new Error('UserOperation did not return a hash.')
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
  
  telemetryStatus = 'success'
  return { 
    userOpHash, 
    transactionHash: receipt.receipt.transactionHash as Hex 
  }
  } catch (error) {
    telemetryStatus = isExpectedUserOpTimeoutError(error) ? 'timeout' : 'error'
    throw error
  } finally {
    recordUserOpTelemetry({
      status: telemetryStatus,
      durationMs: Math.max(0, Date.now() - submissionStartedAt),
      verificationGasLimit: telemetryVerificationGasLimit,
      paymasterMode: telemetryPaymasterMode,
      signatureMode: telemetrySignatureMode,
      ownerIsContract: telemetryOwnerIsContract,
    })
  }
}

function asError(error: unknown): Error {
  if (error instanceof Error) return error
  return new Error(String(error ?? 'Unknown error'))
}

export async function pollUserOperationStatus(params: {
  bundlerClient: any
  userOpHash: Hex
  options?: PollUserOperationStatusOptions
}): Promise<{ status: UserOpStatus; txHash?: Hex }> {
  const { bundlerClient, userOpHash, options } = params
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
      let receipt: any = null
      if (typeof bundlerClient?.getUserOperationReceipt === 'function') {
        receipt = await withTimeout(
          bundlerClient.getUserOperationReceipt({ hash: userOpHash }),
          perCheckTimeoutMs,
          'eth_getUserOperationReceipt',
        )
      } else {
        receipt = await withTimeout(
          waitForUserOperationReceipt(bundlerClient, {
            hash: userOpHash,
            timeout: perCheckTimeoutMs,
          }),
          perCheckTimeoutMs,
          'waitForUserOperationReceipt poll',
        )
      }

      const txHash = receipt?.receipt?.transactionHash
      if (isHexString(txHash)) {
        try {
          ensureUserOperationSucceeded(receipt, 'ERC-4337 status poll')
          emitStatus('confirmed', txHash as Hex)
          return { status: 'confirmed', txHash: txHash as Hex }
        } catch (error) {
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
