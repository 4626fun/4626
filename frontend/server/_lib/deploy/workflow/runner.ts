import {
  claimDeploySessionLease,
  getDeploySessionById,
  isDeploySessionTerminal,
  releaseDeploySessionLease,
  updateDeploySession,
  type DeploySessionRecord,
  type DeploySessionStep,
} from '../deploySessions.js'

export type WorkflowInvocationResult = {
  statusCode: number
  payload: any
}

export type DeployWorkflowCallbacks = {
  invokeContinue: () => Promise<WorkflowInvocationResult>
  invokeStatus: () => Promise<WorkflowInvocationResult>
}

type WorkflowStageExecutor = (params: {
  session: DeploySessionRecord
  callbacks: DeployWorkflowCallbacks
}) => Promise<WorkflowInvocationResult>

type DeployWorkflowResult = {
  sessionId: string
  ticks: number
  transitioned: boolean
  previousStep: DeploySessionStep | null
  currentStep: DeploySessionStep | null
  state: DeploySessionRecord['state'] | null
  halted: 'terminal' | 'stalled' | 'error' | 'lease_unavailable' | 'missing'
  failureCode: string | null
}

function asStep(payload: unknown): DeploySessionStep | null {
  const raw = (payload as any)?.data?.step
  if (typeof raw !== 'string' || !raw.trim()) return null
  return raw.trim() as DeploySessionStep
}

function asError(payload: unknown): string | null {
  const raw = (payload as any)?.error
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  const dataErr = (payload as any)?.data?.lastError
  if (typeof dataErr === 'string' && dataErr.trim()) return dataErr.trim()
  return null
}

function backoffMs(attemptCount: number): number {
  if (attemptCount <= 0) return 1_000
  return Math.min(30_000, 1_000 * 2 ** Math.min(5, attemptCount))
}

const statusExecutor: WorkflowStageExecutor = async ({ callbacks }) => callbacks.invokeStatus()
const continueExecutor: WorkflowStageExecutor = async ({ callbacks }) => callbacks.invokeContinue()

const stageExecutors: Record<DeploySessionStep, WorkflowStageExecutor> = {
  created: continueExecutor,
  phase1_sent: statusExecutor,
  phase1_confirmed: statusExecutor,
  phase1_finalize_sent: statusExecutor,
  phase1_finalize_confirmed: statusExecutor,
  phase2_core_sent: statusExecutor,
  phase2_core_confirmed: statusExecutor,
  phase2_pre_finalize_sent: statusExecutor,
  phase2_pre_finalize_confirmed: statusExecutor,
  phase2_finalize_sent: statusExecutor,
  phase2_finalize_confirmed: statusExecutor,
  phase2_sent: statusExecutor,
  phase2_confirmed: statusExecutor,
  ovault_mesh_sent: statusExecutor,
  ovault_mesh_confirmed: statusExecutor,
  phase3_sent: statusExecutor,
  phase3_confirmed: statusExecutor,
  phase4_sent: statusExecutor,
  phase4_confirmed: statusExecutor,
  cleanup_sent: statusExecutor,
  cancelled: statusExecutor,
  completed: statusExecutor,
  failed: statusExecutor,
}

export async function runDeployWorkflow(params: {
  sessionId: string
  workerId: string
  callbacks: DeployWorkflowCallbacks
  maxTicks?: number
  leaseMs?: number
}): Promise<DeployWorkflowResult> {
  const maxTicks = Math.max(1, Math.min(25, Math.floor(params.maxTicks ?? 8)))
  const leaseMs = Math.max(5_000, Math.min(60_000, Math.floor(params.leaseMs ?? 20_000)))
  let ticks = 0
  let previousStep: DeploySessionStep | null = null
  let currentStep: DeploySessionStep | null = null
  let transitioned = false
  let failureCode: string | null = null
  let halted: DeployWorkflowResult['halted'] = 'stalled'
  let state: DeploySessionRecord['state'] | null = null

  const session = await getDeploySessionById(params.sessionId)
  if (!session) {
    return {
      sessionId: params.sessionId,
      ticks,
      transitioned: false,
      previousStep,
      currentStep,
      state,
      halted: 'missing',
      failureCode: 'session_missing',
    }
  }
  previousStep = session.step
  state = session.state

  const leased = await claimDeploySessionLease({
    id: session.id,
    expectedStep: session.step,
    workerId: params.workerId,
    leaseMs,
  })
  if (!leased) {
    return {
      sessionId: params.sessionId,
      ticks,
      transitioned: false,
      previousStep,
      currentStep: session.step,
      state: session.state,
      halted: 'lease_unavailable',
      failureCode: null,
    }
  }

  try {
    while (ticks < maxTicks) {
      const rec = await getDeploySessionById(params.sessionId)
      if (!rec) {
        halted = 'missing'
        failureCode = 'session_missing_after_lease'
        break
      }
      state = rec.state
      currentStep = rec.step
      if (isDeploySessionTerminal(rec.step)) {
        halted = 'terminal'
        break
      }

      const executor = stageExecutors[rec.step] ?? statusExecutor
      const result = await executor({ session: rec, callbacks: params.callbacks })
      ticks += 1

      const nextStep = asStep(result.payload)
      const invocationError = asError(result.payload)
      const ok = result.statusCode >= 200 && result.statusCode < 300

      if (!ok) {
        failureCode = invocationError ? `workflow_invoke_error:${invocationError}` : `workflow_http_${result.statusCode}`
        const attempt = rec.attemptCount + 1
        await updateDeploySession({
          id: rec.id,
          state: 'running',
          currentStage: rec.step,
          attemptCount: attempt,
          nextRunAfter: new Date(Date.now() + backoffMs(attempt)),
          lastFailureCode: failureCode,
          lastFailureStage: rec.step,
          artifactsPatch: {
            workflow: {
              lastInvocationStatus: result.statusCode,
              lastInvocationError: invocationError,
              lastTickAt: new Date().toISOString(),
            },
          },
        })
        halted = 'error'
        break
      }

      const after = await getDeploySessionById(rec.id)
      if (!after) {
        halted = 'missing'
        failureCode = 'session_missing_post_tick'
        break
      }
      currentStep = after.step
      state = after.state
      if (after.step !== rec.step) {
        transitioned = true
      }

      if (isDeploySessionTerminal(after.step)) {
        halted = 'terminal'
        break
      }

      if (!nextStep && after.step === rec.step) {
        const attempt = after.attemptCount + 1
        await updateDeploySession({
          id: after.id,
          attemptCount: attempt,
          nextRunAfter: new Date(Date.now() + backoffMs(attempt)),
          lastFailureCode: null,
          lastFailureStage: after.step,
          artifactsPatch: {
            workflow: {
              stalled: true,
              lastTickAt: new Date().toISOString(),
            },
          },
        })
        halted = 'stalled'
        break
      }
    }
  } finally {
    await releaseDeploySessionLease({ id: params.sessionId, workerId: params.workerId }).catch(() => {})
  }

  if (!currentStep) {
    const rec = await getDeploySessionById(params.sessionId)
    currentStep = rec?.step ?? null
    state = rec?.state ?? null
  }

  return {
    sessionId: params.sessionId,
    ticks,
    transitioned,
    previousStep,
    currentStep,
    state,
    halted,
    failureCode,
  }
}
