import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  claimAlfaClubCrossChannelIngress,
  linkAlfaClubCrossChannelIngress,
  readAlfaClubCrossChannelIngress,
} from './crossChannelIngress.js'

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }))

vi.mock('../db/postgres.js', () => ({
  getDb: getDbMock,
}))

const ingressRow = {
  id: '7',
  source_channel: 'telegram',
  source_message_id: 'telegram-message-1',
  source_conversation_id: '-100123:42',
  target_room_id: '1659',
  alfaclub_room_id: null,
  alfaclub_message_id: null,
  validated_profile_id: null,
  validated_issuer: null,
  claimed_at: '2026-07-12T00:00:00.000Z',
  linked_at: null,
  updated_at: '2026-07-12T00:00:00.000Z',
}

describe('crossChannelIngress', () => {
  beforeEach(() => {
    getDbMock.mockReset()
  })

  it('claims a source message once', async () => {
    const sql = vi.fn(async (_strings: TemplateStringsArray, ..._values: unknown[]) => ({
      rows: [ingressRow],
      rowCount: 1,
    }))
    getDbMock.mockResolvedValue({ sql })

    const result = await claimAlfaClubCrossChannelIngress({
      sourceChannel: 'telegram',
      sourceMessageId: ' telegram-message-1 ',
      sourceConversationId: ' -100123:42 ',
      targetRoomId: ' 1659 ',
    })

    expect(result).toEqual({
      claimed: true,
      ingress: {
        id: '7',
        sourceChannel: 'telegram',
        sourceMessageId: 'telegram-message-1',
        sourceConversationId: '-100123:42',
        targetRoomId: '1659',
        alfaclubRoomId: null,
        alfaclubMessageId: null,
        validatedProfileId: null,
        validatedIssuer: null,
        claimedAt: ingressRow.claimed_at,
        linkedAt: null,
        updatedAt: ingressRow.updated_at,
      },
    })
    expect(sql.mock.calls[0]?.slice(1)).toEqual([
      'telegram',
      'telegram-message-1',
      '-100123:42',
      '1659',
    ])
  })

  it('reports an existing idempotency claim without claiming it again', async () => {
    const sql = vi
      .fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [ingressRow], rowCount: 1 })
    getDbMock.mockResolvedValue({ sql })

    const result = await claimAlfaClubCrossChannelIngress({
      sourceChannel: 'telegram',
      sourceMessageId: 'telegram-message-1',
      targetRoomId: '1659',
    })

    expect(result?.claimed).toBe(false)
    expect(result?.ingress.id).toBe('7')
    expect(sql).toHaveBeenCalledTimes(2)
  })

  it('links the AlfaClub result to validated profile and issuer attribution', async () => {
    const linkedRow = {
      ...ingressRow,
      alfaclub_room_id: '1659',
      alfaclub_message_id: 'room-message-9',
      validated_profile_id: '42',
      validated_issuer: 'profile:42',
      linked_at: '2026-07-12T00:00:01.000Z',
    }
    const sql = vi.fn(async () => ({ rows: [linkedRow], rowCount: 1 }))
    getDbMock.mockResolvedValue({ sql })

    const result = await linkAlfaClubCrossChannelIngress({
      sourceChannel: 'telegram',
      sourceMessageId: 'telegram-message-1',
      alfaclubRoomId: '1659',
      alfaclubMessageId: 'room-message-9',
      validatedProfileId: 42,
      validatedIssuer: 'profile:42',
    })

    expect(result).toMatchObject({
      alfaclubRoomId: '1659',
      alfaclubMessageId: 'room-message-9',
      validatedProfileId: '42',
      validatedIssuer: 'profile:42',
    })
  })

  it('returns null when a conflicting link update is rejected', async () => {
    const sql = vi.fn(async () => ({ rows: [], rowCount: 0 }))
    getDbMock.mockResolvedValue({ sql })

    await expect(
      linkAlfaClubCrossChannelIngress({
        sourceChannel: 'telegram',
        sourceMessageId: 'telegram-message-1',
        alfaclubRoomId: '1659',
        alfaclubMessageId: 'different-message',
        validatedProfileId: '43',
        validatedIssuer: 'profile:43',
      }),
    ).resolves.toBeNull()
  })

  it('fails closed for claim and link writes when DB is unavailable', async () => {
    getDbMock.mockResolvedValue(null)

    await expect(
      claimAlfaClubCrossChannelIngress({
        sourceChannel: 'xmtp',
        sourceMessageId: 'xmtp-message-1',
        targetRoomId: '1659',
      }),
    ).resolves.toBeNull()
    await expect(
      linkAlfaClubCrossChannelIngress({
        sourceChannel: 'xmtp',
        sourceMessageId: 'xmtp-message-1',
        alfaclubRoomId: '1659',
        alfaclubMessageId: 'room-message-1',
        validatedProfileId: 42,
        validatedIssuer: 'profile:42',
      }),
    ).resolves.toBeNull()
  })

  it('reads web4626 ingress records', async () => {
    const sql = vi.fn(async () => ({
      rows: [{ ...ingressRow, source_channel: 'web4626', source_message_id: 'web-message-1' }],
      rowCount: 1,
    }))
    getDbMock.mockResolvedValue({ sql })

    const result = await readAlfaClubCrossChannelIngress({
      sourceChannel: 'web4626',
      sourceMessageId: 'web-message-1',
    })

    expect(result?.sourceChannel).toBe('web4626')
  })
})
