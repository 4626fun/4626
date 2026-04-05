// model/storySemantics.ts
// SOURCE OF TRUTH — everything else derives from this file.
// If any other file conflicts with these definitions, this file wins.

// ── Beat order ──────────────────────────────────────────────────────────────

export const STORY_BEAT_ORDER = [
  'creatorEstablishes',
  'valueFlowsIn',
  'participantDeposits',
  'distributionMeaningful',
  'deployStrategies',
  'earningTogether',
] as const

export type StoryBeatId = (typeof STORY_BEAT_ORDER)[number]

// ── Milestones ──────────────────────────────────────────────────────────────

// Hard: semantic truth. Shared meaning across all profiles. Never change per profile.
export const STORY_MILESTONES_HARD = [
  'vaultReady',
  'valueSourceActive',
  'mintConfirmed',
  'allocationEncoded',
  'deployComplete',
  'loopActive', // NOT 'loopComplete' — becomes observable, never finishes
] as const

// Soft: visual/timing hints. Profile-sensitive. Renderer cues only.
export const STORY_MILESTONES_SOFT = [
  'distributionFullyVisible',
  'receivingFaceVisible',
  'valueFlowsVisible',
  'reEntryHintVisible', // fires when re-entry affordance is shown in earningTogether
] as const

export type StoryMilestoneHard = (typeof STORY_MILESTONES_HARD)[number]
export type StoryMilestoneSoft = (typeof STORY_MILESTONES_SOFT)[number]
export type StoryMilestoneId = StoryMilestoneHard | StoryMilestoneSoft

// ── Beat definition types ───────────────────────────────────────────────────

export type StoryFocus =
  | 'vault'
  | 'deposit'
  | 'distribution'
  | 'receivingFace'
  | 'strategies'

export type AudiencePrimary = 'all' | 'creator' | 'participants'

// 'holdStart' — milestone fires when dwell window begins (beat is visible and held).
// 'beatExit'  — milestone fires when user scrolls past beat end.
// All beats currently use 'holdStart': truth exists while the beat is shown,
// not only after the user scrolls away. loopActive especially must not wait for exit.
export type MilestoneActivationTrigger = 'holdStart' | 'beatExit'

export type AllocationRepresentation =
  | 'cards'
  | 'payloads'
  | 'receivingSegments'
  | 'unifiedFace'

export type BeatDefinition = {
  focus: StoryFocus
  audiencePrimary: AudiencePrimary
  completion: StoryMilestoneHard
  completionTrigger: MilestoneActivationTrigger
  requiresReEntryHint?: true // if present, renderer MUST render a re-entry affordance
}

// ── Beat definitions ─────────────────────────────────────────────────────────

export const BEAT_DEFINITIONS: Record<StoryBeatId, BeatDefinition> = {
  creatorEstablishes: {
    focus: 'vault',
    audiencePrimary: 'all',
    completion: 'vaultReady',
    completionTrigger: 'holdStart',
  },
  valueFlowsIn: {
    focus: 'vault',
    audiencePrimary: 'participants',
    completion: 'valueSourceActive',
    completionTrigger: 'holdStart',
  },
  participantDeposits: {
    focus: 'deposit',
    audiencePrimary: 'participants',
    completion: 'mintConfirmed',
    completionTrigger: 'holdStart',
  },
  distributionMeaningful: {
    focus: 'distribution',
    audiencePrimary: 'participants',
    completion: 'allocationEncoded',
    completionTrigger: 'holdStart',
  },
  deployStrategies: {
    focus: 'strategies',
    audiencePrimary: 'participants',
    completion: 'deployComplete',
    completionTrigger: 'holdStart',
  },
  earningTogether: {
    focus: 'vault',
    audiencePrimary: 'all',
    completion: 'loopActive',
    completionTrigger: 'holdStart',
    requiresReEntryHint: true, // typed requirement — renderer must show affordance
  },
}

