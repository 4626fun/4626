import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import { handleKeeprCommand } from '../commands.ts'

const TEST_WALLET = '0x00000000000000000000000000000000000000aa' as const

function mockFetchJsonOnce(payload: any, ok = true, status = 200) {
  ;(fetch as any).mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  })
}

describe('/arena commands', () => {
  let restoreEnv: (() => void) | null = null

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    restoreEnv = applyEnv({
      CLASH_OF_CLAW_API_KEY: 'arena_test_key',
      CLASH_OF_CLAW_BASE_URL: 'https://clashofclaw.com/api/v1',
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (restoreEnv) restoreEnv()
    restoreEnv = null
  })

  it('returns arena help without API calls', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-arena-1',
      senderWallet: TEST_WALLET,
      text: '/arena help',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('<b>Keepr — arena</b>')
    expect(result.response).toContain('/arena control ECO:6 TECH:7 C:attack NE:scout commander=SW')
    expect(result.response).toContain('/arena watch on | off | status')
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('requires telegram chat context for watch commands', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-arena-watch-context',
      senderWallet: TEST_WALLET,
      text: '/arena watch on',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('Telegram chats only')
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('requires an API key for non-help arena commands', async () => {
    const restore = applyEnv({
      CLASH_OF_CLAW_API_KEY: undefined,
      ARENA_API_KEY: undefined,
    })
    try {
      const result = await handleKeeprCommand({
        groupId: 'group-arena-2',
        senderWallet: TEST_WALLET,
        text: '/arena state',
      })

      expect(result.ok).toBe(false)
      expect(result.response).toContain('CLASH_OF_CLAW_API_KEY')
      expect((fetch as any).mock.calls.length).toBe(0)
    } finally {
      restore()
    }
  })

  it('rejects invalid identify names before network call', async () => {
    const result = await handleKeeprCommand({
      groupId: 'group-arena-3',
      senderWallet: TEST_WALLET,
      text: '/arena identify bad!name',
    })

    expect(result.ok).toBe(false)
    expect(result.response).toContain('/arena identify <name>')
    expect((fetch as any).mock.calls.length).toBe(0)
  })

  it('posts rules to /command', async () => {
    mockFetchJsonOnce({
      success: true,
      next_step: { action: 'GET /api/v1/game/state', description: 'wait 30 seconds' },
    })

    const result = await handleKeeprCommand({
      groupId: 'group-arena-4',
      senderWallet: TEST_WALLET,
      text: '/arena rules ECO:6 TECH:7 DEF:4 AIR:3 ASSIST:6',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Arena control sent.')
    expect(result.response).toContain('rules: ECO:6 TECH:7 DEF:4 AIR:3 ASSIST:6')
    expect(result.response).toContain('next: GET /api/v1/game/state')

    const [url, init] = (fetch as any).mock.calls[0]
    expect(String(url)).toBe('https://clashofclaw.com/api/v1/command')
    expect(init?.method).toBe('POST')
    const parsedBody = JSON.parse(String(init?.body ?? '{}'))
    expect(parsedBody).toEqual({
      rules: ['ECO:6', 'TECH:7', 'DEF:4', 'AIR:3', 'ASSIST:6'],
    })
  })

  it('supports mixed control payloads (rules + zones + commander)', async () => {
    mockFetchJsonOnce({
      success: true,
      next_step: { action: 'GET /api/v1/game/state', description: 'poll again' },
    })

    const result = await handleKeeprCommand({
      groupId: 'group-arena-5',
      senderWallet: TEST_WALLET,
      text: '/arena control ECO:5 TECH:6 C:attack E:defend commander=SW',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('control: ECO:5 TECH:6 | C:attack E:defend | commander=SW')

    const [url, init] = (fetch as any).mock.calls[0]
    expect(String(url)).toBe('https://clashofclaw.com/api/v1/command')
    const parsedBody = JSON.parse(String(init?.body ?? '{}'))
    expect(parsedBody).toEqual({
      rules: ['ECO:5', 'TECH:6'],
      zones: { C: 'attack', E: 'defend' },
      commander: 'SW',
    })
  })

  it('formats not-running state responses as actionable status', async () => {
    mockFetchJsonOnce({
      success: false,
      error: 'Match not running',
      game_over: true,
    })

    const result = await handleKeeprCommand({
      groupId: 'group-arena-6',
      senderWallet: TEST_WALLET,
      text: '/arena state',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Arena state')
    expect(result.response).toContain('match: not running')
    expect(result.response).toContain('/arena find')
  })
})
