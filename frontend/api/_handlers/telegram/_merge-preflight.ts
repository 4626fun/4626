import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { verifyPrivyForAccounts } from '../../../server/_lib/accountsIdentity.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureTelegramTradingSchema, runTelegramMergePreflight } from '../../../server/_lib/telegramTrading.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type MergePreflightBody = { telegramUserId?: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<MergePreflightBody>(req).catch(() => null)) ?? (req.body as MergePreflightBody | null) ?? {}
  const telegramUserId = typeof body.telegramUserId === 'string' ? body.telegramUserId.trim() : ''
  if (!/^\d+$/.test(telegramUserId)) {
    return res.status(400).json({ success: false, error: 'telegramUserId is required' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Database unavailable' } satisfies ApiEnvelope<never>)
  }

  try {
    const context = await verifyPrivyForAccounts(req)
    await ensureWaitlistSchema(db as any)
    await ensureTelegramTradingSchema(db as any)
    const preflight = await runTelegramMergePreflight({
      db: db as any,
      telegramUserId,
      privyUserId: context.privyUserId,
    })
    if (!preflight.ok) {
      return res.status(409).json({
        success: false,
        error: 'Recovery required: this Telegram account is already linked to another account. Use account recovery to continue.',
        code: 'RECOVERY_REQUIRED_TELEGRAM_BOUND',
        recoveryRequired: true,
      } as ApiEnvelope<never> & { code: string; recoveryRequired: true })
    }

    return res.status(200).json({
      success: true,
      data: { ok: true },
    } satisfies ApiEnvelope<{ ok: true }>)
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'Failed to run Telegram merge preflight'
    const status = /token|unauthorized|forbidden|privy/i.test(message) ? 401 : 500
    return res.status(status).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
