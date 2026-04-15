import { getAddress, isAddress, type Address, type Hex } from 'viem'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

export type { ApiEnvelope } from '@/lib/api/apiEnvelope'

export type PostJsonWithTimeout = <T>(params: {
  url: string
  body: unknown
  label: string
  requestTimeoutMs?: number
  parseTimeoutMs?: number
}) => Promise<{ response: Response; json: ApiEnvelope<T> | null }>

export type DeploySessionStatusData = {
  step?: string
  lastTxHash?: string | null
  lastUserOpHash?: string | null
  lastError?: string | null
  sessionSignerAddress?: string | null
  sessionOwner?: string | null
  [key: string]: unknown
}

export function shouldRetryDeploySessionAuth(message: string): boolean {
  const lower = String(message || '').toLowerCase()
  return (
    lower.includes('not authenticated') ||
    lower.includes('no_session') ||
    lower.includes('deploy ownership mismatch')
  )
}

export async function postDeploySessionRequestWithAuthRetry<T>(params: {
  postJson: PostJsonWithTimeout
  url: string
  body: unknown
  label: string
  ensurePaymasterSession: () => Promise<void>
  maxAuthRetries?: number
  shouldRetryAuth?: (message: string) => boolean
}): Promise<ApiEnvelope<T>> {
  const shouldRetryAuth = params.shouldRetryAuth ?? shouldRetryDeploySessionAuth
  const maxAuthRetries = Math.max(0, Math.floor(params.maxAuthRetries ?? 1))
  let attemptedReauth = 0

  while (true) {
    const { response, json } = await params.postJson<T>({
      url: params.url,
      body: params.body,
      label: params.label,
    })
    if (response.ok && json?.success) return json

    const errMsg = String(json?.error || `Failed to ${params.label}`)
    if (attemptedReauth < maxAuthRetries && shouldRetryAuth(errMsg)) {
      attemptedReauth += 1
      await params.ensurePaymasterSession()
      continue
    }
    throw new Error(errMsg)
  }
}

export async function resumeAndPollDeploySession(params: {
  sessionId: string
  postJson: PostJsonWithTimeout
  ensurePaymasterSession: () => Promise<void>
  ensureDeploySessionSignerInstalled: (sessionSigner: Address) => Promise<void>
  clearDeploySession: () => void
  onStatus?: (data: DeploySessionStatusData) => void
  onCompleted?: (data: DeploySessionStatusData) => void
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  initialDelayMs?: number
  maxDelayMs?: number
  maxDurationMs?: number
}): Promise<DeploySessionStatusData> {
  const now = params.now ?? (() => Date.now())
  const sleep = params.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const started = now()
  const maxDurationMs = params.maxDurationMs ?? 10 * 60 * 1000
  const maxDelayMs = params.maxDelayMs ?? 8_000
  let delayMs = Math.max(250, Math.floor(params.initialDelayMs ?? 2_000))
  let backoff = false
  let sentStepWithoutHash = ''
  let sentStepWithoutHashSinceMs: number | null = null
  let attemptedContinueFromCreated = false
  const isHexHash = (value: unknown): value is Hex => typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value)

  while (true) {
    const statusJson = await postDeploySessionRequestWithAuthRetry<DeploySessionStatusData>({
      postJson: params.postJson,
      url: '/api/deploy/session/status',
      body: { sessionId: params.sessionId },
      label: attemptedContinueFromCreated ? 'deploy session status' : 'deploy session resume status',
      ensurePaymasterSession: params.ensurePaymasterSession,
    })
    const data = statusJson.data ?? {}
    params.onStatus?.(data)

    const step = String(data.step ?? '')
    const lastError = data.lastError ? String(data.lastError) : null
    const lastUserOpHash = typeof data.lastUserOpHash === 'string' ? data.lastUserOpHash : null

    if (step === 'created' && !attemptedContinueFromCreated) {
      attemptedContinueFromCreated = true
      const sessionSignerRaw = String(data.sessionSignerAddress ?? data.sessionOwner ?? '').trim()
      if (!isAddress(sessionSignerRaw)) {
        throw new Error('Invalid deploy session status response')
      }
      await params.ensureDeploySessionSignerInstalled(getAddress(sessionSignerRaw) as Address)
      await postDeploySessionRequestWithAuthRetry({
        postJson: params.postJson,
        url: '/api/deploy/session/continue',
        body: { sessionId: params.sessionId },
        label: 'deploy session resume continue',
        ensurePaymasterSession: params.ensurePaymasterSession,
      })
      continue
    }

    if (step === 'completed') {
      params.clearDeploySession()
      params.onCompleted?.(data)
      return data
    }
    if (step === 'failed' || step === 'cancelled') {
      params.clearDeploySession()
      throw new Error(String(data.lastError ?? 'Server deploy failed'))
    }

    if (step.endsWith('_sent') || step === 'cleanup_sent') {
      const hasUserOpHash = isHexHash(lastUserOpHash)
      if (!hasUserOpHash) {
        if (sentStepWithoutHash !== step) {
          sentStepWithoutHash = step
          sentStepWithoutHashSinceMs = now()
        }
        const stalledMs = sentStepWithoutHashSinceMs ? now() - sentStepWithoutHashSinceMs : 0
        if (lastError) {
          throw new Error(`Deploy stalled at ${step}: ${lastError}`)
        }
        if (stalledMs > 90_000) {
          throw new Error(
            `Deploy stalled at ${step}. No UserOp hash was recorded for over 90 seconds. Retry deploy to create a fresh session.`,
          )
        }
      } else {
        sentStepWithoutHash = ''
        sentStepWithoutHashSinceMs = null
      }
      backoff = true
    } else {
      sentStepWithoutHash = ''
      sentStepWithoutHashSinceMs = null
    }

    if (now() - started > maxDurationMs) {
      throw new Error('Server deploy did not complete in time. Check status and retry continue.')
    }

    if (backoff) delayMs = Math.min(delayMs * 2, maxDelayMs)
    await sleep(delayMs)
  }
}
