// orchestrators/VaultFlowMobile.tsx
// Mobile orchestrator — section-first, one hero object at a time, no multi-layer
// geometry coupling. Uses the shared StoryState model and selector-only logic.
//
// Mobile philosophy: max 1 animated system + 1 supporting UI block at any moment.
// This constraint is enforced by getVisibleSystems(state, 'mobile').

import { useState } from 'react'
import { AnimatePresence, motion, useMotionValueEvent } from 'framer-motion'

import { deriveStoryState } from '../model/storyClock'
import type { StoryState } from '../model/storyClock'
import {
  getVisibleSystems,
  getPrimaryFocus,
  isLoopActive,
  isReEntryHintVisible,
  isDistributionFullyVisible,
} from '../model/storySelectors'
import type { StoryRendererProps } from '../VaultFlowRoot'
import type { StoryBeatId } from '../model/storySemantics'

// ── Beat label map ───────────────────────────────────────────────────────────

const BEAT_LABELS: Record<StoryBeatId, string> = {
  creatorEstablishes:    'The vault',
  valueFlowsIn:          'Value flowing in',
  participantDeposits:   'Your stake',
  distributionMeaningful:'Distribution',
  deployStrategies:      'Strategies',
  earningTogether:       'Earning together',
}

const BEAT_SUBLABELS: Record<StoryBeatId, string> = {
  creatorEstablishes:    'One creator. One vault. Deployed once.',
  valueFlowsIn:          'Trading activity earns. Emissions flow. Your vault accumulates.',
  participantDeposits:   'Deposit creator coins. Receive your stake. Earn over 7 days.',
  distributionMeaningful:'Price discovery. Creator vesting. Liquidity reserve.',
  deployStrategies:      'Active Uniswap V3 LP · Permissionless lending · Cross-chain yield · Reserve',
  earningTogether:       'The vault runs. Creator earns. Participants earn. Value keeps flowing.',
}

// ── Mobile beat card ─────────────────────────────────────────────────────────

