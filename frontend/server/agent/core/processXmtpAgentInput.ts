import type { SharedConversationalRuntimeContext } from '../../ai/chat.js'
import { formatNumberedCommandFallback } from '../../_lib/chatCommandFallback.js'
import { executeConversationalFallback } from './executeConversationalFallback.js'
import {
  EMPTY_CONVERSATIONAL_PROMPT_RESPONSE,
  isConversationalAgentInput,
  resolveConversationalPrompt,
} from './conversationalInput.js'

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

  const resolvedPrompt = resolveConversationalPrompt(params.text)
  if (resolvedPrompt.kind === 'empty') {
    return { responseText: EMPTY_CONVERSATIONAL_PROMPT_RESPONSE }
  }

  const result = await executeConversationalFallback({
    groupId: params.groupId,
    senderWallet: params.senderWallet,
    text: resolvedPrompt.prompt,
    runtimeContext: params.runtimeContext,
    allowActionExecution: false,
  })

  return {
    responseText: result.responseText,
  }
}
