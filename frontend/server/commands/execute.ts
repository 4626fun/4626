import { getKeeprVaultByGroupId } from '../_lib/keepr/keeprRegistry.js'
import { resolveVaultAccessRoleFromVault } from '../agent/core/resolveVaultRole.js'
import { toAgentError, toUserFacingAgentErrorMessage } from '../agent/eliza/_errors.js'
import { getCommandFamily } from './registry.js'
import { evaluateGroupAdminGate } from './telegramGroupAdminGate.js'
import type { ExecuteCommandParams, KeeprCommandResult, KeeprRole } from './types.js'
import { executeCoinCommandFamily } from './families/coin.js'
import { executeConversationalCommandFamily, looksLikeConversationalCommand } from './families/conversation.js'
import { executeHelpCommandFamily } from './families/help.js'
import { executeAlfaclubCommandFamily } from './families/alfaclub.js'
import {
  executeKeeprCommandFamily,
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



export async function executeCommand(params: ExecuteCommandParams): Promise<KeeprCommandResult> {
  const raw = (params.text ?? '').trim()

  try {
    const gate = await evaluateGroupAdminGate({
      text: raw,
      chatId: params.chatId,
      userId: params.userId,
    })
    if (!gate.allowed) return { ok: false, response: gate.response }

    const family = getCommandFamily(raw)
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
      case 'alfaclub':
        return executeAlfaclubCommandFamily({
          text: raw,
          senderWallet: params.senderWallet,
        })
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
