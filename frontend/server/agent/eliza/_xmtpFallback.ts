import { toAgentError, toErrorDetails } from './_errors.js'
import { processXmtpAgentInput } from '../core/processXmtpAgentInput.js'

type XmtpFallbackLogger = {
  error: (message: string, data?: Record<string, unknown>) => void
}

type XmtpFallbackParams = {
  text: string
  conversationId: string
  senderAddress?: string | null
  runtimeBridge: unknown
  inboundMemory: unknown
  state: Record<string, unknown>
  logger: XmtpFallbackLogger
}

export async function handleXmtpFallbackResponse(
  params: XmtpFallbackParams,
): Promise<string> {
  try {
    const fallbackSenderWallet =
      typeof params.senderAddress === 'string' && params.senderAddress.trim()
        ? params.senderAddress.trim().toLowerCase()
        : '0x0000000000000000000000000000000000000000'
    const processed = await processXmtpAgentInput({
      text: params.text,
      groupId: params.conversationId,
      senderWallet: fallbackSenderWallet,
      runtimeContext: {
        runtimeBridge: params.runtimeBridge as any,
        inboundMemory: params.inboundMemory,
        state: params.state,
      },
    })
    return processed.responseText || "I couldn't generate a response right now. Try again later."
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'LLM fallback failed')
    params.logger.error('[eliza] llm fallback failed', {
      error: agentError.message,
      code: agentError.code,
      details: toErrorDetails(agentError),
    })
    if (agentError.code === 'BUDGET_EXCEEDED') {
      return 'Daily AI budget limit reached for this agent. Please try again tomorrow.'
    }
    return "I couldn't generate a response right now. Try again later."
  }
}
