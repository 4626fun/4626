import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock, buildRuntimeSessionContextMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  buildRuntimeSessionContextMock: vi.fn((address: string) => ({
    address,
    isAdmin: true,
    source: 'xmtp',
  })),
}))

vi.mock('../../../_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../../_lib/session.js', () => ({
  buildRuntimeSessionContext: buildRuntimeSessionContextMock,
}))

describe('runtime bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(null)
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
})

