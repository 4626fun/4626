import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createRuntimeBridgeMock,
  createInboundMemoryMock,
  createOutboundMemoryMock,
  runtimeCreateMemoryMock,
  composeStateMock,
  generateResponseMock,
  getAvailableProvidersMock,
  getElizaLlmServiceMock,
} = vi.hoisted(() => {
  const createInboundMemoryMock = vi.fn((msg: any) => ({
    id: 'mem-in',
    content: {
      role: 'user',
      text: msg.content,
      metadata: {
        conversationId: msg.conversationId,
        conversationType: msg.conversationType,
        senderAddress: msg.senderAddress,
      },
    },
  }))
  const createOutboundMemoryMock = vi.fn((conversationId: string, conversationType: string, content: string) => ({
    id: 'mem-out',
    content: {
      role: 'assistant',
      text: content,
      metadata: {
        conversationId,
        conversationType,
        senderAddress: null,
      },
    },
  }))
  const runtimeCreateMemoryMock = vi.fn(async (..._args: any[]) => undefined)
  const composeStateMock = vi.fn(async () => ({
    recentMessages: [],
  }))
  const createRuntimeBridgeMock = vi.fn(() => ({
    runtime: {
      createMemory: runtimeCreateMemoryMock,
    },
    createInboundMemory: createInboundMemoryMock,
    createOutboundMemory: createOutboundMemoryMock,
    composeState: composeStateMock,
  }))

  const generateResponseMock = vi.fn(async () => ({
    text: 'memory-aware reply',
    provider: 'Groq',
    attempts: [],
  }))
  const getAvailableProvidersMock = vi.fn(() => [{ name: 'Groq' }])
  const getElizaLlmServiceMock = vi.fn(() => ({
    generateResponse: generateResponseMock,
    getAvailableProviders: getAvailableProvidersMock,
  }))

  return {
    createRuntimeBridgeMock,
    createInboundMemoryMock,
    createOutboundMemoryMock,
    runtimeCreateMemoryMock,
    composeStateMock,
    generateResponseMock,
    getAvailableProvidersMock,
    getElizaLlmServiceMock,
  }
})

vi.mock('../../agent/eliza/runtimeBridge.js', () => ({
  createRuntimeBridge: createRuntimeBridgeMock,
}))

vi.mock('../../agent/eliza/llm.js', () => ({
  getElizaLlmService: getElizaLlmServiceMock,
}))

