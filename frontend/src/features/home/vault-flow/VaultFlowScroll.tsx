import { useEffect, useRef, useState } from 'react'
import { motion, type MotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion'

import { fetchZoraCoin, fetchZoraProfile } from '@/lib/zora/client'
import { STORY_CONTENT } from '@/features/home/vault-flow/model/storyContent'

const AKITA_ADDRESS = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const
const TOTAL_TOKENS  = 50_000_000

type Props = {
  depositTokens: string
  shareTokens: string
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const GRAIN_URL = `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`

const BLUE   = '59,130,246'
const ORANGE = '245,158,11'

const BEAT_ACCENTS: Record<number, string> = {
  1: `radial-gradient(ellipse 70% 50% at 50% 65%, rgba(${BLUE},0.04) 0%, transparent 70%)`,
  2: `radial-gradient(ellipse 70% 55% at 50% 55%, rgba(${BLUE},0.06) 0%, transparent 70%)`,
  3: `radial-gradient(ellipse 55% 45% at 50% 50%, rgba(${BLUE},0.05) 0%, transparent 70%)`,
  4: `radial-gradient(ellipse 60% 55% at 50% 50%, rgba(${BLUE},0.10) 0%, transparent 70%)`,
  5: `radial-gradient(ellipse 85% 55% at 50% 55%, rgba(${BLUE},0.06) 0%, transparent 70%)`,
  6: `radial-gradient(ellipse 85% 60% at 50% 55%, rgba(${ORANGE},0.04) 0%, transparent 70%)`,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

// Beat 2 — one continuous depositor -> vault pass.
const FLOW_CYCLE = 6.8 // seconds for one full deposit cycle

function DepositFlowViz({ avatarSrc }: { avatarSrc: string | null }) {
  const machineRef = useRef<HTMLDivElement>(null)
  const vaultRef = useRef<HTMLDivElement>(null)
  const [machineSize, setMachineSize] = useState({ width: 640, height: 204 })
  const [vaultCore, setVaultCore] = useState({ x: 320, y: 102 })

  useEffect(() => {
    const node = machineRef.current
    if (!node) return

    const measure = () => {
      const rect = node.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setMachineSize({ width: rect.width, height: rect.height })
      }

      const vaultNode = vaultRef.current
      if (vaultNode) {
        const vaultRect = vaultNode.getBoundingClientRect()
        const x = vaultRect.left - rect.left + vaultRect.width / 2
        const y = vaultRect.top - rect.top + vaultRect.height / 2
        setVaultCore((prev) =>
          Math.abs(prev.x - x) > 0.5 || Math.abs(prev.y - y) > 0.5
            ? { x, y }
            : prev,
        )
      }
    }

    measure()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => measure())
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const { width: machineW, height: machineH } = machineSize

  const tokenRing = {
    border: '1.5px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
  }
  const depositorSeat = {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 72%)',
    boxShadow: `0 0 0 1px rgba(${BLUE},0.05), inset 0 1px 0 rgba(255,255,255,0.05)`,
  }
  // Vault core point aligns to the center of the 4626 mark in the machine.
  const VAULT_CORE_X = vaultCore.x
  const VAULT_CORE_Y = vaultCore.y
  // Keep the deposited token traveling inside the vault body before it fades.
  const VAULT_INNER_Y = machineH * 0.8
  const START_X = machineW * 0.121875
  const START_Y = machineH * 0.490196
  const DEPOSITOR_X = machineW * 0.078125
  const DEPOSITOR_Y = machineH * 0.352941
  const C1_X = machineW * 0.275
  const C1_Y = machineH * 0.490196
  const C2_X = machineW * 0.384375
  const C2_Y = machineH * 0.431373
  const MID_X = machineW * 0.465625
  const C3_X = machineW * 0.484375
  const C4_X = machineW * 0.496875
  const R1_X = machineW * 0.446875
  const R1_Y = machineH * 0.529412
  const R2_X = machineW * 0.340625
  const R2_Y = machineH * 0.519608

  // Path 1: depositor -> vault center -> descends inside vault.
  const depositPath = `path("M ${START_X} ${START_Y} C ${C1_X} ${C1_Y} ${C2_X} ${C2_Y} ${MID_X} ${VAULT_CORE_Y} C ${C3_X} ${VAULT_CORE_Y} ${C4_X} ${VAULT_CORE_Y} ${VAULT_CORE_X} ${VAULT_CORE_Y} L ${VAULT_CORE_X} ${VAULT_INNER_Y}")`
  // Visible guide for path 1 stays on the full depositor -> vault-core route.
  const depositGuidePath = `M ${START_X} ${START_Y} C ${C1_X} ${C1_Y} ${C2_X} ${C2_Y} ${MID_X} ${VAULT_CORE_Y} C ${C3_X} ${VAULT_CORE_Y} ${C4_X} ${VAULT_CORE_Y} ${VAULT_CORE_X} ${VAULT_CORE_Y} L ${VAULT_CORE_X} ${VAULT_INNER_Y}`
  // Path 2: receipt/share token travels in one direction from vault core to depositor.
  const receiptPath = `path("M ${VAULT_CORE_X} ${VAULT_CORE_Y} C ${R1_X} ${R1_Y} ${R2_X} ${R2_Y} ${START_X} ${START_Y}")`

  return (
    <div className="mb-6 w-full max-w-[720px] sm:mb-8" data-testid="beat-2-vault-machine">
      <div ref={machineRef} className="relative mx-auto h-[204px] w-full">
        <div className="pointer-events-none absolute left-1/2 top-0 z-30 flex -translate-x-1/2 items-center gap-2">
          <motion.span
            className="rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em]"
            animate={{ opacity: [0, 1, 1, 0, 0] }}
            transition={{ duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.10, 0.48, 0.56, 1], ease: 'linear' }}
            style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.03)' }}
          >
            1. Deposit {STORY_CONTENT.creatorTokenSymbol.toLowerCase()}
          </motion.span>
          <motion.span
            className="text-[10px]"
            animate={{ opacity: [0, 1, 1, 1, 0] }}
            transition={{ duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.10, 0.58, 0.92, 1], ease: 'linear' }}
            style={{ color: 'rgba(255,255,255,0.32)' }}
          >
            →
          </motion.span>
          <motion.span
            className="rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em]"
            animate={{ opacity: [0, 0, 1, 1, 0] }}
            transition={{ duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.68, 0.74, 0.92, 1], ease: 'linear' }}
            style={{ border: `1px solid rgba(${BLUE},0.30)`, color: `rgba(${BLUE},0.90)`, background: `rgba(${BLUE},0.08)` }}
          >
            2. Receive shares
          </motion.span>
        </div>

        <div
          className="pointer-events-none absolute z-0 flex flex-col items-center gap-1.5"
          data-testid="beat-2-depositor-anchor"
          style={{ left: DEPOSITOR_X, top: DEPOSITOR_Y }}
        >
          <div className="h-14 w-14 rounded-full" style={depositorSeat} />
          <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.20)' }}>
            depositor
          </span>
        </div>

        {/* The motion paths stay active for the token animation but remain visually invisible. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${machineW} ${machineH}`} aria-hidden="true">
          <path d={depositGuidePath} stroke="transparent" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d={`M ${VAULT_CORE_X} ${VAULT_CORE_Y} C ${R1_X} ${R1_Y} ${R2_X} ${R2_Y} ${START_X} ${START_Y}`} stroke="transparent" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>

        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          {[
            { left: DEPOSITOR_X - 20, top: DEPOSITOR_Y - 18, delay: 0 },
            { left: DEPOSITOR_X - 10, top: DEPOSITOR_Y + 52, delay: 0.04 },
            { left: DEPOSITOR_X + 34, top: DEPOSITOR_Y + 12, delay: 0.08 },
          ].map((ghost, index) => (
            <motion.div
              key={`${ghost.left}-${ghost.top}`}
              className="absolute"
              style={{ left: ghost.left, top: ghost.top }}
              animate={{
                opacity: [0, 0, 0.16, 0.24, 0.18],
                scale: [0.84, 0.84, 0.96, 1, 0.98],
              }}
              transition={{
                duration: FLOW_CYCLE,
                repeat: Infinity,
                times: [0, 0.58 + ghost.delay, 0.72 + ghost.delay, 0.90 + ghost.delay, 1],
                ease: 'linear',
              }}
            >
              <div
                className={`rounded-full ${index === 2 ? 'h-8 w-8' : 'h-7 w-7'}`}
                style={{
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.06), rgba(255,255,255,0.01) 72%)',
                  boxShadow: `0 0 0 1px rgba(${BLUE},0.03), inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}
              />
            </motion.div>
          ))}
        </div>

        {/* Path 1: one creator token follows one deposit path into vault center, then down. */}
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-20 -translate-x-1/2 -translate-y-1/2"
          data-testid="beat-2-input-token"
          style={{ offsetPath: depositPath, offsetRotate: '0deg' }}
          animate={{
            offsetDistance: ['0%', '0%', '100%', '100%'],
            scale: [1, 0.98, 0.9, 0.78],
            opacity: [0, 0.92, 1, 1, 1, 0],
          }}
          transition={{
            offsetDistance: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.12, 0.56, 1], ease: 'linear' },
            scale: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.14, 0.56, 0.60], ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.08, 0.12, 0.56, 0.94, 1], ease: 'linear' },
          }}
        >
          <div className="relative flex flex-col items-center">
            <div className="h-14 w-14 overflow-hidden rounded-full" style={tokenRing}>
              {avatarSrc
                ? <img src={avatarSrc} alt={STORY_CONTENT.creatorTokenSymbol} className="h-full w-full rounded-full object-cover" loading="lazy" />
                : <div className="flex h-full w-full items-center justify-center"><div className="h-2.5 w-2.5 rounded-full bg-white/40" /></div>
              }
            </div>
            <span
              className="pointer-events-none absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap"
              style={{ color: `rgba(${ORANGE},0.68)` }}
            >
              {STORY_CONTENT.creatorTokenSymbol.toLowerCase()}
            </span>
          </div>
        </motion.div>

        {/* Vault factory */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            ref={vaultRef}
            className="relative h-[116px] w-[128px] overflow-hidden rounded-[28px]"
            animate={{
              scale: [1, 1.02, 1],
              boxShadow: [
                `0 0 0px rgba(${BLUE},0)`,
                `0 0 34px rgba(${BLUE},0.20)`,
                `0 0 10px rgba(${BLUE},0.08)`,
              ],
            }}
            transition={{
              duration: FLOW_CYCLE,
              repeat: Infinity,
              times: [0, 0.58, 1],
              ease: 'easeInOut',
            }}
            style={{
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
            }}
          >
            <div
              className="absolute left-1/2 top-3 h-2 w-16 -translate-x-1/2 rounded-full"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            />

            <motion.div
              data-testid="beat-2-vault-drop"
              className="absolute left-1/2 top-5 w-px -translate-x-1/2"
              animate={{ height: [10, 10, 36, 56, 56], opacity: [0, 0.10, 0.36, 0.20, 0.06] }}
              transition={{
                duration: FLOW_CYCLE,
                repeat: Infinity,
                times: [0, 0.30, 0.58, 0.76, 1],
                ease: 'easeInOut',
              }}
              style={{ background: `linear-gradient(to bottom, rgba(${BLUE},0.04), rgba(${BLUE},0.45), rgba(${BLUE},0.02))` }}
            />

            <motion.div
              className="absolute inset-x-3 bottom-3 rounded-[18px]"
              animate={{
                height: ['18%', '18%', '34%', '22%'],
                opacity: [0.18, 0.18, 0.34, 0.18],
              }}
              transition={{
                duration: FLOW_CYCLE,
                repeat: Infinity,
                times: [0, 0.52, 0.72, 1],
                ease: 'easeInOut',
              }}
              style={{
                background: `linear-gradient(180deg, rgba(${BLUE},0.00), rgba(${BLUE},0.18))`,
                filter: `blur(1px)`,
              }}
            />

            <div className="absolute inset-0 flex items-center justify-center">
              <img src="/assets/logo-mark.svg" alt="4626 vault" className="h-11 w-11 object-contain" loading="lazy" style={{ opacity: 0.82 }} />
            </div>
          </motion.div>
          <span
            className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap"
            style={{ color: `rgba(${BLUE},0.45)` }}
          >
            vault
          </span>
        </div>

        {/* Path 2: one share token fades/scales in at center, then travels out. */}
        <motion.div
          className="pointer-events-none absolute left-0 top-0 z-20"
          data-testid="beat-2-output-token"
          style={{ offsetPath: receiptPath, offsetRotate: '0deg' }}
          animate={{
            offsetDistance: ['0%', '0%', '100%', '100%'],
            opacity: [0, 0, 0.96, 1, 0.22, 0],
          }}
          transition={{
            offsetDistance: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.74, 0.98, 1], ease: 'linear' },
            opacity: { duration: FLOW_CYCLE, repeat: Infinity, times: [0, 0.68, 0.74, 0.98, 0.995, 1], ease: 'linear' },
          }}
        >
          <motion.div
            className="-translate-x-1/2 -translate-y-1/2"
            animate={{ scale: [0.2, 0.2, 1, 1, 0.94] }}
            transition={{
              duration: FLOW_CYCLE,
              repeat: Infinity,
              times: [0, 0.68, 0.74, 0.92, 1],
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="relative flex flex-col items-center">
              <div className="h-14 w-14 overflow-hidden rounded-lg" style={{ boxShadow: `0 0 20px rgba(${BLUE},0.16)` }}>
                <img
                  src={STORY_CONTENT.shareTokenBadgeSrc}
                  alt={STORY_CONTENT.shareTokenSymbol}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  style={{
                    opacity: 0.96,
                    WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 70%, rgba(0,0,0,0.88) 84%, rgba(0,0,0,0) 100%)',
                    maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 70%, rgba(0,0,0,0.88) 84%, rgba(0,0,0,0) 100%)',
                  }}
                />
              </div>
              <span
                className="pointer-events-none absolute top-full mt-1.5 left-1/2 -translate-x-1/2 text-[10px] font-mono whitespace-nowrap"
                style={{ color: `rgba(${BLUE},0.50)` }}
              >
                {STORY_CONTENT.shareTokenSymbol}
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}


