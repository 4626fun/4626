// orchestrators/VaultFlowReduced.tsx
// Reduced-motion / constrained-device orchestrator.
// - Same beat order, same content, same hard milestones as desktop/mobile.
// - No camera dives, parallax tilt, flash bursts, or blur-heavy backdrops.
// - Crossfade-first transitions; discrete state steps (inactive → active → done).
// - Uses phase/enteringBeat/exitingBeat from StoryState — never raw beatProgress.

import { useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent } from 'framer-motion'

import { deriveStoryState } from '../model/storyClock'
import type { StoryState } from '../model/storyClock'
import {
  isLoopActive,
  isReEntryHintVisible,
  isDistributionFullyVisible,
  isBeat,
  isDeployStrategiesVisible,
  isPhase,
  isExitPhase,
} from '../model/storySelectors'
import type { StoryRendererProps } from '../VaultFlowRoot'
import type { StoryBeatId } from '../model/storySemantics'

// ── Beat content map ─────────────────────────────────────────────────────────

const BEAT_HEADING: Record<StoryBeatId, string> = {
  creatorEstablishes:    'One creator. One vault.',
  valueFlowsIn:          'Value flows in.',
  participantDeposits:   'Your stake.',
  distributionMeaningful:'Structured for purpose.',
  deployStrategies:      'Capital deployed.',
  earningTogether:       'The vault runs.',
}

const BEAT_BODY: Record<StoryBeatId, string> = {
  creatorEstablishes:    'Deployed once. Permanent infrastructure for a creator and their community.',
  valueFlowsIn:          'Trading activity earns. Emissions flow. Your vault accumulates — before any deposit.',
  participantDeposits:   'Deposit creator coins. Receive a share token. Earn over 7 days.',
  distributionMeaningful:'CCA launch · Creator vesting · LP reserve. Each destination serves a purpose.',
  deployStrategies:      'Charm · Ajna · Solana · Reserve. Four strategies, one blended yield.',
  earningTogether:       'Creator earns. Participants earn. Value keeps flowing. The system is open.',
}

// ── Reduced-motion beat step ─────────────────────────────────────────────────

function ReducedBeatStep({
  beat,
  state,
  content,
}: {
  beat: StoryBeatId
  state: StoryState
  content: StoryRendererProps['content']
}) {
  return (
    <motion.div
      key={beat}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="w-full max-w-md mx-auto px-6"
    >
      {/* Step indicator */}
      <div className="mb-4 flex items-center gap-2.5">
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: 'rgba(140,180,255,0.7)' }}
        />
        <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-600">
          {beat.replace(/([A-Z])/g, ' $1').toLowerCase()}
        </span>
      </div>

      {/* Heading */}
      <h3 className="mb-2 text-[18px] font-light leading-snug text-zinc-200">
        {BEAT_HEADING[beat]}
      </h3>

      {/* Body */}
      <p className="mb-4 text-[13px] leading-relaxed text-zinc-500">
        {BEAT_BODY[beat]}
      </p>

      {/* Distribution list (reduced version — static, no animation) */}
      {isBeat(state, 'distributionMeaningful') && isDistributionFullyVisible(state) && (
        <ul className="space-y-2 border-t border-white/[0.05] pt-3">
          {content.distribution.map((dest, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 font-mono text-[11px] text-blue-400/60">{dest.percent}</span>
              <span className="text-[12px] text-zinc-400">{dest.purposeCopy}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Strategy list (reduced version — static) */}
      {isDeployStrategiesVisible(state) && (
        <ul className="space-y-2 border-t border-white/[0.05] pt-3">
          {content.strategies.map((s, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-blue-400/60">{s.percent}</span>
              <span className="flex-1 text-[12px] text-zinc-400">{s.purposeCopy}</span>
              {s.apy !== '—' && (
                <span className="font-mono text-[10px] text-zinc-600">{s.apy}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Phase indicator (replaces motion dives) */}
      <div className="mt-3 flex items-center gap-2">
        {(['enter', 'hold', 'exit'] as const).map((p) => (
          <div
            key={p}
            className="h-0.5 flex-1 rounded-full transition-all duration-200"
            style={{
              background:
                isPhase(state, p)
                  ? 'rgba(140,180,255,0.5)'
                  : isExitPhase(state) && p !== 'exit'
                  ? 'rgba(140,180,255,0.2)'
                  : 'rgba(255,255,255,0.05)',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ── Reduced-motion progress ──────────────────────────────────────────────────

function ReducedProgressBar({ state }: { state: StoryState }) {
  const beats: StoryBeatId[] = [
    'creatorEstablishes',
    'valueFlowsIn',
    'participantDeposits',
    'distributionMeaningful',
    'deployStrategies',
    'earningTogether',
  ]
  const current = beats.indexOf(state.beat)

  return (
    <div className="mb-8 flex items-center gap-0">
      {beats.map((b, i) => (
        <div
          key={b}
          className="h-px flex-1 transition-all duration-200"
          style={{
            background:
              i < current
                ? 'rgba(140,180,255,0.45)'
                : i === current
                ? 'rgba(140,180,255,0.9)'
                : 'rgba(255,255,255,0.06)',
          }}
        />
      ))}
    </div>
  )
}

// ── Re-entry hint ────────────────────────────────────────────────────────────
// Satisfies requiresReEntryHint: true on earningTogether.
// Reduced version: static, no motion — just a legible cue.

function ReducedReEntryHint({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <div
      className="mt-6 flex items-center gap-2"
      style={{ color: 'rgba(100,160,255,0.35)' }}
    >
      <span className="h-px w-6" style={{ background: 'rgba(100,160,255,0.2)' }} />
      <span className="font-mono text-[8px] uppercase tracking-[0.28em]">
        deposit open
      </span>
    </div>
  )
}

// ── Main reduced orchestrator ────────────────────────────────────────────────

export function VaultFlowReduced({
  depositTokens: _depositTokens,
  shareTokens: _shareTokens,
  content,
  scrollProgress,
}: StoryRendererProps) {
  const [state, setState] = useState<StoryState>(() =>
    deriveStoryState(0, 'reduced'),
  )

  useMotionValueEvent(scrollProgress, 'change', (latest) => {
    setState(deriveStoryState(latest, 'reduced'))
  })

  const showReEntryHint = isReEntryHintVisible(state)
  const loopRunning = isLoopActive(state)

  return (
    <div
      className="relative min-h-screen"
      style={{ background: '#00000a' }}
    >
      {/* Sticky content region */}
      <div className="sticky top-0 flex min-h-screen flex-col items-center justify-center px-4">

        {/* Progress bar — static, no animation */}
        <ReducedProgressBar state={state} />

        {/* Beat content — crossfade only, no transforms */}
        <AnimatePresence mode="wait">
          <ReducedBeatStep
            key={state.beat}
            beat={state.beat}
            state={state}
            content={content}
          />
        </AnimatePresence>

        {/* Re-entry hint */}
        <ReducedReEntryHint visible={showReEntryHint} />

        {/* Loop active — static label, no motion */}
        {loopRunning && (
          <div
            className="mt-4 font-mono text-[7px] uppercase tracking-[0.24em]"
            style={{ color: 'rgba(100,160,255,0.28)' }}
          >
            loop active
          </div>
        )}
      </div>

      {/* Scroll space */}
      <div style={{ height: '600vh' }} aria-hidden="true" />
    </div>
  )
}
