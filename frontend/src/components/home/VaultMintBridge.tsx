import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

type Props = {
  depositTokens: string
  shareTokens: string
}

// SVG fork geometry — all in the same coordinate space
const FORK_W = 560
const FORK_H = 116
const STEM_X = FORK_W / 2            // 280 — center x
const STEM_BOTTOM_Y = 42             // where the stem ends and arms begin
const ARM_L_X = 64                   // left arm endpoint x
const ARM_R_X = FORK_W - 64          // right arm endpoint x  (496)
const CTRL_Y = FORK_H * 0.72         // bezier control y

const stemD = `M ${STEM_X} 0 L ${STEM_X} ${STEM_BOTTOM_Y}`
const leftD = `M ${STEM_X} ${STEM_BOTTOM_Y} C ${STEM_X} ${CTRL_Y}, ${ARM_L_X} ${CTRL_Y}, ${ARM_L_X} ${FORK_H}`
const rightD = `M ${STEM_X} ${STEM_BOTTOM_Y} C ${STEM_X} ${CTRL_Y}, ${ARM_R_X} ${CTRL_Y}, ${ARM_R_X} ${FORK_H}`

// Percentages for aligning output labels under arm endpoints
const leftPct = `${(ARM_L_X / FORK_W) * 100}%`
const rightPct = `${((FORK_W - ARM_R_X) / FORK_W) * 100}%`

