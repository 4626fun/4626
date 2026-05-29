import { isTelegramFunnelEventsEnabledForChat, logTelegramFunnelEvent } from '@4626/server-core'

export function emitTelegramFunnelEvent(params: {
  db: any | null | undefined
  telegramUserId?: string | number | bigint | null
  chatId?: string | null
  eventName: string
  actionType?: string | null
  context?: Record<string, unknown> | null
}) {
  if (!params.db) return
  if (!isTelegramFunnelEventsEnabledForChat(params.chatId)) return
  void logTelegramFunnelEvent({
    db: params.db,
    telegramUserId: params.telegramUserId,
    chatId: params.chatId,
    eventName: params.eventName,
    actionType: params.actionType,
    context: params.context ?? {},
  }).catch(() => {})
}
