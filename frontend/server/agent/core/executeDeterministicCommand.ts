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
  result: KeeprCommandResult | null | undefined
  emptyResponseFallback?: string
}): DeterministicCommandResult {
  const result = params.result ?? { ok: false as const, response: '' }
  const rawResponseText = typeof result.response === 'string' ? result.response.trim() : ''
  return {
    ok: result.ok,
    responseText: rawResponseText || params.emptyResponseFallback || 'Command received.',
    rawResponseText,
    ...('action' in result ? { action: result.action } : {}),
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