// Beat 4 — two parallel vertical lines with a downward blue pulse.
const MINT_LINE_BG   = `rgba(${BLUE},0.12)`
const MINT_PULSE_GRD = `linear-gradient(to bottom, transparent 0%, rgba(${BLUE},0.90) 50%, transparent 100%)`

function MintLines() {
  const t = { repeat: Infinity, duration: 1.5, ease: 'linear' as const }
  return (
    <div className="flex items-center gap-5">
      <div className="w-[1px] h-20 relative overflow-hidden" style={{ background: MINT_LINE_BG }}>
        <motion.div className="absolute top-0 w-full" style={{ height: '45%', background: MINT_PULSE_GRD }}
          initial={{ y: '-100%' }} animate={{ y: '240%' }} transition={{ ...t, delay: 0 }} />
      </div>
      <p className="text-[9px] uppercase tracking-[0.38em] font-medium select-none" style={{ color: `rgba(${BLUE},0.55)` }}>
        mints
      </p>
      <div className="w-[1px] h-20 relative overflow-hidden" style={{ background: MINT_LINE_BG }}>
        <motion.div className="absolute top-0 w-full" style={{ height: '45%', background: MINT_PULSE_GRD }}
          initial={{ y: '-100%' }} animate={{ y: '240%' }} transition={{ ...t, delay: 0.25 }} />
      </div>
    </div>
  )
}

function DepositSlot({ testId }: { testId?: string }) {
  return (
    <div className="flex flex-col items-center gap-2" aria-hidden="true" data-testid={testId}>
      <div
        className="h-px w-36"
        style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.18), rgba(255,255,255,0.02))' }}
      />
      <div
        className="h-3 w-24 rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 26px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      />
    </div>
  )
}

type RailTone = 'neutral' | 'blue' | 'orange'

type NarrativeRailLine = {
  text: string
  opacity: MotionValue<number>
  y: MotionValue<number>
  className: string
  color: string
}

