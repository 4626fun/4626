import { AgentError, isRetryableAgentError, toAgentError } from './_errors.js'
import { logger } from '../../_lib/infra/logger.js'

const DEFAULT_MAX_RETRIES = 2
const DEFAULT_BASE_DELAY_MS = 750

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new AgentError('UPSTREAM_TIMEOUT', timeoutMessage, { retryable: true })), timeoutMs)
    }),
  ])
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(params: {
  operation: string
  maxRetries?: number
  baseDelayMs?: number
  run: () => Promise<T>
  correlationId?: string
}): Promise<T> {
  const maxRetries = Math.max(0, params.maxRetries ?? DEFAULT_MAX_RETRIES)
  const baseDelayMs = Math.max(50, params.baseDelayMs ?? DEFAULT_BASE_DELAY_MS)
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await params.run()
    } catch (error) {
      lastError = error
      const asAgentError = toAgentError(error, 'UPSTREAM_ERROR', `${params.operation}_failed`)
      const retryable =
        isRetryableAgentError(asAgentError) ||
        asAgentError.code === 'UPSTREAM_TIMEOUT' ||
        asAgentError.code === 'UPSTREAM_ERROR' ||
        asAgentError.code === 'DEPENDENCY_UNAVAILABLE'
      if (!retryable || attempt >= maxRetries) {
        console.error(
          `[eliza] ${params.operation} failed (attempt ${attempt + 1}/${maxRetries + 1}, retryable=${retryable}): ${asAgentError.message}`,
        )
        break
      }
      const waitMs = baseDelayMs * Math.pow(2, attempt)
      console.warn(
        `[eliza] ${params.operation} attempt ${attempt + 1} failed, retrying in ${waitMs}ms: ${asAgentError.message}`,
      )
      logger.warn('[eliza] retrying operation after failure', {
        operation: params.operation,
        attempt: attempt + 1,
        waitMs,
        correlationId: params.correlationId ?? null,
        error: asAgentError.message,
        code: asAgentError.code,
      })
      await sleep(waitMs)
    }
  }

  throw toAgentError(lastError, 'UPSTREAM_ERROR', `${params.operation}_failed_after_retries`)
}
