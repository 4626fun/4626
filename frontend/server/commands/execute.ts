import { readTelegramChatMemberRole } from '../../api/_handlers/telegram/webhook/telegramApi/chats.js'
import { getTelegramWebhookConfig } from '../../api/_handlers/telegram/webhook/config.js'
import { isPrivateChatId } from '../../api/_handlers/telegram/webhook/env.js'
import { getKeeprVaultByGroupId } from '../_lib/keepr/keeprRegistry.js'
import { resolveVaultAccessRoleFromVault } from '../agent/core/resolveVaultRole.js'
import { toAgentError, toUserFacingAgentErrorMessage } from '../agent/eliza/_errors.js'
import { getCommandFamily, requiresGroupAdminForFamily } from './registry.js'
import type { ExecuteCommandParams, KeeprCommandResult, KeeprRole } from './types.js'
import { executeCoinCommandFamily } from './families/coin.js'
import { executeConversationalCommandFamily, looksLikeConversationalCommand } from './families/conversation.js'
import { executeHelpCommandFamily } from './families/help.js'
import {
  executeKeeprCommandFamily,
  formatAdminCheckUnavailable,
  formatAdminOnlyRefusal,
  formatAssistantOnlyBlocked,
} from './families/keepr.js'
import { executeSendCommandFamily } from './families/send.js'
import { executeTwitterCommandFamily } from './families/twitter.js'
import { executeWhoisCommandFamily } from './families/whois.js'

function resolveVaultRole(params: {
  senderWallet: ExecuteCommandParams['senderWallet']
  vault: Awaited<ReturnType<typeof getKeeprVaultByGroupId>>
}): KeeprRole {
  if (!params.vault) return 'MEMBER'
  return resolveVaultAccessRoleFromVault({
    wallet: params.senderWallet,
    vault: params.vault,
  })
}

/**
 * Enforce group-admin gating on setup commands (/link, /linked, /unlink,
 * /keepr *) when invoked from a Telegram group chat.
 *
 * Returns a refusal KeeprCommandResult if the caller should be blocked, or
 * null if execution should proceed.
 *
 * Fail-open conditions (returns null without calling Telegram):
 *   - feature flag TELEGRAM_SETUP_ROLE_GATE is off
 *   - chatId / userId not provided (non-Telegram caller, e.g. agent runtime tests)
 *   - chatId is a private DM
 *
 * Fail-closed conditions (returns refusal):
 *   - role is 'member' (non-admin in group)
 *   - role is 'unknown' (getChatMember failed; bot may lack permissions)
 */
async function assertGroupAdminOrRefuse(params: {
  text: string
  chatId: string | undefined
  userId: string | undefined
}): Promise<KeeprCommandResult | null> {
  const config = getTelegramWebhookConfig()
  if (!config.setupRoleGateEnabled) return null

  const chatId = params.chatId?.trim() ?? ''
  const userId = params.userId?.trim() ?? ''
  // Non-Telegram callers (tests, server jobs) pass no chatId/userId — do not gate.
  if (!chatId || !userId) return null
  // DMs are never gated — /link in a DM is personal wallet linking.
  if (isPrivateChatId(chatId)) return null

  const commandDisplay = formatCommandForDisplay(params.text)
  const role = await readTelegramChatMemberRole({
    botToken: config.botToken,
    chatId,
    userId,
  })
  if (role === 'admin') return null
  if (role === 'member') {
    return { ok: false, response: formatAdminOnlyRefusal(commandDisplay) }
  }
  // role === 'unknown' — fail closed with distinct copy so users know to fix
  // bot permissions rather than asking an admin.
  return { ok: false, response: formatAdminCheckUnavailable(commandDisplay) }
}

/**
 * Format the user's raw command text for display in a refusal message.
 * Preserves the leading slash and subcommand arg so "/keepr status" stays
 * "/keepr status" rather than collapsing to the normalized head "keepr".
 * Strips @botname suffix and limits length defensively.
 */
function formatCommandForDisplay(rawText: string): string {
  const trimmed = String(rawText ?? '').trim()
  if (!trimmed) return ''
  const parts = trimmed.split(/\s+/g)
  const head = (parts[0] ?? '').replace(/@[\w_]+$/, '')
  const withSlash = head.startsWith('/') ? head : `/${head}`
  const rest = parts.slice(1).join(' ')
  const display = rest ? `${withSlash} ${rest}` : withSlash
  return display.length > 64 ? `${display.slice(0, 64)}…` : display
}

export async function executeCommand(params: ExecuteCommandParams): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()

  try {
    const family = getCommandFamily(raw)

    if (requiresGroupAdminForFamily(family)) {
      const refusal = await assertGroupAdminOrRefuse({
        text: raw,
        chatId: params.chatId,
        userId: params.userId,
      })
      if (refusal) return refusal
    }

    let vaultPromise: Promise<Awaited<ReturnType<typeof getKeeprVaultByGroupId>>> | null = null
    const getVault = () => {
      if (!vaultPromise) {
        vaultPromise = getKeeprVaultByGroupId(params.groupId)
      }
      return vaultPromise
    }
    const getRole = async (override?: KeeprRole) => {
      if (override) return override
      const vault = await getVault()
      return resolveVaultRole({ senderWallet: params.senderWallet, vault })
    }

    const helpResult = executeHelpCommandFamily(raw)
    if (helpResult) {
      return helpResult
    }

    if (family === 'whois') {
      return executeWhoisCommandFamily({ text: raw })
    }

    if (looksLikeConversationalCommand(raw)) {
      return executeConversationalCommandFamily({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        text: raw,
        vault: await getVault(),
      })
    }

    switch (family) {
      case 'twitter':
        return executeTwitterCommandFamily({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: raw,
          role: await getRole(params.roleOverrides?.twitter),
        })
      case 'send': {
        const vault = await getVault()
        if (!vault) return { ok: false, response: formatAssistantOnlyBlocked('/send') }
        return executeSendCommandFamily({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: raw,
          role: await getRole(params.roleOverrides?.send),
          vault,
        })
      }
      case 'coin': {
        const vault = await getVault()
        if (!vault) return { ok: false, response: formatAssistantOnlyBlocked('/coin') }
        return executeCoinCommandFamily({
          groupId: params.groupId,
          senderWallet: params.senderWallet,
          text: raw,
          role: await getRole(params.roleOverrides?.coin),
          vault,
        })
      }
    }

    const vault = await getVault()
    return executeKeeprCommandFamily({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      vault,
      role: await getRole(),
    })
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'Keepr command failed')
    return {
      ok: false,
      response: toUserFacingAgentErrorMessage(agentError),
    }
  }
}
