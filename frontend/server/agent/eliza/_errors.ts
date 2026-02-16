export type AgentErrorCode =
  | 'INVALID_ENV'
  | 'RATE_LIMITED'
  | 'BUDGET_EXCEEDED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'ACTION_FAILED'
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

export function toAgentError(
  error: unknown,
  fallbackCode: AgentErrorCode = 'UNKNOWN',
  fallbackMessage = 'Unexpected agent error',
): AgentError {
  if (error instanceof AgentError) return error
  if (error instanceof Error) {
    return new AgentError(fallbackCode, error.message || fallbackMessage, {
      cause: error,
    })
  }
  return new AgentError(fallbackCode, fallbackMessage, {
    details: { value: String(error) },
  })
}

