import { useId, useRef } from 'react'
import { motion, useInView } from 'framer-motion'

export type TokenFlowSlot = {
  readonly label?: string
  readonly title?: string
  readonly percent: string
  readonly numericPercent: number
  readonly description: string
  readonly icon?: string | null
  readonly iconAlt?: string
  readonly iconClassName?: string
}

type TokenFlowVizProps = {
  slots: readonly TokenFlowSlot[]
  sourceLabel: string
  variant?: 'white' | 'blue'
}

const SEGMENT_COLORS_WHITE = [
  'bg-white/60',
  'bg-white/40',
  'bg-white/25',
  'bg-white/15',
]

const SEGMENT_COLORS_BLUE = [
  'bg-brand-primary/70',
  'bg-brand-primary/50',
  'bg-brand-primary/30',
  'bg-brand-primary/18',
]

const GLOW_COLORS_WHITE = [
  'rgba(255,255,255,0.45)',
  'rgba(255,255,255,0.28)',
  'rgba(255,255,255,0.18)',
  'rgba(255,255,255,0.10)',
]

const GLOW_COLORS_BLUE = [
  'rgba(0,82,255,0.55)',
  'rgba(0,82,255,0.35)',
  'rgba(0,82,255,0.22)',
  'rgba(0,82,255,0.14)',
]

function buildPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const midY = fromY + (toY - fromY) * 0.5
  return `M ${fromX} ${fromY} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${toY}`
}

export function TokenFlowViz({ slots, sourceLabel, variant = 'white' }: TokenFlowVizProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px 0px' })
  const uid = useId().replace(/:/g, '')
  const isBlue = variant === 'blue'
  const SEGMENT_COLORS = isBlue ? SEGMENT_COLORS_BLUE : SEGMENT_COLORS_WHITE
  const GLOW_COLORS = isBlue ? GLOW_COLORS_BLUE : GLOW_COLORS_WHITE

  const SVG_W = 800
  const SVG_H = 120
  const SOURCE_X = SVG_W / 2
  const SOURCE_Y = 8
  const SLOT_Y = SVG_H - 8
  const slotCount = slots.length
  const padding = SVG_W * 0.08
  const usableW = SVG_W - padding * 2
  const slotXs = slots.map((_, i) =>
    slotCount === 1
      ? SOURCE_X
      : padding + (i / (slotCount - 1)) * usableW,
  )

  return (
    <div ref={ref} className="space-y-0">
      {/* Source node */}
      <div className="flex justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className={
            isBlue
              ? 'inline-flex items-center gap-2 rounded-full border border-brand-primary/30 bg-brand-primary/10 px-4 py-1.5 text-xs font-mono text-brand-primary shadow-[0_0_24px_-8px_rgba(0,82,255,0.45)]'
              : 'inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-mono text-white shadow-[0_0_24px_-8px_rgba(255,255,255,0.15)]'
          }
        >
          {sourceLabel}
        </motion.div>
      </div>

      {/* SVG connectors — hidden on mobile */}
      <div className="hidden sm:block">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full"
          style={{ height: SVG_H }}
          aria-hidden="true"
        >
          <defs>
            {slots.map((_, i) => (
              <linearGradient
                key={i}
                id={`flow-grad-${uid}-${i}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor={isBlue ? 'rgba(0,82,255,0.7)' : 'rgba(255,255,255,0.5)'} />
                <stop offset="100%" stopColor={GLOW_COLORS[i % GLOW_COLORS.length]} />
              </linearGradient>
            ))}
          </defs>

          {slots.map((_, i) => (
            <motion.path
              key={i}
              d={buildPath(SOURCE_X, SOURCE_Y, slotXs[i], SLOT_Y)}
              fill="none"
              stroke={`url(#flow-grad-${uid}-${i})`}
              strokeWidth={1.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 1 } : {}}
              transition={{
                pathLength: {
                  duration: 0.65,
                  delay: 0.2 + i * 0.1,
                  ease: 'easeInOut',
                },
                opacity: {
                  duration: 0.2,
                  delay: 0.2 + i * 0.1,
                },
              }}
            />
          ))}

          {/* Destination dots */}
          {slots.map((_, i) => (
            <motion.circle
              key={`dot-${i}`}
              cx={slotXs[i]}
              cy={SLOT_Y}
              r={3}
              fill={isBlue ? 'rgba(0,82,255,0.6)' : 'rgba(255,255,255,0.4)'}
              initial={{ opacity: 0, scale: 0 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.25, delay: 0.8 + i * 0.08 }}
            />
          ))}
        </svg>
      </div>

      {/* Segmented proportion bar */}
      <div className="overflow-hidden rounded-full">
        <div className="flex h-1.5 w-full gap-px">
          {slots.map((slot, i) => (
            <motion.div
              key={slot.percent + i}
              className={`h-full origin-left ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}`}
              style={{ width: `${slot.numericPercent}%` }}
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{
                duration: 0.5,
                delay: 0.35 + i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          ))}
        </div>
      </div>

      {/* Slot cards */}
      <div
        className={`grid gap-3 pt-3 ${
          slotCount === 3
            ? 'sm:grid-cols-3'
            : slotCount === 4
              ? 'sm:grid-cols-2 lg:grid-cols-4'
              : 'sm:grid-cols-2'
        }`}
      >
        {slots.map((slot, i) => {
          const name = slot.label ?? slot.title ?? ''
          return (
            <motion.div
              key={name + i}
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.45,
                delay: 0.65 + i * 0.08,
                ease: 'easeOut',
              }}
              className="space-y-2 rounded-2xl border border-white/6 bg-black/20 p-4"
            >
              {/* Icon + label row */}
              <div className="flex items-center gap-1.5">
                {slot.icon ? (
                  <img
                    src={slot.icon}
                    alt={slot.iconAlt ?? name}
                    width={14}
                    height={14}
                    className={slot.iconClassName ?? 'h-3.5 w-3.5 opacity-90'}
                    loading="lazy"
                  />
                ) : (
                  <span
                    className={`inline-flex h-1.5 w-1.5 rounded-full ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} opacity-90`}
                    aria-hidden="true"
                  />
                )}
                <span className="label text-[9px] sm:text-[10px]">{name}</span>
              </div>

              {/* Percent */}
              <div className="value mono text-2xl text-white sm:text-3xl">
                {slot.percent}
              </div>

              {/* Description */}
              <p className="text-[11px] font-light leading-relaxed text-zinc-300 sm:text-xs">
                {slot.description}
              </p>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
