import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentError } from './_errors.ts'

const { processXmtpAgentInputMock } = vi.hoisted(() => ({
  processXmtpAgentInputMock: vi.fn(),
}))

vi.mock('../core/processXmtpAgentInput.js', () => ({
  processXmtpAgentInput: processXmtpAgentInputMock,
}))

import { handleXmtpFallbackResponse } from './_xmtpFallback.ts'

describe('handleXmtpFallbackResponse', () => {
  const logger = {
    error: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns numbered fallback text for unknown slash commands', async () => {
    processXmtpAgentInputMock.mockResolvedValue({
      responseText: 'I did not recognize that slash command.\n1. /keepr status',
    })

    const result = await handleXmtpFallbackResponse({
      text: '/unknown',
      conversationId: 'xmtp:conversation-1',
      senderAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      runtimeBridge: {},
      inboundMemory: { id: 'mem-1' },
      state: {},
      logger,
    })

    expect(processXmtpAgentInputMock).toHaveBeenCalledWith(expect.objectContaining({
      text: '/unknown',
      groupId: 'xmtp:conversation-1',
      senderWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }))
    expect(result).toContain('I did not recognize that slash command.')
  })

  it('returns empty-ai guidance without rewriting it', async () => {
    processXmtpAgentInputMock.mockResolvedValue({
      responseText: 'Ask me anything about this vault or DeFi on Base.',
    })

    const result = await handleXmtpFallbackResponse({
      text: '/ai   ',
      conversationId: 'xmtp:conversation-2',
      senderAddress: null,
      runtimeBridge: {},
      inboundMemory: { id: 'mem-2' },
      state: {},
      logger,
    })

    expect(processXmtpAgentInputMock).toHaveBeenCalledWith(expect.objectContaining({
      senderWallet: '0x0000000000000000000000000000000000000000',
    }))
    expect(result).toBe('Ask me anything about this vault or DeFi on Base.')
  })

  it('maps budget errors to the user-facing budget message', async () => {
    processXmtpAgentInputMock.mockRejectedValue(
      new AgentError('BUDGET_EXCEEDED', 'budget exceeded'),
    )

    const result = await handleXmtpFallbackResponse({
      text: '@keepr hello',
      conversationId: 'xmtp:conversation-3',
      senderAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      runtimeBridge: {},
      inboundMemory: { id: 'mem-3' },
      state: {},
      logger,
    })

    expect(result).toBe('Daily AI budget limit reached for this agent. Please try again tomorrow.')
    expect(logger.error).toHaveBeenCalledWith('[eliza] llm fallback failed', expect.objectContaining({
      code: 'BUDGET_EXCEEDED',
    }))
  })
})
