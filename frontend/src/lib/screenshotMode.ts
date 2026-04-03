import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export const SCREENSHOT_QUERY_PARAM = 'screenshot'
export const SCREENSHOT_DEMO_QUERY_PARAM = 'demo'
export const SCREENSHOT_HIDE_ATTR = 'data-screenshot-hide'

export type ScreenshotMode = {
  enabled: boolean
  demo: string | null
}

declare global {
  interface Window {
    __APP_SCREENSHOT_READY?: boolean
  }
}

function toSearchParams(input: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return input
  const raw = input.startsWith('?') ? input.slice(1) : input
  return new URLSearchParams(raw)
}

function isTruthyQueryFlag(value: string | null): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function parseScreenshotMode(input: string | URLSearchParams): ScreenshotMode {
  const params = toSearchParams(input)
  const demoRaw = String(params.get(SCREENSHOT_DEMO_QUERY_PARAM) ?? '').trim()

  return {
    enabled: isTruthyQueryFlag(params.get(SCREENSHOT_QUERY_PARAM)),
    demo: demoRaw || null,
  }
}

export function isScreenshotMode(input: string | URLSearchParams): boolean {
  return parseScreenshotMode(input).enabled
}

export function clearAppScreenshotReady(): void {
  if (typeof window === 'undefined') return
  window.__APP_SCREENSHOT_READY = false
}

export function setAppScreenshotReady(ready: boolean): void {
  if (typeof window === 'undefined') return
  window.__APP_SCREENSHOT_READY = Boolean(ready)
}

export function useScreenshotMode(): ScreenshotMode {
  const location = useLocation()
  return useMemo(() => parseScreenshotMode(location.search), [location.search])
}

export function useScreenshotReady(ready: boolean): void {
  const screenshotMode = useScreenshotMode()

  useEffect(() => {
    if (!screenshotMode.enabled) return
    clearAppScreenshotReady()
    return () => {
      clearAppScreenshotReady()
    }
  }, [screenshotMode.enabled])

  useEffect(() => {
    if (!screenshotMode.enabled) return
    setAppScreenshotReady(ready)
  }, [ready, screenshotMode.enabled])
}
