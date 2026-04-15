import { describe, expect, it } from 'vitest'

import {
  clearAppScreenshotReady,
  parseScreenshotMode,
  setAppScreenshotReady,
} from '@/lib/ui/screenshotMode'

describe('screenshotMode', () => {
  it('detects screenshot mode and seeded demo params from a query string', () => {
    expect(parseScreenshotMode('?screenshot=1&demo=akita')).toEqual({
      enabled: true,
      demo: 'akita',
    })
  })

  it('treats absent screenshot params as disabled', () => {
    expect(parseScreenshotMode('')).toEqual({
      enabled: false,
      demo: null,
    })
  })

  it('sets and clears the global screenshot-ready flag', () => {
    ;(globalThis as typeof globalThis & { window?: Window & typeof globalThis }).window = {} as Window & typeof globalThis

    clearAppScreenshotReady()
    expect(globalThis.window?.__APP_SCREENSHOT_READY).toBe(false)

    setAppScreenshotReady(true)
    expect(globalThis.window?.__APP_SCREENSHOT_READY).toBe(true)

    clearAppScreenshotReady()
    expect(globalThis.window?.__APP_SCREENSHOT_READY).toBe(false)
  })
})
