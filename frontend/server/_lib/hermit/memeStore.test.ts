import { afterEach, describe, expect, it } from 'vitest'
import {
  pickGmeowLocalLine,
  pickRandomHermitMeme,
  resetHermitMemeRecentForTests,
} from './memeStore.js'

describe('memeStore', () => {
  afterEach(() => {
    resetHermitMemeRecentForTests()
  })

  it('plain pick uses the full library, not only laugh-tagged memes', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 24; i++) {
      ids.add(pickRandomHermitMeme().id)
    }
    expect(ids.size).toBeGreaterThan(1)
  })

  it('vibe tag filters to matching memes', () => {
    for (let i = 0; i < 12; i++) {
      const meme = pickRandomHermitMeme('laugh')
      expect(meme.tags).toContain('laugh')
    }
  })

  it('avoids immediate repeat of the same meme id when pool has alternatives', () => {
    const first = pickRandomHermitMeme()
    const second = pickRandomHermitMeme()
    expect(second.id).not.toBe(first.id)
  })

  it('pickGmeowLocalLine returns a non-empty hook', () => {
    const meme = pickRandomHermitMeme('gm')
    const line = pickGmeowLocalLine(meme)
    expect(line.length).toBeGreaterThan(8)
  })
})
