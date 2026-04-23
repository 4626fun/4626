import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../../../packages/server-core/src/index.js'
import legacyCreateHandler from '../../session/_create.js'
import { updateDeploySession } from '../../../../../server/_lib/deploy/deploySessions.js'
import { invokeLegacyHandler } from './_legacyInvoke.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const body = await readBoundedJsonObjectBody(req, { maxBytes: 512_000 })
  if (!body) {
    return res.status(400).json({ success: false, error: 'Invalid JSON body' } satisfies ApiEnvelope<null>)
  }

  const result = await invokeLegacyHandler<ApiEnvelope<any>>({
    req,
    body,
    handler: legacyCreateHandler as any,
  })

  const payload = result.payload ?? ({ success: false, error: 'create_failed' } satisfies ApiEnvelope<null>)
  if (result.statusCode >= 200 && result.statusCode < 300 && payload?.success && payload?.data?.sessionId) {
    const sessionId = String(payload.data.sessionId)
    await updateDeploySession({
      id: sessionId,
      state: 'running',
      currentStage: 'created',
      attemptCount: 0,
      nextRunAfter: new Date(),
      lastFailureCode: null,
      lastFailureStage: null,
      artifactsPatch: {
        workflow: {
          createdVia: 'deploy_v2_session_create',
          createdAt: new Date().toISOString(),
        },
      },
    }).catch(() => {})
  }
  return res.status(result.statusCode).json(payload)
}
