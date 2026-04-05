// orchestrators/VaultFlowDesktop.tsx
// Desktop orchestrator — cinematic, parallel, full 3D depth.
// Wraps the existing VaultFlowScroll implementation while adding canonical
// StoryState derivation from the shared model layer.
//
// Migration path:
//   Phase 1 (now): StoryState derived alongside existing scroll logic.
//   Phase 2: Individual scenes extracted one by one.
//   Phase 3: Existing per-beat MotionValue derivation replaced by storySelectors.

import { useRef } from 'react'
import { useMotionValueEvent } from 'framer-motion'

import { deriveStoryState } from '../model/storyClock'
import {
  isLoopActive,
  isDistributionVisible,
  getVisibleSystems,
} from '../model/storySelectors'
import type { StoryRendererProps } from '../VaultFlowRoot'

// The existing monolith renders the full cinematic experience.
// It owns its own scroll subscription internally for now.
import { VaultFlowScroll } from '../../VaultFlowScroll'

export function VaultFlowDesktop({
  depositTokens,
  shareTokens,
  content: _content,
  scrollProgress,
  profile,
}: StoryRendererProps) {
  // Derive canonical StoryState alongside the existing implementation.
  // This does not yet replace the existing MotionValue-based logic —
  // it runs in parallel so tests and future scene extraction have a clean state.
  const stateRef = useRef(deriveStoryState(0, 'desktop'))

  useMotionValueEvent(scrollProgress, 'change', (latest) => {
    const state = deriveStoryState(latest, 'desktop')
    stateRef.current = state

    // Validate invariants in development
    if (process.env.NODE_ENV === 'development') {
      // loopActive must not be false while earningTogether is held
      if (state.beat === 'earningTogether' && state.phase === 'hold') {
        if (!isLoopActive(state)) {
          console.warn('[VaultFlowDesktop] loopActive should be true at earningTogether hold phase')
        }
      }

      // Max animated systems check (desktop has no hard limit, but log for audit)
      const systems = getVisibleSystems(state, profile)
      if (systems.length === 0 && state.beat !== 'creatorEstablishes') {
        console.warn('[VaultFlowDesktop] no animated systems active for beat:', state.beat)
      }

      // Distribution beat checks
      if (isDistributionVisible(state) && state.allocationRepresentation === undefined) {
        console.warn('[VaultFlowDesktop] allocationRepresentation must be set during distributionMeaningful')
      }
    }
  })

  // The existing VaultFlowScroll renders the full cinematic desktop experience.
  // It manages its own useScroll, MotionValues, and stage navigation internally.
  // In subsequent phases, individual beats will be extracted into scene components
  // that consume stateRef.current via props.
  return (
    <VaultFlowScroll
      depositTokens={depositTokens}
      shareTokens={shareTokens}
    />
  )
}
