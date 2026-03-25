import { handleTwitterCommand, type TwitterRole } from '../../twitter/commands.js'
import { matchesCommandFamily } from '../../commands/registry.js'
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
  twitterConfirmMode?: 'preview_only' | 'allow_direct_confirm'
  emptyResponseFallback?: string
}

function isSensitiveDmCommand(text: string): boolean {
  const lower = String(text ?? '').trim().toLowerCase()
  return SENSITIVE_DM_COMMAND_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

function isTelegramTwitterPostCommand(rawText: string): boolean {
  const parts = String(rawText ?? '').trim().split(/\s+/g).filter(Boolean)
  const head = String(parts[0] ?? '').toLowerCase()
  if (head === '/tweet' || head === 'tweet') return parts.length >= 2
  return (head === '/x' || head === 'x') && String(parts[1] ?? '').toLowerCase() === 'post'
}

function stripTwitterConfirmFlags(rawText: string): string {
  const parts = String(rawText ?? '').trim().split(/\s+/g).filter(Boolean)
  const kept = parts.filter((part) => !/^[-\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]+confirm$/i.test(part))
  return kept.join(' ').trim()
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
  if (matchesCommandFamily(params.text, 'twitter')) {
    const twitterConfirmMode = params.twitterConfirmMode ?? 'preview_only'
    const role = await resolveTwitterRole({
      isAdmin: params.isAdmin,
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      senderWalletSource: params.senderWalletSource,
    })
    const text =
      twitterConfirmMode === 'preview_only' && isTelegramTwitterPostCommand(params.text)
        ? stripTwitterConfirmFlags(params.text)
        : params.text
    const result = await handleTwitterCommand({
      groupId: params.groupId,
      senderWallet: params.senderWallet,
      text,
      role,
    })
    return {
      responseText: String(result.response ?? '').trim(),
      ...('action' in result ? { action: result.action } : {}),
    }
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
