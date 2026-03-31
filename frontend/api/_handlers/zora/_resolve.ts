import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'


import {
  ensureAccountsIdentitySchema,
  resolveAndPersistZoraSignals,
  syncEmailIdentity,
  verifyPrivyForAccounts,
} from '../../../server/_lib/accountsIdentity.js'

type ZoraResolveResponse = {
  canonicalCswAddress: string | null
  creatorCoin: { address: string; name: string | null; symbol: string | null; imageUrl: string | null } | null
  zoraHandle: string | null
}

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

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureAccountsIdentitySchema(db as any)
    await syncEmailIdentity({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
    })

    const summary = await resolveAndPersistZoraSignals({
      db: db as any,
      privyUserId: context.privyUserId,
      privyUser: context.privyUser,
      forceRefresh: false,
    })

    const data: ZoraResolveResponse = {
      canonicalCswAddress: summary.canonicalCswAddress,
      creatorCoin: summary.creatorCoin
        ? {
            address: summary.creatorCoin.address,
            name: summary.creatorCoin.name,
            symbol: summary.creatorCoin.symbol,
            imageUrl: summary.creatorCoin.imageUrl,
          }
        : null,
      zoraHandle: summary.zoraHandle,
    }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ZoraResolveResponse>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to resolve Zora signals'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

