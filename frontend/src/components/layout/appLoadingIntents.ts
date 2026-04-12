import type { PixelWavePreset } from '@/components/ui/PixelWaveLoader'

export type LoadingIntent = 'page' | 'session' | 'redirect' | 'deploy' | 'processing'

type LoadingPattern = {
  id: string
  preset: PixelWavePreset
  baseDelays: readonly number[]
  baseDurationMs: number
  phaseIntervalMs: number
  phaseStepMs: number
  durationStepMs: number
  phaseOffsets: readonly number[]
}

export type LoadingIntentConfig = {
  headline: string
  srStatus: string
  pattern: LoadingPattern
}

// All patterns share the clockwise orbit layout. Each cell's delay is keyed by
// its position in the ring (0 = top-left, travelling clockwise; 4 = center).
// Index order in the 3×3 grid:  0 1 2 / 3 4 5 / 6 7 8
// Clockwise step assigned:       0 1 2 / 7 4 3 / 6 5 4
// Formula: delay[i] = step[i] * stepMs

// page — calm left-to-right sweep
const PAGE_PATTERN: LoadingPattern = {
  id: 'wave-lr-page',
  preset: 'wave-lr',
  baseDelays: [0, 120, 240, 0, 120, 240, 0, 120, 240],
  baseDurationMs: 1220,
  phaseIntervalMs: 1300,
  phaseStepMs: 12,
  durationStepMs: 20,
  phaseOffsets: [0, 1, 1, 0, 1, 1, 0, 1, 1],
}

// session — brisk orbit, 105ms per step
const SESSION_PATTERN: LoadingPattern = {
  id: 'orbit-session',
  preset: 'wave-orbit-cw',
  baseDelays: [0, 105, 210, 735, 420, 315, 630, 525, 420],
  baseDurationMs: 1050,
  phaseIntervalMs: 1100,
  phaseStepMs: 12,
  durationStepMs: 16,
  phaseOffsets: [0, 1, 0, 0, 1, 1, 0, 1, 0],
}

// redirect — quick handoff, 80ms per step
const REDIRECT_PATTERN: LoadingPattern = {
  id: 'orbit-redirect',
  preset: 'wave-orbit-cw',
  baseDelays: [0, 80, 160, 560, 320, 240, 480, 400, 320],
  baseDurationMs: 900,
  phaseIntervalMs: 950,
  phaseStepMs: 10,
  durationStepMs: 14,
  phaseOffsets: [0, 1, 0, 0, 1, 1, 0, 1, 0],
}

// deploy — deliberate orbit, 165ms per step
const DEPLOY_PATTERN: LoadingPattern = {
  id: 'orbit-deploy',
  preset: 'wave-orbit-cw',
  baseDelays: [0, 165, 330, 1155, 660, 495, 990, 825, 660],
  baseDurationMs: 1600,
  phaseIntervalMs: 1700,
  phaseStepMs: 8,
  durationStepMs: 22,
  phaseOffsets: [0, 1, 0, 0, 1, 1, 0, 1, 0],
}

// processing — steady orbit, 110ms per step
const PROCESSING_PATTERN: LoadingPattern = {
  id: 'orbit-processing',
  preset: 'wave-orbit-cw',
  baseDelays: [0, 110, 220, 770, 440, 330, 660, 550, 440],
  baseDurationMs: 1100,
  phaseIntervalMs: 1200,
  phaseStepMs: 10,
  durationStepMs: 16,
  phaseOffsets: [0, 1, 0, 0, 1, 1, 0, 1, 0],
}

export const LOADING_INTENT_CONFIG: Record<LoadingIntent, LoadingIntentConfig> = {
  page: {
    headline: 'Loading...',
    srStatus: 'Loading page content.',
    pattern: PAGE_PATTERN,
  },
  session: {
    headline: 'Syncing session...',
    srStatus: 'Syncing your account session.',
    pattern: SESSION_PATTERN,
  },
  redirect: {
    headline: 'Redirecting...',
    srStatus: 'Redirecting you to the next step.',
    pattern: REDIRECT_PATTERN,
  },
  deploy: {
    headline: 'Loading deploy page...',
    srStatus: 'Loading deploy page content.',
    pattern: DEPLOY_PATTERN,
  },
  processing: {
    headline: 'Processing...',
    srStatus: 'Processing your request.',
    pattern: PROCESSING_PATTERN,
  },
}

export function getLoadingIntentConfig(intent: LoadingIntent): LoadingIntentConfig {
  return LOADING_INTENT_CONFIG[intent]
}

export function getLoadingIntentFromPath(pathname: string): LoadingIntent {
  return pathname.startsWith('/deploy') ? 'deploy' : 'page'
}
