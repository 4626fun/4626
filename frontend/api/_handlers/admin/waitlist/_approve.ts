import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  logger,
} from '../../../../packages/server-core/src/index.js'



import { ensureWaitlistSchema } from '../../../../server/_lib/waitlistSchema.js'
import { logAdminAction } from '../../../../server/_lib/adminAudit.js'

import { enableCswAgent, getOrCreateCreatorXmtpAgent } from '../../../../server/_lib/creatorXmtpAgents.js'


declare const process: { env: Record<string, string | undefined> }

type Body = { id?: number; note?: string | null }

const WAITLIST_APPROVE_BODY_MAX_BYTES = 16_384

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  if (!isAdminAddress(admin)) return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  const rate = checkRateLimit(
    rateLimitKey('admin-waitlist-approve', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: WAITLIST_APPROVE_BODY_MAX_BYTES })) as Body
  const id = typeof body.id === 'number' ? Math.floor(body.id) : NaN
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Missing id' } satisfies ApiEnvelope<never>)
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : null

  const db = isDbConfigured() ? await getDb() : null
  if (!db) return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)
  if (!db.query) return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)

  // Update status to approved
  const q = await db.query(
    `UPDATE profiles
     SET app_access_status = 'approved',
         app_access_decision_note = $2,
         app_access_decided_at = NOW(),
         app_access_decided_by = $3,
         updated_at = NOW()
     WHERE id = $1
     RETURNING id, primary_wallet, csw_address,
               preprov_server_wallet_id, preprov_server_wallet_address,
               preprov_coin_address, preprov_coin_symbol;`,
    [id, note, admin],
  )
  if (!q.rows || q.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Signup not found' } satisfies ApiEnvelope<never>)
  }

  const row = q.rows[0] as any
  const creatorWallet = String(row.csw_address || row.primary_wallet || '').trim().toLowerCase()
  const serverWalletId = String(row.preprov_server_wallet_id || '').trim()
  const serverWalletAddress = String(row.preprov_server_wallet_address || '').trim()
  const autoEnableAgentsRaw = String(process.env.WAITLIST_AUTO_ENABLE_AGENTS ?? '').trim().toLowerCase()
  const autoEnableAgents = autoEnableAgentsRaw === '1' || autoEnableAgentsRaw === 'true' || autoEnableAgentsRaw === 'yes'

  let allowlisted = false
  let agentEnabled = false

  if (creatorWallet && isValidEvmAddress(creatorWallet)) {
    // Automation signer enablement remains an explicit opt-in after waitlist approval.
    if (autoEnableAgents) {
      // Optional compatibility path: auto-enable agent on approval when explicitly configured.
      if (serverWalletId && serverWalletAddress) {
        try {
          await enableCswAgent({
            creatorAddress: creatorWallet as `0x${string}`,
            cswAddress: creatorWallet as `0x${string}`,
            privyWalletId: serverWalletId,
            listedPublicly: true,
          })
          agentEnabled = true
          logger.info('[approve] CSW agent enabled', { id, wallet: creatorWallet.slice(0, 10) })
        } catch (err) {
          logger.warn('[approve] CSW agent enable failed, falling back to EOA', err)
          // Fallback: create EOA agent
          try {
            await getOrCreateCreatorXmtpAgent({
              creatorAddress: creatorWallet as `0x${string}`,
              listedPublicly: true,
            })
            agentEnabled = true
          } catch (err2) {
            logger.warn('[approve] EOA agent fallback also failed', err2)
          }
        }
      } else {
        // No pre-provisioned wallet — try EOA agent as fallback
        try {
          await getOrCreateCreatorXmtpAgent({
            creatorAddress: creatorWallet as `0x${string}`,
            listedPublicly: true,
          })
          agentEnabled = true
        } catch (err) {
          logger.warn('[approve] EOA agent creation failed', err)
        }
      }
    } else {
      logger.info('[approve] Skipping auto-enable agent (explicit opt-in required)', {
        id,
        wallet: creatorWallet.slice(0, 10),
      })
    }
  }

  // Audit log
  await logAdminAction({
    db: db as any,
    adminAddress: admin,
    action: 'waitlist_approve',
    targetType: 'profile',
    targetId: id,
    details: { note, allowlisted, agentEnabled },
    ipAddress: getClientIp(req),
  })

  return res.status(200).json({
    success: true,
    data: { id, status: 'approved', allowlisted, agentEnabled },
  } satisfies ApiEnvelope<any>)
}
