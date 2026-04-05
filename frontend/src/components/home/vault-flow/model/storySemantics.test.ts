// storySemantics.test.ts
// Locks canonical invariants from the spec's compliance checklist and drift-prevention rules.
// These tests must pass before any implementation proceeds.

import { describe, it, expect } from 'vitest'
import {
  STORY_BEAT_ORDER,
  STORY_MILESTONES_HARD,
  STORY_MILESTONES_SOFT,
  BEAT_DEFINITIONS,
  DESKTOP_BEAT_WINDOWS,
  MOBILE_BEAT_WINDOWS,
  REDUCED_BEAT_WINDOWS,
  resolveBeatWindow,
} from './storySemantics'

// ── Compliance checklist ─────────────────────────────────────────────────────

describe('compliance checklist', () => {
  it('loopActive is the final hard milestone', () => {
    const last = STORY_MILESTONES_HARD[STORY_MILESTONES_HARD.length - 1]
    expect(last).toBe('loopActive')
    expect(STORY_MILESTONES_HARD).not.toContain('loopComplete')
  })

  it('loopActive fires at earningTogether holdStart (completionTrigger)', () => {
    expect(BEAT_DEFINITIONS.earningTogether.completionTrigger).toBe('holdStart')
    expect(BEAT_DEFINITIONS.earningTogether.completion).toBe('loopActive')
  })

  it('requiresReEntryHint is present on earningTogether', () => {
    expect(BEAT_DEFINITIONS.earningTogether.requiresReEntryHint).toBe(true)
  })

  it('reEntryHintVisible is a named soft milestone', () => {
    expect(STORY_MILESTONES_SOFT).toContain('reEntryHintVisible')
  })

  it('uses creator and participants audience vocabulary only', () => {
    for (const beatId of STORY_BEAT_ORDER) {
      const def = BEAT_DEFINITIONS[beatId]
      // audiencePrimary must be 'all', 'creator', or 'participants'
      expect(['all', 'creator', 'participants']).toContain(def.audiencePrimary)
    }
  })
})

// ── Beat order correctness ───────────────────────────────────────────────────

describe('beat order', () => {
  it('has exactly 6 beats in the canonical order', () => {
    expect(STORY_BEAT_ORDER).toHaveLength(6)
  })

  it('follows the human-first comprehension arc', () => {
    expect(STORY_BEAT_ORDER[0]).toBe('creatorEstablishes')
    expect(STORY_BEAT_ORDER[1]).toBe('valueFlowsIn')
    expect(STORY_BEAT_ORDER[2]).toBe('participantDeposits')
    expect(STORY_BEAT_ORDER[3]).toBe('distributionMeaningful')
    expect(STORY_BEAT_ORDER[4]).toBe('deployStrategies')
    expect(STORY_BEAT_ORDER[5]).toBe('earningTogether')
  })

  it('does not contain legacy beat IDs', () => {
    const legacy = ['allocationHandoff', 'vaultUnifiedSeal', 'depositMint', 'distributionExploded', 'vaultIntro']
    for (const id of legacy) {
      expect(STORY_BEAT_ORDER).not.toContain(id)
    }
  })
})

// ── Hard milestone correctness ───────────────────────────────────────────────

describe('hard milestones', () => {
  it('has exactly 6 hard milestones', () => {
    expect(STORY_MILESTONES_HARD).toHaveLength(6)
  })

  it('includes all required hard milestones', () => {
    const required = ['vaultReady', 'valueSourceActive', 'mintConfirmed', 'allocationEncoded', 'deployComplete', 'loopActive'] as const
    for (const m of required) {
      expect(STORY_MILESTONES_HARD).toContain(m)
    }
  })

  it('does not contain loopComplete or other completion-language milestones', () => {
    expect(STORY_MILESTONES_HARD).not.toContain('loopComplete')
    expect(STORY_MILESTONES_HARD).not.toContain('distributionComplete')
    expect(STORY_MILESTONES_HARD).not.toContain('vaultSealed')
  })
})

// ── Beat definitions ─────────────────────────────────────────────────────────