describe('generateLlmResponse memory integration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getAvailableProvidersMock.mockReturnValue([{ name: 'Groq' }])
    runtimeCreateMemoryMock.mockResolvedValue(undefined)
    composeStateMock.mockResolvedValue({
      recentMessages: [],
    })
    generateResponseMock.mockResolvedValue({
      text: 'memory-aware reply',
      provider: 'Groq',
      attempts: [],
    })
  })

  it('injects recent conversation history into LLM context', async () => {
    composeStateMock.mockResolvedValueOnce({
      recentMessages: [
        { role: 'user', text: 'What was my vault status?' },
        { role: 'assistant', text: 'Your vault is healthy and unlocked.' },
        { role: 'user', text: 'Can you restate that with one action item?' },
      ],
    } as any)

    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:7726886643',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: 'Can you restate that with one action item?',
      vault: null,
    })

    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.vaultContext).toContain('[conversation_history]')
    expect(call?.vaultContext).toContain('user: What was my vault status?')
    expect(call?.vaultContext).toContain('assistant: Your vault is healthy and unlocked.')
    expect(call?.vaultContext).not.toContain('user: Can you restate that with one action item?')
  })

  it('injects warm memory blocks into LLM context when available', async () => {
    composeStateMock.mockResolvedValueOnce({
      recentMessages: [{ role: 'assistant', text: 'Prior answer from earlier turn.' }],
      memorySnapshotBlock: '<memory_snapshot>\n<summary>User wants Base-first actions.</summary>\n</memory_snapshot>',
      factCardsBlock: '<fact_cards>\n<fact entity="user_style" confidence="0.90">prefers concise responses</fact>\n</fact_cards>',
      openTasksBlock: '<open_tasks>\n<task id="1" status="open">Ship staged rollout</task>\n</open_tasks>',
      semanticRecallBlock:
        '<semantic_recall>\n<hit role="assistant" score="0.77" ts="2026-03-14T08:00:00.000Z">Use lower slippage for volatile routes.</hit>\n</semantic_recall>',
    } as any)

    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:7726886643',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: 'What should we do next?',
      vault: null,
    })

    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.vaultContext).toContain('<memory_snapshot>')
    expect(call?.vaultContext).toContain('<fact_cards>')
    expect(call?.vaultContext).toContain('<open_tasks>')
    expect(call?.vaultContext).toContain('<semantic_recall>')
  })

  it('persists inbound and outbound memory around the LLM call', async () => {
    const events: string[] = []
    runtimeCreateMemoryMock.mockImplementation(async (memory: any) => {
      events.push(`memory:${String(memory?.content?.role ?? 'unknown')}`)
    })
    generateResponseMock.mockImplementation(async () => {
      events.push('llm')
      return {
        text: 'reply from model',
        provider: 'Groq',
        attempts: [],
      }
    })

    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-42',
      senderWallet: '0x2222222222222222222222222222222222222222',
      text: '/ai summarize this',
      vault: null,
    })

    expect(createInboundMemoryMock).toHaveBeenCalledTimes(1)
    expect(createOutboundMemoryMock).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['memory:user', 'llm', 'memory:assistant'])
  })

  it('falls back to stateless generation when memory persistence fails', async () => {
    runtimeCreateMemoryMock.mockRejectedValueOnce(new Error('db unavailable'))
    generateResponseMock.mockResolvedValueOnce({
      text: 'fallback still works',
      provider: 'Groq',
      attempts: [],
    })

    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-99',
      senderWallet: '0x3333333333333333333333333333333333333333',
      text: '/ai hello',
      vault: null,
    })

    expect(result).toEqual({ ok: true, response: 'fallback still works' })
    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.vaultContext).toBe('')
    expect(createOutboundMemoryMock).not.toHaveBeenCalled()
  })

  it('answers stack questions with deterministic runtime facts', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x4444444444444444444444444444444444444444',
      text: 'what is your current stack',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('unverified in current runtime')
    expect(result.response).toContain('Telegram + XMTP')
    expect(result.response).toContain('Coinbase Smart Wallet')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers stack questions without requiring the word current', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x4444444444444444444444444444444444444444',
      text: 'what is your stack',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('unverified in current runtime')
    expect(result.response).toContain('Telegram + XMTP')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers ElizaOS connection questions with bounded fallback when runtime is unverified', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'are you connected to elizaOS?',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response.toLowerCase()).toContain("can't verify a live elizaos connection")
    expect(result.response).toContain('Telegram')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers ElizaOS connection questions affirmatively only when runtime verification is true', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'are you connected to elizaOS?',
      vault: null,
      runtimeTruth: {
        isElizaConnected: true,
      },
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Yes')
    expect(result.response).toContain('ElizaOS')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers ElizaOS identity questions with typo variants without forced yes', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'are you elizao',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response.toLowerCase()).toContain("can't verify")
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('Telegram')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers persistent memory questions with bounded fallback when memory is unverified', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'hi do you have persistent memory now?',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('I only have access to the current chat context')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers persistent memory questions affirmatively when memory is verified', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'hi do you have persistent memory now?',
      vault: null,
      runtimeTruth: {
        hasPersistentMemory: true,
      },
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Yes')
    expect(result.response.toLowerCase()).toContain('memory')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers Eliza remember prompts with memory limits when unverified', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'I thought elizaOS allowed you to remember though',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('current chat context')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers generic identity prompts without LLM drift', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x7777777777777777777777777777777777777777',
      text: 'who are you',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Akitai (Keepr)')
    expect(result.response).toContain('Runtime status:')
    expect(result.response).toContain('Telegram')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers uncommon who-are-you variants like whomst', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x7777777777777777777777777777777777777777',
      text: 'whomst are you',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Akitai (Keepr)')
    expect(result.response).toContain('Runtime status:')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers vault deployment flow questions with bounded fallback when unverified', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x7777777777777777777777777777777777777777',
      text: 'How does vault deployment flow work in the app?',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain("can't verify the exact in-app deployment steps")
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('uses verified deployment flow context when provided', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x7777777777777777777777777777777777777777',
      text: 'How does vault deployment flow work in the app?',
      vault: null,
      runtimeTruth: {
        hasVerifiedDeploymentFlow: true,
        deploymentFlowSource: 'docs',
        deploymentFlowSummary: 'Phase 1 deploys vault + wrapper, then later phases activate strategies and launch.',
      },
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('verified docs context')
    expect(result.response).toContain('Phase 1 deploys vault + wrapper')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('injects channel-aware identity guardrails in the LLM system prompt', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-identity',
      senderWallet: '0x6666666666666666666666666666666666666666',
      text: '/ai summarize vault status',
      vault: null,
    })

    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.systemPrompt).toContain('You are Akitai (Keepr), the 4626 assistant.')
    expect(call?.systemPrompt).toContain('currently responding inside Telegram')
    expect(call?.systemPrompt).toContain('Never claim you are Meta AI')
    expect(call?.systemPrompt).toContain('Only claim live ElizaOS connection when runtime verification is true')
  })
})
