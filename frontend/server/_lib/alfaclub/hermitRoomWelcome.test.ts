import { describe, expect, it } from 'vitest'

import {
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

  it('is enabled by default', () => {
    expect(isHermitRoomWelcomeEnabled()).toBe(true)
  })
})
