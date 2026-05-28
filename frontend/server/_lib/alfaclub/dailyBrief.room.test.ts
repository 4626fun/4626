import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyEnv } from '../../../api/__tests__/helpers'
import {
  isDailyBriefRoomSameAsBridgeRoom,
  readAlfaClubDailyBriefSeparateFromBridge,
  resolveDailyBriefRoomId,
  resolveAlfaClubBridgeRoomId,
} from './dailyBrief.js'

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
})
