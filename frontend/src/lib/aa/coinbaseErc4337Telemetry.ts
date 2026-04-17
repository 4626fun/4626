// Batched UserOp telemetry extracted from coinbaseErc4337.ts.
// Samples p50/p95/p99 latency, error/timeout rates, and signature/paymaster
// modes across XMTP UserOp submissions and flushes to the shared telemetry
// endpoint + analytics channel at intervals, on threshold, or on timeout.

import { useropTelemetryFlag, debugLogsFlag } from '@/lib/flags/featureFlags'
import { trackEvent } from '@/lib/analytics/analytics'
import { apiFetch } from '@/lib/api/apiBase'
import { logger } from '@/lib/observability/logger'

const USEROP_TELEMETRY_BATCH_SIZE = 20
const USEROP_TELEMETRY_FLUSH_INTERVAL_MS = 60_000
const USEROP_TELEMETRY_SAMPLE_RATE = 0.2
const USEROP_TELEMETRY_SLOW_MS = 2_500

export type UserOpSubmissionPath = 'eth_sendUserOperation' | 'wallet_sendCalls'

export type UserOpTelemetrySample = {
  status: 'success' | 'error' | 'timeout'
  durationMs: number
  verificationGasLimit: string | null
  paymasterMode: 'sponsored' | 'self_funded' | 'fallback_to_self_funded'
  signatureMode: 'eth_sign' | 'signMessage' | 'auto'
  ownerIsContract: boolean
  approvalRunId?: string | null
  approvalStage?: string | null
  executionMode?: string | null
  approvalAttempt?: number | null
  errorCode?: string | null
  /**
   * Which submission path produced this sample. Defaults to
   * 'eth_sendUserOperation' when unset for backward compatibility with legacy
   * call sites in coinbaseErc4337.ts.
   */
  submissionPath?: UserOpSubmissionPath
}

const userOpTelemetrySamples: UserOpTelemetrySample[] = []
let userOpTelemetryLastFlushAt = 0

function isAaDebugEnabled(): boolean {
  if (debugLogsFlag()) return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug') === 'true'
  } catch {
    return false
  }
}

function isUserOpTelemetryEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (useropTelemetryFlag()) return true
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

  // Generic maps consumed by the admin UserOp health dashboard. Flat modes
  // above are kept for backward compatibility with any legacy analytics
  // consumers, while these maps let us add new enum values without schema
  // churn.
  const signatureModeBreakdown: Record<string, number> = {}
  const paymasterModeBreakdown: Record<string, number> = {}
  const submissionPathBreakdown: Record<string, number> = {}
  const errorCodes: Record<string, number> = {}
  let fallbackToSelfFundedCount = 0
  let ownerIsContractCount = 0
  for (const sample of samples) {
    signatureModeBreakdown[sample.signatureMode] = (signatureModeBreakdown[sample.signatureMode] ?? 0) + 1
    paymasterModeBreakdown[sample.paymasterMode] = (paymasterModeBreakdown[sample.paymasterMode] ?? 0) + 1
    const path = sample.submissionPath ?? 'eth_sendUserOperation'
    submissionPathBreakdown[path] = (submissionPathBreakdown[path] ?? 0) + 1
    if (sample.paymasterMode === 'fallback_to_self_funded') fallbackToSelfFundedCount += 1
    if (sample.ownerIsContract) ownerIsContractCount += 1
    if (sample.errorCode && sample.errorCode.trim()) {
      const code = sample.errorCode.trim()
      errorCodes[code] = (errorCodes[code] ?? 0) + 1
    }
  }

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
    // Legacy flat counts retained for backward compatibility.
    signatureModes,
    paymasterUsage,
    ownerType,
    verificationGasLimitUsed,
    // Generic, agg-friendly breakdowns used by /api/admin/userop/health.
    signatureModeBreakdown,
    paymasterModeBreakdown,
    submissionPathBreakdown,
    errorCodes,
    fallbackToSelfFundedCount,
    ownerIsContractCount,
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

  if (isAaDebugEnabled()) logger.debug('[ERC-4337] UserOp telemetry batch', payload)
}

export function recordUserOpTelemetry(sample: UserOpTelemetrySample): void {
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
