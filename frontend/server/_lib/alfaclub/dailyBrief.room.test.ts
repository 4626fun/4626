import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  hasExplicitDailyBriefRoomId,
  isDailyBriefRoomSameAsBridgeRoom,
  listDailyBriefCommandRoomIds,
  listDailyBriefPostRoomIds,
  readAlfaClubDailyBriefSeparateFromBridge,
  resolveDailyBriefRoomId,
  resolveAlfaClubBridgeRoomId,
  sendDailyBriefToCommandRooms,
} from './dailyBrief.js'

vi.mock('./chatBridge.js', async () => {
  const actual = await vi.importActual<typeof import('./chatBridge.js')>('./chatBridge.js')
  return {
    ...actual,
    sendAlfaClubRoomText: vi.fn(),
    readAlfaClubChatBridgeFlags: vi.fn(() => ({
      roomId: '1043',
      hermitCommandRoomIds: ['1043', '1659'],
    })),
  }
})

describe('daily brief room resolution', () => {
  let restoreEnv: (() => void) | null = null

  afterEach(() => {
    restoreEnv?.()
    restoreEnv = null
  })

  it('uses hermit command rooms when configured', () => {
    expect(
      listDailyBriefCommandRoomIds({ roomId: '1043', hermitCommandRoomIds: ['1043', '1659'] }),
    ).toEqual(['1043', '1659'])
  })

  it('falls back to bridge room when hermit list is empty', () => {
    expect(listDailyBriefCommandRoomIds({ roomId: '1043', hermitCommandRoomIds: [] })).toEqual([
      '1043',
    ])
  })

  it('resolveDailyBriefRoomId picks the primary command room', () => {
    restoreEnv = applyEnv({ ALFACLUB_CHAT_ROOM_ID: '1043' })
    expect(resolveDailyBriefRoomId()).toBe('1043')
    expect(isDailyBriefRoomSameAsBridgeRoom('1043')).toBe(true)
  })

  it('listDailyBriefPostRoomIds uses ALFACLUB_DAILY_BRIEF_ROOM_ID when set', () => {
    restoreEnv = applyEnv({ ALFACLUB_DAILY_BRIEF_ROOM_ID: '1659' })
    expect(hasExplicitDailyBriefRoomId()).toBe(true)
    expect(resolveDailyBriefRoomId()).toBe('1659')
    expect(
      listDailyBriefPostRoomIds({ roomId: '1043', hermitCommandRoomIds: ['1043', '1659'] }),
    ).toEqual(['1659'])
  })

  it('readAlfaClubDailyBriefSeparateFromBridge is always off', () => {
    restoreEnv = applyEnv({ ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE: '1' })
    expect(readAlfaClubDailyBriefSeparateFromBridge()).toBe(false)
  })

  it('resolveAlfaClubBridgeRoomId defaults to 1043', () => {
    restoreEnv = applyEnv({ ALFACLUB_CHAT_ROOM_ID: undefined })
    expect(resolveAlfaClubBridgeRoomId()).toBe('1043')
  })

  it('sendDailyBriefToCommandRooms posts to every reachable command room', async () => {
    const { sendAlfaClubRoomText } = await import('./chatBridge.js')
    vi.mocked(sendAlfaClubRoomText).mockReset()
    vi.mocked(sendAlfaClubRoomText)
      .mockRejectedValueOnce(new Error('bot_message_failed:403'))
      .mockResolvedValueOnce({ lane: 'bot_token_without_reply_id', messageId: null })

    const result = await sendDailyBriefToCommandRooms({
      text: 'hello',
      flags: {
        roomId: '1043',
        hermitCommandRoomIds: ['2001', '1043'],
      } as ReturnType<typeof import('./chatBridge.js').readAlfaClubChatBridgeFlags>,
    })

    expect(result.posted.map((post) => post.roomId)).toEqual(['1043'])
    expect(sendAlfaClubRoomText).toHaveBeenCalledTimes(2)
  })

  it('sendDailyBriefToCommandRooms posts to all command rooms when all succeed', async () => {
    const { sendAlfaClubRoomText } = await import('./chatBridge.js')
    vi.mocked(sendAlfaClubRoomText).mockReset()
    vi.mocked(sendAlfaClubRoomText).mockResolvedValue({ lane: 'bot_token_without_reply_id', messageId: null })

    const result = await sendDailyBriefToCommandRooms({
      text: 'hello',
      flags: {
        roomId: '1043',
        hermitCommandRoomIds: ['1043', '1659'],
      } as ReturnType<typeof import('./chatBridge.js').readAlfaClubChatBridgeFlags>,
    })

    expect(result.posted.map((post) => post.roomId)).toEqual(['1043', '1659'])
    expect(sendAlfaClubRoomText).toHaveBeenCalledTimes(2)
  })

  it('sendDailyBriefToCommandRooms posts only to explicit brief room when configured', async () => {
    restoreEnv = applyEnv({ ALFACLUB_DAILY_BRIEF_ROOM_ID: '1659' })
    const { sendAlfaClubRoomText } = await import('./chatBridge.js')
    vi.mocked(sendAlfaClubRoomText).mockReset()
    vi.mocked(sendAlfaClubRoomText).mockResolvedValue({ lane: 'bot_token_without_reply_id', messageId: null })

    const result = await sendDailyBriefToCommandRooms({
      text: 'hello',
      flags: {
        roomId: '1043',
        hermitCommandRoomIds: ['1043', '1659'],
      } as ReturnType<typeof import('./chatBridge.js').readAlfaClubChatBridgeFlags>,
    })

    expect(result.posted.map((post) => post.roomId)).toEqual(['1659'])
    expect(sendAlfaClubRoomText).toHaveBeenCalledTimes(1)
  })
})
