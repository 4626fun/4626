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

/**
 * Resolves the FlowProfile at mount time based on device capabilities.
 * The resolved profile is stable for the lifetime of the component — no
 * mid-session profile switching.
 */
export function resolveFlowProfile(): FlowProfile {
  // Keep renderer selection predictable across mobile devices:
  // only use reduced profile when the user has explicitly requested reduced motion.
  if (prefersReducedMotion()) {
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
import { useState } from 'react'

export function useVaultFlowProfile(): FlowProfile {
  // Resolve once at mount time; avoid reduced->mobile renderer swapping after paint.
  const [profile] = useState<FlowProfile>(() =>
    typeof window === 'undefined' ? 'reduced' : resolveFlowProfile(),
  )
  return profile
}
