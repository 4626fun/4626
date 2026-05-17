import { beforeEach, describe, expect, it, vi } from 'vitest'

const CHARACTER_SYSTEM_PROMPT = 'You are Akitai (Keepr), the 4626 assistant. Be helpful and concise.'

const {
  createRuntimeBridgeMock,
  createInboundMemoryMock,
  createOutboundMemoryMock,
  runtimeCreateMemoryMock,
  runtimeProcessActionsMock,
  composeStateMock,
  rankActionsMock,
  generateResponseMock,
  getAvailableProvidersMock,
  getElizaLlmServiceMock,
  keeprProviderMock,
  knowledgeProviderMock,
  resolveCharacterRuntimeConfigMock,
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
      metadata: { conversationId, conversationType, senderAddress: null },
    },
  }))
  const runtimeCreateMemoryMock = vi.fn(async (..._args: any[]) => undefined)
  const runtimeProcessActionsMock = vi.fn(async (..._args: any[]) => [])
  const composeStateMock = vi.fn(async () => ({
    recentMessages: [],
  }))
  const rankActionsMock = vi.fn(async (..._args: any[]): Promise<any[]> => [])
  const createRuntimeBridgeMock = vi.fn(() => ({
    runtime: {
      createMemory: runtimeCreateMemoryMock,
      composeState: composeStateMock,
      processActions: runtimeProcessActionsMock,
    },
    createInboundMemory: createInboundMemoryMock,
    createOutboundMemory: createOutboundMemoryMock,
    rankActions: rankActionsMock,
  }))

  const keeprProviderMock = { name: 'vault-info', get: vi.fn(async () => ({ text: '' })) }
  const knowledgeProviderMock = { name: 'knowledge', get: vi.fn(async () => ({ text: '' })) }

  const generateResponseMock = vi.fn(async () => ({
    text: 'eliza-runtime reply',
    provider: 'Groq',
    attempts: [],
  }))
  const getAvailableProvidersMock = vi.fn(() => [{ name: 'Groq' }])
  const getElizaLlmServiceMock = vi.fn(() => ({
    generateResponse: generateResponseMock,
    getAvailableProviders: getAvailableProvidersMock,
  }))
  const resolveCharacterRuntimeConfigMock = vi.fn(() => ({
    systemPrompt: 'You are Akitai (Keepr), the 4626 assistant. Be helpful and concise.',
    preferredModel: 'test-model',
    settings: { CHARACTER_NAME: 'Akitai' },
  }))

  return {
    createRuntimeBridgeMock,
    createInboundMemoryMock,
    createOutboundMemoryMock,
    runtimeCreateMemoryMock,
    runtimeProcessActionsMock,
    composeStateMock,
    rankActionsMock,
    generateResponseMock,
    getAvailableProvidersMock,
    getElizaLlmServiceMock,
    keeprProviderMock,
    knowledgeProviderMock,
    resolveCharacterRuntimeConfigMock,
  }
})

vi.mock('../../agents/eliza/runtimeBridge.js', () => ({
  createRuntimeBridge: createRuntimeBridgeMock,
}))
vi.mock('../../agents/eliza/llm.js', () => ({
  getElizaLlmService: getElizaLlmServiceMock,
}))
vi.mock('../../agents/eliza/character.js', () => ({
  resolveCharacterRuntimeConfig: resolveCharacterRuntimeConfigMock,
}))
vi.mock('../../agents/eliza/plugins/keepr/index.js', () => ({
  keeprPlugin: { name: 'keepr', actions: [], providers: [keeprProviderMock] },
}))
vi.mock('../../agents/eliza/plugins/zora/index.js', () => ({
  zoraPlugin: { name: 'zora', actions: [], providers: [] },
}))
vi.mock('../../agents/eliza/plugins/uniswap/index.js', () => ({
  uniswapPlugin: { name: 'uniswap', actions: [], providers: [] },
}))
vi.mock('../../agents/eliza/plugins/lens/index.js', () => ({
  lensPlugin: { name: 'lens', actions: [], providers: [] },
}))
vi.mock('../../agents/eliza/plugins/walletIntel/index.js', () => ({
  walletIntelPlugin: { name: 'walletIntel', actions: [], providers: [] },
}))
vi.mock('../../agents/eliza/plugins/reputation/index.js', () => ({
  reputationPlugin: { name: 'reputation', actions: [], providers: [] },
}))
vi.mock('../../agents/eliza/plugins/keeperOps/index.js', () => ({
  keeprOpsPlugin: { name: 'keeper-ops', actions: [], providers: [] },
}))
vi.mock('../../agents/eliza/plugins/knowledge/index.js', () => ({
  knowledgePlugin: { name: 'knowledge', actions: [], providers: [knowledgeProviderMock] },
}))

