/**
 * Base brand motion constants.
 *
 * Canonical easing: cubic-bezier(0.4, 0, 0.2, 1)
 * "One curve adapts across sizes; extend duration rather than change timing."
 *
 * Duration targets:
 *   Snap    — 120-180ms  (micro-feedback: hover, press, toggle)
 *   Standard — 180-240ms (element enter/exit, state change)
 *   Emphasis — 360-480ms (hero entrance, route transition)
 *   Sequence — ≤800ms    (full choreographed intro/outro)
 */

export const BASE_EASE = [0.4, 0, 0.2, 1] as const

export const DURATION = {
  snap: 0.15,
  standard: 0.22,
  emphasis: 0.4,
  sequenceMax: 0.8,
} as const

export const STAGGER_STEP = 0.06

export const BASE_EASE_CSS = 'cubic-bezier(0.4, 0, 0.2, 1)'
