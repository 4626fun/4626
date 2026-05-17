import { isAddressLike, isServerAdminAddress } from '../../_lib/infra/trust.js'

export type AgentSessionSource = 'xmtp' | 'telegram'

export type AgentSessionContext = {
  address: `0x${string}`
  isAdmin: boolean
  source: AgentSessionSource
}

export type TelegramSenderWalletSource = 'user_map' | 'default' | 'zero'

export type TelegramIdentityContext = {
  groupId: string
  senderWallet: `0x${string}`
  senderWalletSource: TelegramSenderWalletSource
  session: AgentSessionContext | null
}

type TelegramIdentityResolverDeps = {
  isPrivateChatId: (chatId: string) => boolean
  resolveGroupId: (chatId: string) => string
  resolveSenderWalletWithSource: (userId: string) => {
    wallet: `0x${string}`
    source: TelegramSenderWalletSource
  }
}

export function buildAgentSessionContext(params: {
  address: string | null | undefined
  source: AgentSessionSource
  isAdmin?: boolean
}): AgentSessionContext | null {
  if (!params.address || !isAddressLike(params.address)) return null
  const normalized = params.address.toLowerCase() as `0x${string}`
  return {
    address: normalized,
    isAdmin: params.isAdmin === true || isServerAdminAddress(normalized),
    source: params.source,
  }
}

export function resolveTelegramIdentityContext(
  params: {
    chatId: string
    userId: string
    isAdmin: boolean
    zeroAddress: `0x${string}`
  } & TelegramIdentityResolverDeps,
): TelegramIdentityContext {
  if (params.isPrivateChatId(params.chatId) && !params.isAdmin) {
    return {
      groupId: `telegram:${params.chatId}`,
      senderWallet: params.zeroAddress,
      senderWalletSource: 'zero',
      session: null,
    }
  }

  const resolvedSenderWallet = params.resolveSenderWalletWithSource(params.userId)
  return {
    groupId: params.resolveGroupId(params.chatId),
    senderWallet: resolvedSenderWallet.wallet,
    senderWalletSource: resolvedSenderWallet.source,
    session: buildAgentSessionContext({
      address: resolvedSenderWallet.wallet,
      source: 'telegram',
      isAdmin: params.isAdmin,
    }),
  }
}
