import { handleTwitterCommand, type TwitterRole } from '../../twitter/commands.js'
import { executeDeterministicCommand } from './executeDeterministicCommand.js'
import { resolveVaultAccessRoleByGroupId, type VaultAccessRole } from './resolveVaultRole.js'
import type { TelegramSenderWalletSource } from './resolveIdentityContext.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const
const SENSITIVE_DM_COMMAND_PREFIXES = ['/send', 'send ', '/lock', '/unlock', '/coin create', '/coin deploy'] as const

export type TelegramAgentInputResult = {
  responseText: string
  action?: unknown
}

export type ProcessTelegramAgentInputParams = {
  text: string
  chatId: string
  userId: string
  groupId: string
  senderWallet: `0x${string}`
  senderWalletSource: TelegramSenderWalletSource
  isAdmin: boolean
  isPrivateChat: boolean
  emptyResponseFallback?: string
}

function isTwitterCommand(rawText: string): boolean {
  const lower = String(rawText ?? '').trim().toLowerCase()
  return /^(\/x|x)(\s|$)/.test(lower) || /^(\/tweet|tweet)(\s|$)/.test(lower)
}

function isSensitiveDmCommand(text: string): boolean {
  const lower = String(text ?? '').trim().toLowerCase()
  return SENSITIVE_DM_COMMAND_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

async function resolveTwitterRole(params: {
  isAdmin: boolean
  groupId: string
  senderWallet: `0x${string}`
  senderWalletSource: TelegramSenderWalletSource
}): Promise<TwitterRole> {
  if (params.isAdmin) return 'ADMIN'
  if (params.senderWalletSource !== 'user_map') return 'MEMBER'

  const normalizedWallet = params.senderWallet.trim().toLowerCase()
  if (normalizedWallet === ZERO_ADDRESS) return 'MEMBER'

  try {
    const role: VaultAccessRole = await resolveVaultAccessRoleByGroupId({
      groupId: params.groupId,
      wallet: normalizedWallet,
    })
    return role
  } catch (error) {
    console.warn('[agent/core] failed to resolve vault role for twitter command', {
      groupId: params.groupId,
      err: error instanceof Error ? error.message : String(error),
    })
    return 'MEMBER'
  }
}

export async function processTelegramAgentInput(
  params: ProcessTelegramAgentInputParams,
): Promise<TelegramAgentInputResult> {
  if (isTwitterCommand(params.text)) {
    const role = await resolveTwitterRole({
      isAdmin: params.isAdmin,
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      senderWalletSource: params.senderWalletSource,
    })
    const result = await handleTwitterCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text: params.text,
      role,
    })
    return { responseText: String(result.response ?? '').trim() }
  }

  if (params.isPrivateChat && isSensitiveDmCommand(params.text)) {
    return {
      responseText: 'This command is only available in group chats, not private DMs.',
    }
  }

  const result = await executeDeterministicCommand({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: params.text,
    chatId: params.chatId,
    userId: params.userId,
    emptyResponseFallback: params.emptyResponseFallback,
  })

  return {
    responseText: result.responseText,
    ...('action' in result ? { action: result.action } : {}),
  }
}
