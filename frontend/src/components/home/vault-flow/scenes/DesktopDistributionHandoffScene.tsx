import { motion, useTransform, type MotionValue } from 'framer-motion'

import type { StoryContent } from '../model/storyContent'
import type { StoryState } from '../model/storyClock'
import {
  isDistributionVisible,
  isHandoffActive,
} from '../model/storySelectors'

// SVG flow geometry — 800 × 110 viewBox, source at centre-top
const DIST_PATHS = [
  'M 400 10 C 400 60 130 60 130 100',
  'M 400 10 C 400 60 400 60 400 100',
  'M 400 10 C 400 60 670 60 670 100',
] as const

const ENDPOINT_LEFTS = ['16.25%', '50%', '83.75%'] as const

type Props = {
  state: StoryState
  content: StoryContent
  uid: string
  orbitTrav0: MotionValue<number>
  orbitTrav1: MotionValue<number>
  orbitTrav2: MotionValue<number>
}

export function DesktopDistributionHandoffScene({
  state,
  content,
  uid,
  orbitTrav0,
  orbitTrav1,
  orbitTrav2,
}: Props) {
  // All hooks must be called before any early return (React rules of hooks)
  // Endpoint glow dots — appear as each path finishes drawing
  const nodeGlow0 = useTransform(orbitTrav0, [0.6, 1], [0, 1])
  const nodeGlow1 = useTransform(orbitTrav1, [0.6, 1], [0, 1])
  const nodeGlow2 = useTransform(orbitTrav2, [0.6, 1], [0, 1])

  // Traveling dots — linear approximation of bezier path midpoints
  const dist0DotX = useTransform(orbitTrav0, (t) => 400 + (130 - 400) * t)
  const dist0DotY = useTransform(orbitTrav0, (t) => 10 + (100 - 10) * t)
  const dist1DotY = useTransform(orbitTrav1, (t) => 10 + (100 - 10) * t)
  const dist2DotX = useTransform(orbitTrav2, (t) => 400 + (670 - 400) * t)
  const dist2DotY = useTransform(orbitTrav2, (t) => 10 + (100 - 10) * t)

  const distDotOp0 = useTransform(orbitTrav0, [0, 0.1, 0.85, 1], [0, 1, 1, 0])
  const distDotOp1 = useTransform(orbitTrav1, [0, 0.1, 0.85, 1], [0, 1, 1, 0])
  const distDotOp2 = useTransform(orbitTrav2, [0, 0.1, 0.85, 1], [0, 1, 1, 0])

  if (!isDistributionVisible(state)) return null

  const handoffActive = isHandoffActive(state)
  const travs = [orbitTrav0, orbitTrav1, orbitTrav2]

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 z-20 px-3 sm:px-10 lg:px-14"
      style={{ top: 'clamp(42vh, 47vh, 52vh)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
    >
      <div className="mx-auto max-w-3xl">
        {/* Section header */}
        <div
          aria-label="distribution summary"
          className="mb-4 flex items-center justify-center gap-2"
        >
          <span className="h-px w-5 bg-blue-300/25" />
          <span className="font-mono text-[7px] uppercase tracking-[0.30em] text-blue-300/60">
            live routing · distribution handoff
          </span>
          <span className="h-px w-5 bg-blue-300/25" />
        </div>

        {/* Fan SVG — desktop only; aria-hidden because accessible data is in the cards below */}
        <div className="relative mx-auto mb-2 hidden w-full sm:block" aria-hidden="true">
          <svg
            viewBox="0 0 800 110"
            preserveAspectRatio="xMidYMid meet"
            className="w-full"
            aria-hidden="true"
            style={{ height: 92 }}
          >
            <defs>
              <linearGradient
                id={`${uid}-dg`}
                gradientUnits="userSpaceOnUse"
                x1="400" y1="10" x2="400" y2="100"
              >
                <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0.06} />
              </linearGradient>
              <filter id={`${uid}-bf`} x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feFlood floodColor="#60a5fa" floodOpacity="0.9" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Source dot at vault origin */}
            <circle cx={400} cy={10} r={4.5} fill="#93c5fd" filter={`url(#${uid}-bf)`} />

            {/* Animated branch paths — draw as scroll progresses */}
            <motion.path
              d={DIST_PATHS[0]}
              stroke={`url(#${uid}-dg)`} strokeWidth="1.5"
              fill="none" strokeLinecap="round"
              style={{ pathLength: orbitTrav0, opacity: orbitTrav0 }}
            />
            <motion.path
              d={DIST_PATHS[1]}
              stroke={`url(#${uid}-dg)`} strokeWidth="1.5"
              fill="none" strokeLinecap="round"
              style={{ pathLength: orbitTrav1, opacity: orbitTrav1 }}
            />
            <motion.path
              d={DIST_PATHS[2]}
              stroke={`url(#${uid}-dg)`} strokeWidth="1.5"
              fill="none" strokeLinecap="round"
              style={{ pathLength: orbitTrav2, opacity: orbitTrav2 }}
            />

            {/* Endpoint glow dots */}
            <motion.circle cx={130} cy={100} r={4} fill="#93c5fd"
              filter={`url(#${uid}-bf)`} style={{ opacity: nodeGlow0 }} />
            <motion.circle cx={400} cy={100} r={4} fill="#93c5fd"
              filter={`url(#${uid}-bf)`} style={{ opacity: nodeGlow1 }} />
            <motion.circle cx={670} cy={100} r={4} fill="#93c5fd"
              filter={`url(#${uid}-bf)`} style={{ opacity: nodeGlow2 }} />

            {/* Traveling dots along each path */}
            <motion.g style={{ opacity: distDotOp0 }}>
              <motion.circle r={4} fill="#bfdbfe" filter={`url(#${uid}-bf)`}
                style={{ x: dist0DotX, y: dist0DotY }} />
            </motion.g>
            <motion.g style={{ opacity: distDotOp1 }}>
              <motion.circle r={4} fill="#bfdbfe" filter={`url(#${uid}-bf)`}
                style={{ x: 400, y: dist1DotY }} />
            </motion.g>
            <motion.g style={{ opacity: distDotOp2 }}>
              <motion.circle r={4} fill="#bfdbfe" filter={`url(#${uid}-bf)`}
                style={{ x: dist2DotX, y: dist2DotY }} />
            </motion.g>
          </svg>

          {/* Recipient labels below each endpoint */}
          {content.distribution.map((row, i) => (
            <motion.div
              key={row.title}
              className="pointer-events-none absolute -translate-x-1/2 text-center"
              style={{ left: ENDPOINT_LEFTS[i], top: 'calc(100% + 4px)', opacity: travs[i] }}
            >
              <div className="font-mono text-[9px] font-black text-white/90">{row.percent}</div>
              <div className="font-mono text-[7px] uppercase tracking-[0.18em] text-blue-300/65">
                {row.title}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Checkpoint progress bar */}
        <div
          aria-label="distribution checkpoint progress"
          role="progressbar"
          className="mx-auto mb-4 h-1 max-w-[240px] overflow-hidden rounded-full bg-white/10"
          style={{ opacity: handoffActive ? 1 : 0.35 }}
        >
          <div
            className="h-full rounded-full bg-blue-300/70"
            style={{ width: `${Math.max(8, state.beatProgress * 100)}%` }}
          />
        </div>

        {/* Distribution recipient cards */}
        <div className="grid gap-3 sm:grid-cols-3">
          {content.distribution.map((row) => (
            <motion.div
              key={row.title}
              className="rounded-[14px] border border-white/10 bg-white/[0.03] p-3"
              animate={{
                opacity: 1,
                y: handoffActive ? -4 : 0,
              }}
              transition={{ duration: 0.25 }}
            >
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-zinc-500">
                {row.title}
              </p>
              <p className="mt-1 font-mono text-lg font-black text-white/90">{row.percent}</p>
              <p className="mt-1 text-[11px] text-zinc-400">{row.purposeCopy}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
