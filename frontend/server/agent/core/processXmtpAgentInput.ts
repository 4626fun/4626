import type { SharedConversationalRuntimeContext } from '../../ai/chat.js'
import { formatNumberedCommandFallback } from '../../_lib/chatCommandFallback.js'
import { executeConversationalFallback } from './executeConversationalFallback.js'
import { isConversationalAgentInput, normalizeConversationalPrompt } from './conversationalInput.js'

export type ProcessXmtpAgentInputParams = {
  text: string
  groupId: string
  senderWallet: string
  runtimeContext: SharedConversationalRuntimeContext
}

export type XmtpAgentInputResult = {
  responseText: string
}

export async function processXmtpAgentInput(
  params: ProcessXmtpAgentInputParams,
): Promise<XmtpAgentInputResult> {
  if (!isConversationalAgentInput(params.text)) {
    return {
      responseText: formatNumberedCommandFallback({
        intro: 'I did not recognize that slash command.',
      }),
    }
  }

  if (!normalizeConversationalPrompt(params.text)) {
    return { responseText: 'Ask me anything about this vault or DeFi on Base.' }
  }

  const result = await executeConversationalFallback({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: params.text,
    runtimeContext: params.runtimeContext,
    allowActionExecution: false,
  })

  return {
    responseText: result.responseText,
  }
}
