// model/storySelectors.ts
// The ONLY interface renderers use for conditional logic.
//
// Renderers must NOT:
//   - read raw beatProgress for conditional logic
//   - check state.beat === 'something' && state.beatProgress > 0.6
//   - re-derive phase/enteringBeat/exitingBeat from scratch
//
// Renderers MUST use these selectors for all semantic conditions.

import type { StoryState } from './storyClock'
import type { FlowProfile } from './flowProfile'
import { FLOW_PROFILE_CONFIGS } from './flowProfile'
import type { AllocationRepresentation, StoryFocus } from './storySemantics'

// ── Semantic selectors (hard milestones) ─────────────────────────────────────

export const isVaultReady = (s: StoryState): boolean =>
  s.milestonesHard.vaultReady

export const isValueSourceActive = (s: StoryState): boolean =>
  s.milestonesHard.valueSourceActive

export const isMintConfirmed = (s: StoryState): boolean =>
  s.milestonesHard.mintConfirmed

export const isAllocationEncoded = (s: StoryState): boolean =>
  s.milestonesHard.allocationEncoded

export const isDeployComplete = (s: StoryState): boolean =>
  s.milestonesHard.deployComplete

/**
 * True when loopActive milestone is set.
 * Fires at earningTogether holdStart and stays true.
 * Replaces any isEarningLoopVisible pattern.
 */
export const isLoopActive = (s: StoryState): boolean =>
  s.milestonesHard.loopActive

// ── Beat-presence selectors ──────────────────────────────────────────────────

export const isValueSourceVisible = (s: StoryState): boolean =>
  s.beat === 'valueFlowsIn'

export const isDistributionVisible = (s: StoryState): boolean =>
  s.beat === 'distributionMeaningful'

// ── Choreography selectors (internal to distributionMeaningful) ───────────────
// These are choreography helpers only — NOT semantic milestones.
// distributionComplete and vaultSealed were absorbed into allocationEncoded
// and do not exist as standalone hard milestones.

export const isDistributionComplete = (s: StoryState): boolean =>
  s.milestonesHard.allocationEncoded

export const isHandoffActive = (s: StoryState): boolean =>
  s.beat === 'distributionMeaningful' &&
  (s.allocationRepresentation === 'payloads' || s.allocationRepresentation === 'receivingSegments')

export const isSealReady = (s: StoryState): boolean =>
  s.beat === 'distributionMeaningful' && s.allocationRepresentation === 'unifiedFace'

// ── Soft milestone selectors ─────────────────────────────────────────────────

export const isValueFlowsVisible = (s: StoryState): boolean =>
  s.milestonesSoft.valueFlowsVisible

export const isDistributionFullyVisible = (s: StoryState): boolean =>
  s.milestonesSoft.distributionFullyVisible

export const isReceivingFaceVisible = (s: StoryState): boolean =>
  s.milestonesSoft.receivingFaceVisible

/**
 * True when the re-entry hint affordance is visible in earningTogether.
 * The renderer is responsible for setting reEntryHintVisible in milestonesSoft
 * when the affordance becomes visible on screen.
 * Used by tests and renderers to verify the affordance is shown.
 */
export const isReEntryHintVisible = (s: StoryState): boolean =>
  s.milestonesSoft.reEntryHintVisible

// ── Focus / composition selectors ────────────────────────────────────────────

/**
 * Returns the primary focal object for the current beat.
 * Derived from the beat definition — never inferred ad-hoc.
 */
export const getPrimaryFocus = (s: StoryState): StoryFocus =>
  s.focus

/**
 * Returns the current allocation representation step.
 * Renderers use this to decide which visual representation to show.
 */
export const getAllocationRepresentation = (s: StoryState): AllocationRepresentation =>
  s.allocationRepresentation

// ── Mobile concurrency constraint ────────────────────────────────────────────

export type AnimatedSystem =
  | 'vault'
  | 'valueFlows'
  | 'depositCard'
  | 'distributionFan'
  | 'allocationHandoff'
  | 'strategyFan'
  | 'earningLoop'

/**
 * Returns the set of animated systems allowed to run simultaneously for the
 * given profile. Mobile enforces max 1 animated system + 1 supporting UI block.
 * This is a selector-enforced API contract, not a convention.
 */
export function getVisibleSystems(
  s: StoryState,
  profile: FlowProfile,
): AnimatedSystem[] {
  const maxSystems = FLOW_PROFILE_CONFIGS[profile].maxAnimatedSystems

  const allSystems: AnimatedSystem[] = []

  if (s.beat === 'creatorEstablishes') allSystems.push('vault')
  if (s.beat === 'valueFlowsIn')       allSystems.push('vault', 'valueFlows')
  if (s.beat === 'participantDeposits') allSystems.push('vault', 'depositCard')
  if (s.beat === 'distributionMeaningful') {
    const rep = s.allocationRepresentation
    if (rep === 'cards' || rep === 'payloads') allSystems.push('distributionFan')
    if (rep === 'receivingSegments' || rep === 'unifiedFace') allSystems.push('allocationHandoff')
  }
  if (s.beat === 'deployStrategies') allSystems.push('strategyFan')
  if (s.beat === 'earningTogether')  allSystems.push('vault', 'earningLoop')

  // Enforce max concurrency for constrained profiles
  if (allSystems.length > maxSystems && maxSystems !== Infinity) {
    // Priority: always keep the focus-aligned system first
    return allSystems.slice(0, maxSystems)
  }

  return allSystems
}
