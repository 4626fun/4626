import { timingSafeEqual } from 'node:crypto'

import type { VercelRequest } from '@vercel/node'

import { getTelegramWebhookConfig } from '../config.js'
import { isPrivateChatId, parseAdminUserIds, parseAllowedChatIds } from '../env.js'
import { asTrimmed, parseDelimitedSet } from '../utils.js'

function safeCompareSecret(provided: string, configured: string): boolean {
  const expected = Buffer.from(configured)
  const actual = Buffer.from(provided)
  if (expected.length === 0 || actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export function isTelegramContextAllowed(params: {
  chatId: string
  userId: string
  allowAdminDm: boolean
  allowPrivateDm: boolean
  signalsChatId?: string
}): boolean {
  const adminUserIds = parseAdminUserIds()
  const isAdmin = params.userId ? adminUserIds.has(params.userId) : false
  const allowedChatIds = parseAllowedChatIds()
  const allowedByChat =
    (allowedChatIds.size > 0 && allowedChatIds.has(params.chatId)) ||
    (!!params.signalsChatId && params.chatId === params.signalsChatId)
  const allowedByPrivateDm = params.allowPrivateDm && isPrivateChatId(params.chatId)
  const allowedByAdminDm = params.allowAdminDm && isAdmin && isPrivateChatId(params.chatId)
  return allowedByChat || allowedByPrivateDm || allowedByAdminDm
}

export function verifyBotConfigSecret(req: Pick<VercelRequest, 'headers'>): boolean {
  const configured = getTelegramWebhookConfig().botConfigSecret
  if (!configured) return false
  const provided = asTrimmed(req.headers['x-telegram-link-secret'])
  return safeCompareSecret(provided, configured)
}

export function verifyTelegramLinkApiSecret(req: Pick<VercelRequest, 'headers'>): boolean {
  const configured = getTelegramWebhookConfig().linkApiSecret
  if (!configured) return false
  const provided = asTrimmed(req.headers['x-telegram-link-secret'])
  return safeCompareSecret(provided, configured)
}

export function isTelegramMiniAppSessionEnabled(params: { chatId?: string | null; userId?: string | null }): boolean {
  const config = getTelegramWebhookConfig()
  if (!config.miniAppSessionEnabled) return false

  const userId = asTrimmed(params.userId ?? '')
  const chatId = asTrimmed(params.chatId ?? '')
  const allowedChatIds = parseDelimitedSet(config.miniAppSessionChatIdsRaw)
  const allowedUserIds = parseDelimitedSet(config.miniAppSessionUserIdsRaw)

  if (allowedUserIds.size > 0 && (!userId || !allowedUserIds.has(userId))) return false
  if (allowedChatIds.size > 0 && (!chatId || !allowedChatIds.has(chatId))) return false
  return true
}
