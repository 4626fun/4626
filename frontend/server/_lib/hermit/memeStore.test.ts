import { afterEach, describe, expect, it } from 'vitest'
import {
  mergeHermitMemePools,
  pickGmeowLocalLine,
  pickRandomHermitMeme,
  pickRandomHermitMemeFromPool,
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

describe('mergeHermitMemePools', () => {
  it('prefers db memes and dedupes by url', () => {
    const merged = mergeHermitMemePools(
      [{ id: 's1', url: 'https://a.example/1.gif', caption: 's', tags: ['static'] }],
      [
        { id: 'db-1', url: 'https://b.example/2.gif', caption: 'd', tags: ['kept'] },
        { id: 'db-dup', url: 'https://a.example/1.gif', caption: 'dup', tags: ['kept'] },
      ],
    )
    expect(merged.map((m) => m.id)).toEqual(['db-1', 'db-dup'])
  })

  it('picks from a custom pool', () => {
    resetHermitMemeRecentForTests()
    const picked = pickRandomHermitMemeFromPool([
      { id: 'only', url: 'https://c.example/3.gif', caption: 'c', tags: ['kept'] },
    ])
    expect(picked.id).toBe('only')
  })
})
