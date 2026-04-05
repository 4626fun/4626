// storyClock.test.ts
// Tests for StoryState derivation — milestone timing, phase derivation,
// loopActive persistence, reEntryHintVisible, and allocationRepresentation chain.

import { describe, it, expect } from 'vitest'
import { deriveStoryState } from './storyClock'
import { DESKTOP_BEAT_WINDOWS } from './storySemantics'
import {
  isLoopActive,
  isReEntryHintVisible,
  isHandoffActive,
  isSealReady,
  getVisibleSystems,
} from './storySelectors'

// ── Milestone timing: loopActive ─────────────────────────────────────────────

describe('loopActive milestone timing', () => {
  // earningTogether window: 0.88–1.00, holdStart: 0.25, holdEnd: 0.85
  // holdStart in global terms: 0.88 + 0.25*(1.00-0.88) = 0.88 + 0.03 = 0.91

  it('loopActive is false before earningTogether', () => {
    const state = deriveStoryState(0.87, 'desktop')
    expect(state.beat).not.toBe('earningTogether')
    expect(isLoopActive(state)).toBe(false)
  })

  it('loopActive is false at earningTogether entry phase (before holdStart)', () => {
    // 0.885 → within earningTogether (0.88–1.0) but beatProgress ≈ 0.04 < holdStart 0.25
    const state = deriveStoryState(0.883, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(state.phase).toBe('enter')
    expect(isLoopActive(state)).toBe(false)
  })

  it('loopActive becomes true at earningTogether holdStart', () => {
    // beatProgress = 0.25 → exactly at holdStart
    // global = 0.88 + 0.25 * (1.00 - 0.88) = 0.88 + 0.03 = 0.91
    const state = deriveStoryState(0.91, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(state.phase).toBe('hold')
    expect(isLoopActive(state)).toBe(true)
  })

  it('loopActive remains true at beatProgress > holdStart', () => {
    const state = deriveStoryState(0.96, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(isLoopActive(state)).toBe(true)
  })

  it('loopActive is true at progress=1 (end of experience)', () => {
    const state = deriveStoryState(1.0, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(isLoopActive(state)).toBe(true)
  })

  it('loopActive does not revert — every state after first activation stays true', () => {
    const holdGlobal = 0.91
    const samples = [holdGlobal, 0.93, 0.95, 0.97, 1.0]
    for (const g of samples) {
      const state = deriveStoryState(g, 'desktop')
      expect(isLoopActive(state)).toBe(true)
    }
  })
})

// ── Milestone timing: reEntryHintVisible ─────────────────────────────────────

describe('reEntryHintVisible milestone timing', () => {
  it('reEntryHintVisible is false before earningTogether hold', () => {
    const state = deriveStoryState(0.883, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(isReEntryHintVisible(state)).toBe(false)
  })

  it('reEntryHintVisible becomes true at earningTogether hold phase', () => {
    const state = deriveStoryState(0.91, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(state.phase).toBe('hold')
    expect(isReEntryHintVisible(state)).toBe(true)
  })

  it('reEntryHintVisible is false at earningTogether exit phase', () => {
    // holdEnd for earningTogether is 0.85 beatProgress
    // global = 0.88 + 0.85 * 0.12 = 0.88 + 0.102 = 0.982
    const state = deriveStoryState(0.985, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(state.phase).toBe('exit')
    expect(isReEntryHintVisible(state)).toBe(false)
  })
})

// ── Phase derivation ─────────────────────────────────────────────────────────

describe('phase derivation', () => {
  it('phase is "enter" at beatProgress < holdStart', () => {
    // creatorEstablishes: 0.00–0.14, holdStart: 0.3 beatProgress
    // global 0.02 → beatProgress 0.02/0.14 ≈ 0.143 < 0.3
    const state = deriveStoryState(0.02, 'desktop')
    expect(state.beat).toBe('creatorEstablishes')
    expect(state.phase).toBe('enter')
  })

  it('phase is "hold" at beatProgress between holdStart and holdEnd', () => {
    // creatorEstablishes: 0.00–0.14, holdStart: 0.3, holdEnd: 0.7
    // global 0.07 → beatProgress ≈ 0.5
    const state = deriveStoryState(0.07, 'desktop')
    expect(state.beat).toBe('creatorEstablishes')
    expect(state.phase).toBe('hold')
  })

  it('phase is "exit" at beatProgress > holdEnd', () => {
    // creatorEstablishes: 0.00–0.14, holdEnd: 0.7
    // global 0.12 → beatProgress ≈ 0.857 > 0.7
    const state = deriveStoryState(0.12, 'desktop')
    expect(state.beat).toBe('creatorEstablishes')
    expect(state.phase).toBe('exit')
  })
})

// ── enteringBeat / exitingBeat flags ─────────────────────────────────────────

describe('enteringBeat and exitingBeat', () => {
  it('enteringBeat is true when beatProgress < 0.10', () => {
    const state = deriveStoryState(0.005, 'desktop')
    expect(state.enteringBeat).toBe(true)
    expect(state.exitingBeat).toBe(false)
  })

  it('exitingBeat is true when beatProgress > 0.90', () => {
    // creatorEstablishes ends at 0.14; global 0.138 → beatProgress ≈ 0.986
    const state = deriveStoryState(0.138, 'desktop')
    expect(state.beat).toBe('creatorEstablishes')
    expect(state.exitingBeat).toBe(true)
    expect(state.enteringBeat).toBe(false)
  })

  it('neither flag is true in the middle of a beat', () => {
    const state = deriveStoryState(0.07, 'desktop')
    expect(state.enteringBeat).toBe(false)
    expect(state.exitingBeat).toBe(false)
  })
})

// ── Allocation representation chain ──────────────────────────────────────────

describe('allocationRepresentation chain inside distributionMeaningful', () => {
  // distributionMeaningful: 0.42–0.66
  // chain: < 0.35 → cards, < 0.55 → payloads, < 0.75 → receivingSegments, else → unifiedFace

  it('starts as cards at beat entry', () => {
    // global 0.43 → beatProgress ≈ 0.042 < 0.35
    const state = deriveStoryState(0.43, 'desktop')
    expect(state.beat).toBe('distributionMeaningful')
    expect(state.allocationRepresentation).toBe('cards')
  })

  it('transitions to payloads', () => {
    // global 0.50 → beatProgress ≈ 0.33; with 0.42–0.66 span = 0.24
    // beatProgress = (0.50-0.42)/0.24 ≈ 0.33 → cards still
    // Let's try 0.51 → (0.51-0.42)/0.24 ≈ 0.375 → payloads
    const state = deriveStoryState(0.51, 'desktop')
    expect(state.beat).toBe('distributionMeaningful')
    expect(state.allocationRepresentation).toBe('payloads')
  })

  it('transitions to receivingSegments', () => {
    // 0.55 → (0.55-0.42)/0.24 ≈ 0.542 → still payloads
    // 0.555 → (0.555-0.42)/0.24 ≈ 0.5625 → receivingSegments (>= 0.55)
    const state = deriveStoryState(0.555, 'desktop')
    expect(state.beat).toBe('distributionMeaningful')
    expect(state.allocationRepresentation).toBe('receivingSegments')
  })

  it('transitions to unifiedFace', () => {
    // 0.62 → (0.62-0.42)/0.24 = 0.20/0.24 ≈ 0.833 → unifiedFace (>= 0.75)
    // Using 0.62 not 0.60 to avoid float precision edge (0.60-0.42=0.17999... < 0.18)
    const state = deriveStoryState(0.62, 'desktop')
    expect(state.beat).toBe('distributionMeaningful')
    expect(state.allocationRepresentation).toBe('unifiedFace')
  })

  it('is cards before distributionMeaningful', () => {
    const state = deriveStoryState(0.30, 'desktop')
    expect(state.beat).toBe('participantDeposits')
    expect(state.allocationRepresentation).toBe('cards')
  })

  it('is unifiedFace after distributionMeaningful', () => {
    const state = deriveStoryState(0.70, 'desktop')
    expect(state.beat).toBe('deployStrategies')
    expect(state.allocationRepresentation).toBe('unifiedFace')
  })
})

// ── Choreography selectors (distributionMeaningful) ──────────────────────────

describe('choreography selectors — distributionMeaningful', () => {
  it('isHandoffActive during payloads and receivingSegments', () => {
    const payloads = deriveStoryState(0.51, 'desktop')
    expect(isHandoffActive(payloads)).toBe(true)

    const receiving = deriveStoryState(0.555, 'desktop')
    expect(isHandoffActive(receiving)).toBe(true)
  })

  it('isHandoffActive is false during cards', () => {
    const state = deriveStoryState(0.43, 'desktop')
    expect(isHandoffActive(state)).toBe(false)
  })

  it('isSealReady during unifiedFace', () => {
    // 0.62 gives beatProgress ≈ 0.833 → unifiedFace
    const state = deriveStoryState(0.62, 'desktop')
    expect(isSealReady(state)).toBe(true)
  })

  it('isSealReady is false during earlier representations', () => {
    expect(isSealReady(deriveStoryState(0.43, 'desktop'))).toBe(false)
    expect(isSealReady(deriveStoryState(0.51, 'desktop'))).toBe(false)
    expect(isSealReady(deriveStoryState(0.555, 'desktop'))).toBe(false)
  })
})

// ── Focus matches beat definition ─────────────────────────────────────────────

describe('focus matches beat definition', () => {
  const expectedFocus: Record<string, string> = {
    creatorEstablishes:    'vault',
    valueFlowsIn:          'vault',
    participantDeposits:   'deposit',
    distributionMeaningful:'distribution',
    deployStrategies:      'strategies',
    earningTogether:       'vault',
  }

  for (const [beat, focus] of Object.entries(expectedFocus)) {
    it(`${beat} has focus: ${focus}`, () => {
      // Find a global progress value in the middle of this beat
      const window = DESKTOP_BEAT_WINDOWS.find((w) => w.beat === beat)!
      const midGlobal = (window.start + window.end) / 2
      const state = deriveStoryState(midGlobal, 'desktop')
      expect(state.beat).toBe(beat)
      expect(state.focus).toBe(focus)
    })
  }
})

// ── Mobile: max 1 animated system constraint ─────────────────────────────────

describe('getVisibleSystems mobile constraint', () => {
  const beats = [
    { global: 0.07, beat: 'creatorEstablishes' },
    { global: 0.20, beat: 'valueFlowsIn' },
    { global: 0.34, beat: 'participantDeposits' },
    { global: 0.54, beat: 'distributionMeaningful' },
    { global: 0.77, beat: 'deployStrategies' },
    { global: 0.94, beat: 'earningTogether' },
  ]

  for (const { global: g, beat } of beats) {
    it(`${beat}: mobile gets max 1 animated system`, () => {
      const state = deriveStoryState(g, 'mobile')
      const systems = getVisibleSystems(state, 'mobile')
      expect(systems.length).toBeLessThanOrEqual(1)
    })
  }
})

// ── previousBeat / nextBeat ───────────────────────────────────────────────────

describe('previousBeat and nextBeat', () => {
  it('first beat has no previousBeat', () => {
    const state = deriveStoryState(0.01, 'desktop')
    expect(state.beat).toBe('creatorEstablishes')
    expect(state.previousBeat).toBeNull()
    expect(state.nextBeat).toBe('valueFlowsIn')
  })

  it('last beat has no nextBeat', () => {
    const state = deriveStoryState(0.95, 'desktop')
    expect(state.beat).toBe('earningTogether')
    expect(state.nextBeat).toBeNull()
    expect(state.previousBeat).toBe('deployStrategies')
  })

  it('middle beats have both previousBeat and nextBeat', () => {
    const state = deriveStoryState(0.34, 'desktop')
    expect(state.beat).toBe('participantDeposits')
    expect(state.previousBeat).toBe('valueFlowsIn')
    expect(state.nextBeat).toBe('distributionMeaningful')
  })
})
