import {
  getTelegramWebhookConfig,
} from '../../api/_handlers/telegram/webhook/config.js'
import { isPrivateChatId } from '../../api/_handlers/telegram/webhook/env.js'
import { readTelegramChatMemberRole } from '../../api/_handlers/telegram/webhook/telegramApi/chats.js'

import {
  formatAdminCheckUnavailable,
  formatAdminOnlyRefusal,
} from './families/keepr.js'
import { getCommandFamily, requiresGroupAdminForFamily } from './registry.js'

/**
 * Result of evaluating whether a caller should be allowed to run a setup
 * command in a group chat. `allowed: true` means proceed normally.
 */
export type GroupAdminGateDecision =
  | { allowed: true }
  | { allowed: false; response: string }

/**
 * Format the user's raw command text for display in a refusal message.
 * Preserves the leading slash and subcommand arg so "/keepr status" stays
 * "/keepr status" rather than collapsing to the normalized head "keepr".
 * Strips @botname suffix and limits length defensively.
 */
export function formatCommandForDisplay(rawText: string): string {
  const trimmed = String(rawText ?? '').trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/g)
  const head = (parts[0] ?? '').replace(/@[\w_]+$/, '')
  const withSlash = head.startsWith('/') ? head : `/${head}`
  const rest = parts.slice(1).join(' ')
  const display = rest ? `${withSlash} ${rest}` : withSlash
  return display.length > 64 ? `${display.slice(0, 64)}\u2026` : display
}

/**
 * Central decision point for the Telegram group-admin gate. Both the
 * deterministic execute pipeline and the native Telegram command handler
 * must route through this so the two paths can never disagree.
 *
 * Fail-open (returns `allowed: true` without network calls):
 *   - feature flag TELEGRAM_SETUP_ROLE_GATE is off
 *   - command family is not in GROUP_ADMIN_REQUIRED_FAMILIES
 *   - chatId or userId missing (non-Telegram caller)
 *   - chatId is a private DM
 *
 * Fail-closed (returns `allowed: false` with refusal copy):
 *   - role is 'member' (non-admin in group)   \u2192 formatAdminOnlyRefusal
 *   - role is 'unknown' (lookup failed/errored) \u2192 formatAdminCheckUnavailable
 */
export async function evaluateGroupAdminGate(params: {
  text: string
  chatId: string | undefined
  userId: string | undefined
}): Promise<GroupAdminGateDecision> {
  const family = getCommandFamily(params.text)
  if (!requiresGroupAdminForFamily(family)) return { allowed: true }

  const config = getTelegramWebhookConfig()
  if (!config.setupRoleGateEnabled) return { allowed: true }

  const chatId = params.chatId?.trim() ?? ''
  const userId = params.userId?.trim() ?? ''
  if (!chatId || !userId) return { allowed: true }
  if (isPrivateChatId(chatId)) return { allowed: true }

  const commandDisplay = formatCommandForDisplay(params.text)

  // readTelegramChatMemberRole swallows its own transport errors, but we
  // belt-and-suspenders wrap here as well so a future refactor can never
  // regress the fail-closed contract.
  let role: Awaited<ReturnType<typeof readTelegramChatMemberRole>>
  try {
    role = await readTelegramChatMemberRole({
      botToken: config.botToken,
      chatId,
      userId,
    })
  } catch {
    role = 'unknown'
  }

  if (role === 'admin') return { allowed: true }
  if (role === 'member') {
    return { allowed: false, response: formatAdminOnlyRefusal(commandDisplay) }
  }
  return { allowed: false, response: formatAdminCheckUnavailable(commandDisplay) }
}
