import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type WaitlistMeResponse = {
  primaryWallet: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  cswAddress: string | null
  privyUserId: string | null
  appAccessStatus: string | null
  updatedAt: string | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const address = readRequestPrincipalAddress(req)
  if (!address) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistMeResponse | null>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  const record = await db.sql`
    SELECT
      primary_wallet,
      embedded_wallet,
      embedded_wallet_chain,
      embedded_wallet_client_type,
      csw_address,
      privy_user_id,
      app_access_status,
      updated_at
    FROM profiles
    WHERE LOWER(primary_wallet) = ${address}
       OR LOWER(embedded_wallet) = ${address}
       OR LOWER(csw_address) = ${address}
       OR LOWER(base_sub_account) = ${address}
    LIMIT 1;
  `

  const row = record?.rows?.[0] ?? null
  if (!row) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistMeResponse | null>)
  }

  const data: WaitlistMeResponse = {
    primaryWallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
    embeddedWallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
    embeddedWalletChain: typeof row.embedded_wallet_chain === 'string' ? row.embedded_wallet_chain : null,
    embeddedWalletClientType: typeof row.embedded_wallet_client_type === 'string' ? row.embedded_wallet_client_type : null,
    cswAddress: typeof row.csw_address === 'string' ? row.csw_address : null,
    privyUserId: typeof row.privy_user_id === 'string' ? row.privy_user_id : null,
    appAccessStatus: typeof row.app_access_status === 'string' ? row.app_access_status : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistMeResponse>)
}