describe('beat definitions', () => {
  it('every beat has a focus, audiencePrimary, completion, and completionTrigger', () => {
    for (const beatId of STORY_BEAT_ORDER) {
      const def = BEAT_DEFINITIONS[beatId]
      expect(def.focus).toBeDefined()
      expect(def.audiencePrimary).toBeDefined()
      expect(def.completion).toBeDefined()
      expect(def.completionTrigger).toBeDefined()
    }
  })

  it('every completionTrigger is holdStart (all beats fire at hold phase)', () => {
    for (const beatId of STORY_BEAT_ORDER) {
      expect(BEAT_DEFINITIONS[beatId].completionTrigger).toBe('holdStart')
    }
  })

  it('every completion milestone exists in STORY_MILESTONES_HARD', () => {
    for (const beatId of STORY_BEAT_ORDER) {
      const { completion } = BEAT_DEFINITIONS[beatId]
      expect(STORY_MILESTONES_HARD).toContain(completion)
    }
  })

  it('focus values are valid StoryFocus types', () => {
    const validFocus = ['vault', 'deposit', 'distribution', 'receivingFace', 'strategies']
    for (const beatId of STORY_BEAT_ORDER) {
      expect(validFocus).toContain(BEAT_DEFINITIONS[beatId].focus)
    }
  })

  it('earningTogether has focus: vault', () => {
    expect(BEAT_DEFINITIONS.earningTogether.focus).toBe('vault')
  })
})

// ── Beat windows ─────────────────────────────────────────────────────────────

describe('beat windows', () => {
  const allWindowSets = [
    { name: 'desktop', windows: DESKTOP_BEAT_WINDOWS },
    { name: 'mobile',  windows: MOBILE_BEAT_WINDOWS },
    { name: 'reduced', windows: REDUCED_BEAT_WINDOWS },
  ]

  for (const { name, windows } of allWindowSets) {
    describe(name, () => {
      it('has exactly 6 windows', () => {
        expect(windows).toHaveLength(6)
      })

      it('windows cover beats in canonical order', () => {
        const beatIds = windows.map((w) => w.beat)
        expect(beatIds).toEqual([...STORY_BEAT_ORDER])
      })

      it('first window starts at 0 and last ends at 1', () => {
        expect(windows[0].start).toBe(0)
        expect(windows[windows.length - 1].end).toBe(1)
      })

      it('holdStart and holdEnd are within [0, 1] for every window', () => {
        for (const w of windows) {
          expect(w.holdStart).toBeGreaterThanOrEqual(0)
          expect(w.holdStart).toBeLessThan(1)
          expect(w.holdEnd).toBeGreaterThan(0)
          expect(w.holdEnd).toBeLessThanOrEqual(1)
          expect(w.holdStart).toBeLessThan(w.holdEnd)
        }
      })

      it('windows are non-overlapping and contiguous', () => {
        for (let i = 1; i < windows.length; i++) {
          expect(windows[i].start).toBeCloseTo(windows[i - 1].end, 5)
        }
      })
    })
  }
})

// ── resolveBeatWindow ────────────────────────────────────────────────────────

describe('resolveBeatWindow', () => {
  it('progress=0 resolves to first beat with beatProgress=0', () => {
    const { window, beatProgress } = resolveBeatWindow(0, DESKTOP_BEAT_WINDOWS)
    expect(window.beat).toBe('creatorEstablishes')
    expect(beatProgress).toBe(0)
  })

  it('progress=1 resolves to earningTogether', () => {
    const { window } = resolveBeatWindow(1, DESKTOP_BEAT_WINDOWS)
    expect(window.beat).toBe('earningTogether')
  })

  it('resolves intermediate progress to correct beat', () => {
    // 0.50 is in the middle of distributionMeaningful (0.42–0.66)
    const { window } = resolveBeatWindow(0.50, DESKTOP_BEAT_WINDOWS)
    expect(window.beat).toBe('distributionMeaningful')
  })

  it('beatProgress is normalized to [0,1] within beat', () => {
    const { beatProgress } = resolveBeatWindow(0.50, DESKTOP_BEAT_WINDOWS)
    expect(beatProgress).toBeGreaterThanOrEqual(0)
    expect(beatProgress).toBeLessThanOrEqual(1)
  })
})
