import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '@4626/server-core'


import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  syncEmailIdentity,
  verifyPrivyForAccounts,
} from '../../../server/_lib/identity/accountsIdentity.js'
import { isDeployDryRunDbDisabled } from '../../../server/_lib/dev/localDevEnv.js'

type AccountsMeResponse = Awaited<ReturnType<typeof buildAccountsMePayload>>

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    const error = isDeployDryRunDbDisabled()
      ? 'Database unavailable for deploy dry-run. Set DEPLOY_DRY_RUN_KEEP_DB_ENV=1 in frontend/.env.deploy-dry-run.local and restart dev-deploy-dry-run.'
      : 'Database unavailable'
    return res.status(503).json({ success: false, error } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const data = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AccountsMeResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to load account'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