function MobileBeatCard({ state, content }: { state: StoryState; content: StoryRendererProps['content'] }) {
  const beat = state.beat
  const systems = getVisibleSystems(state, 'mobile')
  const focus = getPrimaryFocus(state)

  return (
    <motion.div
      key={beat}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.32, 0, 0.67, 0] }}
      className="w-full max-w-sm mx-auto px-4"
    >
      {/* Focus indicator */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-px flex-1"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
        <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-600">
          {focus}
        </span>
        <span
          className="h-px flex-1"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        />
      </div>

      {/* Beat heading */}
      <div
        className="rounded-xl p-4"
        style={{
          background: 'linear-gradient(168deg, rgba(14,16,32,0.92) 0%, rgba(7,7,19,0.96) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.24em] text-zinc-600">
          {BEAT_LABELS[beat]}
        </div>
        <p className="text-[13px] font-light leading-relaxed text-zinc-300">
          {BEAT_SUBLABELS[beat]}
        </p>

        {/* Distribution rows — shown during distributionMeaningful */}
        {beat === 'distributionMeaningful' && isDistributionFullyVisible(state) && (
          <div className="mt-3 space-y-1.5">
            {content.distribution.map((dest, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">{dest.title}</span>
                <div className="flex items-center gap-2">
                  <div
                    className="h-px"
                    style={{
                      width: `${dest.numericPercent * 0.6}px`,
                      background: 'rgba(100,160,255,0.4)',
                    }}
                  />
                  <span className="font-mono text-[11px] text-zinc-300">{dest.percent}</span>
                </div>
              </div>
            ))}
            <p className="mt-2 text-[10px] leading-relaxed text-zinc-600">
              {content.distribution[0].purposeCopy}
            </p>
          </div>
        )}

        {/* Strategy rows — shown during deployStrategies */}
        {beat === 'deployStrategies' && (
          <div className="mt-3 space-y-1.5">
            {content.strategies.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">{s.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] text-blue-400/70">{s.apy}</span>
                  <span className="font-mono text-[11px] text-zinc-300">{s.percent}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Earning together state */}
        {beat === 'earningTogether' && (
          <div className="mt-3">
            <div
              className="rounded-lg px-3 py-2 text-center"
              style={{ background: 'rgba(100,160,255,0.06)', border: '1px solid rgba(100,160,255,0.12)' }}
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-blue-400/70">
                System active
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active systems badge */}
      {systems.length > 0 && (
        <div className="mt-2 flex justify-end">
          <span className="font-mono text-[7px] uppercase tracking-[0.2em] text-zinc-700">
            {systems[0]}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ── Re-entry hint (earningTogether) ─────────────────────────────────────────
// Satisfies the requiresReEntryHint: true requirement on the final beat.
// This is a subtle affordance — not a CTA button.

function ReEntryHint({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="reentry-hint"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mt-3 flex flex-col items-center gap-1.5"
          aria-hidden="true"
        >
          <motion.div
            className="h-px w-8"
            style={{ background: 'rgba(100,160,255,0.25)' }}
            animate={{ scaleX: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span
            className="font-mono text-[8px] uppercase tracking-[0.28em]"
            style={{ color: 'rgba(100,160,255,0.35)' }}
          >
            deposit open
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── Mobile progress bar ──────────────────────────────────────────────────────

function MobileProgressBar({ state }: { state: StoryState }) {
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
    <div className="flex items-center justify-center gap-1.5 py-3">
      {beats.map((b, i) => (
        <motion.div
          key={b}
          className="rounded-full"
          animate={{
            width:   i === current ? 16 : 5,
            height:  5,
            opacity: i < current ? 0.5 : i === current ? 1 : 0.18,
            background: i === current
              ? 'rgba(140,180,255,0.9)'
              : 'rgba(255,255,255,0.3)',
          }}
          transition={{ duration: 0.35, ease: [0.32, 0, 0.67, 0] }}
        />
      ))}
    </div>
  )
}

// ── Main mobile orchestrator ─────────────────────────────────────────────────

export function VaultFlowMobile({
  depositTokens: _depositTokens,
  shareTokens: _shareTokens,
  content,
  scrollProgress,
  profile: _profile,
}: StoryRendererProps) {
  const [state, setState] = useState<StoryState>(() =>
    deriveStoryState(0, 'mobile'),
  )

  // Derive canonical StoryState from scroll progress
  useMotionValueEvent(scrollProgress, 'change', (latest) => {
    setState(deriveStoryState(latest, 'mobile'))
  })

  const showReEntryHint = isReEntryHintVisible(state)
  const loopRunning = isLoopActive(state)

  return (
    <div
      className="relative min-h-screen"
      style={{ background: '#00000a' }}
    >
      {/* Star field background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(ellipse at 50% 30%, rgba(40,60,120,0.15) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Sticky beat region */}
      <div className="sticky top-0 flex min-h-screen flex-col items-center justify-center pb-16 pt-20">

        {/* Progress indicator */}
        <MobileProgressBar state={state} />

        {/* Phase label */}
        <div className="mb-4 font-mono text-[8px] uppercase tracking-[0.28em] text-zinc-700">
          {state.phase === 'enter' ? 'entering' : state.phase === 'hold' ? 'active' : 'transitioning'}
        </div>

        {/* Beat content — animates between beats */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            <MobileBeatCard
              key={state.beat}
              state={state}
              content={content}
            />
          </AnimatePresence>
        </div>

        {/* Re-entry hint — rendered when earningTogether is held */}
        <ReEntryHint visible={showReEntryHint} />

        {/* Loop active indicator */}
        {loopRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 font-mono text-[7px] uppercase tracking-[0.24em]"
            style={{ color: 'rgba(100,160,255,0.3)' }}
          >
            loop active
          </motion.div>
        )}
      </div>

      {/* Scroll space — 6 sections of scrollable height */}
      <div style={{ height: '600vh' }} aria-hidden="true" />
    </div>
  )
}
