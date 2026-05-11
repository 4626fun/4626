import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitKey,
} from '../../../packages/server-core/src/index.js'

import { getTelegramWebhookConfig } from './webhook/config.js'
import { verifyBotConfigSecret } from './webhook/services/access.js'

type MiniAppStatusData = {
  ok: boolean
  code: 'OK' | 'TELEGRAM_BOT_NOT_CONFIGURED' | 'TELEGRAM_MINIAPP_SESSION_DISABLED'
  hint: string | null
  botTokenConfigured: boolean
  miniAppSessionEnabled: boolean
  miniAppInitDataMaxAgeSeconds: number
  miniAppSessionTtlSeconds: number
  miniAppReplayTtlSeconds: number
  allowedChatIdsConfigured: boolean
  allowedUserIdsConfigured: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('telegram-miniapp-status', getClientIp(req)),
    RATE_LIMITS.telegramAdminWrite,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' } satisfies ApiEnvelope<never>)
  }

  if (!verifyBotConfigSecret(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  const config = getTelegramWebhookConfig()
  const botTokenConfigured = config.botToken.trim().length > 0
  const miniAppSessionEnabled = config.miniAppSessionEnabled

  let code: MiniAppStatusData['code'] = 'OK'
  let hint: string | null = null
  if (!botTokenConfigured) {
    code = 'TELEGRAM_BOT_NOT_CONFIGURED'
    hint = 'Set TELEGRAM_BOT_TOKEN on the server and redeploy.'
  } else if (!miniAppSessionEnabled) {
    code = 'TELEGRAM_MINIAPP_SESSION_DISABLED'
    hint = 'Set TELEGRAM_MINIAPP_SESSION_ENABLED=true to allow Mini App session proof issuance.'
  }

  const data: MiniAppStatusData = {
    ok: code === 'OK',
    code,
    hint,
    botTokenConfigured,
    miniAppSessionEnabled,
    miniAppInitDataMaxAgeSeconds: config.miniAppInitDataMaxAgeSeconds,
    miniAppSessionTtlSeconds: config.miniAppSessionTtlSeconds,
    miniAppReplayTtlSeconds: config.miniAppReplayTtlSeconds,
    allowedChatIdsConfigured: config.miniAppSessionChatIdsRaw.trim().length > 0,
    allowedUserIdsConfigured: config.miniAppSessionUserIdsRaw.trim().length > 0,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<MiniAppStatusData>)
}
