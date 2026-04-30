import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readBoundedJsonObjectBody,
  requireKeeprApiKey,
  setCors,
  setNoStore,
} from '../../../../../packages/server-core/src/index.js'
import { recheckVaultChatMemberships } from '../../../../../server/_lib/chat/vaultChatPolicy.js'
import { normalizeVaultAddressFromQuery } from '../../workspace/_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  if (!requireKeeprApiKey(req, res)) return

  const vaultAddress = normalizeVaultAddressFromQuery(req)
  if (!vaultAddress) return res.status(400).json({ success: false, error: 'vault is required' })

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 2048 })) ?? {}
  const limit = Number(body.limit ?? req.query.limit ?? 100)

  try {
    const result = await recheckVaultChatMemberships({ vaultAddress, limit })
    return res.status(200).json({ success: true, data: result })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message ? String(error.message) : 'recheck_failed' })
  }
}
