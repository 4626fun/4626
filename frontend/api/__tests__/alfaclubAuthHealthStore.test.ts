import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock, ensureAlfaClubVigilanteSchemaMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
  ensureAlfaClubVigilanteSchemaMock: vi.fn(async () => undefined),
}))

vi.mock('../../server/_lib/db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('../../server/_lib/alfaclub/schema.js', () => ({
  ensureAlfaClubVigilanteSchema: ensureAlfaClubVigilanteSchemaMock,
}))

vi.mock('../../server/_lib/infra/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import {
  _HEALTH_KEYS_FOR_TESTS,
  _resetBridgeAuthHealthForTests,
  readBridgeAuthHealthSnapshotFromStorage,
  recordBridgeCfChallenge,
  recordBridgeCfChallengeRecovered,
  recordBridgeProxyFallbackDirect,
} from '../../server/_lib/alfaclub/authHealthStore.ts'

function makeHealthDb() {
  const rows = new Map<string, { secret_value: string; updated_at: string; updated_by: string | null }>()
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join(' ').toLowerCase()
    if (text.includes('insert into alfaclub_runtime_secret')) {
      const key = String(values[0])
      rows.set(key, {
        secret_value: String(values[1] ?? ''),
        updated_at: '2026-05-02T00:00:00.000Z',
        updated_by: String(values[3] ?? ''),
      })
      return { rows: [] }
    }
    if (text.includes('from alfaclub_runtime_secret')) {
      const key = String(values[0])
      const row = rows.get(key)
      return { rows: row ? [row] : [] }
    }
    return { rows: [] }
  })
  return { rows, db: { sql } }
}

describe('AlfaClub bridge auth health store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetBridgeAuthHealthForTests()
  })

  it('persists CF challenge counters through the shared bridge health row', async () => {
    const { rows, db } = makeHealthDb()
    getDbMock.mockResolvedValue(db)

    recordBridgeCfChallenge('2026-05-02T00:00:00.000Z', false)
    await vi.waitFor(() => {
      expect(rows.has(_HEALTH_KEYS_FOR_TESTS.BRIDGE)).toBe(true)
    })
    recordBridgeCfChallenge('2026-05-02T00:01:01.000Z', true)
    await vi.waitFor(() => {
      const persisted = JSON.parse(rows.get(_HEALTH_KEYS_FOR_TESTS.BRIDGE)?.secret_value ?? '{}')
      expect(persisted.consecutiveCfChallenges).toBe(2)
    })

    _resetBridgeAuthHealthForTests()
    const crossRuntimeSnapshot = await readBridgeAuthHealthSnapshotFromStorage()
    expect(crossRuntimeSnapshot).toMatchObject({
      lastCfChallengeAt: '2026-05-02T00:01:01.000Z',
      consecutiveCfChallenges: 2,
      cfChallengeSustained: true,
    })

    recordBridgeCfChallengeRecovered()
    await vi.waitFor(() => {
      const persisted = JSON.parse(rows.get(_HEALTH_KEYS_FOR_TESTS.BRIDGE)?.secret_value ?? '{}')
      expect(persisted).toMatchObject({
        lastCfChallengeAt: null,
        consecutiveCfChallenges: 0,
        cfChallengeSustained: false,
      })
    })
  })

  it('persists proxy fallback direct-send counters in the bridge health row', async () => {
    const { rows, db } = makeHealthDb()
    getDbMock.mockResolvedValue(db)

    recordBridgeProxyFallbackDirect('2026-05-13T10:30:00.000Z')
    await vi.waitFor(() => {
      const persisted = JSON.parse(rows.get(_HEALTH_KEYS_FOR_TESTS.BRIDGE)?.secret_value ?? '{}')
      expect(persisted).toMatchObject({
        proxyFallbackDirectCount: 1,
        lastProxyFallbackDirectAt: '2026-05-13T10:30:00.000Z',
      })
    })

    recordBridgeProxyFallbackDirect('2026-05-13T10:31:00.000Z')
    await vi.waitFor(() => {
      const persisted = JSON.parse(rows.get(_HEALTH_KEYS_FOR_TESTS.BRIDGE)?.secret_value ?? '{}')
      expect(persisted).toMatchObject({
        proxyFallbackDirectCount: 2,
        lastProxyFallbackDirectAt: '2026-05-13T10:31:00.000Z',
      })
    })

    _resetBridgeAuthHealthForTests()
    const crossRuntimeSnapshot = await readBridgeAuthHealthSnapshotFromStorage()
    expect(crossRuntimeSnapshot).toMatchObject({
      proxyFallbackDirectCount: 2,
      lastProxyFallbackDirectAt: '2026-05-13T10:31:00.000Z',
    })
  })
})
