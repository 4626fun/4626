import { describe, expect, it } from 'vitest'

import {
  collectHermitRoomWelcomeCandidates,
  formatHermitRoomWelcome,
  isHermitRoomWelcomeEnabled,
} from './hermitRoomWelcome.js'

describe('hermitRoomWelcome', () => {
  it('formats a compact welcome with optional username', () => {
    const withName = formatHermitRoomWelcome({ roomId: '1659', username: 'akita' })
    expect(withName).toContain('Welcome, **akita**')
    expect(withName).toContain('/help')

    const generic = formatHermitRoomWelcome({ roomId: '1043' })
    expect(generic).toContain('Welcome — **Agent Hermit**')
    expect(generic.length).toBeLessThan(500)
  })

  it('dedupes welcome candidates per room+sender', () => {
    const wallet = '0x1111111111111111111111111111111111111111'
    const candidates = collectHermitRoomWelcomeCandidates([
      { roomId: '1659', senderAddress: wallet, messageId: 'm1' },
      { roomId: '1659', senderAddress: wallet, messageId: 'm2' },
      { roomId: '1659', senderAddress: '0x2222222222222222222222222222222222222222', messageId: 'm3' },
      { roomId: '1659', senderAddress: 'not-a-wallet', messageId: 'm4' },
      { roomId: '1659', senderAddress: wallet, messageId: 'm5', isBot: true },
    ])
    expect(candidates).toHaveLength(2)
    expect(candidates[0]?.messageId).toBe('m1')
  })

  it('is enabled by default', () => {
    expect(isHermitRoomWelcomeEnabled()).toBe(true)
  })
})
