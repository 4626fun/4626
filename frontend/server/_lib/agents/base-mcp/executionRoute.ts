import type { PolicyDecision } from './policy'

export type ExecutionMode = 'canonical' | 'eoa'

export interface ExecutionRouteInput {
  requestedMode: ExecutionMode
  canonicalReady: boolean
  eoaReady: boolean
  canonicalSender?: string | null
  eoaSender?: string | null
}

export type ExecutionRouteResult =
  | { status: 'ok'; executionMode: ExecutionMode; sender: string }
  | ({ status: 'blocked'; reasonCode: 'not_execution_ready'; message: string } & Pick<PolicyDecision, never>)

export function resolveExecutionRoute(input: ExecutionRouteInput): ExecutionRouteResult {
  if (input.requestedMode === 'canonical') {
    if (!input.canonicalReady || !input.canonicalSender) {
      return {
        status: 'blocked',
        reasonCode: 'not_execution_ready',
        message: 'Canonical execution lane is not ready for this account.',
      }
    }

    return { status: 'ok', executionMode: 'canonical', sender: input.canonicalSender }
  }

  if (!input.eoaReady || !input.eoaSender) {
    return {
      status: 'blocked',
      reasonCode: 'not_execution_ready',
      message: 'EOA execution lane is not ready for this account.',
    }
  }

  return { status: 'ok', executionMode: 'eoa', sender: input.eoaSender }
}
