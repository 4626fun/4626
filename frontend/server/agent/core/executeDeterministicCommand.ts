import { handleKeeprCommand, type KeeprCommandResult } from '../../keepr/commands.js'

export type DeterministicCommandResult = {
  ok: boolean
  responseText: string
  rawResponseText: string
  action?: unknown
}

type ExecuteDeterministicCommandParams = {
  groupId: string
  senderWallet: `0x${string}`
  text: string
  chatId?: string
  userId?: string
  emptyResponseFallback?: string
}

function normalizeKeeprCommandResult(params: {
  result: KeeprCommandResult
  emptyResponseFallback?: string
}): DeterministicCommandResult {
  const rawResponseText = typeof params.result.response === 'string' ? params.result.response.trim() : ''
  return {
    ok: params.result.ok,
    responseText: rawResponseText || params.emptyResponseFallback || 'Command received.',
    rawResponseText,
    ...('action' in params.result ? { action: params.result.action } : {}),
  }
}

export async function executeDeterministicCommand(
  params: ExecuteDeterministicCommandParams,
): Promise<DeterministicCommandResult> {
  const result = await handleKeeprCommand({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: params.text,
    ...(params.chatId ? { chatId: params.chatId } : {}),
    ...(params.userId ? { userId: params.userId } : {}),
  })

  return normalizeKeeprCommandResult({
    result,
    emptyResponseFallback: params.emptyResponseFallback,
  })
}

export { normalizeKeeprCommandResult }