type NarrativeRailProps = {
  testId: string
  opacity: MotionValue<number>
  y: MotionValue<number>
  scale?: MotionValue<number>
  chip?: {
    tone: RailTone
    iconSrc?: string
    leftText: string
    rightText?: string
    opacity?: MotionValue<number>
    scale?: MotionValue<number>
  }
  lines: NarrativeRailLine[]
}

const RAIL_TONE_STYLES: Record<RailTone, { border: string; background: string; boxShadow: string; rightColor: string }> = {
  neutral: {
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
    boxShadow: '0 0 18px rgba(255,255,255,0.04)',
    rightColor: 'rgba(255,255,255,0.78)',
  },
  blue: {
    border: `1px solid rgba(${BLUE},0.22)`,
    background: `linear-gradient(180deg, rgba(${BLUE},0.10), rgba(${BLUE},0.04))`,
    boxShadow: `0 0 22px rgba(${BLUE},0.08)`,
    rightColor: `rgba(${BLUE},0.90)`,
  },
  orange: {
    border: `1px solid rgba(${ORANGE},0.18)`,
    background: `linear-gradient(180deg, rgba(${ORANGE},0.10), rgba(${ORANGE},0.03))`,
    boxShadow: `0 0 22px rgba(${ORANGE},0.08)`,
    rightColor: `rgba(${ORANGE},0.80)`,
  },
}

function NarrativeRail({ testId, opacity, y, scale, chip, lines }: NarrativeRailProps) {
  const chipStyle = chip ? RAIL_TONE_STYLES[chip.tone] : null

  return (
    <motion.div
      style={{ opacity, y, scale }}
      className="pointer-events-none absolute left-1/2 top-16 z-30 flex w-full max-w-4xl -translate-x-1/2 justify-center px-6 sm:top-18"
      data-testid={testId}
    >
      <div className="flex max-w-2xl flex-col items-center gap-3 text-center">
        {chip && chipStyle && (
          <motion.div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              opacity: chip.opacity,
              scale: chip.scale,
              border: chipStyle.border,
              background: chipStyle.background,
              boxShadow: chipStyle.boxShadow,
            }}
          >
            {chip.iconSrc ? <img src={chip.iconSrc} alt="" aria-hidden="true" className="h-4 w-4 object-contain" loading="lazy" /> : null}
            <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.62)' }}>
              {chip.leftText}
            </span>
            {chip.rightText ? (
              <span className="font-mono text-[11px]" style={{ color: chipStyle.rightColor }}>
                {chip.rightText}
              </span>
            ) : null}
          </motion.div>
        )}
        {lines.map((line) => (
          <motion.p key={line.text} className={line.className} style={{ color: line.color, opacity: line.opacity, y: line.y }}>
            {line.text}
          </motion.p>
        ))}
      </div>
    </motion.div>
  )
}

// Beat 5 — three cubic bezier paths fanning from a central source to three cards.
// viewBox 600×120: source (300,6), endpoints (80,114) (300,114) (520,114).
// Paths are white so they read as neutral connectors; nodes are blue accent dots.
type PathProps3 = { p1: MotionValue<number>; p2: MotionValue<number>; p3: MotionValue<number> }

const DIST_PATH_LEFT = 'M 300 6 C 300 65 80 65 80 114'
const DIST_PATH_MID = 'M 300 6 C 300 65 300 65 300 114'
const DIST_PATH_RIGHT = 'M 300 6 C 300 65 520 65 520 114'

function DistributionPaths({ p1, p2, p3 }: PathProps3) {
  const stroke = 'rgba(255,255,255,0.38)'
  const dot    = `rgba(${BLUE},0.95)`
  const tokenLeftDistance = useTransform(p1, [0, 1], ['0%', '100%'])
  const tokenMidDistance = useTransform(p2, [0, 1], ['0%', '100%'])
  const tokenRightDistance = useTransform(p3, [0, 1], ['0%', '100%'])
  const tokenLeftOpacity = useTransform(p1, [0, 0.08, 0.9, 1], [0, 1, 1, 0])
  const tokenMidOpacity = useTransform(p2, [0, 0.08, 0.9, 1], [0, 1, 1, 0])
  const tokenRightOpacity = useTransform(p3, [0, 0.08, 0.9, 1], [0, 1, 1, 0])
  const tokenLeftScale = useTransform(p1, [0, 0.8, 1], [0.7, 1, 0.9])
  const tokenMidScale = useTransform(p2, [0, 0.8, 1], [0.7, 1, 0.9])
  const tokenRightScale = useTransform(p3, [0, 0.8, 1], [0.7, 1, 0.9])

  return (
    <div className="relative w-full max-w-3xl mx-auto" style={{ height: 120 }}>
      <svg viewBox="0 0 600 120" className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden="true">
        <circle cx="300" cy="6" r="3.5" fill={dot} />
        <motion.path d={DIST_PATH_LEFT} stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: p1 }} />
        <motion.path d={DIST_PATH_MID} stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: p2 }} />
        <motion.path d={DIST_PATH_RIGHT} stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: p3 }} />
        <motion.circle cx="80"  cy="114" r="3" fill={dot} style={{ opacity: p1 }} />
        <motion.circle cx="300" cy="114" r="3" fill={dot} style={{ opacity: p2 }} />
        <motion.circle cx="520" cy="114" r="3" fill={dot} style={{ opacity: p3 }} />
      </svg>

      <motion.div
        className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-[44%]"
        style={{ offsetPath: `path("${DIST_PATH_LEFT}")`, offsetRotate: '0deg', offsetDistance: tokenLeftDistance, opacity: tokenLeftOpacity, scale: tokenLeftScale }}
        aria-hidden="true"
      >
        <img src={STORY_CONTENT.shareTokenBadgeSrc} alt="" className="h-5 w-5 object-contain drop-shadow-[0_0_7px_rgba(59,130,246,0.55)]" loading="lazy" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-[44%]"
        style={{ offsetPath: `path("${DIST_PATH_MID}")`, offsetRotate: '0deg', offsetDistance: tokenMidDistance, opacity: tokenMidOpacity, scale: tokenMidScale }}
        aria-hidden="true"
      >
        <img src={STORY_CONTENT.shareTokenBadgeSrc} alt="" className="h-5 w-5 object-contain drop-shadow-[0_0_7px_rgba(59,130,246,0.55)]" loading="lazy" />
      </motion.div>
      <motion.div
        className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-[44%]"
        style={{ offsetPath: `path("${DIST_PATH_RIGHT}")`, offsetRotate: '0deg', offsetDistance: tokenRightDistance, opacity: tokenRightOpacity, scale: tokenRightScale }}
        aria-hidden="true"
      >
        <img src={STORY_CONTENT.shareTokenBadgeSrc} alt="" className="h-5 w-5 object-contain drop-shadow-[0_0_7px_rgba(59,130,246,0.55)]" loading="lazy" />
      </motion.div>
    </div>
  )
}

// Beat 6 — four independent bezier arcs, all originating from the source node.
// SVG viewBox 600×120 + overflow:visible so arcs extend into the grid below.
// Grid geometry (SVG px coords):
//   top-row cards:    y=128–214  →  endpoint at top edge y=128
//   bottom-row cards: y=226–312  →  endpoint at top edge y=226
//   left column cx=150, right column cx=450
// Top paths control points at y=80 (short arc), bottom paths at y=165 (deep arc).
type PathProps2 = {
  pLeft: MotionValue<number>
  pRight: MotionValue<number>
  pBotLeft: MotionValue<number>
  pBotRight: MotionValue<number>
  tokenSrc?: string | null
  tokenSymbol: string
}

const STRAT_PATH_LEFT = 'M 300 6 C 300 80 150 80 150 128'
const STRAT_PATH_RIGHT = 'M 300 6 C 300 80 450 80 450 128'
const STRAT_PATH_BOT_LEFT = 'M 300 6 C 300 165 150 165 150 226'
const STRAT_PATH_BOT_RIGHT = 'M 300 6 C 300 165 450 165 450 226'

