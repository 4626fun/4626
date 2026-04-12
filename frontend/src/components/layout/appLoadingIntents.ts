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

const PAGE_PATTERN: LoadingPattern = {
  id: 'calm-sweep',
  preset: 'wave-lr',
  baseDelays: [0, 120, 240, 0, 120, 240, 0, 120, 240],
  baseDurationMs: 1220,
  phaseIntervalMs: 1300,
  phaseStepMs: 12,
  durationStepMs: 20,
  phaseOffsets: [0, 1, 1, 0, 1, 1, 0, 1, 1],
}

const SESSION_PATTERN: LoadingPattern = {
  id: 'session-diagonal',
  preset: 'wave-diag',
  baseDelays: [0, 90, 180, 90, 180, 270, 180, 270, 360],
  baseDurationMs: 1180,
  phaseIntervalMs: 1200,
  phaseStepMs: 14,
  durationStepMs: 18,
  phaseOffsets: [1, 0, 1, 0, 1, 2, 1, 2, 1],
}

const REDIRECT_PATTERN: LoadingPattern = {
  id: 'handoff-ripple',
  preset: 'wave-rl',
  baseDelays: [220, 140, 60, 220, 140, 60, 220, 140, 60],
  baseDurationMs: 980,
  phaseIntervalMs: 1000,
  phaseStepMs: 16,
  durationStepMs: 16,
  phaseOffsets: [0, 1, 2, 0, 1, 2, 0, 1, 2],
}

const DEPLOY_PATTERN: LoadingPattern = {
  id: 'staged-pulse',
  preset: 'wave-tb',
  baseDelays: [0, 40, 80, 220, 260, 300, 420, 460, 500],
  baseDurationMs: 1360,
  phaseIntervalMs: 1450,
  phaseStepMs: 10,
  durationStepMs: 22,
  phaseOffsets: [2, 1, 0, 1, 1, 1, 0, 1, 2],
}

const PROCESSING_PATTERN: LoadingPattern = {
  id: 'balanced-cycle',
  preset: 'wave-bt',
  baseDelays: [280, 280, 280, 140, 140, 140, 0, 0, 0],
  baseDurationMs: 1200,
  phaseIntervalMs: 1250,
  phaseStepMs: 12,
  durationStepMs: 16,
  phaseOffsets: [0, 1, 0, 1, 2, 1, 0, 1, 0],
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
