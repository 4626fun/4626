import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  isDailyBriefRoomSameAsBridgeRoom,
  listDailyBriefCommandRoomIds,
  readAlfaClubDailyBriefSeparateFromBridge,
  resolveDailyBriefRoomId,
  resolveAlfaClubBridgeRoomId,
  sendDailyBriefToReachableRoom,
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

  it('uses command rooms only (bridge + hermit list)', () => {
    expect(
      listDailyBriefCommandRoomIds({ roomId: '1043', hermitCommandRoomIds: ['1043', '1659'] }),
    ).toEqual(['1043', '1659'])
  })

  it('resolveDailyBriefRoomId picks the primary command room', () => {
    restoreEnv = applyEnv({ ALFACLUB_CHAT_ROOM_ID: '1043' })
    expect(resolveDailyBriefRoomId()).toBe('1043')
    expect(isDailyBriefRoomSameAsBridgeRoom('1043')).toBe(true)
  })

  it('readAlfaClubDailyBriefSeparateFromBridge is always off', () => {
    restoreEnv = applyEnv({ ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE: '1' })
    expect(readAlfaClubDailyBriefSeparateFromBridge()).toBe(false)
  })

  it('resolveAlfaClubBridgeRoomId defaults to 1043', () => {
    restoreEnv = applyEnv({ ALFACLUB_CHAT_ROOM_ID: undefined })
    expect(resolveAlfaClubBridgeRoomId()).toBe('1043')
  })

  it('sendDailyBriefToReachableRoom falls through forbidden rooms', async () => {
    const { sendAlfaClubRoomText } = await import('./chatBridge.js')
    vi.mocked(sendAlfaClubRoomText).mockReset()
    vi.mocked(sendAlfaClubRoomText)
      .mockRejectedValueOnce(new Error('bot_message_failed:403'))
      .mockResolvedValueOnce({ lane: 'bot_token_without_reply_id' })

    const result = await sendDailyBriefToReachableRoom({
      text: 'hello',
      flags: {
        roomId: '2001',
        hermitCommandRoomIds: ['2001', '1043'],
      } as ReturnType<typeof import('./chatBridge.js').readAlfaClubChatBridgeFlags>,
    })

    expect(result.roomId).toBe('1043')
    expect(sendAlfaClubRoomText).toHaveBeenCalledTimes(2)
  })
})
