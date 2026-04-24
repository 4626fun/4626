import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../../../packages/server-core/src/index.js'
import { getDeploySessionById } from '../../../../../server/_lib/deploy/deploySessions.js'
import {
  DeploySessionAccessError,
  loadAuthorizedDeploySession,
  normalizeDeploySessionId,
} from './_sessionAccess.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

function deriveNextAction(params: {
  step: string
  state: string
  lastFailureCode: string | null
}): string | null {
  if (params.step === 'created') return 'wait_for_owner_install'
  if (params.state === 'completed') return 'completed'
  if (params.state === 'cancelled') return 'cancelled'
  if (params.state === 'failed') {
    if (params.lastFailureCode?.includes('workflow_invoke_error')) return 'retry_resume'
    return 'retry_deploy'
  }
  return 'resume'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const body = await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })
  const sessionId = normalizeDeploySessionId(body?.sessionId)
  if (!sessionId) {
    return res.status(400).json({ success: false, error: 'Missing or invalid sessionId' } satisfies ApiEnvelope<null>)
  }

  try {
    const access = await loadAuthorizedDeploySession({
      req,
      sessionId,
      getDeploySessionById,
    })
    const rec = access.rec
    const payload = rec.payload && typeof rec.payload === 'object' ? rec.payload : {}

    return res.status(200).json({
      success: true,
      data: {
        id: rec.id,
        state: rec.state,
        currentStage: rec.currentStage,
        step: rec.step,
        attemptCount: rec.attemptCount,
        nextRunAfter: rec.nextRunAfter,
        expiresAt: rec.expiresAt,
        lastError: rec.lastError,
        lastFailureCode: rec.lastFailureCode,
        lastFailureStage: rec.lastFailureStage,
        lastUserOpHash: rec.lastUserOpHash,
        lastTxHash: rec.lastTxHash,
        smartWallet: rec.smartWallet,
        sessionSignerAddress: rec.sessionSigner,
        lockOwner: rec.lockOwner,
        lockExpiresAt: rec.lockExpiresAt,
        nextAction: deriveNextAction({
          step: rec.step,
          state: rec.state,
          lastFailureCode: rec.lastFailureCode,
        }),
        phase2InvariantGate:
          payload && typeof payload === 'object' && payload['phase2InvariantGate'] && typeof payload['phase2InvariantGate'] === 'object'
            ? payload['phase2InvariantGate']
            : null,
        launchImage:
          payload && typeof payload === 'object' && payload['launchImage'] && typeof payload['launchImage'] === 'object'
            ? payload['launchImage']
            : null,
        ovault:
          payload && typeof payload === 'object' && payload['ovault'] && typeof payload['ovault'] === 'object'
            ? payload['ovault']
            : null,
        diagnostics:
          payload && typeof payload === 'object' && payload['diagnostics'] && typeof payload['diagnostics'] === 'object'
            ? payload['diagnostics']
            : null,
        artifacts: rec.artifacts,
      },
    } satisfies ApiEnvelope<any>)
  } catch (error) {
    if (error instanceof DeploySessionAccessError) {
      return res.status(error.status).json({ success: false, error: error.message } satisfies ApiEnvelope<null>)
    }
    const message = error instanceof Error ? error.message : 'status_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<null>)
  }
}
