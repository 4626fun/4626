import { describe, expect, it } from 'vitest'
import {
  isRoomTimelineHostAddressCandidate,
  pickEffectiveHostAddress,
} from './roomTimeline.js'

const HOST = '0x64c3fb828bd2a8cde9cde14d0295d34916bb94e9'
const GUEST = '0x74ab91cd845ff0d2006404440af49c3bc8c1df96'

describe('isRoomTimelineHostAddressCandidate', () => {
  it('accepts hex wallets only', () => {
    expect(isRoomTimelineHostAddressCandidate(HOST)).toBe(true)
    expect(isRoomTimelineHostAddressCandidate(HOST.toUpperCase())).toBe(true)
    expect(isRoomTimelineHostAddressCandidate('trade-completed')).toBe(false)
    expect(isRoomTimelineHostAddressCandidate('chip')).toBe(false)
    expect(isRoomTimelineHostAddressCandidate('proliquid:123')).toBe(false)
    expect(isRoomTimelineHostAddressCandidate('')).toBe(false)
    expect(isRoomTimelineHostAddressCandidate(null)).toBe(false)
  })
})

describe('pickEffectiveHostAddress', () => {
  it('prefers the resolved host when that wallet posted', () => {
    expect(pickEffectiveHostAddress([GUEST, HOST, GUEST], HOST)).toBe(HOST)
  })

  it('skips Chip / trade-completed dominance and picks the next wallet', () => {
    const senders = [
      'trade-completed',
      'trade-completed',
      'trade-completed',
      'trade-completed',
      HOST,
      HOST,
      GUEST,
    ]
    expect(pickEffectiveHostAddress(senders, null)).toBe(HOST)
  })

  it('does not treat trade-completed as a resolved host', () => {
    expect(pickEffectiveHostAddress([HOST, 'trade-completed', HOST], 'trade-completed')).toBe(HOST)
  })

  it('returns null when only system senders are present', () => {
    expect(pickEffectiveHostAddress(['trade-completed', 'chip', 'proliquid:1'], null)).toBeNull()
  })
})
