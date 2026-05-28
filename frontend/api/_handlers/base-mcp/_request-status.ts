import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { baseMcpApprovalStore } from '../../../server/_lib/agents/base-mcp/store.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const requestId = typeof req.query.requestId === 'string' ? req.query.requestId : ''
  if (!requestId) {
    return res.status(400).json({ success: false, error: 'Missing requestId' } satisfies ApiEnvelope<never>)
  }

  const record = baseMcpApprovalStore.get(requestId)
  if (!record) {
    return res.status(404).json({ success: false, error: 'Request not found' } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({ success: true, data: record } satisfies ApiEnvelope<typeof record>)
}