// ── Beat window ──────────────────────────────────────────────────────────────

// BeatWindow maps a beat to a normalized [0,1] global scroll range.
// holdStart/holdEnd define the dwell phase within the beat window.
// Milestones with completionTrigger: 'holdStart' fire when progress >= holdStart.
export type BeatWindow = {
  beat: StoryBeatId
  start: number   // global progress where beat begins
  end: number     // global progress where beat ends
  holdStart: number // within-beat progress [0,1] where hold phase begins
  holdEnd: number   // within-beat progress [0,1] where hold phase ends
}

// ── Desktop beat windows (continuous scroll scrub) ───────────────────────────
// 6 beats across the full scroll, each with a generous hold window.
// These map to the existing VaultFlowScroll stage breakdown:
//   Stage 1 (zorb/hero): 0.00–0.22  → creatorEstablishes
//   Stage 2 (deposit):   0.22–0.42  → valueFlowsIn + participantDeposits
//   Stage 3 (distribute):0.42–0.68  → distributionMeaningful
//   Stage 4 (deploy):    0.68–0.88  → deployStrategies
//   Outro:               0.88–1.00  → earningTogether
export const DESKTOP_BEAT_WINDOWS: BeatWindow[] = [
  { beat: 'creatorEstablishes',   start: 0.00, end: 0.14, holdStart: 0.3, holdEnd: 0.7 },
  { beat: 'valueFlowsIn',         start: 0.14, end: 0.26, holdStart: 0.3, holdEnd: 0.7 },
  { beat: 'participantDeposits',  start: 0.26, end: 0.42, holdStart: 0.3, holdEnd: 0.7 },
  { beat: 'distributionMeaningful', start: 0.42, end: 0.66, holdStart: 0.25, holdEnd: 0.75 },
  { beat: 'deployStrategies',     start: 0.66, end: 0.88, holdStart: 0.25, holdEnd: 0.75 },
  { beat: 'earningTogether',      start: 0.88, end: 1.00, holdStart: 0.25, holdEnd: 0.85 },
]

// ── Mobile beat windows (section-first, shorter sticky windows) ──────────────
// Mobile uses shorter sections per beat; transitions are snappier.
export const MOBILE_BEAT_WINDOWS: BeatWindow[] = [
  { beat: 'creatorEstablishes',   start: 0.00, end: 0.14, holdStart: 0.35, holdEnd: 0.70 },
  { beat: 'valueFlowsIn',         start: 0.14, end: 0.26, holdStart: 0.35, holdEnd: 0.70 },
  { beat: 'participantDeposits',  start: 0.26, end: 0.42, holdStart: 0.35, holdEnd: 0.70 },
  { beat: 'distributionMeaningful', start: 0.42, end: 0.66, holdStart: 0.30, holdEnd: 0.75 },
  { beat: 'deployStrategies',     start: 0.66, end: 0.88, holdStart: 0.30, holdEnd: 0.75 },
  { beat: 'earningTogether',      start: 0.88, end: 1.00, holdStart: 0.30, holdEnd: 0.85 },
]

// ── Reduced beat windows (same as desktop; transitions are quantized by clock) ─
export const REDUCED_BEAT_WINDOWS: BeatWindow[] = DESKTOP_BEAT_WINDOWS

// ── Helper: resolve beat window for a global progress ───────────────────────

export function resolveBeatWindow(
  globalProgress: number,
  windows: BeatWindow[],
): { window: BeatWindow; beatProgress: number } {
  // Walk backwards so the last beat "owns" progress=1.0
  for (let i = windows.length - 1; i >= 0; i--) {
    const w = windows[i]
    if (globalProgress >= w.start) {
      const span = w.end - w.start
      const beatProgress = span > 0 ? Math.min((globalProgress - w.start) / span, 1) : 1
      return { window: w, beatProgress }
    }
  }
  return { window: windows[0], beatProgress: 0 }
}
