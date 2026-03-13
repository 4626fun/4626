import { describe, expect, it } from 'vitest'

import { rekeyOpenWindows } from './chatWidgetState'

describe('rekeyOpenWindows', () => {
  const sample = [
    {
      id: 'old-id',
      name: 'Akita',
      type: 'dm' as const,
      peerAddress: '0x1111111111111111111111111111111111111111',
      minimized: true,
      seedCommandId: null,
    },
    {
      id: 'other-id',
      name: 'Other',
      type: 'dm' as const,
      peerAddress: '0x2222222222222222222222222222222222222222',
      minimized: false,
      seedCommandId: null,
    },
  ]

  it('updates matching window id and unminimizes it', () => {
    const next = rekeyOpenWindows(sample, 'old-id', 'new-id')
    expect(next).toEqual([
      {
        id: 'new-id',
        name: 'Akita',
        type: 'dm',
        peerAddress: '0x1111111111111111111111111111111111111111',
        minimized: false,
        seedCommandId: null,
      },
      sample[1],
    ])
  })

  it('is a no-op when ids are equal', () => {
    const next = rekeyOpenWindows(sample, 'old-id', 'old-id')
    expect(next).toEqual(sample)
  })

  it('is a no-op when target window does not exist', () => {
    const next = rekeyOpenWindows(sample, 'missing-id', 'new-id')
    expect(next).toEqual(sample)
  })
})
