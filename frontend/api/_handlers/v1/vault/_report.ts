import type { VercelRequest, VercelResponse } from '@vercel/node'

import vaultReport from '../../status/_vaultReport.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/vault/report', kind: 'read' })
  if (!g.ok) return

  // Support both query-style and path-style routing.
  const vault = (typeof req.query?.vault === 'string' ? req.query.vault : typeof req.query?.address === 'string' ? req.query.address : '').trim()
  if (vault && !req.query.vault) req.query.vault = vault
  return await vaultReport(req, res)
}

