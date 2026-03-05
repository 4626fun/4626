import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { extractZoraCrossAppAccounts, verifyPrivyForAccounts } from '../../../../server/_lib/accountsIdentity.js'

type ZoraLinkStatusResponse = {
  zoraLinked: boolean
  zoraCrossAppAccounts: Array<{ address: string; providerAppId: string }>
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    const zoraCrossAppAccounts = extractZoraCrossAppAccounts(context.privyUser)
    const data: ZoraLinkStatusResponse = {
      zoraLinked: zoraCrossAppAccounts.length > 0,
      zoraCrossAppAccounts,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ZoraLinkStatusResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to read Zora link status'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

