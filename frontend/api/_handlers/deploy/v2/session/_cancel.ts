import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../../../packages/server-core/src/index.js'
import legacyCancelHandler from '../../session/_cancel.js'
import { invokeLegacyHandler } from './_legacyInvoke.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  if (handleOptions(req, res)) return
  setCors(req, res)

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<null>)
  }

  const body = await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })
  if (!body || typeof body.sessionId !== 'string' || !body.sessionId.trim()) {
    return res.status(400).json({ success: false, error: 'Missing or invalid sessionId' } satisfies ApiEnvelope<null>)
  }

  const result = await invokeLegacyHandler<ApiEnvelope<any>>({
    req,
    body,
    handler: legacyCancelHandler as any,
  })
  return res
    .status(result.statusCode)
    .json(result.payload ?? ({ success: false, error: 'cancel_failed' } satisfies ApiEnvelope<null>))
}
