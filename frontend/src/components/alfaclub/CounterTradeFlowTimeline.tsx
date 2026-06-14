import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'

/**
 * Self-contained horizontal 3D timeline component (no horizontal scroll created by this component).
 *
 * Full-width band (main content column after sidebar → right viewport edge).
 * Uses a responsive 7-column grid so the 7 phases always fit the available width
 * without forcing an overflow-x scroller inside the timeline.
 *
 * Mouse position drives the 3D tilt on the stage + the progress dot on the thin rail
 * (interactive scrub across the flow). Cards retain the full layered glass/bevel style.
 */
export function CounterTradeFlowTimeline() {
  const phases = [
    { phase: '01', name: 'Scheduler', desc: 'Ticker wakes the loop (Railway only when enabled)', keys: 'counterTradeTicker.ts • hermit' },
    { phase: '02', name: 'Orchestrator', desc: 'Runner loads state, drives the tick', keys: 'counterTradeRunner.ts • counterTradeConfig.ts' },
    { phase: '03', name: 'Decision Core', desc: 'Engine + LLM decide the counter move', keys: 'counterTradeEngine.ts • counterTradeLlmAdvisor.ts' },
    { phase: '04', name: 'Main Execute', desc: 'Flows + usage + room posts for the trade', keys: 'counterTradeEntryFlow.ts • counterTradeExitFlow.ts • usage • posting' },
    { phase: '05', name: 'Side Effects', desc: 'Defense / Harvest / Sweep (parallel every tick)', keys: 'counterTradeDefense.ts • counterTradeHarvest.ts' },
    { phase: '06', name: 'State + External', desc: 'Ledgers + HL/Arena/Chat (data in, actions out)', keys: 'counterTradeStore.ts • hyperliquid.ts • arenaClient • chatBridge' },
    { phase: '07', name: 'Observe', desc: 'Status API + UI surfaces everything', keys: 'status endpoint • UI pages/hooks' },
  ]

  const scrollerRef = useRef<HTMLDivElement>(null)

  // Mouse-driven stage tilt + interactive rail progress (no horizontal scroll forced by the timeline)
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const stageRotateX = useTransform(mouseY, [-0.5, 0.5], [7, -7])
  const stageRotateY = useTransform(mouseX, [-0.5, 0.5], [-11, 11])

  // Rail progress follows horizontal mouse position across the band (interactive "scrub" feel)
  const railProgress = useTransform(mouseX, [-0.5, 0.5], [0, 1])
  const railLeftPct = useTransform(railProgress, (v) => `${v * 100}%`)

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width - 0.5
    const ny = (e.clientY - rect.top) / rect.height - 0.5
    mouseX.set(Math.max(-0.5, Math.min(0.5, nx)))
    mouseY.set(Math.max(-0.5, Math.min(0.5, ny)))
  }
  const handlePointerLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div className="relative -mx-4 sm:-mx-6 lg:-mr-6 w-[calc(100%+2rem)] lg:w-[calc(100%+1.5rem)]">
      {/* Label aligned to content column */}
      <div className="mb-3 flex items-center gap-3 pl-4 sm:pl-6 lg:pl-0 text-[10px] font-mono tracking-[3.5px] text-zinc-500/70">
        RUNTIME FLOW
        <div className="h-px flex-1 bg-gradient-to-r from-zinc-800/70 to-transparent" />
      </div>

      {/* The timeline band — transparent, no borders, no overflow-x-auto.
          Uses a 7-column grid so the phases always fit the available width.
          The component never forces its own horizontal scrollbar. */}
      <div
        ref={scrollerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="relative py-8"
      >
        {/* Very faint grid texture directly on the page background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* 3D stage as grid (always fits, no min-w forcing scroll).
            lg padding keeps alignment after the fixed sidebar. */}
        <motion.div
          className="grid grid-cols-7 w-full gap-2 sm:gap-3 lg:gap-4 px-4 sm:px-6 lg:pl-[18rem] lg:pr-6 pb-2"
          style={{
            transformStyle: 'preserve-3d',
            rotateX: stageRotateX,
            rotateY: stageRotateY,
          }}
        >
          {phases.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 68, rotateX: 26, scale: 0.92 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 3, scale: 1 }}
              viewport={{ once: true, margin: '-90px' }}
              transition={{ duration: 0.62, delay: i * 0.032, ease: [0.21, 0.9, 0.26, 1] }}
              whileHover={{ rotateX: -5, y: -15, scale: 1.032, transition: { duration: 0.18 } }}
              className="group relative w-full min-w-[90px] rounded-3xl border border-white/10 bg-zinc-950/95 p-4 sm:p-5 shadow-[0_40px_120px_-30px_rgb(0,0,0,0.65)] backdrop-blur-2xl"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Back bevel plane */}
              <div
                className="absolute -inset-[1.5px] rounded-[17px] bg-[radial-gradient(120%_70%_at_30%_20%,rgba(255,255,255,0.045),transparent_55%),linear-gradient(145deg,rgba(0,0,0,0.55),transparent)]"
                style={{ transform: 'translateZ(-16px) rotateX(3.5deg)' }}
              />

              {/* Glass layer */}
              <div
                className="absolute inset-[1px] rounded-[15px] bg-gradient-to-br from-white/10 via-white/[0.018] to-transparent"
                style={{ transform: 'translateZ(7px)' }}
              />

              <div className="relative z-10" style={{ transform: 'translateZ(13px)' }}>
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="font-mono text-[10px] tracking-[3px] text-amber-400/70">{p.phase}</div>
                  <div className="h-px w-5 bg-white/25 transition group-hover:bg-white/60" />
                </div>

                <div className="mb-2 text-[15px] sm:text-[17px] font-semibold leading-none tracking-[-0.35px] text-white transition-colors group-hover:text-white">
                  {p.name}
                </div>

                <div className="mb-4 pr-1 text-[11px] sm:text-[12.5px] leading-snug text-zinc-400">{p.desc}</div>

                <div className="border-t border-white/10 pt-2.5 font-mono text-[9px] sm:text-[10px] tracking-[-0.1px] leading-tight text-zinc-500/80">
                  {p.keys}
                </div>
              </div>

              {i < phases.length - 1 && (
                <div className="pointer-events-none absolute top-[42%] -right-[10px] h-px w-3 bg-gradient-to-r from-white/35 to-transparent" />
              )}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Thin rail on the page background. Dot position follows mouse X (interactive, no scroll needed). */}
      <div className="relative mt-1 h-px lg:pl-[18rem]">
        <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-800/80" />
        <motion.div
          className="absolute inset-y-0 left-0 origin-left h-px bg-gradient-to-r from-white/60 via-white to-white/60"
          style={{ scaleX: railProgress }}
        />
        <motion.div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-zinc-950 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ left: railLeftPct }}
        />
      </div>

      <div className="mt-2 pl-4 text-[10px] text-zinc-500/70 sm:pl-6 lg:pl-[18rem]">
        Move mouse across the timeline to tilt the 3D stage and move the rail dot. The flow always fits without its own horizontal scroll.
      </div>
    </div>
  )
}
