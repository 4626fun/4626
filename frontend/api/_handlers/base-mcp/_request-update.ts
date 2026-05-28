import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { z } from 'zod'
import { baseMcpApprovalStore } from '../../../server/_lib/agents/base-mcp/store.js'

const MAX_BODY_BYTES = 16_384

const UpdateRequestSchema = z.object({
  requestId: z.string().min(1),
  status: z.enum(['approved', 'rejected']),
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<unknown>(req, { maxBytes: MAX_BODY_BYTES })
  const parsed = UpdateRequestSchema.safeParse(body)

  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Invalid request update payload' } satisfies ApiEnvelope<never>)
  }

  const updated = baseMcpApprovalStore.setStatus(parsed.data.requestId, parsed.data.status)
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({ success: true, data: updated } satisfies ApiEnvelope<typeof updated>)
}
