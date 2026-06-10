import { describe, expect, it } from 'vitest'

import { chunkProfileRows } from './scanTopProfiles.js'

describe('chunkProfileRows', () => {
  it('splits rows into fixed-size batches', () => {
    expect(chunkProfileRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('uses at least one row per batch when size is invalid', () => {
    expect(chunkProfileRows(['a'], 0)).toEqual([['a']])
  })
})
