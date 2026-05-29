import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import {
  getDeploySessionById,
  randomId,
  updateDeploySession,
} from '../../../../../server/_lib/deploy/deploySessions.js'
import { runDeployWorkflow } from '../../../../../server/_lib/deploy/workflow/runner.js'
import continueCoreHandler from './_continueCore.js'
import statusCoreHandler from './_statusCore.js'
import {
  DeploySessionAccessError,
  loadAuthorizedDeploySession,
  normalizeDeploySessionId,
} from './_sessionAccess.js'
import { invokeHandler } from './_invokeHandler.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

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
  const maxTicksRaw = Number(body?.maxTicks ?? 8)
  const maxTicks = Number.isFinite(maxTicksRaw) ? Math.max(1, Math.min(25, Math.floor(maxTicksRaw))) : 8

  try {
    const access = await loadAuthorizedDeploySession({
      req,
      sessionId,
      getDeploySessionById,
    })

    const workflow = await runDeployWorkflow({
      sessionId,
      workerId: randomId('wf_'),
      maxTicks,
      callbacks: {
        invokeContinue: async () =>
          invokeHandler({
            req,
            body: { sessionId },
            handler: continueCoreHandler as any,
          }),
        invokeStatus: async () =>
          invokeHandler({
            req,
            body: { sessionId },
            handler: statusCoreHandler as any,
          }),
      },
    })

    const rec = await getDeploySessionById(sessionId)
    const responseState = rec?.state ?? access.rec.state
    const responseStep = rec?.step ?? access.rec.step

    return res.status(200).json({
      success: true,
      data: {
        id: sessionId,
        workflow,
        state: responseState,
        currentStage: rec?.currentStage ?? responseStep,
        step: responseStep,
        attemptCount: rec?.attemptCount ?? access.rec.attemptCount,
        nextRunAfter: rec?.nextRunAfter ?? access.rec.nextRunAfter,
        lastError: rec?.lastError ?? access.rec.lastError,
        lastFailureCode: rec?.lastFailureCode ?? access.rec.lastFailureCode,
        lastFailureStage: rec?.lastFailureStage ?? access.rec.lastFailureStage,
        lastUserOpHash: rec?.lastUserOpHash ?? access.rec.lastUserOpHash,
        lastTxHash: rec?.lastTxHash ?? access.rec.lastTxHash,
      },
    } satisfies ApiEnvelope<any>)
  } catch (error) {
    if (error instanceof DeploySessionAccessError) {
      return res.status(error.status).json({ success: false, error: error.message } satisfies ApiEnvelope<null>)
    }
    const message = error instanceof Error ? error.message : 'resume_failed'
    await updateDeploySession({
      id: sessionId,
      state: 'running',
      lastError: message,
      lastFailureCode: `resume_failed:${message}`,
      lastFailureStage: null,
      nextRunAfter: new Date(Date.now() + 5_000),
      artifactsPatch: {
        workflow: {
          resumeError: message,
          resumeFailedAt: new Date().toISOString(),
        },
      },
    }).catch(() => {})
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<null>)
  }
}
