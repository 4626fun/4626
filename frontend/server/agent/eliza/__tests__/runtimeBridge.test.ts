import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDbMock,
  buildRuntimeSessionContextMock,
  tryUploadImmutableJsonMock,
  getGroveChainIdMock,
  resolveLensUriMock,
} = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  buildRuntimeSessionContextMock: vi.fn((address: string) => ({
    address,
    isAdmin: true,
    source: 'xmtp',
  })),
  tryUploadImmutableJsonMock: vi.fn(),
  getGroveChainIdMock: vi.fn(() => 232),
  resolveLensUriMock: vi.fn((uri: string) => uri),
}))

vi.mock('../../../_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../../_lib/session.js', () => ({
  buildRuntimeSessionContext: buildRuntimeSessionContextMock,
}))

vi.mock('../../../_lib/lensGrove.js', () => ({
  tryUploadImmutableJson: tryUploadImmutableJsonMock,
  getGroveChainId: getGroveChainIdMock,
  resolveLensUri: resolveLensUriMock,
}))

describe('runtime bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(null)
    tryUploadImmutableJsonMock.mockResolvedValue({
      ok: true,
      result: {
        storageKey: 'storage-key-1',
        gatewayUrl: 'https://api.grove.storage/ipfs/bafytestchunk',
        lensUri: 'lens://bafytestchunk',
        statusUrl: null,
      },
    })
    getGroveChainIdMock.mockReturnValue(232)
    resolveLensUriMock.mockImplementation((uri: string) => uri)
  })

  it('composes session-aware state and ranks matching actions', async () => {
    const { createRuntimeBridge } = await import('../runtimeBridge.ts')

    const creAction = {
      name: 'CRE_TRIGGER',
      validate: vi.fn(async () => true),
      handler: vi.fn(),
    }
    const genericAction = {
      name: 'GENERIC_ACTION',
      validate: vi.fn(async () => true),
      handler: vi.fn(),
    }
    const plugins = [{ name: 'test-plugin', actions: [genericAction, creAction] }] as any

    const bridge = createRuntimeBridge({
      agentKey: 'creator-1',
      plugins,
    })

    const message = bridge.createInboundMemory({
      conversationId: 'conv-1',
      conversationType: 'group',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: '/cre status',
    })

    await bridge.runtime.createMemory(message as any, 'messages' as any)
    const state = await bridge.composeState(message)
    const ranked = await bridge.rankActions('/cre status', message)

    expect((state as any).recentMessages).toHaveLength(1)
    expect((state as any).session).toEqual({
      address: '0x1111111111111111111111111111111111111111',
      isAdmin: true,
      source: 'xmtp',
    })
    expect(ranked.map((r) => r.action.name)).toEqual(['CRE_TRIGGER', 'GENERIC_ACTION'])
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0)
  })

  it('applies deterministic swarm-role bias to action ranking', async () => {
    const { createRuntimeBridge } = await import('../runtimeBridge.ts')

    const traderAction = {
      name: 'UNISWAP_SWAP',
      validate: vi.fn(async () => true),
      handler: vi.fn(),
    }
    const knowledgeAction = {
      name: 'KNOWLEDGE_LOOKUP',
      validate: vi.fn(async () => true),
      handler: vi.fn(),
    }
    const plugins = [{ name: 'test-plugin', actions: [knowledgeAction, traderAction] }] as any

    const bridge = createRuntimeBridge({
      agentKey: 'creator-trader',
      plugins,
      swarm: {
        role: 'trader',
        capabilities: ['uniswap', 'cre'],
      },
    })

    const message = bridge.createInboundMemory({
      conversationId: 'conv-role',
      conversationType: 'group',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'run action',
    })

    await bridge.runtime.createMemory(message as any, 'messages' as any)
    const ranked = await bridge.rankActions('run action', message)

    expect(ranked.map((r) => r.action.name)).toEqual(['UNISWAP_SWAP', 'KNOWLEDGE_LOOKUP'])
    expect(String(ranked[0]?.reason ?? '')).toContain('trader_')
  })

  it('persists memory rows when a DB is available', async () => {
    const db = {
      query: vi.fn(async () => ({ rows: [] })),
      sql: vi.fn(async () => ({ rows: [] })),
    }
    getDbMock.mockResolvedValue(db)

    const { createRuntimeBridge } = await import('../runtimeBridge.ts')
    const plugins = [] as any
    const bridge = createRuntimeBridge({
      agentKey: 'creator-2',
      plugins,
    })

    const inbound = bridge.createInboundMemory({
      conversationId: 'conv-2',
      conversationType: 'dm',
      senderAddress: '0x2222222222222222222222222222222222222222',
      content: 'hello',
    })
    await bridge.runtime.createMemory(inbound as any, 'messages' as any)

    const insertCall = (db.sql.mock.calls as any[]).find((call: any[]) =>
      String(call?.[0]?.[0] ?? '').includes('INSERT INTO agent_message_memory'),
    )
    expect(db.query).toHaveBeenCalled()
    expect(insertCall).toBeTruthy()
  })

  it('bounds tracked conversation history buckets', async () => {
    const { createRuntimeBridge } = await import('../runtimeBridge.ts')
    const bridge = createRuntimeBridge({
      agentKey: 'creator-3',
      plugins: [],
      history: {
        maxConversations: 2,
        maxMessagesPerConversation: 5,
      },
    } as any)

    const c1 = bridge.createInboundMemory({
      conversationId: 'conv-1',
      conversationType: 'group',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'hello 1',
    })
    await bridge.runtime.createMemory(c1 as any, 'messages' as any)

    const c2 = bridge.createInboundMemory({
      conversationId: 'conv-2',
      conversationType: 'group',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'hello 2',
    })
    await bridge.runtime.createMemory(c2 as any, 'messages' as any)

    const c3 = bridge.createInboundMemory({
      conversationId: 'conv-3',
      conversationType: 'group',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'hello 3',
    })
    await bridge.runtime.createMemory(c3 as any, 'messages' as any)

    const debug = (bridge as any).getDebugState?.()
    expect(debug?.trackedConversations).toBe(2)
    expect(debug?.conversationIds).toEqual(['conv-2', 'conv-3'])
  })

  it('hydrates warm memory artifacts into composed state', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const query = String(strings?.[0] ?? '')
        if (query.includes('FROM episodic_summaries')) {
          return {
            rows: [{ summary: 'User prefers concise updates and runs Base-only vault actions.' }],
          }
        }
        if (query.includes('FROM fact_cards')) {
          return {
            rows: [
              { entity: 'user_wallet', fact: 'primary wallet 0x1111111111111111111111111111111111111111', confidence: 0.98 },
              { entity: 'user_style', fact: 'prefers concise responses', confidence: 0.91 },
            ],
          }
        }
        if (query.includes('FROM task_loops')) {
          return {
            rows: [{ id: 1, task: 'Ship Telegram rollout flags in staging', status: 'open' }],
          }
        }
        return { rows: [] }
      }),
    }
    getDbMock.mockResolvedValue(db as any)

    const { createRuntimeBridge } = await import('../runtimeBridge.ts')
    const bridge = createRuntimeBridge({
      agentKey: 'creator-warm',
      plugins: [],
    })

    const inbound = bridge.createInboundMemory({
      conversationId: 'conv-warm',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'Please remember my wallet and current rollout task.',
    })
    await bridge.runtime.createMemory(inbound as any, 'messages' as any)
    const state = await bridge.composeState(inbound as any)

    expect((state as any).memorySnapshot?.summary).toContain('Base-only')
    expect(Array.isArray((state as any).factCards)).toBe(true)
    expect((state as any).factCards[0]?.entity).toBe('user_wallet')
    expect(Array.isArray((state as any).openTasks)).toBe(true)
    expect((state as any).openTasks[0]?.task).toContain('Telegram rollout flags')
  })

  it('extracts durable fact cards and tasks from user messages', async () => {
    const sqlMock = vi.fn(async (strings: TemplateStringsArray) => {
      const query = String(strings?.[0] ?? '')
      if (query.includes('SELECT role, content') && query.includes('FROM agent_message_memory')) {
        return {
          rows: [
            {
              role: 'user',
              content: 'My wallet is 0x1111111111111111111111111111111111111111. I prefer concise answers. TODO: verify metrics rollout.',
            },
          ],
        }
      }
      return { rows: [] }
    })
    const db = { sql: sqlMock }
    getDbMock.mockResolvedValue(db as any)

    const { createRuntimeBridge } = await import('../runtimeBridge.ts')
    const bridge = createRuntimeBridge({
      agentKey: 'creator-facts',
      plugins: [],
    })

    const inbound = bridge.createInboundMemory({
      conversationId: 'conv-facts',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'My wallet is 0x1111111111111111111111111111111111111111. I prefer concise answers. TODO: verify metrics rollout.',
    })
    await bridge.runtime.createMemory(inbound as any, 'messages' as any)

    const statements = (sqlMock.mock.calls as Array<any[]>).map((call) => String(call?.[0]?.[0] ?? ''))
    expect(statements.some((query) => query.includes('INSERT INTO fact_cards'))).toBe(true)
    expect(statements.some((query) => query.includes('INSERT INTO task_loops'))).toBe(true)
    expect(statements.some((query) => query.includes('INSERT INTO episodic_summaries'))).toBe(true)
  })

  it('archives encrypted chunk bundles to Grove and stores CID-backed manifest rows', async () => {
    const previousEnabled = process.env.ELIZA_GROVE_ARCHIVE_ENABLED
    const previousThreshold = process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD
    const previousInterval = process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES
    const previousKey = process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY
    process.env.ELIZA_GROVE_ARCHIVE_ENABLED = 'true'
    process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD = '2'
    process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES = '0'
    process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111'

    const memoryRows: Array<{ id: string; role: string; content: string; created_at: string }> = []
    let manifestRow: any = null
    const sqlMock = vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const query = String(strings?.[0] ?? '')
      if (query.includes('INSERT INTO agent_message_memory')) {
        memoryRows.push({
          id: String(values[0] ?? ''),
          role: String(values[4] ?? 'user'),
          content: String(values[8] ?? ''),
          created_at: new Date().toISOString(),
        })
        return { rows: [] }
      }
      if (query.includes('SELECT role, content') && query.includes('FROM agent_message_memory')) {
        return {
          rows: memoryRows.map((row) => ({ role: row.role, content: row.content })),
        }
      }
      if (query.includes('SELECT content') && query.includes("AND role = 'assistant'")) {
        return {
          rows: memoryRows
            .filter((row) => row.role === 'assistant')
            .map((row) => ({ content: row.content })),
        }
      }
      if (query.includes('SELECT COUNT(*)::int AS total_count')) {
        return { rows: [{ total_count: memoryRows.length }] }
      }
      if (query.includes('SELECT chunk_list, root_hash')) {
        return { rows: manifestRow ? [manifestRow] : [] }
      }
      if (query.includes('SELECT id, role, content, created_at')) {
        return {
          rows: memoryRows.slice(-2).map((row) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            created_at: row.created_at,
          })),
        }
      }
      if (query.includes('INSERT INTO grove_chat_manifests')) {
        manifestRow = {
          chunk_list: JSON.parse(String(values[1] ?? '[]')),
          root_hash: String(values[2] ?? ''),
          encryption_pubkey: values[3] ? String(values[3]) : null,
          last_archived_at: new Date().toISOString(),
          lens_profile_id: values[4] ? String(values[4]) : null,
        }
        return { rows: [] }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql: sqlMock } as any)

    const { createRuntimeBridge } = await import('../runtimeBridge.ts')
    const bridge = createRuntimeBridge({
      agentKey: 'creator-archive',
      plugins: [],
    })

    const inbound1 = bridge.createInboundMemory({
      conversationId: 'conv-archive',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'first secret message',
    })
    await bridge.runtime.createMemory(inbound1 as any, 'messages' as any)

    const inbound2 = bridge.createInboundMemory({
      conversationId: 'conv-archive',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'second secret message',
    })
    await bridge.runtime.createMemory(inbound2 as any, 'messages' as any)

    expect(tryUploadImmutableJsonMock).toHaveBeenCalledTimes(1)
    const uploadPayload = tryUploadImmutableJsonMock.mock.calls[0]?.[0]
    expect(typeof uploadPayload?.payload?.ciphertext).toBe('string')
    expect(typeof uploadPayload?.payload?.tag).toBe('string')
    expect(JSON.stringify(uploadPayload)).not.toContain('first secret message')
    expect(JSON.stringify(uploadPayload)).not.toContain('second secret message')

    const statements = (sqlMock.mock.calls as Array<any[]>).map((call) => String(call?.[0]?.[0] ?? ''))
    expect(statements.some((query) => query.includes('INSERT INTO grove_chat_manifests'))).toBe(true)
    expect(Array.isArray(manifestRow?.chunk_list)).toBe(true)
    expect(String(manifestRow?.chunk_list?.[0]?.cid ?? '')).toContain('lens://')

    if (typeof previousEnabled === 'string') process.env.ELIZA_GROVE_ARCHIVE_ENABLED = previousEnabled
    else delete process.env.ELIZA_GROVE_ARCHIVE_ENABLED
    if (typeof previousThreshold === 'string') process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD = previousThreshold
    else delete process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD
    if (typeof previousInterval === 'string') process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES = previousInterval
    else delete process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES
    if (typeof previousKey === 'string') process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY = previousKey
    else delete process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY
  })

  it('archives and restores Grove chunks with XMTP conversation key hints (no env key)', async () => {
    const previousEnabled = process.env.ELIZA_GROVE_ARCHIVE_ENABLED
    const previousThreshold = process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD
    const previousInterval = process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES
    const previousKey = process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY
    process.env.ELIZA_GROVE_ARCHIVE_ENABLED = 'true'
    process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD = '2'
    process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES = '0'
    delete process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY

    const xmtpConversationKey = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const memoryRows: Array<{ id: string; role: string; content: string; created_at: string }> = []
    let manifestRow: any = null
    const sqlArchiveMock = vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
      const query = String(strings?.[0] ?? '')
      if (query.includes('INSERT INTO agent_message_memory')) {
        memoryRows.push({
          id: String(values[0] ?? ''),
          role: String(values[4] ?? 'user'),
          content: String(values[8] ?? ''),
          created_at: new Date().toISOString(),
        })
        return { rows: [] }
      }
      if (query.includes('SELECT role, content') && query.includes('FROM agent_message_memory')) {
        return { rows: memoryRows.map((row) => ({ role: row.role, content: row.content })) }
      }
      if (query.includes('SELECT content') && query.includes("AND role = 'assistant'")) {
        return {
          rows: memoryRows
            .filter((row) => row.role === 'assistant')
            .map((row) => ({ content: row.content })),
        }
      }
      if (query.includes('SELECT COUNT(*)::int AS total_count')) {
        return { rows: [{ total_count: memoryRows.length }] }
      }
      if (query.includes('SELECT chunk_list, root_hash')) {
        return { rows: manifestRow ? [manifestRow] : [] }
      }
      if (query.includes('SELECT id, role, content, created_at')) {
        return {
          rows: memoryRows.slice(-2).map((row) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            created_at: row.created_at,
          })),
        }
      }
      if (query.includes('INSERT INTO grove_chat_manifests')) {
        manifestRow = {
          chunk_list: JSON.parse(String(values[1] ?? '[]')),
          root_hash: String(values[2] ?? ''),
          encryption_pubkey: values[3] ? String(values[3]) : null,
          last_archived_at: new Date().toISOString(),
          lens_profile_id: values[4] ? String(values[4]) : null,
        }
        return { rows: [] }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql: sqlArchiveMock } as any)

    const { createRuntimeBridge } = await import('../runtimeBridge.ts')
    const archiveBridge = createRuntimeBridge({
      agentKey: 'creator-xmtp-archive',
      plugins: [],
    })

    const inbound1 = archiveBridge.createInboundMemory({
      conversationId: 'conv-xmtp-archive',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'xmtp key secured message one',
      xmtpConversationKey,
    })
    await archiveBridge.runtime.createMemory(inbound1 as any, 'messages' as any)

    const inbound2 = archiveBridge.createInboundMemory({
      conversationId: 'conv-xmtp-archive',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'xmtp key secured message two',
      xmtpConversationKey,
    })
    await archiveBridge.runtime.createMemory(inbound2 as any, 'messages' as any)

    expect(tryUploadImmutableJsonMock).toHaveBeenCalledTimes(1)
    const uploadPayload = tryUploadImmutableJsonMock.mock.calls[0]?.[0]
    expect(typeof uploadPayload?.payload?.ciphertext).toBe('string')
    expect(JSON.stringify(uploadPayload)).not.toContain('xmtp key secured message one')
    expect(JSON.stringify(uploadPayload)).not.toContain('xmtp key secured message two')

    resolveLensUriMock.mockReturnValue('https://api.grove.storage/ipfs/bafytestchunk-xmtp')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => uploadPayload,
      })) as any,
    )

    const sqlRestoreMock = vi.fn(async (strings: TemplateStringsArray) => {
      const query = String(strings?.[0] ?? '')
      if (query.includes('FROM agent_message_memory') && query.includes('ORDER BY created_at DESC')) {
        return { rows: [] }
      }
      if (query.includes('SELECT chunk_list') && query.includes('FROM grove_chat_manifests')) {
        return { rows: manifestRow ? [manifestRow] : [] }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql: sqlRestoreMock } as any)

    const restoreBridge = createRuntimeBridge({
      agentKey: 'creator-xmtp-restore',
      plugins: [],
    })

    const restoreInbound = restoreBridge.createInboundMemory({
      conversationId: 'conv-xmtp-archive',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'restore with xmtp key',
      xmtpConversationKey,
    })
    const restoredState = await restoreBridge.composeState(restoreInbound as any)
    expect((restoredState as any).recentMessages.some((entry: any) => String(entry?.text ?? '').includes('xmtp key secured message one'))).toBe(true)
    expect((restoredState as any).recentMessages.some((entry: any) => String(entry?.text ?? '').includes('xmtp key secured message two'))).toBe(true)

    vi.unstubAllGlobals()
    if (typeof previousEnabled === 'string') process.env.ELIZA_GROVE_ARCHIVE_ENABLED = previousEnabled
    else delete process.env.ELIZA_GROVE_ARCHIVE_ENABLED
    if (typeof previousThreshold === 'string') process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD = previousThreshold
    else delete process.env.ELIZA_GROVE_ARCHIVE_TURN_THRESHOLD
    if (typeof previousInterval === 'string') process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES = previousInterval
    else delete process.env.ELIZA_GROVE_ARCHIVE_INTERVAL_MINUTES
    if (typeof previousKey === 'string') process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY = previousKey
    else delete process.env.ELIZA_GROVE_ARCHIVE_ENCRYPTION_KEY
  })

  it('hydrates recent history from Grove manifest chunks when hot storage misses', async () => {
    const previousEnabled = process.env.ELIZA_GROVE_ARCHIVE_ENABLED
    process.env.ELIZA_GROVE_ARCHIVE_ENABLED = 'true'
    resolveLensUriMock.mockReturnValue('https://api.grove.storage/ipfs/bafytestchunk')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          turns: [
            {
              id: 'turn-1',
              role: 'user',
              content: 'restored from grove chunk',
              createdAt: '2026-03-14T00:00:00.000Z',
            },
          ],
        }),
      })) as any,
    )

    const sqlMock = vi.fn(async (strings: TemplateStringsArray) => {
      const query = String(strings?.[0] ?? '')
      if (query.includes('FROM agent_message_memory') && query.includes('ORDER BY created_at DESC')) {
        return { rows: [] }
      }
      if (query.includes('SELECT chunk_list') && query.includes('FROM grove_chat_manifests')) {
        return {
          rows: [
            {
              chunk_list: [
                {
                  cid: 'lens://bafytestchunk',
                  hash: 'abc',
                  version: 1,
                },
              ],
              root_hash: 'root-1',
            },
          ],
        }
      }
      return { rows: [] }
    })
    getDbMock.mockResolvedValue({ sql: sqlMock } as any)

    const { createRuntimeBridge } = await import('../runtimeBridge.ts')
    const bridge = createRuntimeBridge({
      agentKey: 'creator-restore',
      plugins: [],
    })

    const inbound = bridge.createInboundMemory({
      conversationId: 'conv-restore',
      conversationType: 'dm',
      senderAddress: '0x1111111111111111111111111111111111111111',
      content: 'hydrate my context',
    })
    const state = await bridge.composeState(inbound as any)

    expect(Array.isArray((state as any).recentMessages)).toBe(true)
    expect((state as any).recentMessages.some((entry: any) => String(entry?.text ?? '').includes('restored from grove'))).toBe(true)
    expect((fetch as any).mock.calls.length).toBeGreaterThan(0)
    expect(resolveLensUriMock).toHaveBeenCalled()

    vi.unstubAllGlobals()
    if (typeof previousEnabled === 'string') process.env.ELIZA_GROVE_ARCHIVE_ENABLED = previousEnabled
    else delete process.env.ELIZA_GROVE_ARCHIVE_ENABLED
  })
})

