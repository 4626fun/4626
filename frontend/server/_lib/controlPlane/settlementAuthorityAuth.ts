export const SWEEP_COMPLETION_AUTH_ENV_KEY = 'KPR_SWEEP_COMPLETION_KEY'
export const SWEEP_COMPLETION_AUTH_HEADER = 'x-keeper-sweep-completion-key'

export function requestsCompletedSettlement(input: {
  settledAt?: unknown
  settlementStage?: unknown
}): boolean {
  return (
    (typeof input.settledAt === 'string' && input.settledAt.trim().length > 0)
    || (typeof input.settlementStage === 'string'
      && input.settlementStage.trim().toLowerCase() === 'completed')
  )
}
