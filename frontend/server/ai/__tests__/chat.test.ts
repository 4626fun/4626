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
    expect(result.response).toContain('Telegram + XMTP')
    expect(result.response).toContain('Coinbase Smart Wallet')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers ElizaOS connection questions explicitly', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'are you connected to elizaOS?',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response.toLowerCase()).toContain('yes')
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('Telegram')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers ElizaOS identity questions with typo variants', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:-100123',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: 'are you elizao',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response.toLowerCase()).toContain('yes')
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('Telegram')
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
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('Telegram')
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
  })
})
