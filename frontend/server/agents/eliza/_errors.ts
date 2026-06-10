export type AgentErrorCode =
  | 'INVALID_ENV'
  | 'STARTUP_FAILED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'ACTION_FAILED'
  | 'QUEUE_ERROR'
  | 'SESSION_ERROR'
  | 'RUNTIME_ERROR'
  | 'UNKNOWN'

export class AgentError extends Error {
  readonly code: AgentErrorCode
  readonly retryable: boolean
  readonly details?: Record<string, unknown>

  constructor(
    code: AgentErrorCode,
    message: string,
    options?: {
      retryable?: boolean
      details?: Record<string, unknown>
      cause?: unknown
    },
  ) {
    super(message)
    this.name = 'AgentError'
    this.code = code
    this.retryable = options?.retryable ?? false
    this.details = options?.details
    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

export function isRetryableAgentError(error: unknown): boolean {
  return error instanceof AgentError && error.retryable
}

export function toErrorDetails(error: unknown): Record<string, unknown> {
  if (error instanceof AgentError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details ?? null,
      cause: (error as { cause?: unknown }).cause ?? null,
    }
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    }
  }
  return { value: String(error) }
}

export function toAgentError(
  error: unknown,
  fallbackCode: AgentErrorCode = 'UNKNOWN',
  fallbackMessage = 'Unexpected agent error',
): AgentError {
  if (error instanceof AgentError) return error
  if (error instanceof Error) {
    const message = error.message || fallbackMessage
    const lower = message.toLowerCase()
    const inferredCode: AgentErrorCode =
      lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('denied')
        ? 'UNAUTHORIZED'
        : lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429')
          ? 'RATE_LIMITED'
          : lower.includes('timeout') || lower.includes('timed out')
            ? 'UPSTREAM_TIMEOUT'
            : lower.includes('unavailable') || lower.includes('503') || lower.includes('connection refused')
              ? 'DEPENDENCY_UNAVAILABLE'
              : fallbackCode
    return new AgentError(inferredCode, message, {
      cause: error,
      retryable:
        inferredCode === 'UPSTREAM_TIMEOUT' ||
        inferredCode === 'DEPENDENCY_UNAVAILABLE' ||
        inferredCode === 'RATE_LIMITED',
    })
  }
  return new AgentError(fallbackCode, fallbackMessage, {
    details: { value: String(error) },
  })
}

export function toUserFacingAgentErrorMessage(error: AgentError): string {
  if (error.code === 'RATE_LIMITED') {
    return 'Request rate limited. Please retry in a few seconds.'
  }
  if (error.code === 'UNAUTHORIZED') {
    return 'Unauthorized for this action.'
  }
  if (error.code === 'DEPENDENCY_UNAVAILABLE') {
    return 'A required service is temporarily unavailable. Please try again shortly.'
  }
  if (error.code === 'UPSTREAM_TIMEOUT') {
    return 'Request timed out. Please try again.'
  }
  if (error.code === 'BUDGET_EXCEEDED') {
    return 'Daily AI budget limit reached for this agent. Please try again tomorrow.'
  }
  return 'Command failed due to an upstream error. Please try again later.'
}

