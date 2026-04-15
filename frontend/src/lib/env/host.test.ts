import { describe, expect, it } from 'vitest'

import { resolveLoopbackOriginForCurrentWindow } from '@/lib/env/host'

describe('resolveLoopbackOriginForCurrentWindow', () => {
  it('keeps configured origin for non-local hosts', () => {
    expect(
      resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: 'https://4626.fun',
        currentOrigin: 'http://localhost:5174',
      }),
    ).toBe('https://4626.fun')
  })

  it('keeps configured origin when local host and port match', () => {
    expect(
      resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: 'http://localhost:5173',
        currentOrigin: 'http://localhost:5173',
      }),
    ).toBe('http://localhost:5173')
  })

  it('falls back to current origin when local host matches but port differs', () => {
    expect(
      resolveLoopbackOriginForCurrentWindow({
        configuredOrigin: 'http://localhost:5173',
        currentOrigin: 'http://localhost:5174',
      }),
    ).toBe('http://localhost:5174')
  })
})
