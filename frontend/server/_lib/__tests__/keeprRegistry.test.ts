import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ensureKeeprSchemaMock, getDbMock, sqlMock } = vi.hoisted(() => ({
  ensureKeeprSchemaMock: vi.fn(async () => {}),
  getDbMock: vi.fn(),
  sqlMock: vi.fn(),
}))

vi.mock('../keeprSchema.js', () => ({
  ensureKeeprSchema: ensureKeeprSchemaMock,
}))

vi.mock('../postgres.js', () => ({
  getDb: getDbMock,
}))

import { enqueueKeeprAction, getKeeprVaultByGroupId } from '../keeprRegistry.js'

describe('keeprRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sqlMock.mockResolvedValue({ rows: [{ id: 42 }] })
    getDbMock.mockResolvedValue({ sql: sqlMock })
  })

  it('stores the effective action type when the nested action payload is more specific', async () => {
    await enqueueKeeprAction({
      vaultAddress: '0x00000000000000000000000000000000000000bb',
      groupId: 'group-1',
      actionType: 'monitor.healthcheck',
      action: {
        action: 'strategy.ajna.rebucket',
        authAddress: '0x00000000000000000000000000000000000000cc',
        targetBucket: 1200,
      },
    })

    expect(sqlMock).toHaveBeenCalled()
    expect(sqlMock.mock.calls[0]?.[3]).toBe('strategy.ajna.rebucket')
  })

  it('falls back from telegram chat id to mapped group id from env when direct lookup misses', async () => {
    process.env.TELEGRAM_GROUP_ID_MAP_JSON = JSON.stringify({
      '-1003595003982': '543a2ed196de4aa6a02df5145c5fdfaf',
    })

    const row = {
      vault_address: '0x00000000000000000000000000000000000000aa',
      chain_id: 8453,
      group_id: '543a2ed196de4aa6a02df5145c5fdfaf',
      lens_group_address: null,
      creator_coin_address: '0x00000000000000000000000000000000000000bb',
      canonical_owner_address: '0x00000000000000000000000000000000000000cc',
      share_token_address: null,
      gating_enabled: true,
      join_locked: false,
      gating_mode: 'shares',
      min_shares: '1',
      fail_closed: true,
      config_version: 1,
      config_hash: 'hash',
      config_json: {
        version: 1,
        chainId: 8453,
        vault: {
          vaultAddress: '0x00000000000000000000000000000000000000aa',
          creatorCoinAddress: '0x00000000000000000000000000000000000000bb',
          canonicalOwnerAddress: '0x00000000000000000000000000000000000000cc',
        },
        xmtp: {
          groupId: '543a2ed196de4aa6a02df5145c5fdfaf',
        },
        gating: { enabled: true, joinLocked: false, mode: 'shares', failClosed: true },
        roles: { owner: '0x00000000000000000000000000000000000000cc', admins: [] },
      },
    }

    sqlMock.mockImplementation(async (_strings: TemplateStringsArray, groupId: string) => {
      if (groupId === 'telegram:-1003595003982') return { rows: [] }
      if (groupId === '543a2ed196de4aa6a02df5145c5fdfaf') return { rows: [row] }
      return { rows: [] }
    })

    const result = await getKeeprVaultByGroupId('telegram:-1003595003982')
    expect(result?.groupId).toBe('543a2ed196de4aa6a02df5145c5fdfaf')
    expect(sqlMock).toHaveBeenCalledTimes(2)
  })

  it('falls back from raw telegram numeric chat id to mapped group id from env', async () => {
    process.env.TELEGRAM_GROUP_ID_MAP_JSON = JSON.stringify({
      '-1003595003982': '543a2ed196de4aa6a02df5145c5fdfaf',
    })

    const row = {
      vault_address: '0x00000000000000000000000000000000000000aa',
      chain_id: 8453,
      group_id: '543a2ed196de4aa6a02df5145c5fdfaf',
      lens_group_address: null,
      creator_coin_address: '0x00000000000000000000000000000000000000bb',
      canonical_owner_address: '0x00000000000000000000000000000000000000cc',
      share_token_address: null,
      gating_enabled: true,
      join_locked: false,
      gating_mode: 'shares',
      min_shares: '1',
      fail_closed: true,
      config_version: 1,
      config_hash: 'hash',
      config_json: {
        version: 1,
        chainId: 8453,
        vault: {
          vaultAddress: '0x00000000000000000000000000000000000000aa',
          creatorCoinAddress: '0x00000000000000000000000000000000000000bb',
          canonicalOwnerAddress: '0x00000000000000000000000000000000000000cc',
        },
        xmtp: {
          groupId: '543a2ed196de4aa6a02df5145c5fdfaf',
        },
        gating: { enabled: true, joinLocked: false, mode: 'shares', failClosed: true },
        roles: { owner: '0x00000000000000000000000000000000000000cc', admins: [] },
      },
    }

    sqlMock.mockImplementation(async (_strings: TemplateStringsArray, groupId: string) => {
      if (groupId === '-1003595003982') return { rows: [] }
      if (groupId === '543a2ed196de4aa6a02df5145c5fdfaf') return { rows: [row] }
      return { rows: [] }
    })

    const result = await getKeeprVaultByGroupId('-1003595003982')
    expect(result?.groupId).toBe('543a2ed196de4aa6a02df5145c5fdfaf')
    expect(sqlMock).toHaveBeenCalledTimes(2)
  })
})