export function VaultMintBridge({ depositTokens, shareTokens }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px 0px' })

  return (
    <section
      ref={ref}
      className="cinematic-section no-divider-top no-divider-bottom relative !py-20 sm:!py-28 lg:!py-36"
    >
      {/* Ambient depth glow — centered on vault */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 72% 56% at 50% 52%, rgba(0,82,255,0.08) 0%, rgba(0,82,255,0.03) 35%, transparent 68%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex max-w-[560px] flex-col items-center px-4 sm:px-6">

        {/* ─── Deposit amount ─── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="mb-4 text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-600">
            Deposited into vault
          </p>
          <p className="font-mono text-[2.75rem] font-bold leading-none text-zinc-100 sm:text-[4.5rem] lg:text-[5.5rem]">
            {depositTokens}
          </p>
          <p className="mt-2.5 font-mono text-xs tracking-[0.22em] text-zinc-500 sm:text-sm">
            TOKEN
          </p>
        </motion.div>

        {/* ─── Top connector: deposit → vault ─── */}
        <svg
          width="2"
          height="72"
          viewBox="0 0 2 72"
          className="overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="vmb-top-line" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
            </linearGradient>
          </defs>
          <motion.path
            d="M 1 0 L 1 72"
            stroke="url(#vmb-top-line)"
            strokeWidth="1.5"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={inView ? { pathLength: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.35 }}
          />
          {/* Cascading particles flowing down the stem */}
          {([0, 0.55, 1.1] as const).map((d) => (
            <circle key={d} cx="1" r="2" fill="rgba(255,255,255,0.5)">
              <animate
                attributeName="cy"
                values="0;72"
                dur="1.5s"
                repeatCount="indefinite"
                begin={`${0.85 + d}s`}
              />
              <animate
                attributeName="opacity"
                values="0;0.8;0"
                dur="1.5s"
                repeatCount="indefinite"
                begin={`${0.85 + d}s`}
              />
            </circle>
          ))}
        </svg>

        {/* ─── Vault node ─── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.68 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, delay: 0.48, type: 'spring', stiffness: 170, damping: 18 }}
          className="relative flex items-center justify-center"
        >
          {/* Breathing ring — outermost */}
          <motion.div
            className="absolute rounded-[22px] border border-white/[0.035]"
            style={{ width: 228, height: 228 }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
          />
          {/* Breathing ring — inner */}
          <motion.div
            className="absolute rounded-[20px] border border-brand-primary/[0.13]"
            style={{ width: 196, height: 196 }}
            animate={{ scale: [1, 1.06, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
          />
          {/* Core vault box */}
          <div
            className="relative z-10 flex flex-col items-center justify-center rounded-[18px] border border-white/[0.07] bg-black/80"
            style={{
              width: 164,
              height: 164,
              boxShadow: [
                '0 0 0 1px rgba(0,82,255,0.1)',
                '0 0 48px -10px rgba(0,82,255,0.6)',
                '0 0 100px -36px rgba(0,82,255,0.32)',
                '0 32px 64px -24px rgba(0,0,0,0.8)',
                'inset 0 1px 0 rgba(255,255,255,0.04)',
              ].join(', '),
            }}
          >
            <span className="font-mono text-[8px] font-medium uppercase tracking-[0.32em] text-zinc-700">
              erc
            </span>
            <span className="mt-0.5 font-mono text-[2.4rem] font-bold leading-none text-brand-primary">
              4626
            </span>
            <span className="mt-1.5 font-mono text-[8px] font-medium uppercase tracking-[0.24em] text-zinc-700">
              vault
            </span>
          </div>
        </motion.div>

        {/* ─── Y-split SVG fork: vault → two outputs (desktop) ─── */}
        <div className="hidden w-full sm:block">
          <svg
            viewBox={`0 0 ${FORK_W} ${FORK_H}`}
            width="100%"
            style={{ height: FORK_H }}
            className="overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="vmb-stem-g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
              </linearGradient>
              <linearGradient
                id="vmb-left-g"
                gradientUnits="userSpaceOnUse"
                x1={STEM_X} y1={STEM_BOTTOM_Y}
                x2={ARM_L_X} y2={FORK_H}
              >
                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
              </linearGradient>
              <linearGradient
                id="vmb-right-g"
                gradientUnits="userSpaceOnUse"
                x1={STEM_X} y1={STEM_BOTTOM_Y}
                x2={ARM_R_X} y2={FORK_H}
              >
                <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
                <stop offset="100%" stopColor="rgba(0,82,255,0.7)" />
              </linearGradient>
            </defs>

            {/* Hidden paths used by animateMotion */}
            <path id="vmb-left-mpath" d={leftD} fill="none" stroke="none" />
            <path id="vmb-right-mpath" d={rightD} fill="none" stroke="none" />

            {/* Stem */}
            <motion.path
              d={stemD}
              stroke="url(#vmb-stem-g)"
              strokeWidth={1.5}
              fill="none"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 0.38, delay: 0.78 }}
            />

            {/* Left arm */}
            <motion.path
              d={leftD}
              stroke="url(#vmb-left-g)"
              strokeWidth={1.5}
              fill="none"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 0.58, delay: 0.98 }}
            />

            {/* Right arm */}
            <motion.path
              d={rightD}
              stroke="url(#vmb-right-g)"
              strokeWidth={1.5}
              fill="none"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 0.58, delay: 0.98 }}
            />

            {/* Particles — left arm (white) */}
            {inView &&
              ([0, 0.6, 1.2] as const).map((d) => (
                <circle key={`pl-${d}`} r="2.2" fill="rgba(255,255,255,0.55)" opacity="0">
                  <animate
                    attributeName="opacity"
                    values="0;0.75;0"
                    dur="1.6s"
                    repeatCount="indefinite"
                    begin={`${1.55 + d}s`}
                  />
                  <animateMotion
                    dur="1.6s"
                    repeatCount="indefinite"
                    begin={`${1.55 + d}s`}
                  >
                    <mpath href="#vmb-left-mpath" />
                  </animateMotion>
                </circle>
              ))}

            {/* Particles — right arm (blue) */}
            {inView &&
              ([0, 0.6, 1.2] as const).map((d) => (
                <circle key={`pr-${d}`} r="2.2" fill="rgba(0,82,255,0.8)" opacity="0">
                  <animate
                    attributeName="opacity"
                    values="0;0.9;0"
                    dur="1.6s"
                    repeatCount="indefinite"
                    begin={`${1.55 + d}s`}
                  />
                  <animateMotion
                    dur="1.6s"
                    repeatCount="indefinite"
                    begin={`${1.55 + d}s`}
                  >
                    <mpath href="#vmb-right-mpath" />
                  </animateMotion>
                </circle>
              ))}

            {/* Destination dots */}
            <motion.circle
              cx={ARM_L_X} cy={FORK_H} r={3.5}
              fill="rgba(255,255,255,0.32)"
              initial={{ opacity: 0, scale: 0 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.28, delay: 1.55 }}
            />
            <motion.circle
              cx={ARM_R_X} cy={FORK_H} r={3.5}
              fill="rgba(0,82,255,0.75)"
              initial={{ opacity: 0, scale: 0 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.28, delay: 1.55 }}
            />
          </svg>

          {/* Output labels — anchored under each arm endpoint */}
          <div
            className="flex justify-between pt-3"
            style={{ paddingLeft: leftPct, paddingRight: rightPct }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 1.5 }}
              className="-translate-x-1/2 text-center"
            >
              <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-600">
                → Strategies
              </p>
              <p className="mt-1.5 font-mono text-base text-zinc-200 sm:text-lg">
                {depositTokens}
              </p>
              <p className="font-mono text-[10px] tracking-widest text-zinc-500">TOKEN</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 1.5 }}
              className="translate-x-1/2 text-center"
            >
              <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-zinc-600">
                → Distribution
              </p>
              <p className="mt-1.5 font-mono text-base text-brand-primary sm:text-lg">
                {shareTokens}
              </p>
              <p className="font-mono text-[10px] tracking-widest text-brand-primary/55">■TOKEN</p>
            </motion.div>
          </div>
        </div>

        {/* ─── Mobile fork: two stacked output nodes ─── */}
        <div className="sm:hidden flex w-full max-w-xs justify-between pt-2">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.85 }}
          >
            <motion.div
              className="mx-auto mb-2 h-8 w-px origin-top bg-gradient-to-b from-white/10 to-white/28"
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.8 }}
            />
            <p className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">
              → Strategies
            </p>
            <p className="mt-1 font-mono text-sm text-zinc-200">{depositTokens}</p>
            <p className="font-mono text-[10px] text-zinc-500">TOKEN</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.85 }}
            className="text-right"
          >
            <motion.div
              className="ml-auto mb-2 h-8 w-px origin-top bg-gradient-to-b from-brand-primary/10 to-brand-primary/45"
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.8 }}
            />
            <p className="text-[9px] font-medium uppercase tracking-widest text-zinc-600">
              → Distribution
            </p>
            <p className="mt-1 font-mono text-sm text-brand-primary">{shareTokens}</p>
            <p className="font-mono text-[10px] text-brand-primary/55">■TOKEN</p>
          </motion.div>
        </div>

      </div>
    </section>
  )
}
