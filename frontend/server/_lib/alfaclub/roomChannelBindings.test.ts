import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listEnabledAlfaClubRoomChannelBindings,
  lookupEnabledAlfaClubRoomChannelBindingByTelegram,
  lookupEnabledAlfaClubRoomChannelBindingByXmtpGroup,
  readAlfaClubRoomChannelBinding,
  upsertAlfaClubRoomChannelBinding,
} from './roomChannelBindings.js'

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }))

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

const bindingRow = {
  room_id: '1659',
  enabled: false,
  rollout_status: 'canary',
  telegram_enabled: false,
  telegram_chat_id: null,
  telegram_thread_id: null,
  xmtp_enabled: false,
  xmtp_group_id: null,
  synthetic_keepr_vault_address: '0x0000000000000000000000000000000000001659',
  created_at: '2026-07-12T00:00:00.000Z',
  updated_at: '2026-07-12T00:00:00.000Z',
}

describe('roomChannelBindings', () => {
  beforeEach(() => {
    getDbMock.mockReset()
  })

  it('reads a data-driven room binding', async () => {
    const sql = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
      rows: [bindingRow],
      rowCount: 1,
    }))
    getDbMock.mockResolvedValue({ sql })

    await expect(readAlfaClubRoomChannelBinding(' 1659 ')).resolves.toEqual({
      roomId: '1659',
      enabled: false,
      rolloutStatus: 'canary',
      telegram: { enabled: false, chatId: null, threadId: null },
      xmtp: {
        enabled: false,
        groupId: null,
        syntheticKeeprVaultAddress: '0x0000000000000000000000000000000000001659',
      },
      createdAt: bindingRow.created_at,
      updatedAt: bindingRow.updated_at,
    })
    expect(sql).toHaveBeenCalledTimes(1)
    expect(sql.mock.calls[0]?.[1]).toBe('1659')
  })

  it('upserts normalized channel configuration', async () => {
    const returnedRow = {
      ...bindingRow,
      enabled: true,
      telegram_enabled: true,
      telegram_chat_id: '-100123',
      telegram_thread_id: '42',
      xmtp_enabled: true,
      xmtp_group_id: 'group-1659',
    }
    const sql = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
      rows: [returnedRow],
      rowCount: 1,
    }))
    getDbMock.mockResolvedValue({ sql })

    const result = await upsertAlfaClubRoomChannelBinding({
      roomId: '1659',
      enabled: true,
      rolloutStatus: 'canary',
      telegramEnabled: true,
      telegramChatId: ' -100123 ',
      telegramThreadId: ' 42 ',
      xmtpEnabled: true,
      xmtpGroupId: ' group-1659 ',
      syntheticKeeprVaultAddress: '0x0000000000000000000000000000000000001659',
    })

    expect(result?.telegram).toEqual({ enabled: true, chatId: '-100123', threadId: '42' })
    expect(result?.xmtp.enabled).toBe(true)
    expect(sql.mock.calls[0]?.slice(1)).toEqual([
      '1659',
      true,
      'canary',
      true,
      '-100123',
      '42',
      true,
      'group-1659',
      '0x0000000000000000000000000000000000001659',
    ])
  })

  it('fails closed for writes when DB is unavailable', async () => {
    getDbMock.mockResolvedValue(null)

    await expect(
      upsertAlfaClubRoomChannelBinding({
        roomId: '1659',
        enabled: false,
        rolloutStatus: 'canary',
        telegramEnabled: false,
        xmtpEnabled: false,
        syntheticKeeprVaultAddress: '0x0000000000000000000000000000000000001659',
      }),
    ).resolves.toBeNull()
  })

  it('rejects an enabled channel without required routing data before querying DB', async () => {
    await expect(
      upsertAlfaClubRoomChannelBinding({
        roomId: '1659',
        enabled: true,
        rolloutStatus: 'enabled',
        telegramEnabled: true,
        xmtpEnabled: false,
      }),
    ).resolves.toBeNull()
    expect(getDbMock).not.toHaveBeenCalled()
  })

  it('looks up enabled Telegram topics and XMTP groups without cross-room fallback', async () => {
    const sql = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ ...bindingRow, enabled: true, telegram_enabled: true, telegram_chat_id: '-100123' }],
      })
      .mockResolvedValueOnce({
        rows: [{ ...bindingRow, enabled: true, xmtp_enabled: true, xmtp_group_id: 'group-1659' }],
      })
    getDbMock.mockResolvedValue({ sql })

    await expect(lookupEnabledAlfaClubRoomChannelBindingByTelegram({
      chatId: '-100123',
      threadId: 42,
    })).resolves.toMatchObject({ available: true, binding: { roomId: '1659' } })
    await expect(
      lookupEnabledAlfaClubRoomChannelBindingByXmtpGroup('group-1659'),
    ).resolves.toMatchObject({ available: true, binding: { roomId: '1659' } })
    expect(sql.mock.calls[0]?.slice(1)).toEqual(['-100123', '42', '42'])
    expect(sql.mock.calls[1]?.[1]).toBe('group-1659')
  })

  it('lists only enabled rollout bindings and fails closed when storage is unavailable', async () => {
    getDbMock.mockResolvedValueOnce({
      sql: vi.fn(async () => ({ rows: [{ ...bindingRow, enabled: true, rollout_status: 'enabled' }] })),
    })
    await expect(listEnabledAlfaClubRoomChannelBindings()).resolves.toHaveLength(1)

    getDbMock.mockResolvedValueOnce(null)
    await expect(listEnabledAlfaClubRoomChannelBindings()).resolves.toEqual([])
  })
})
