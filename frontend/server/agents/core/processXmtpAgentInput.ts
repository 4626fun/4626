import type { SharedConversationalRuntimeContext } from '../../ai/chat.js'
import {
  formatAiPromptGuidance,
  formatNumberedCommandFallback,
  resolveInboundMenuText,
} from '../../_lib/messaging/chatCommandFallback.js'
import { executeConversationalFallback } from './executeConversationalFallback.js'
import { executeDeterministicCommand } from './executeDeterministicCommand.js'
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
  const menuRoute = resolveInboundMenuText(params.text)
  if (menuRoute.kind === 'invalid') {
    return {
      responseText: formatNumberedCommandFallback({
        intro: `No option ${menuRoute.selection}.`,
        includeHint: 'Reply with 1–5 or type a command like /help.',
      }),
    }
  }
  if (menuRoute.kind === 'ai_prompt') {
    return { responseText: formatAiPromptGuidance() }
  }

  const routedText = menuRoute.kind === 'command' ? menuRoute.resolvedText : params.text

  if (!isConversationalAgentInput(routedText)) {
    if (menuRoute.kind === 'command' && routedText.startsWith('/')) {
      const deterministic = await executeDeterministicCommand({
        groupId: params.groupId,
        senderWallet: params.senderWallet,
        text: routedText,
      })
      return { responseText: deterministic.responseText }
    }
    return {
      responseText: formatNumberedCommandFallback({
        intro: 'I did not recognize that slash command.',
      }),
    }
  }

  const resolvedPrompt = resolveConversationalPrompt(routedText)
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
