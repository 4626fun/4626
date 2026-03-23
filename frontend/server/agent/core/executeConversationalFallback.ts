import { getKeeprVaultByGroupId, type KeeprVaultRow } from '../../_lib/keeprRegistry.js'
import { generateLlmResponse, type SharedConversationalRuntimeContext } from '../../ai/chat.js'
import type { AssistantRuntimeTruthInput } from '../../ai/runtimeTruth.js'

export type ConversationalFallbackResult = {
  ok: boolean
  responseText: string
  handledByRuntime: boolean
}

type ExecuteConversationalFallbackParams = {
  groupId: string
  senderWallet: string
  text: string
  vault?: KeeprVaultRow | null
  runtimeTruth?: AssistantRuntimeTruthInput
  runtimeContext?: SharedConversationalRuntimeContext
  allowActionExecution?: boolean
}

export async function executeConversationalFallback(
  params: ExecuteConversationalFallbackParams,
): Promise<ConversationalFallbackResult> {
  const vault = params.vault === undefined
    ? await getKeeprVaultByGroupId(params.groupId)
    : params.vault

  const result = await generateLlmResponse({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: params.text,
    vault,
    ...(params.runtimeTruth ? { runtimeTruth: params.runtimeTruth } : {}),
    ...(params.runtimeContext ? { runtimeContext: params.runtimeContext } : {}),
    ...(params.allowActionExecution === false ? { allowActionExecution: false } : {}),
  })

  return {
    ok: result.ok,
    responseText: result.response,
    handledByRuntime: result.handledByRuntime,
  }
}

export default executeConversationalFallback
