import { getKeeprVaultByGroupId } from '../_lib/keeprRegistry.js'
import { executeConversationalFallback } from '../agent/core/executeConversationalFallback.js'
import { isConversationalAgentInput, normalizeConversationalPrompt } from '../agent/core/conversationalInput.js'
import { resolveVaultAccessRoleFromVault } from '../agent/core/resolveVaultRole.js'
import { toAgentError, toUserFacingAgentErrorMessage } from '../agent/eliza/_errors.js'
import { handleWhoisCommand } from '../keepr/whoisCommand.js'
import { handleSendCommand } from '../keepr/sendCommand.js'
import { handleTwitterCommand } from '../twitter/commands.js'
import { handleCoinCommand } from '../zora/commands.js'
import { matchesCommandFamily } from './registry.js'
import type { ExecuteCommandParams, KeeprCommandResult, KeeprRole } from './types.js'
import {
  executeKeeprCommandFamily,
  formatAssistantOnlyBlocked,
  formatGroupConnectGuidance,
  formatKeeprHelp,
  handleMarketCommand,
  isMarketCommand,
  looksLikeGroupConnectIntent,
} from './families/keepr.js'

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

export async function executeCommand(params: ExecuteCommandParams): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()

  try {
    const rawLower = raw.toLowerCase()
    const globalHelpMatch = raw.match(/^\/?help(?:\s+(\S+))?\s*$/i)
    if (globalHelpMatch) {
      return { ok: true, response: formatKeeprHelp(globalHelpMatch[1] ?? null) }
    }

    if (matchesCommandFamily(raw, 'whois')) {
      return handleWhoisCommand({ text: raw })
    }

    const looksLikeAi = isConversationalAgentInput(raw) && (/^\/ai\b/i.test(raw) || /^@(keepr|bot)\b/i.test(raw))
    if (looksLikeAi) {
      const aiText = normalizeConversationalPrompt(raw)
      if (!aiText) {
        return { ok: true, response: 'Ask me anything about this vault or DeFi on Base.' }
      }
      const vault = await getKeeprVaultByGroupId(params.groupId)
      if (!vault && looksLikeGroupConnectIntent(aiText)) {
        return { ok: true, response: formatGroupConnectGuidance(params.groupId) }
      }
      const aiResult = await executeConversationalFallback({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        text: aiText,
        vault,
      })
      return { ok: aiResult.ok, response: aiResult.responseText }
    }

    if (isMarketCommand(rawLower)) {
      return handleMarketCommand(raw)
    }

    if (matchesCommandFamily(raw, 'twitter')) {
      const vault = await getKeeprVaultByGroupId(params.groupId)
      return handleTwitterCommand({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        text: raw,
        role: resolveVaultRole({ senderWallet: params.senderWallet, vault }),
      })
    }

    if (matchesCommandFamily(raw, 'send')) {
      const vault = await getKeeprVaultByGroupId(params.groupId)
      if (!vault) return { ok: false, response: formatAssistantOnlyBlocked('/send') }
      return handleSendCommand({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        text: raw,
        role: resolveVaultRole({ senderWallet: params.senderWallet, vault }),
        vault,
      })
    }

    if (matchesCommandFamily(raw, 'coin')) {
      const vault = await getKeeprVaultByGroupId(params.groupId)
      if (!vault) return { ok: false, response: formatAssistantOnlyBlocked('/coin') }
      return handleCoinCommand({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        text: raw,
        role: resolveVaultRole({ senderWallet: params.senderWallet, vault }),
        vault,
      })
    }

    const vault = await getKeeprVaultByGroupId(params.groupId)
    return executeKeeprCommandFamily({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: raw,
      vault,
      role: resolveVaultRole({ senderWallet: params.senderWallet, vault }),
    })
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'Keepr command failed')
    return {
      ok: false,
      response: toUserFacingAgentErrorMessage(agentError),
    }
  }
}