function StrategyBranches({ pLeft, pRight, pBotLeft, pBotRight, tokenSrc, tokenSymbol }: PathProps2) {
  const stroke   = 'rgba(255,255,255,0.22)'
  const nodeFill = `rgba(${ORANGE},0.65)`
  const nodeGlow = `drop-shadow(0 0 4px rgba(${ORANGE},0.40))`
  const tokenLeftDistance = useTransform(pLeft, [0, 1], ['0%', '100%'])
  const tokenRightDistance = useTransform(pRight, [0, 1], ['0%', '100%'])
  const tokenBotLeftDistance = useTransform(pBotLeft, [0, 1], ['0%', '100%'])
  const tokenBotRightDistance = useTransform(pBotRight, [0, 1], ['0%', '100%'])
  const tokenLeftOpacity = useTransform(pLeft, [0, 0.08, 0.9, 1], [0, 1, 1, 0])
  const tokenRightOpacity = useTransform(pRight, [0, 0.08, 0.9, 1], [0, 1, 1, 0])
  const tokenBotLeftOpacity = useTransform(pBotLeft, [0, 0.08, 0.9, 1], [0, 1, 1, 0])
  const tokenBotRightOpacity = useTransform(pBotRight, [0, 0.08, 0.9, 1], [0, 1, 1, 0])
  const tokenLeftScale = useTransform(pLeft, [0, 0.8, 1], [0.7, 1, 0.9])
  const tokenRightScale = useTransform(pRight, [0, 0.8, 1], [0.7, 1, 0.9])
  const tokenBotLeftScale = useTransform(pBotLeft, [0, 0.8, 1], [0.7, 1, 0.9])
  const tokenBotRightScale = useTransform(pBotRight, [0, 0.8, 1], [0.7, 1, 0.9])

  const tokenBadge = tokenSrc ? (
    <img
      src={tokenSrc}
      alt=""
      className="h-5 w-5 rounded-full object-cover ring-1 ring-orange-300/25 drop-shadow-[0_0_7px_rgba(245,158,11,0.45)]"
      loading="lazy"
    />
  ) : (
    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-400/30 ring-1 ring-orange-300/25 text-[9px] font-mono text-orange-200/90 drop-shadow-[0_0_7px_rgba(245,158,11,0.45)]">
      {tokenSymbol.trim().charAt(0) || '$'}
    </div>
  )

  return (
    <div className="relative w-full max-w-2xl mx-auto" style={{ height: 120 }}>
      <svg viewBox="0 0 600 120" className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden="true">
        {/* source */}
        <circle cx="300" cy="6" r="4" fill={nodeFill} style={{ filter: nodeGlow }} />

        {/* top-row arcs — tighter curve, arrives at top of top cards */}
        <motion.path d={STRAT_PATH_LEFT} stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pLeft }} />
        <motion.path d={STRAT_PATH_RIGHT} stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pRight }} />

        {/* bottom-row arcs — deeper curve, arrives at top of bottom cards */}
        <motion.path d={STRAT_PATH_BOT_LEFT} stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pBotLeft }} />
        <motion.path d={STRAT_PATH_BOT_RIGHT} stroke={stroke} strokeWidth="1.2" fill="none" strokeLinecap="round" style={{ pathLength: pBotRight }} />

        {/* four endpoint nodes */}
        <motion.circle cx="150" cy="128" r="3.5" fill={nodeFill} style={{ opacity: pLeft,    filter: nodeGlow }} />
        <motion.circle cx="450" cy="128" r="3.5" fill={nodeFill} style={{ opacity: pRight,   filter: nodeGlow }} />
        <motion.circle cx="150" cy="226" r="3.5" fill={nodeFill} style={{ opacity: pBotLeft, filter: nodeGlow }} />
        <motion.circle cx="450" cy="226" r="3.5" fill={nodeFill} style={{ opacity: pBotRight,filter: nodeGlow }} />
      </svg>

      <motion.div
        className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-[44%]"
        style={{ offsetPath: `path("${STRAT_PATH_LEFT}")`, offsetRotate: '0deg', offsetDistance: tokenLeftDistance, opacity: tokenLeftOpacity, scale: tokenLeftScale }}
        aria-hidden="true"
      >
        {tokenBadge}
      </motion.div>
      <motion.div
        className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-[44%]"
        style={{ offsetPath: `path("${STRAT_PATH_RIGHT}")`, offsetRotate: '0deg', offsetDistance: tokenRightDistance, opacity: tokenRightOpacity, scale: tokenRightScale }}
        aria-hidden="true"
      >
        {tokenBadge}
      </motion.div>
      <motion.div
        className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-[44%]"
        style={{ offsetPath: `path("${STRAT_PATH_BOT_LEFT}")`, offsetRotate: '0deg', offsetDistance: tokenBotLeftDistance, opacity: tokenBotLeftOpacity, scale: tokenBotLeftScale }}
        aria-hidden="true"
      >
        {tokenBadge}
      </motion.div>
      <motion.div
        className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 -translate-y-[44%]"
        style={{ offsetPath: `path("${STRAT_PATH_BOT_RIGHT}")`, offsetRotate: '0deg', offsetDistance: tokenBotRightDistance, opacity: tokenBotRightOpacity, scale: tokenBotRightScale }}
        aria-hidden="true"
      >
        {tokenBadge}
      </motion.div>
    </div>
  )
}


// ── Root ───────────────────────────────────────────────────────────────────────

