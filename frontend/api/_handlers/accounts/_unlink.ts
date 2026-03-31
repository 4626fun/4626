import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import {
  buildAccountsMePayload,
  ensureAccountsIdentitySchema,
  recordProviderUnlink,
  syncEmailIdentity,
  type AccountLinkProvider,
  verifyPrivyForAccounts,
} from '../../../server/_lib/accountsIdentity.js'

type UnlinkBody = {
  provider?: AccountLinkProvider
  value?: string | null
}

type AccountsUnlinkResponse = Awaited<ReturnType<typeof buildAccountsMePayload>>

const ALLOWED_PROVIDERS = new Set<AccountLinkProvider>([
  'google',
  'apple',
  'twitter',
  'telegram',
  'tiktok',
  'external_eoa',
  'email',
  'zora_cross_app',
])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<UnlinkBody>(req).catch(() => null)) ?? (req.body as UnlinkBody | null) ?? {}
  const provider = body.provider
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, error: 'Invalid provider' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    await recordProviderUnlink({
      db: db as any,
      privyUserId: context.privyUserId,
      provider,
      value: typeof body.value === 'string' ? body.value : null,
    })

    const data = await buildAccountsMePayload({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AccountsUnlinkResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to unlink provider'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

