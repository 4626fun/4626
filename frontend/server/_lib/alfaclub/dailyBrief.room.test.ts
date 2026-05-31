import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  isDailyBriefRoomSameAsBridgeRoom,
  listDailyBriefPostRoomCandidates,
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

  it('uses explicit brief room when set', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_DAILY_BRIEF_ROOM_ID: '2001',
    })
    expect(resolveDailyBriefRoomId()).toBe('2001')
    expect(isDailyBriefRoomSameAsBridgeRoom('2001')).toBe(false)
  })

  it('falls back to bridge room when brief room unset', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_DAILY_BRIEF_ROOM_ID: undefined,
    })
    expect(resolveDailyBriefRoomId()).toBe('1043')
    expect(isDailyBriefRoomSameAsBridgeRoom('1043')).toBe(true)
  })

  it('readAlfaClubDailyBriefSeparateFromBridge parses env when on', () => {
    restoreEnv = applyEnv({ ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE: '1' })
    expect(readAlfaClubDailyBriefSeparateFromBridge()).toBe(true)
  })

  it('readAlfaClubDailyBriefSeparateFromBridge parses env when off', () => {
    restoreEnv = applyEnv({ ALFACLUB_DAILY_BRIEF_SEPARATE_FROM_BRIDGE: '0' })
    expect(readAlfaClubDailyBriefSeparateFromBridge()).toBe(false)
  })

  it('resolveAlfaClubBridgeRoomId defaults to 1043', () => {
    restoreEnv = applyEnv({ ALFACLUB_CHAT_ROOM_ID: undefined })
    expect(resolveAlfaClubBridgeRoomId()).toBe('1043')
  })

  it('listDailyBriefPostRoomCandidates dedupes and prefers bridge then hermit rooms', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_HERMIT_COMMAND_ROOMS: '1043,1659',
    })
    expect(listDailyBriefPostRoomCandidates({ roomId: '1043', hermitCommandRoomIds: ['1043', '1659'] })).toEqual([
      '1043',
      '1659',
    ])
  })

  it('listDailyBriefPostRoomCandidates tries explicit brief room first when set', () => {
    restoreEnv = applyEnv({
      ALFACLUB_CHAT_ROOM_ID: '1043',
      ALFACLUB_DAILY_BRIEF_ROOM_ID: '2001',
      ALFACLUB_HERMIT_COMMAND_ROOMS: '1043,1659',
    })
    expect(listDailyBriefPostRoomCandidates({ roomId: '1043', hermitCommandRoomIds: ['1043', '1659'] })).toEqual([
      '2001',
      '1043',
      '1659',
    ])
  })

  it('sendDailyBriefToReachableRoom falls through forbidden rooms', async () => {
    restoreEnv = applyEnv({
      ALFACLUB_DAILY_BRIEF_ROOM_ID: '2001',
      ALFACLUB_CHAT_ROOM_ID: '1043',
    })
    const { sendAlfaClubRoomText } = await import('./chatBridge.js')
    vi.mocked(sendAlfaClubRoomText).mockReset()
    vi.mocked(sendAlfaClubRoomText)
      .mockRejectedValueOnce(new Error('bot_message_failed:403'))
      .mockResolvedValueOnce({ lane: 'bot_token_without_reply_id' })

    const result = await sendDailyBriefToReachableRoom({
      text: 'hello',
      flags: {
        roomId: '1043',
        hermitCommandRoomIds: ['1043', '1659'],
      } as ReturnType<typeof import('./chatBridge.js').readAlfaClubChatBridgeFlags>,
    })

    expect(result.roomId).toBe('1043')
    expect(sendAlfaClubRoomText).toHaveBeenCalledTimes(2)
  })
})