export function VaultFlowScroll(_props: Props) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const numberRef    = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end end'] })

  // ── Timing system ──────────────────────────────────────────────────────────
  // 1900vh total.  1% = 19vh.
  //
  // Every crossfade uses the SAME ±30px y-motion so each scroll unit feels
  // identical regardless of where you are in the story:
  //   entry: y +30 → 0  (rises into position from below)
  //   exit:  y 0 → -30  (drifts upward and out)
  //
  // Crossfade windows are 4–5% (64–80vh) so dissolves read as intentional.
  //
  // Exception: Beat 4 exits via a hard clip-through-floor; Beat 5 enters
  // with a 150px pop-up — these are deliberate moment-of-transformation beats.
  //
  //  Beat  │ in       │ hold / sequence │ out
  //  ────────────────────────────────────────────────────────────
  //  1     │ 0–3%     │ 3–10%           │ 10–13%
  //  2     │ 10–16%   │ 16–32%          │ 32–36%
  //  3     │ 36–39%   │ 39–45%          │ 45–48%
  //  4     │ 45–50%   │ 50–58%          │ clip 55–58%, opac 58–60%
  //  5     │ 61–65%   │ 65–74%          │ 74–78%
  //  6     │ 72–78%   │ paths+cards     │ 90–94%
  //  7     │ 92–96%   │ branches+cards  │ 96–100%

  // Beat 1: The Threshold
  const opacityBeat1 = useTransform(scrollYProgress, [0, 0.03, 0.10, 0.13], [1, 1, 1, 0])
  const yBeat1       = useTransform(scrollYProgress, [0, 0.13], [0, -30])

  // Beat 2: one continuous deposit → mint → return scene.
  const opacityBeat2 = useTransform(scrollYProgress, [0.10, 0.16, 0.32, 0.36], [0, 1, 1, 0])
  const yBeat2       = useTransform(scrollYProgress, [0.10, 0.16, 0.36], [30, 0, -30])
  const beat12NarrativeOpacity = useTransform(scrollYProgress, [0.07, 0.11, 0.30, 0.34], [0, 1, 1, 0])
  const beat12NarrativeY       = useTransform(scrollYProgress, [0.07, 0.11, 0.34], [18, 0, -10])
  const beat12ChipOpacity      = useTransform(scrollYProgress, [0.07, 0.11, 0.28, 0.32], [0, 1, 1, 0])
  const beat12ChipScale        = useTransform(scrollYProgress, [0.07, 0.13, 0.34], [0.94, 1, 0.98])
  const beat12Line1Opacity     = useTransform(scrollYProgress, [0.075, 0.115, 0.29, 0.33], [0, 1, 1, 0])
  const beat12Line2Opacity     = useTransform(scrollYProgress, [0.085, 0.125, 0.29, 0.33], [0, 1, 1, 0])
  const beat12Line3Opacity     = useTransform(scrollYProgress, [0.10, 0.14, 0.28, 0.32], [0, 0.68, 0.68, 0])
  const beat12Line1Y           = useTransform(scrollYProgress, [0.075, 0.115, 0.33], [8, 0, -6])
  const beat12Line2Y           = useTransform(scrollYProgress, [0.085, 0.125, 0.33], [8, 0, -6])
  const beat12Line3Y           = useTransform(scrollYProgress, [0.10, 0.14, 0.32], [10, 0, -6])

  // Beat 3: Dedicated bridge card.
  const opacityBeat3Intro = useTransform(scrollYProgress, [0.36, 0.39, 0.45, 0.48], [0, 1, 1, 0])
  const yBeat3Intro       = useTransform(scrollYProgress, [0.36, 0.39, 0.48], [30, 0, -30])
  const beat34NarrativeOpacity = useTransform(scrollYProgress, [0.36, 0.39, 0.58, 0.60], [0, 1, 1, 0])
  const beat34NarrativeY       = useTransform(scrollYProgress, [0.36, 0.39, 0.60], [20, 0, -12])
  const beat34NarrativeScale   = useTransform(scrollYProgress, [0.36, 0.50, 0.60], [0.985, 1, 0.985])
  const beat3Line1Opacity = useTransform(scrollYProgress, [0.36, 0.375, 0.45, 0.48], [0, 1, 1, 0])
  const beat3Line2Opacity = useTransform(scrollYProgress, [0.365, 0.385, 0.45, 0.48], [0, 1, 1, 0])
  const beat3Line3Opacity = useTransform(scrollYProgress, [0.37, 0.395, 0.45, 0.48], [0, 1, 1, 0])
  const beat3Line1Y       = useTransform(scrollYProgress, [0.36, 0.385, 0.48], [10, 0, -6])
  const beat3Line2Y       = useTransform(scrollYProgress, [0.365, 0.39, 0.48], [10, 0, -6])
  const beat3Line3Y       = useTransform(scrollYProgress, [0.37, 0.395, 0.48], [10, 0, -6])

  // Beat 4: The Commitment — keep the bill upright, then drop it into the slit.
  const opacityBeat4 = useTransform(scrollYProgress, [0.45, 0.50, 0.58, 0.60], [0, 1, 1, 0])
  const scaleBeat4   = useTransform(scrollYProgress, [0.45, 0.50], [0.92, 1])
  const beat4Line1Opacity = useTransform(scrollYProgress, [0.45, 0.475, 0.58, 0.60], [0, 1, 1, 0])
  const beat4Line2Opacity = useTransform(scrollYProgress, [0.46, 0.485, 0.58, 0.60], [0, 1, 1, 0])
  const beat4Line3Opacity = useTransform(scrollYProgress, [0.49, 0.525, 0.58, 0.60], [0, 0.62, 0.62, 0])
  const beat4Line1Y       = useTransform(scrollYProgress, [0.45, 0.475, 0.60], [8, 0, -6])
  const beat4Line2Y       = useTransform(scrollYProgress, [0.46, 0.485, 0.60], [8, 0, -6])
  const beat4Line3Y       = useTransform(scrollYProgress, [0.49, 0.525, 0.60], [10, 0, -6])
  const billY4       = useTransform(scrollYProgress, [0.55, 0.589], [0, 214])
  const billOpacity4 = useTransform(scrollYProgress, [0.55, 0.578, 0.589], [1, 1, 0])
  const slotOpacity4 = useTransform(scrollYProgress, [0.535, 0.555], [0, 1])
  const slitGlow4    = useTransform(scrollYProgress, [0.535, 0.555, 0.595], [0.94, 1, 0.98])
  const countMV      = useTransform(scrollYProgress, [0.45, 0.54], [0, TOTAL_TOKENS])
  const beat45NarrativeOpacity = useTransform(scrollYProgress, [0.53, 0.57, 0.72, 0.76], [0, 1, 1, 0])
  const beat45NarrativeY       = useTransform(scrollYProgress, [0.53, 0.57, 0.76], [18, 0, -10])
  const beat45ChipOpacity      = useTransform(scrollYProgress, [0.53, 0.57, 0.70, 0.74], [0, 1, 1, 0])
  const beat45ChipScale        = useTransform(scrollYProgress, [0.53, 0.59, 0.76], [0.94, 1, 0.98])
  const beat45Line1Opacity     = useTransform(scrollYProgress, [0.54, 0.58, 0.71, 0.75], [0, 1, 1, 0])
  const beat45Line2Opacity     = useTransform(scrollYProgress, [0.55, 0.59, 0.71, 0.75], [0, 1, 1, 0])
  const beat45Line1Y           = useTransform(scrollYProgress, [0.54, 0.58, 0.75], [8, 0, -6])
  const beat45Line2Y           = useTransform(scrollYProgress, [0.55, 0.59, 0.75], [8, 0, -6])

  // Beat 5: The Mint — shares appear only after the bill has committed into the slit.
  const opacityBeat5 = useTransform(scrollYProgress, [0.61, 0.65, 0.74, 0.78], [0, 1, 1, 0])
  const scaleBeat5   = useTransform(scrollYProgress, [0.61, 0.65], [0.72, 1])
  const yBeat5       = useTransform(scrollYProgress, [0.61, 0.65, 0.78], [150, 0, -30])
  const beat56NarrativeOpacity = useTransform(scrollYProgress, [0.64, 0.68, 0.90, 0.94], [0, 1, 1, 0])
  const beat56NarrativeY       = useTransform(scrollYProgress, [0.64, 0.68, 0.94], [18, 0, -10])
  const beat56ChipOpacity      = useTransform(scrollYProgress, [0.64, 0.68, 0.90, 0.94], [0, 1, 1, 0])
  const beat56ChipScale        = useTransform(scrollYProgress, [0.64, 0.70, 0.94], [0.92, 1, 0.98])
  const beat56Line1Opacity     = useTransform(scrollYProgress, [0.64, 0.68, 0.89, 0.93], [0, 1, 1, 0])
  const beat56Line2Opacity     = useTransform(scrollYProgress, [0.66, 0.70, 0.89, 0.93], [0, 1, 1, 0])
  const beat56Line1Y           = useTransform(scrollYProgress, [0.64, 0.68, 0.93], [8, 0, -6])
  const beat56Line2Y           = useTransform(scrollYProgress, [0.66, 0.70, 0.93], [8, 0, -6])

  // Beat 6: Distribution — slower stagger so each destination reads before the next.
  const opacityBeat6 = useTransform(scrollYProgress, [0.72, 0.78, 0.90, 0.94], [0, 1, 1, 0])
  const yBeat6       = useTransform(scrollYProgress, [0.72, 0.78, 0.90, 0.94], [30, 0, 0, -30])
  const path6A       = useTransform(scrollYProgress, [0.78, 0.84], [0, 1])
  const path6B       = useTransform(scrollYProgress, [0.81, 0.87], [0, 1])
  const path6C       = useTransform(scrollYProgress, [0.84, 0.90], [0, 1])
  const opac6A       = useTransform(scrollYProgress, [0.82, 0.86], [0, 1])
  const opac6B       = useTransform(scrollYProgress, [0.85, 0.89], [0, 1])
  const opac6C       = useTransform(scrollYProgress, [0.88, 0.92], [0, 1])
  const y6A          = useTransform(scrollYProgress, [0.82, 0.86], [18, 0])
  const y6B          = useTransform(scrollYProgress, [0.85, 0.89], [18, 0])
  const y6C          = useTransform(scrollYProgress, [0.88, 0.92], [18, 0])
  const scale6A      = useTransform(scrollYProgress, [0.82, 0.86], [0.96, 1])
  const scale6B      = useTransform(scrollYProgress, [0.85, 0.89], [0.96, 1])
  const scale6C      = useTransform(scrollYProgress, [0.88, 0.92], [0.96, 1])
  const beat67NarrativeOpacity = useTransform(scrollYProgress, [0.88, 0.92, 0.99, 1], [0, 1, 1, 0])
  const beat67NarrativeY       = useTransform(scrollYProgress, [0.88, 0.92, 1], [18, 0, -10])
  const beat67ChipOpacity      = useTransform(scrollYProgress, [0.88, 0.92, 0.99, 1], [0, 1, 1, 0])
  const beat67ChipScale        = useTransform(scrollYProgress, [0.88, 0.94, 1], [0.94, 1, 0.98])
  const beat67Line1Opacity     = useTransform(scrollYProgress, [0.885, 0.925, 0.99, 1], [0, 1, 1, 0])
  const beat67Line2Opacity     = useTransform(scrollYProgress, [0.895, 0.935, 0.99, 1], [0, 1, 1, 0])
  const beat67Line1Y           = useTransform(scrollYProgress, [0.885, 0.925, 1], [8, 0, -6])
  const beat67Line2Y           = useTransform(scrollYProgress, [0.895, 0.935, 1], [8, 0, -6])

  // Beat 7: Yield Strategies — final landing beat.
  const opacityBeat7 = useTransform(scrollYProgress, [0.92, 0.96], [0, 1])
  const yBeat7       = useTransform(scrollYProgress, [0.92, 0.96], [30, 0])
  const path7L       = useTransform(scrollYProgress, [0.96, 0.975], [0, 1])
  const path7R       = useTransform(scrollYProgress, [0.97, 0.985], [0, 1])
  const path7BL      = useTransform(scrollYProgress, [0.98, 0.992], [0, 1])
  const path7BR      = useTransform(scrollYProgress, [0.988, 1.00], [0, 1])
  const opac7A       = useTransform(scrollYProgress, [0.972, 0.982], [0, 1])
  const opac7B       = useTransform(scrollYProgress, [0.982, 0.99], [0, 1])
  const opac7C       = useTransform(scrollYProgress, [0.99, 0.996], [0, 1])
  const opac7D       = useTransform(scrollYProgress, [0.994, 1.00], [0, 1])
  const y7A          = useTransform(scrollYProgress, [0.972, 0.982], [16, 0])
  const y7B          = useTransform(scrollYProgress, [0.982, 0.99], [16, 0])
  const y7C          = useTransform(scrollYProgress, [0.99, 0.996], [16, 0])
  const y7D          = useTransform(scrollYProgress, [0.994, 1.00], [16, 0])

  // Drive counter DOM text directly — avoids re-renders on every frame.
  useMotionValueEvent(countMV, 'change', (v) => {
    if (numberRef.current) numberRef.current.textContent = Math.floor(v).toLocaleString()
  })

  useEffect(() => {
    const run = async () => {
      try {
        const coin    = await fetchZoraCoin(AKITA_ADDRESS)
        const coinAny = coin as any
        const img =
          coin?.mediaContent?.previewImage?.small ??
          coin?.mediaContent?.previewImage?.medium ??
          coin?.creatorProfile?.avatar?.previewImage?.small ??
          coinAny?.image ??
          coinAny?.metadata?.image
        if (img) { setAvatarSrc(img); return }
        const creatorAddr = coin?.creatorAddress
        if (creatorAddr) {
          const profile = await fetchZoraProfile(creatorAddr)
          const avatar  = profile?.avatar?.small ?? profile?.avatar?.medium
          if (avatar) setAvatarSrc(avatar)
        }
      } catch { /* fall back to dot */ }
    }
    run()
  }, [])

  const dist  = STORY_CONTENT.distribution
  const strats = STORY_CONTENT.strategies
  const cardOpacities  = [opac6A, opac6B, opac6C]
  const cardPaths      = [path6A, path6B, path6C]
  const cardYs         = [y6A, y6B, y6C]
  const cardScales     = [scale6A, scale6B, scale6C]
  const stratOpacities = [opac7A, opac7B, opac7C, opac7D]
  const stratYs        = [y7A, y7B, y7C, y7D]

  // ── Layout note ────────────────────────────────────────────────────────────
  // Beats 5, 6 and 7 each use a single centered flex-column container so
  // sub-element spacing is controlled by gap/margin rather than independent
  // absolute positions.  The container top is chosen so the stack is visually
  // centred in the viewport (50vh).  Approximate stack heights:
  //   Beat 4: badge 20 + gap 8 + MintLines 80 + gap 12 + count ~80 ≈ 200px → top = 50vh − 100px
  //   Beat 5: source 76 + SVG 120 + gap 4 + cards ~130 ≈ 330px → top = 50vh − 165px
  //   Beat 6: source 40 + SVG 120 + gap 8 + 2×2 grid ~252 + APY 32 ≈ 452px → top = 50vh − 226px

  return (
    // 1900vh — extended dwell windows so the narrative and handoffs have room to read
    <div
      ref={containerRef}
      className="h-[1900vh] bg-black text-white relative font-sans selection:bg-white/20"
      style={{ borderTop: '1px solid rgba(255,255,255,0.035)' }}
    >
      <div className="sticky top-0 h-screen w-full flex flex-col items-center justify-center overflow-hidden">

        {/* Grain */}
        <div className="absolute inset-0 pointer-events-none z-10"
          style={{ backgroundImage: GRAIN_URL, backgroundSize: '256px 256px', opacity: 0.038 }} />

        {/* Scroll progress bar */}
        <motion.div
          className="absolute top-0 left-0 h-[1px] w-full origin-left z-20 pointer-events-none"
          style={{ scaleX: scrollYProgress, background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.38))' }}
        />

        {/* ── Beat 1 ─────────────────────────────────────────────────────── */}
        <motion.div style={{ opacity: opacityBeat1, y: yBeat1 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-1-threshold">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[1] }} />
          <p className="text-[10px] uppercase tracking-[0.44em] font-medium mb-8" style={{ color: `rgba(${BLUE},0.55)` }}>
            Introducing
          </p>
          <h2 className="mb-5 text-3xl font-medium leading-tight tracking-tight text-center md:text-5xl" style={{ color: 'rgba(255,255,255,0.90)' }}>
            Earn Together.
          </h2>
          <p className="text-base md:text-xl font-light text-center" style={{ color: 'rgba(255,255,255,0.36)' }}>
            ERC-4626 Tokenized Creator Vaults
          </p>
        </motion.div>

        {/* ── Beat 2 ─────────────────────────────────────────────────────── */}
        {/* A single read: deposit from the left, continue down through the vault, return as share token. */}
        <motion.div style={{ opacity: opacityBeat2, y: yBeat2 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-2-authority">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[2] }} />

          <div className="relative flex min-h-[400px] w-full max-w-3xl flex-col items-center justify-center sm:min-h-[360px]">
            <h2 className="mb-5 max-w-[14ch] text-center text-2xl font-medium tracking-tight text-white sm:mb-7 sm:max-w-none md:text-3xl">
              Deposit {STORY_CONTENT.creatorTokenSymbol.toLowerCase()}. Receive {STORY_CONTENT.shareTokenSymbol}.
            </h2>
            <DepositFlowViz avatarSrc={avatarSrc} />
            <p
              className="max-w-[19rem] text-center text-sm font-light leading-relaxed sm:max-w-md md:text-base"
              style={{ color: 'rgba(255,255,255,0.38)' }}
            >
              <span style={{ color: `rgba(${BLUE},0.70)` }}>{STORY_CONTENT.shareTokenSymbol}</span>{' '}
              is minted from the deposit and returned to the depositor as the vault&apos;s share token.
            </p>
          </div>
        </motion.div>

        <NarrativeRail
          testId="beat-1-2-narrative"
          opacity={beat12NarrativeOpacity}
          y={beat12NarrativeY}
          chip={{
            tone: 'neutral',
            iconSrc: avatarSrc ?? undefined,
            leftText: 'core concept',
            opacity: beat12ChipOpacity,
            scale: beat12ChipScale,
          }}
          lines={[
            {
              text: 'Everything starts with creator commitment.',
              opacity: beat12Line1Opacity,
              y: beat12Line1Y,
              className: 'text-sm font-light md:text-base',
              color: 'rgba(255,255,255,0.62)',
            },
            {
              text: 'Deposit a native Zora Creator Coin and receive a vault share in return.',
              opacity: beat12Line2Opacity,
              y: beat12Line2Y,
              className: 'text-[11px] font-mono uppercase tracking-[0.2em]',
              color: 'rgba(255,255,255,0.38)',
            },
            {
              text: `Shown with ${STORY_CONTENT.creatorTokenSymbol.toLowerCase()} as an example creator coin.`,
              opacity: beat12Line3Opacity,
              y: beat12Line3Y,
              className: 'text-[10px] font-light tracking-[0.01em]',
              color: 'rgba(255,255,255,0.20)',
            },
          ]}
        />

        {/* Shared narrative rail — persists from beat 3 into beat 4. */}
        <NarrativeRail
          testId="beat-3-4-narrative"
          opacity={beat34NarrativeOpacity}
          y={beat34NarrativeY}
          scale={beat34NarrativeScale}
          lines={[
            {
              text: 'In the beginning',
              opacity: beat3Line1Opacity,
              y: beat3Line1Y,
              className: 'text-[11px] font-mono uppercase tracking-[0.28em]',
              color: 'rgba(255,255,255,0.46)',
            },
            {
              text: 'Every vault begins with commitment.',
              opacity: beat3Line2Opacity,
              y: beat3Line2Y,
              className: 'text-base font-light md:text-lg',
              color: 'rgba(255,255,255,0.66)',
            },
            {
              text: 'The creator deposits first.',
              opacity: beat3Line3Opacity,
              y: beat3Line3Y,
              className: 'text-sm font-light md:text-base',
              color: 'rgba(255,255,255,0.48)',
            },
            {
              text: 'That opening act begins issuance and sets the vault in motion.',
              opacity: beat4Line1Opacity,
              y: beat4Line1Y,
              className: 'text-sm font-light md:text-base',
              color: 'rgba(255,255,255,0.58)',
            },
            {
              text: 'The vault share becomes the receipt.',
              opacity: beat4Line2Opacity,
              y: beat4Line2Y,
              className: 'text-sm font-light md:text-base',
              color: `rgba(${BLUE},0.72)`,
            },
            {
              text: `Shown with ${STORY_CONTENT.creatorTokenSymbol.toLowerCase()} as an example creator coin.`,
              opacity: beat4Line3Opacity,
              y: beat4Line3Y,
              className: 'text-[10px] font-light tracking-[0.01em]',
              color: 'rgba(255,255,255,0.20)',
            },
          ]}
        />

        {/* ── Beat 3 ─────────────────────────────────────────────────────── */}
        {/* Dedicated bridge beat between deposit/receive and commitment. */}
        <motion.div
          style={{ opacity: opacityBeat3Intro, y: yBeat3Intro }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-3-intro"
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[3] }} />
        </motion.div>

        {/* ── Beat 4 ─────────────────────────────────────────────────────── */}
        {/* Upright bill deposits downward into slit and fades into the vault. */}
        <motion.div style={{ opacity: opacityBeat4, scale: scaleBeat4 }}
          className="absolute inset-0 flex flex-col items-center justify-center px-6"
          data-testid="beat-3-commitment">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[3] }} />
          <div className="flex flex-col items-center justify-center overflow-hidden w-full" style={{ height: '58vh' }}>
            <div className="relative flex w-full items-center justify-center" style={{ minHeight: 420 }}>
              <motion.div
                className="absolute top-[246px] h-[52px] w-px bg-linear-to-b from-white/0 via-white/24 to-white/0"
                style={{ opacity: slotOpacity4, scaleY: slitGlow4, transformOrigin: 'top center' }}
                aria-hidden="true"
              />

              <motion.div
                style={{ opacity: slotOpacity4, scale: slitGlow4 }}
                className="absolute top-[294px]"
              >
                <DepositSlot testId="deposit-slit" />
              </motion.div>

              <motion.div
                className="flex flex-col items-center"
                style={{ y: billY4, opacity: billOpacity4 }}
                data-testid="deposit-bill"
              >
                <div
                  className="flex w-[min(88vw,640px)] flex-col items-center px-6 py-8 sm:px-10 sm:py-9 md:px-12 md:py-10"
                >
                  <motion.div className="flex flex-col items-center" style={{ scale: scaleBeat4 }}>
                    <div className="mb-6 flex flex-col items-center gap-2">
                      <span
                        className="font-mono text-[10px] uppercase tracking-[0.28em]"
                        style={{ color: 'rgba(255,255,255,0.24)' }}
                      >
                        creator deposit
                      </span>
                      <div
                        className="h-px w-20"
                        style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.22), rgba(255,255,255,0))' }}
                      />
                    </div>
                    <div
                      ref={numberRef}
                      className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-semibold tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50"
                      data-testid="deposited-counter"
                    >
                      {STORY_CONTENT.defaultDepositTokens}
                    </div>
                    <p className="mt-6 text-lg tracking-wide sm:mt-8 sm:text-xl" style={{ color: 'rgba(255,255,255,0.40)' }}>
                      {STORY_CONTENT.creatorTokenSymbol.toLowerCase()}
                    </p>
                    <p className="mt-3 text-xs font-mono" style={{ color: `rgba(${BLUE},0.50)` }}>
                      = 5% of total supply
                    </p>
                  </motion.div>
                </div>
              </motion.div>

              <motion.div
                className="pointer-events-none absolute inset-0"
                style={{ opacity: opacityBeat4 }}
              />
            </div>
          </div>
        </motion.div>

        <NarrativeRail
          testId="beat-4-5-narrative"
          opacity={beat45NarrativeOpacity}
          y={beat45NarrativeY}
          chip={{
            tone: 'neutral',
            iconSrc: avatarSrc ?? undefined,
            leftText: 'creator deposit',
            rightText: 'committed',
            opacity: beat45ChipOpacity,
            scale: beat45ChipScale,
          }}
          lines={[
            {
              text: 'That opening act begins issuance.',
              opacity: beat45Line1Opacity,
              y: beat45Line1Y,
              className: 'text-sm font-light md:text-base',
              color: 'rgba(255,255,255,0.60)',
            },
            {
              text: 'The vault share becomes the receipt.',
              opacity: beat45Line2Opacity,
              y: beat45Line2Y,
              className: 'text-[11px] font-mono uppercase tracking-[0.22em]',
              color: `rgba(${BLUE},0.58)`,
            },
          ]}
        />

        {/* ── Beat 5 ─────────────────────────────────────────────────────── */}
        {/* The slot remains visible so the minted shares feel like they emerge from the deposit. */}
        <motion.div style={{ opacity: opacityBeat5, scale: scaleBeat5, y: yBeat5, paddingTop: 'calc(50vh - 122px)' }}
          className="absolute inset-0 flex flex-col items-center px-6"
          data-testid="beat-4-mint">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[4] }} />

          <div className="relative flex flex-col items-center">
            <DepositSlot />
            <div className="mt-5">
              <MintLines />
            </div>

            {/* Minted count */}
            <p className="mt-3 text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tighter tabular-nums text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
              {STORY_CONTENT.defaultDepositTokens}
            </p>

            {/* Badge identity — sits at the BOTTOM, away from Beat 5's incoming top-label */}
            <div className="mt-3 flex items-center gap-2">
              <img src={STORY_CONTENT.shareTokenBadgeSrc} alt="" aria-hidden="true" className="h-4 w-4 object-contain" loading="lazy" />
              <span className="font-mono text-sm" style={{ color: `rgba(${BLUE},0.90)` }}>
                {STORY_CONTENT.shareTokenSymbol}
              </span>
              <span className="ml-1 text-[10px] uppercase tracking-[0.3em]" style={{ color: `rgba(${BLUE},0.50)` }}>
                shares minted
              </span>
            </div>
          </div>
        </motion.div>

        {/* Shared allocation rail — persists from mint into distribution. */}
        <NarrativeRail
          testId="beat-5-6-narrative"
          opacity={beat56NarrativeOpacity}
          y={beat56NarrativeY}
          chip={{
            tone: 'blue',
            iconSrc: STORY_CONTENT.shareTokenBadgeSrc,
            leftText: STORY_CONTENT.defaultDepositTokens,
            rightText: STORY_CONTENT.shareTokenSymbol,
            opacity: beat56ChipOpacity,
            scale: beat56ChipScale,
          }}
          lines={[
            {
              text: 'From there, the split begins',
              opacity: beat56Line1Opacity,
              y: beat56Line1Y,
              className: 'text-[11px] font-mono uppercase tracking-[0.28em]',
              color: 'rgba(255,255,255,0.40)',
            },
            {
              text: 'From there, issuance is split across launch, vesting, and reserve.',
              opacity: beat56Line2Opacity,
              y: beat56Line2Y,
              className: 'text-sm font-light md:text-base',
              color: 'rgba(255,255,255,0.60)',
            },
          ]}
        />

        {/* ── Beat 6 ─────────────────────────────────────────────────────── */}
        {/* Single flex-column centred at 50vh − 165px (stack ≈ 330px tall). */}
        {/* Source → bezier paths → 3 distribution cards, one card at a time. */}
        <motion.div style={{ opacity: opacityBeat6, y: yBeat6, paddingTop: 'calc(50vh - 140px)' }}
          className="absolute inset-0 flex flex-col items-center px-6"
          data-testid="beat-5-structure">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[5] }} />

          {/* Accessibility landmarks */}
          <div aria-label="distribution summary" className="sr-only" />
          <div aria-label="distribution checkpoint progress" role="progressbar" className="sr-only" />

          <div className="relative flex flex-col items-center w-full max-w-3xl">
            <div className="flex flex-col items-center mb-3">
              <p className="text-[10px] uppercase tracking-[0.38em] font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.22)' }}>
                Next, the split
              </p>
              <p className="mt-1.5 text-[11px] text-center max-w-xs font-light" style={{ color: 'rgba(255,255,255,0.28)' }}>
                Public launch, creator vesting, and reserve are defined up front.
              </p>
              <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.22em]" style={{ color: `rgba(${BLUE},0.44)` }}>
                lane by lane
              </p>
            </div>

            {/* Bezier paths — SVG source dot is the continuation of the badge above */}
            <DistributionPaths p1={cardPaths[0]!} p2={cardPaths[1]!} p3={cardPaths[2]!} />

            {/* Distribution cards — fade in one at a time as paths reach them */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3 w-full mt-1">
              {dist.map((row, i) => (
                <motion.div key={row.title} style={{ opacity: cardOpacities[i], y: cardYs[i], scale: cardScales[i] }}>
                  <div className="h-full rounded-3xl p-5 sm:p-6" style={{
                    border: `1px solid rgba(${BLUE},0.22)`,
                    background: `rgba(${BLUE},0.04)`,
                    backdropFilter: 'blur(12px)',
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(${BLUE},0.10), 0 0 28px rgba(${BLUE},0.14)`,
                  }}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[10px] font-mono uppercase tracking-[0.24em]" style={{ color: 'rgba(255,255,255,0.24)' }}>
                        committed lane
                      </p>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-mono"
                        style={{
                          color: `rgba(${BLUE},0.84)`,
                          border: `1px solid rgba(${BLUE},0.22)`,
                          background: `rgba(${BLUE},0.08)`,
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="text-3xl font-medium tracking-tight sm:text-4xl md:text-5xl">{row.percent}</div>
                    <div className="mb-5 text-sm font-mono sm:mb-6">
                      <span style={{ color: 'rgba(255,255,255,0.36)' }}>{row.amount} </span>
                      <span style={{ color: `rgba(${BLUE},0.75)` }}>{STORY_CONTENT.shareTokenSymbol}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      {row.icon && (
                        <img src={row.icon} alt="" aria-hidden="true" className="h-4 w-4 object-contain opacity-60" loading="lazy" />
                      )}
                      <p className="font-medium text-lg" style={{ color: 'rgba(255,255,255,0.90)' }}>{row.title}</p>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{row.purposeCopy}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Shared deployment rail — persists from allocation into strategy deployment. */}
        <NarrativeRail
          testId="beat-6-7-narrative"
          opacity={beat67NarrativeOpacity}
          y={beat67NarrativeY}
          chip={{
            tone: 'orange',
            leftText: 'deployed across',
            rightText: '4 yield lanes',
            opacity: beat67ChipOpacity,
            scale: beat67ChipScale,
          }}
          lines={[
            {
              text: 'Then capital goes to work',
              opacity: beat67Line1Opacity,
              y: beat67Line1Y,
              className: 'text-[11px] font-mono uppercase tracking-[0.28em]',
              color: 'rgba(255,255,255,0.38)',
            },
            {
              text: 'while capital is deployed into active strategies.',
              opacity: beat67Line2Opacity,
              y: beat67Line2Y,
              className: 'text-sm font-light md:text-base',
              color: 'rgba(255,255,255,0.58)',
            },
          ]}
        />

        {/* ── Beat 7 ─────────────────────────────────────────────────────── */}
        {/* Single flex-column centred at 50vh − 226px (stack ≈ 452px tall). */}
        {/* Source → two bezier branches → 2×2 strategy grid → blended APY.  */}
        {/* Left branch: strats[0] Charm (top-left), strats[2] Solana (btm-left)  */}
        {/* Right branch: strats[1] Ajna (top-right), strats[3] Idle (btm-right) */}
        <motion.div style={{ opacity: opacityBeat7, y: yBeat7, paddingTop: 'calc(50vh - 226px)' }}
          className="absolute inset-0 flex flex-col items-center px-6"
          data-testid="beat-6-strategies">
          <div className="absolute inset-0 pointer-events-none" style={{ background: BEAT_ACCENTS[6] }} />

          <div className="relative flex flex-col items-center w-full max-w-2xl">
            <div className="flex flex-col items-center mb-2">
              <p className="text-xs uppercase tracking-[0.32em] font-medium" style={{ color: 'rgba(255,255,255,0.26)' }}>
                Then capital goes to work
              </p>
              <p className="mt-1 text-[11px] text-center max-w-xs font-light" style={{ color: 'rgba(255,255,255,0.26)' }}>
                It moves into active strategies as soon as the structure is set.
              </p>
            </div>

            {/* Two-branch bezier SVG — left col, right col */}
            <StrategyBranches
              pLeft={path7L}
              pRight={path7R}
              pBotLeft={path7BL}
              pBotRight={path7BR}
              tokenSrc={avatarSrc}
              tokenSymbol={STORY_CONTENT.creatorTokenSymbol}
            />

            {/* 2×2 strategy grid */}
            <div className="grid w-full grid-cols-2 gap-2 sm:gap-3 mt-2">
              {strats.map((s, i) => (
                <motion.div key={s.label} style={{ opacity: stratOpacities[i], y: stratYs[i] }}>
                  <div className="flex items-start justify-between rounded-2xl px-3 py-3 sm:px-4 sm:py-4" style={{
                    border: `1px solid rgba(${ORANGE},0.08)`,
                    background: 'rgba(255,255,255,0.012)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(${ORANGE},0.05), 0 0 20px rgba(${ORANGE},0.07)`,
                  }}>
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                      {s.icon ? (
                        <img src={s.icon} alt={s.iconAlt} className={s.iconClassName} loading="lazy" />
                      ) : (
                        <div className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: 'rgba(255,255,255,0.08)' }} />
                      )}
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-tight sm:text-sm truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.label}</p>
                        <p className="mt-0.5 text-[9px] font-mono uppercase tracking-[0.18em] sm:text-[10px] sm:tracking-[0.2em]" style={{ color: `rgba(${ORANGE},0.44)` }}>
                          active strategy
                        </p>
                        <p className="mt-1 text-[10px] leading-snug sm:mt-1.5 sm:text-[11px]" style={{ color: 'rgba(255,255,255,0.32)' }}>{s.purposeCopy}</p>
                      </div>
                    </div>
                    <div className="ml-3 flex shrink-0 flex-col items-end gap-1 sm:ml-4">
                      <span className="font-mono text-sm font-semibold sm:text-base" style={{ color: `rgba(${ORANGE},0.82)` }}>{s.percent}</span>
                      {s.apy !== '—' ? (
                        <span className="font-mono text-[9px] sm:text-[10px]" style={{ color: 'rgba(255,255,255,0.26)' }}>
                          {s.apy}{' '}
                          <span style={{ color: 'rgba(255,255,255,0.14)' }}>APR</span>
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] sm:text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Blended APR */}
            <p className="mt-4 font-mono text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>
              Blended APR:{' '}
              <span style={{ color: 'rgba(255,255,255,0.48)' }}>{STORY_CONTENT.blendedApy}</span>
            </p>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
