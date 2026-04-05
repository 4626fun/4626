// model/flowProfile.ts
// Resolves a FlowProfile from device/browser capabilities.
// Profile selection is the only place device detection lives.
// Renderers receive a profile and must not re-detect capabilities themselves.

export type FlowProfile = 'desktop' | 'mobile' | 'reduced'

export type FlowProfileConfig = {
  profile: FlowProfile
  // Scroll source for this profile
  scrollSource: 'continuous' | 'section'
  // Whether transitions are quantized (reduced) or interpolated (desktop/mobile)
  quantizedTransitions: boolean
  // Max concurrent animated systems allowed at one time
  maxAnimatedSystems: number
}

export const FLOW_PROFILE_CONFIGS: Record<FlowProfile, FlowProfileConfig> = {
  desktop: {
    profile: 'desktop',
    scrollSource: 'continuous',
    quantizedTransitions: false,
    maxAnimatedSystems: Infinity,
  },
  mobile: {
    profile: 'mobile',
    scrollSource: 'section',
    quantizedTransitions: false,
    maxAnimatedSystems: 1, // enforced by getVisibleSystems selector
  },
  reduced: {
    profile: 'reduced',
    scrollSource: 'continuous',
    quantizedTransitions: true,
    maxAnimatedSystems: 1,
  },
}

// ── Capability heuristics ───────────────────────────────────────────────────

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isConstrainedDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  // Low logical CPU core count is a reasonable proxy for constrained
  const cores = (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency
  if (cores !== undefined && cores <= 2) return true
  // Save-Data header hint
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (conn?.saveData) return true
  return false
}

function isConstrainedWebview(): boolean {
  if (typeof navigator === 'undefined') return false
  // Detect common in-app browser indicators (Instagram, TikTok, etc.)
  const ua = navigator.userAgent
  return /FB_IAB|FBAN|Instagram|Twitter|Line\/|TikTok/i.test(ua)
}

/**
 * Resolves the FlowProfile at mount time based on device capabilities.
 * The resolved profile is stable for the lifetime of the component — no
 * mid-session profile switching.
 */
export function resolveFlowProfile(): FlowProfile {
  if (prefersReducedMotion() || isConstrainedDevice() || isConstrainedWebview()) {
    return 'reduced'
  }
  if (isMobileViewport()) {
    return 'mobile'
  }
  return 'desktop'
}

/**
 * React hook that resolves profile once on mount and returns a stable value.
 * Import from this file; do not call resolveFlowProfile() directly in renderers.
 */
import { useState, useEffect } from 'react'

export function useVaultFlowProfile(): FlowProfile {
  // SSR-safe: start with 'reduced' until we can read window
  const [profile, setProfile] = useState<FlowProfile>('reduced')

  useEffect(() => {
    // SSR-safe deferred capability detection: first render uses 'reduced' default,
    // then we update to the real resolved profile after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(resolveFlowProfile())
  }, [])

  return profile
}
