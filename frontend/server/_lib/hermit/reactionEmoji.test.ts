import { describe, expect, it } from 'vitest'
import { pickHermitReactionEmoji } from './reactionEmoji.js'

describe('pickHermitReactionEmoji', () => {
  it('prefers kind-specific emoji', () => {
    expect(pickHermitReactionEmoji({ kind: 'gmeow', tags: ['laugh'] })).toBe('😼')
  })

  it('maps meme tags when kind is unknown', () => {
    expect(pickHermitReactionEmoji({ kind: null, tags: ['gm', 'daily'] })).toBe('☀️')
  })

  it('returns a fallback emoji from the pool', () => {
    const emoji = pickHermitReactionEmoji({ kind: 'unknown', tags: [] })
    expect(['👍', '🔥', '😹', '✨', '🫡']).toContain(emoji)
  })
})
