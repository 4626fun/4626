// model/storyClock.ts
// Derives canonical StoryState from raw scroll progress + FlowProfile.
// This is the only place where raw progress becomes semantic state.

import {
  BEAT_DEFINITIONS,
  DESKTOP_BEAT_WINDOWS,
  MOBILE_BEAT_WINDOWS,
  REDUCED_BEAT_WINDOWS,
  STORY_BEAT_ORDER,
  resolveBeatWindow,
  type AllocationRepresentation,
  type BeatWindow,
  type StoryBeatId,
  type StoryFocus,
  type StoryMilestoneHard,
  type StoryMilestoneSoft,
} from './storySemantics'
import type { FlowProfile } from './flowProfile'

// ── StoryState — canonical shape.
// Matches spec section 3 and section 6 exactly.
// Do NOT use a reduced version of this shape anywhere.

export type StoryState = {
  // Current beat
  beat: StoryBeatId
  // Progress within the current beat [0, 1]
  beatProgress: number
  // Raw global scroll progress [0, 1]
  globalProgress: number
  // Adjacent beats (null at boundaries)
  previousBeat: StoryBeatId | null
  nextBeat: StoryBeatId | null
  // Phase within the beat
  phase: 'enter' | 'hold' | 'exit'
  // Derived flags — consume from state; never re-derive by thresholding beatProgress
  enteringBeat: boolean // beatProgress < 0.10
  exitingBeat: boolean  // beatProgress > 0.90
  // Milestone flags
  milestonesHard: Record<StoryMilestoneHard, boolean>
  milestonesSoft: Record<StoryMilestoneSoft, boolean>
  // Allocation representation chain (distributionMeaningful choreography)
  allocationRepresentation: AllocationRepresentation
  // Primary focal object for this beat — enforced by beat definition
  focus: StoryFocus
}

// ── Beat window lookup ───────────────────────────────────────────────────────

function getBeatWindows(profile: FlowProfile): BeatWindow[] {
  switch (profile) {
    case 'mobile':  return MOBILE_BEAT_WINDOWS
    case 'reduced': return REDUCED_BEAT_WINDOWS
    default:        return DESKTOP_BEAT_WINDOWS
  }
}

function getBeatIndex(beat: StoryBeatId, windows: BeatWindow[]): number {
  return windows.findIndex((w) => w.beat === beat)
}

// ── Milestone derivation ─────────────────────────────────────────────────────

function deriveHardMilestones(
  beat: StoryBeatId,
  beatProgress: number,
  window: BeatWindow,
): Record<StoryMilestoneHard, boolean> {
  const beatIndex  = STORY_BEAT_ORDER.indexOf(beat)
  const atHoldStart = beatProgress >= window.holdStart

  // A hard milestone is true if:
  // 1. Its beat has already passed (beatIndex > milestone's beat index), OR
  // 2. Its beat is current AND beatProgress >= holdStart (completionTrigger: 'holdStart')
  const isMilestoneActive = (milestoneOwnerBeat: StoryBeatId): boolean => {
    const ownerIndex = STORY_BEAT_ORDER.indexOf(milestoneOwnerBeat)
    if (ownerIndex < beatIndex) return true
    if (ownerIndex === beatIndex) return atHoldStart
    return false
  }

  return {
    vaultReady:        isMilestoneActive('creatorEstablishes'),
    valueSourceActive: isMilestoneActive('valueFlowsIn'),
    mintConfirmed:     isMilestoneActive('participantDeposits'),
    allocationEncoded: isMilestoneActive('distributionMeaningful'),
    deployComplete:    isMilestoneActive('deployStrategies'),
    loopActive:        isMilestoneActive('earningTogether'),
  }
}

function deriveSoftMilestones(
  beat: StoryBeatId,
  beatProgress: number,
  window: BeatWindow,
): Record<StoryMilestoneSoft, boolean> {
  const atHoldStart = beatProgress >= window.holdStart
  const atHoldEnd   = beatProgress >= window.holdEnd

  return {
    valueFlowsVisible:
      beat === 'valueFlowsIn' && beatProgress > 0.2,

    distributionFullyVisible:
      beat === 'distributionMeaningful' && atHoldStart,

    receivingFaceVisible:
      beat === 'distributionMeaningful' && beatProgress > 0.5,

    // Re-entry hint surfaces when earningTogether is held (before holdEnd)
    reEntryHintVisible:
      beat === 'earningTogether' && atHoldStart && !atHoldEnd,
  }
}

// ── Allocation representation derivation ────────────────────────────────────

function deriveAllocationRepresentation(
  beat: StoryBeatId,
  beatProgress: number,
): AllocationRepresentation {
  if (beat !== 'distributionMeaningful') {
    const idx     = STORY_BEAT_ORDER.indexOf(beat)
    const distIdx = STORY_BEAT_ORDER.indexOf('distributionMeaningful')
    return idx > distIdx ? 'unifiedFace' : 'cards'
  }
  // Inside distributionMeaningful: progress through the canonical chain
  if (beatProgress < 0.35) return 'cards'
  if (beatProgress < 0.55) return 'payloads'
  if (beatProgress < 0.75) return 'receivingSegments'
  return 'unifiedFace'
}

// ── Phase derivation ─────────────────────────────────────────────────────────

function derivePhase(
  beatProgress: number,
  window: BeatWindow,
): 'enter' | 'hold' | 'exit' {
  if (beatProgress < window.holdStart) return 'enter'
  if (beatProgress > window.holdEnd)   return 'exit'
  return 'hold'
}

// ── Main derivation ──────────────────────────────────────────────────────────

/**
 * Derives a fully typed StoryState from raw global progress and profile.
 * Pure function — no side effects, no React.
 */
export function deriveStoryState(globalProgress: number, profile: FlowProfile): StoryState {
  const windows = getBeatWindows(profile)
  const { window, beatProgress } = resolveBeatWindow(globalProgress, windows)
  const beat = window.beat

  const beatIndex  = getBeatIndex(beat, windows)
  const prevWindow = beatIndex > 0 ? windows[beatIndex - 1] : null
  const nextWindow = beatIndex < windows.length - 1 ? windows[beatIndex + 1] : null

  const phase                  = derivePhase(beatProgress, window)
  const milestonesHard         = deriveHardMilestones(beat, beatProgress, window)
  const milestonesSoft         = deriveSoftMilestones(beat, beatProgress, window)
  const allocationRepresentation = deriveAllocationRepresentation(beat, beatProgress)
  const focus                  = BEAT_DEFINITIONS[beat].focus

  return {
    beat,
    beatProgress,
    globalProgress,
    previousBeat: prevWindow?.beat ?? null,
    nextBeat:     nextWindow?.beat ?? null,
    phase,
    enteringBeat: beatProgress < 0.10,
    exitingBeat:  beatProgress > 0.90,
    milestonesHard,
    milestonesSoft,
    allocationRepresentation,
    focus,
  }
}
