import { checkRateLimit, rateLimitKey } from '../../../../../packages/server-core/src/index.js'
import { asTrimmed } from '../utils.js'

export function readTradeLimitFromEnv(key: string, fallback: number): number {
  const raw = Number(asTrimmed(process.env[key] ?? ''))
  if (!Number.isFinite(raw) || raw <= 0) return fallback
  return Math.floor(raw)
}

export function tradeRateLimitForAction(actionType: 'buy' | 'sell' | 'bid'): { userLimit: number; chatLimit: number } {
  if (actionType === 'bid') {
    return {
      userLimit: readTradeLimitFromEnv('TELEGRAM_BID_USER_RATE_LIMIT_PER_MIN', 3),
      chatLimit: readTradeLimitFromEnv('TELEGRAM_BID_CHAT_RATE_LIMIT_PER_MIN', 20),
    }
  }
  return {
    userLimit: readTradeLimitFromEnv('TELEGRAM_TRADE_USER_RATE_LIMIT_PER_MIN', 10),
    chatLimit: readTradeLimitFromEnv('TELEGRAM_TRADE_CHAT_RATE_LIMIT_PER_MIN', 60),
  }
}

export function checkTelegramTradeRateLimit(params: {
  chatId: string
  userId: string
  actionType: 'buy' | 'sell' | 'bid'
}): { ok: true } | { ok: false; reason: 'rate_limit_user' | 'rate_limit_chat'; retryAfterSeconds: number } {
  const limits = tradeRateLimitForAction(params.actionType)
  const userWindow = checkRateLimit(rateLimitKey('telegram', 'trade', 'user', params.actionType, params.userId), {
    windowMs: 60_000,
    maxRequests: limits.userLimit,
  })
  if (!userWindow.allowed) {
    return {
      ok: false,
      reason: 'rate_limit_user',
      retryAfterSeconds: Math.max(1, Math.ceil((userWindow.resetAt - Date.now()) / 1000)),
    }
  }

  const chatWindow = checkRateLimit(rateLimitKey('telegram', 'trade', 'chat', params.actionType, params.chatId), {
    windowMs: 60_000,
    maxRequests: limits.chatLimit,
  })
  if (!chatWindow.allowed) {
    return {
      ok: false,
      reason: 'rate_limit_chat',
      retryAfterSeconds: Math.max(1, Math.ceil((chatWindow.resetAt - Date.now()) / 1000)),
    }
  }
  return { ok: true }
}