describe('generateLlmResponse memory integration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getAvailableProvidersMock.mockReturnValue([{ name: 'Groq' }])
    runtimeCreateMemoryMock.mockResolvedValue(undefined)
    runtimeProcessActionsMock.mockResolvedValue([])
    composeStateMock.mockResolvedValue({
      recentMessages: [],
    })
    generateResponseMock.mockResolvedValue({
      text: 'eliza-runtime reply',
      provider: 'Groq',
      attempts: [],
    })
    keeprProviderMock.get.mockResolvedValue({ text: '' })
    knowledgeProviderMock.get.mockResolvedValue({ text: '' })
  })

  // -----------------------------------------------------------------------
  // Action ranking
  // -----------------------------------------------------------------------

  it('uses rankActions to find matching actions (not processActions)', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-1',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai hello',
      vault: null,
    })

    expect(rankActionsMock).toHaveBeenCalledTimes(1)
    expect(rankActionsMock).toHaveBeenCalledWith('hello', expect.anything())
  })

  it('returns action reply when an action candidate produces text', async () => {
    const handlerMock = vi.fn(async (_rt: any, _mem: any, _state: any, _opts: any, cb: any) => {
      await cb({ text: 'vault status: healthy' })
    })
    rankActionsMock.mockResolvedValueOnce([
      { action: { name: 'KPR_COMMAND', handler: handlerMock, validate: vi.fn() }, score: 0.95, reason: 'keepr_prefix' },
    ])

    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-2',
      senderWallet: '0x2222222222222222222222222222222222222222',
      text: '/keepr status',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toBe('vault status: healthy')
    expect(result.handledByRuntime).toBe(true)
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('skips failed action candidates and continues to next', async () => {
    const failHandler = vi.fn(async () => { throw new Error('action failed') })
    const succeedHandler = vi.fn(async (_rt: any, _mem: any, _state: any, _opts: any, cb: any) => {
      await cb({ text: 'fallback action reply' })
    })
    rankActionsMock.mockResolvedValueOnce([
      { action: { name: 'FAIL_ACTION', handler: failHandler, validate: vi.fn() }, score: 0.9, reason: 'test' },
      { action: { name: 'OK_ACTION', handler: succeedHandler, validate: vi.fn() }, score: 0.8, reason: 'test' },
    ])

    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-3',
      senderWallet: '0x3333333333333333333333333333333333333333',
      text: 'test action',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toBe('fallback action reply')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // LLM fallback with character prompt
  // -----------------------------------------------------------------------

  it('falls back to LLM with character systemPrompt when no action matches', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-4',
      senderWallet: '0x4444444444444444444444444444444444444444',
      text: '/ai summarize vault status',
      vault: null,
    })

    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.systemPrompt).toContain(CHARACTER_SYSTEM_PROMPT)
    expect(call?.preferredModel).toBe('test-model')
  })

  it('uses provided runtime context and skips action execution when disabled', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const providedBridge = createRuntimeBridgeMock()

    await generateLlmResponse({
      groupId: 'xmtp:chat-7',
      senderWallet: '0x7777777777777777777777777777777777777777',
      text: 'plain text question',
      vault: null,
      runtimeContext: {
        runtimeBridge: providedBridge as any,
        inboundMemory: { id: 'provided-inbound', __persistedToDb: true },
        state: {
          recentMessages: [{ role: 'user', text: 'previous turn' }],
        },
      },
      allowActionExecution: false,
    })

    expect(rankActionsMock).not.toHaveBeenCalled()
    expect(createInboundMemoryMock).not.toHaveBeenCalled()
    expect(generateResponseMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT use custom identity/truth system prompts', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-5',
      senderWallet: '0x5555555555555555555555555555555555555555',
      text: '/ai what is your favorite chain',
      vault: null,
    })

    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.systemPrompt).not.toContain('currently responding inside Telegram')
    expect(call?.systemPrompt).not.toContain('Only claim live ElizaOS connection when runtime verification is true')
    expect(String(call?.vaultContext ?? '')).toContain('currently responding inside Telegram')
  })

  it('includes continuity context (memory blocks) in LLM system prompt', async () => {
    composeStateMock.mockResolvedValueOnce({
      recentMessages: [{ role: 'user', text: 'prior message' }],
      memorySnapshotBlock: '<memory_snapshot>\n<summary>User prefers Base.</summary>\n</memory_snapshot>',
      factCardsBlock: '<fact_cards>\n<fact entity="pref" confidence="0.9">concise</fact>\n</fact_cards>',
      openTasksBlock: '<open_tasks>\n<task id="1" status="open">Ship it</task>\n</open_tasks>',
    } as any)

    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-6',
      senderWallet: '0x6666666666666666666666666666666666666666',
      text: 'What should we do next?',
      vault: null,
    })

    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.systemPrompt).toContain('<memory_snapshot>')
    expect(call?.systemPrompt).toContain('<fact_cards>')
    expect(call?.systemPrompt).toContain('<open_tasks>')
  })

  // -----------------------------------------------------------------------
  // Context providers
  // -----------------------------------------------------------------------

  it('calls context providers for LLM fallback and passes vault context', async () => {
    keeprProviderMock.get.mockResolvedValueOnce({ text: 'Vault: 0xABC, Status: active' })

    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-7',
      senderWallet: '0x7777777777777777777777777777777777777777',
      text: 'what is the vault status',
      vault: null,
    })

    expect(keeprProviderMock.get).toHaveBeenCalledTimes(1)
    expect(knowledgeProviderMock.get).toHaveBeenCalledTimes(1)
    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.vaultContext).toContain('Vault: 0xABC, Status: active')
  })

  it('includes wallet_context block when sender address is valid', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-8',
      senderWallet: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      text: 'show my balance',
      vault: null,
    })

    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.vaultContext).toContain('[wallet_context]')
    expect(call?.vaultContext).toContain('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  // -----------------------------------------------------------------------
  // Memory persistence
  // -----------------------------------------------------------------------

  it('persists inbound and outbound memory around the LLM call', async () => {
    const events: string[] = []
    runtimeCreateMemoryMock.mockImplementation(async (memory: any) => {
      events.push(`memory:${String(memory?.content?.role ?? 'unknown')}`)
    })
    generateResponseMock.mockImplementation(async () => {
      events.push('llm')
      return { text: 'reply from model', provider: 'Groq', attempts: [] }
    })

    const { generateLlmResponse } = await import('../chat.ts')
    await generateLlmResponse({
      groupId: 'telegram:chat-9',
      senderWallet: '0x9999999999999999999999999999999999999999',
      text: '/ai summarize this',
      vault: null,
    })

    expect(createInboundMemoryMock).toHaveBeenCalledTimes(1)
    expect(createOutboundMemoryMock).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['memory:user', 'llm', 'memory:assistant'])
  })

  it('returns bounded runtime fallback when runtime memory write fails', async () => {
    runtimeCreateMemoryMock.mockRejectedValueOnce(new Error('db unavailable'))

    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-10',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: 'run action',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain("can't verify a live ElizaOS connection")
    expect(generateResponseMock).not.toHaveBeenCalled()
    expect(createOutboundMemoryMock).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // handledByRuntime status
  // -----------------------------------------------------------------------

  it('returns handledByRuntime: true when runtime processes successfully', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-11',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai what is your stack',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.handledByRuntime).toBe(true)
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('verified in current runtime')
    expect(result.response).toContain('Telegram + XMTP')
    expect(result.response).toContain('Coinbase Smart Wallet')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('returns handledByRuntime: false when runtime is unavailable', async () => {
    createRuntimeBridgeMock.mockImplementationOnce(() => { throw new Error('bridge init failed') })

    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-12',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai what is your stack',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.handledByRuntime).toBe(false)
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('unverified in current runtime')
    expect(result.response).toContain('Telegram + XMTP')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers ElizaOS connection questions with bounded fallback when runtime is unverified', async () => {
    runtimeCreateMemoryMock.mockRejectedValueOnce(new Error('runtime unavailable'))
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-13',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai hello',
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
    runtimeCreateMemoryMock.mockRejectedValueOnce(new Error('runtime unavailable'))
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-14',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: 'who are you',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response.toLowerCase()).toContain('not verified')
    expect(result.response).toContain('ElizaOS')
    expect(result.response).toContain('Telegram')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('answers persistent memory questions with bounded fallback when memory is unverified', async () => {
    runtimeCreateMemoryMock.mockRejectedValueOnce(new Error('runtime unavailable'))
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
      groupId: 'telegram:chat-15',
      senderWallet: '0x1111111111111111111111111111111111111111',
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
    runtimeCreateMemoryMock.mockRejectedValueOnce(new Error('runtime unavailable'))
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-16',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: 'hi do you have persistent memory now?',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('current chat context')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('blocks AI commands when sender wallet is zero address', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-zero-wallet',
      senderWallet: '0x0000000000000000000000000000000000000000',
      text: '/ai summarize this',
      vault: null,
    })

    expect(result.ok).toBe(false)
    expect(result.handledByRuntime).toBe(false)
    expect(result.response).toContain('Connect a verified wallet to use AI commands.')
    expect(rankActionsMock).not.toHaveBeenCalled()
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('blocks AI commands when sender wallet matches sentinel placeholder format', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-sentinel-wallet',
      senderWallet: '0x00000000000000000000000000000000000000aa',
      text: '/ai summarize this',
      vault: null,
    })

    expect(result.ok).toBe(false)
    expect(result.handledByRuntime).toBe(false)
    expect(result.response).toContain('Connect a verified wallet to use AI commands.')
    expect(rankActionsMock).not.toHaveBeenCalled()
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('returns empty response for empty text', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-17',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '',
      vault: null,
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Akitai (Keepr)')
    expect(result.response).toContain('Runtime status:')
    expect(result.response).toContain('Telegram')
    expect(generateResponseMock).not.toHaveBeenCalled()
  })

  it('returns command fallback for unrecognized slash commands', async () => {
    const { generateLlmResponse } = await import('../chat.ts')
    const result = await generateLlmResponse({
      groupId: 'telegram:chat-18',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/unknown command',
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

  it('enforces per-group cooldown for back-to-back LLM requests', async () => {
    const { generateLlmResponse } = await import('../chat.ts')

    const first = await generateLlmResponse({
      groupId: 'telegram:chat-rate-limit',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai first request',
      vault: null,
    })
    const second = await generateLlmResponse({
      groupId: 'telegram:chat-rate-limit',
      senderWallet: '0x1111111111111111111111111111111111111111',
      text: '/ai second request',
      vault: null,
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    expect(second.response).toContain('AI is rate-limited')
    expect(second.handledByRuntime).toBe(true)
    expect(generateResponseMock).toHaveBeenCalledTimes(1)
    const call = (generateResponseMock as any).mock.calls[0]?.[0] as any
    expect(call?.systemPrompt).toContain('You are Akitai (Keepr), the 4626 assistant.')
    const merged = `${call?.systemPrompt ?? ''}\n${call?.vaultContext ?? ''}`
    expect(merged).toContain('currently responding inside Telegram')
    expect(merged).toContain('Never claim you are Meta AI')
    expect(merged).toContain('Only claim live ElizaOS connection when runtime verification is true')
  })
})
