import { isPrivateChatId, parseAdminUserIds, parseAllowedChatIds } from '../env.js'

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
    allowedChatIds.size === 0 ||
    allowedChatIds.has(params.chatId) ||
    (!!params.signalsChatId && params.chatId === params.signalsChatId)
  const allowedByPrivateDm = params.allowPrivateDm && isPrivateChatId(params.chatId)
  const allowedByAdminDm = params.allowAdminDm && isAdmin && isPrivateChatId(params.chatId)
  return allowedByChat || allowedByPrivateDm || allowedByAdminDm
}
