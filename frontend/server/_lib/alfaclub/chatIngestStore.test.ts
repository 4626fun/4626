import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('./schema.js', () => ({
  ensureAlfaClubVigilanteSchema: vi.fn(async () => {}),
}))

import { listAlfaClubRoomChatMessages } from './chatIngestStore.js'

describe('listAlfaClubRoomChatMessages', () => {
  beforeEach(() => {
    getDbMock.mockReset()
  })

  it('fails closed when the database is unavailable', async () => {
    getDbMock.mockResolvedValueOnce(null)
    await expect(listAlfaClubRoomChatMessages({ roomId: '1659' })).rejects.toThrow(
      'db_not_configured',
    )
  })

  it('returns newest-first messages with origin when present', async () => {
    const sql = vi.fn(async () => ({
      rows: [
        {
          room_id: '1659',
          message_id: 'm2',
          sender_address: '0xABC',
          message_text: 'newer',
          message_date: '2026-07-13T12:00:00.000Z',
          username: 'bob',
          avatar_url: null,
          is_bot: false,
          reply_id: null,
          reply_text: null,
          reply_sender: null,
          reply_username: null,
          origin: 'telegram',
        },
        {
          room_id: '1659',
          message_id: 'm1',
          sender_address: '0xDEF',
          message_text: 'older',
          message_date: '2026-07-13T11:00:00.000Z',
          username: null,
          avatar_url: null,
          is_bot: null,
          reply_id: 'm0',
          reply_text: 'parent',
          reply_sender: '0xaaa',
          reply_username: 'alice',
          origin: null,
        },
      ],
    }))
    getDbMock.mockResolvedValueOnce({ sql })

    const messages = await listAlfaClubRoomChatMessages({ roomId: '1659', limit: 20 })
    expect(sql).toHaveBeenCalledTimes(1)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      messageId: 'm2',
      origin: 'telegram',
      senderAddress: '0xabc',
    })
    expect(messages[1]).toMatchObject({
      messageId: 'm1',
      origin: null,
      replyId: 'm0',
      replyText: 'parent',
    })
  })

  it('passes before cursors when loading older pages', async () => {
    const sql = vi.fn(async () => ({ rows: [] }))
    getDbMock.mockResolvedValueOnce({ sql })

    await listAlfaClubRoomChatMessages({
      roomId: '9',
      beforeMessageId: 'm9',
      beforeDateMs: Date.parse('2026-07-13T10:00:00.000Z'),
      limit: 10,
    })

    expect(sql).toHaveBeenCalledTimes(1)
    const values = sql.mock.calls[0]?.slice(1) ?? []
    expect(values).toContain('9')
    expect(values).toContain('m9')
    expect(values).toContain('2026-07-13T10:00:00.000Z')
    expect(values).toContain(10)
  })
})
