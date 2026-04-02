import { describe, expect, it, vi } from 'vitest'

import { setExploreSearchParam, setExploreSearchQueryParam } from './exploreShared'

describe('setExploreSearchParam', () => {
  it('does not write URL params when value is unchanged', () => {
    const searchParams = new URLSearchParams('sort=volume&time=1d')
    const setSearchParams = vi.fn()

    const changed = setExploreSearchParam(searchParams, setSearchParams, 'sort', 'volume')

    expect(changed).toBe(false)
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('writes URL params and preserves existing keys when value changes', () => {
    const searchParams = new URLSearchParams('sort=volume&time=1d')
    const setSearchParams = vi.fn()

    const changed = setExploreSearchParam(searchParams, setSearchParams, 'sort', 'marketCap')

    expect(changed).toBe(true)
    expect(setSearchParams).toHaveBeenCalledTimes(1)

    const [nextParams, options] = setSearchParams.mock.calls[0] as [URLSearchParams, { replace: boolean }]
    expect(nextParams.get('sort')).toBe('marketCap')
    expect(nextParams.get('time')).toBe('1d')
    expect(options).toEqual({ replace: true })
  })
})

describe('setExploreSearchQueryParam', () => {
  it('does not write URL params when query is unchanged', () => {
    const searchParams = new URLSearchParams('sort=volume&q=abc')
    const setSearchParams = vi.fn()

    const changed = setExploreSearchQueryParam(searchParams, setSearchParams, 'abc')

    expect(changed).toBe(false)
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('writes query key and preserves existing params', () => {
    const searchParams = new URLSearchParams('sort=volume&time=1d')
    const setSearchParams = vi.fn()

    const changed = setExploreSearchQueryParam(searchParams, setSearchParams, 'coin')

    expect(changed).toBe(true)
    expect(setSearchParams).toHaveBeenCalledTimes(1)
    const [nextParams, options] = setSearchParams.mock.calls[0] as [URLSearchParams, { replace: boolean }]
    expect(nextParams.get('sort')).toBe('volume')
    expect(nextParams.get('time')).toBe('1d')
    expect(nextParams.get('q')).toBe('coin')
    expect(options).toEqual({ replace: true })
  })

  it('normalizes surrounding whitespace before writing query key', () => {
    const searchParams = new URLSearchParams('sort=volume')
    const setSearchParams = vi.fn()

    const changed = setExploreSearchQueryParam(searchParams, setSearchParams, '  coin  ')

    expect(changed).toBe(true)
    expect(setSearchParams).toHaveBeenCalledTimes(1)
    const [nextParams] = setSearchParams.mock.calls[0] as [URLSearchParams]
    expect(nextParams.get('q')).toBe('coin')
  })

  it('does not rewrite URL when only query whitespace changes', () => {
    const searchParams = new URLSearchParams('q=coin')
    const setSearchParams = vi.fn()

    const changed = setExploreSearchQueryParam(searchParams, setSearchParams, '  coin ')

    expect(changed).toBe(false)
    expect(setSearchParams).not.toHaveBeenCalled()
  })

  it('removes query key when query is empty', () => {
    const searchParams = new URLSearchParams('sort=volume&q=coin')
    const setSearchParams = vi.fn()

    const changed = setExploreSearchQueryParam(searchParams, setSearchParams, '')

    expect(changed).toBe(true)
    expect(setSearchParams).toHaveBeenCalledTimes(1)
    const [nextParams] = setSearchParams.mock.calls[0] as [URLSearchParams]
    expect(nextParams.get('sort')).toBe('volume')
    expect(nextParams.has('q')).toBe(false)
  })
})
