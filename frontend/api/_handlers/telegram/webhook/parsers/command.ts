import { TELEGRAM_NATIVE_COMMANDS } from '../constants.js'
import type { TelegramMessage } from '../types.js'
import { asTrimmed, getCommandHead, isHelpCategoryCommand, isHelpCommand, isInlineLauncherCommand, isLikelyCommandText, isTwitterCommand, normalizeTelegramCommand } from '../utils.js'

export { getCommandHead, isLikelyCommandText, isTwitterCommand, isInlineLauncherCommand, isHelpCommand, isHelpCategoryCommand, normalizeTelegramCommand }

export function isTelegramNativeCommand(rawText: string): boolean {
  return TELEGRAM_NATIVE_COMMANDS.has(getCommandHead(rawText))
}

export function shouldAutoRouteToAi(params: {
  chatId: string
  text: string
  message: TelegramMessage
  aiFollowupEnabled: boolean
  isPrivateChatId: (chatId: string) => boolean
}): boolean {
  if (!params.aiFollowupEnabled) return false
  const text = asTrimmed(params.text)
  if (!text) return false
  if (text.startsWith('/')) return false
  if (isLikelyCommandText(text)) return false
  const lower = text.toLowerCase()
  if (lower.startsWith('@keepr') || lower.startsWith('@bot') || lower.startsWith('@akitai_bot')) return true
  return Boolean(params.message.reply_to_message?.from?.is_bot)
}
