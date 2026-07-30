import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Pause, Play, RotateCcw, Snowflake, ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import {
  CREATOR_TOKEN_SYMBOL,
  DEFAULT_PARAMS,
  SHARE_BOX_SYMBOL,
  SHARE_OFT_SYMBOL,
  type CreatorVaultSimParams,
} from './defaults'
import {
  resetSim,
  setImpairment,
  setParams,
  setPaused,
  stressRedeem,
  tick,
} from './engine'
import { formatBpsAsPct, formatCompact, formatPct } from './format'
import {
  ccaProgress,
  createInitialState,
  sharePrice,
  type ActiveFlow,
  type CreatorVaultSimState,
} from './model'

const DOCS_LEARN_URL = 'https://docs.4626.fun/getting-started/'

function flowActive(flow: ActiveFlow, target: ActiveFlow | ActiveFlow[]): boolean {
  const list = Array.isArray(target) ? target : [target]
  return list.includes(flow)
}

function edgeOpacity(active: boolean, pulse: number): number {
  return active ? 0.35 + pulse * 0.55 : 0.12
}

function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  onChange: (value: number) => void
}) {
  const id = `sim-param-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className="block space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs text-zinc-400 font-light">
          {label}
        </label>
        <span className="font-mono text-[11px] text-zinc-300">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white/80"
        aria-label={label}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-lg sm:text-xl text-white tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-zinc-600 font-light">{hint}</div> : null}
    </div>
  )
}

function Flywheel({ state }: { state: CreatorVaultSimState }) {
  const flow = state.activeFlow
  const pulse = state.flowPulse
  const graduated = state.ccaGraduated

  const nodeStyle = (active: boolean): CSSProperties => ({
    opacity: active ? 0.95 : 0.55,
    filter: active ? `drop-shadow(0 0 ${6 + pulse * 10}px rgba(255,255,255,0.25))` : undefined,
  })

  return (
    <div className="relative w-full aspect-[16/11] max-h-[420px]">
      <svg viewBox="0 0 640 440" className="h-full w-full" role="img" aria-label="Creator Vault flywheel">
        <defs>
          <linearGradient id="simEdge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>

        {/* Edges */}
        <g stroke="url(#simEdge)" strokeWidth="1.5" fill="none">
          <path
            d="M110 120 C170 120, 190 180, 250 200"
            opacity={edgeOpacity(flowActive(flow, 'deposit'), pulse)}
          />
          <path
            d="M320 200 C360 200, 380 160, 430 140"
            opacity={edgeOpacity(flowActive(flow, ['wrap', 'cca']), pulse)}
          />
          <path
            d="M320 220 C360 240, 390 280, 430 300"
            opacity={edgeOpacity(flowActive(flow, 'legs'), pulse)}
          />
          <path
            d="M250 210 C220 260, 180 300, 140 320"
            opacity={edgeOpacity(flowActive(flow, 'solanaArm'), pulse)}
          />
          <path
            d="M450 150 C510 150, 540 200, 520 250"
            opacity={edgeOpacity(flowActive(flow, 'tradeFee'), pulse)}
          />
          <path
            d="M110 340 C180 360, 260 370, 320 300"
            opacity={edgeOpacity(flowActive(flow, 'payout'), pulse)}
          />
          <path
            d="M250 190 C230 150, 200 120, 160 110"
            opacity={edgeOpacity(flowActive(flow, 'redeem'), pulse)}
          />
        </g>

        {/* Nodes */}
        <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
          <g style={nodeStyle(flowActive(flow, ['deposit', 'redeem']))}>
            <rect x="48" y="88" width="120" height="56" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x="108" y="112" textAnchor="middle" fill="#a1a1aa" fontSize="9">CREATOR COIN</text>
            <text x="108" y="130" textAnchor="middle" fill="#fafafa" fontSize="13">{CREATOR_TOKEN_SYMBOL}</text>
          </g>

          <g style={nodeStyle(flowActive(flow, ['deposit', 'legs', 'redeem', 'impairment']))}>
            <rect x="230" y="168" width="140" height="72" rx="16" fill="rgba(255,255,255,0.04)" stroke={state.impairmentActive ? 'rgba(251,113,133,0.55)' : 'rgba(255,255,255,0.16)'} />
            <text x="300" y="196" textAnchor="middle" fill="#a1a1aa" fontSize="9">VAULT</text>
            <text x="300" y="218" textAnchor="middle" fill="#fafafa" fontSize="14">
              {SHARE_BOX_SYMBOL} {formatCompact(state.boxSupply)}
            </text>
          </g>

          <g style={nodeStyle(flowActive(flow, ['wrap', 'cca', 'tradeFee']))}>
            <rect x="410" y="108" width="130" height="64" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x="475" y="132" textAnchor="middle" fill="#a1a1aa" fontSize="9">SHARE OFT</text>
            <text x="475" y="152" textAnchor="middle" fill="#fafafa" fontSize="13">
              {SHARE_OFT_SYMBOL} {formatCompact(state.oftCirculating)}
            </text>
          </g>

          <g style={nodeStyle(flowActive(flow, 'cca') || graduated)}>
            <rect x="410" y="200" width="130" height="56" rx="14" fill="rgba(255,255,255,0.03)" stroke={graduated ? 'rgba(52,211,153,0.45)' : 'rgba(255,255,255,0.12)'} />
            <text x="475" y="224" textAnchor="middle" fill="#a1a1aa" fontSize="9">CCA ARM</text>
            <text x="475" y="242" textAnchor="middle" fill="#fafafa" fontSize="12">
              {graduated ? 'Graduated' : `${formatPct(ccaProgress(state) * 100)} filled`}
            </text>
          </g>

          <g style={nodeStyle(flowActive(flow, 'legs'))}>
            <rect x="410" y="278" width="130" height="72" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x="475" y="300" textAnchor="middle" fill="#a1a1aa" fontSize="9">LEGS</text>
            <text x="475" y="318" textAnchor="middle" fill="#fafafa" fontSize="11">
              Charm {formatPct(state.params.legs.charm)}
            </text>
            <text x="475" y="336" textAnchor="middle" fill="#d4d4d8" fontSize="10">
              Ajna {formatPct(state.params.legs.ajna)} · idle {formatPct(state.params.legs.idle)}
            </text>
          </g>

          <g style={nodeStyle(flowActive(flow, 'solanaArm'))}>
            <rect x="48" y="292" width="140" height="64" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x="118" y="316" textAnchor="middle" fill="#a1a1aa" fontSize="9">SOLANA ARM</text>
            <text x="118" y="336" textAnchor="middle" fill="#fafafa" fontSize="12">
              {formatCompact(state.solanaArmHeld)} ■
            </text>
          </g>

          <g style={nodeStyle(flowActive(flow, 'tradeFee'))}>
            <rect x="470" y="360" width="120" height="56" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x="530" y="384" textAnchor="middle" fill="#a1a1aa" fontSize="9">GAUGE</text>
            <text x="530" y="402" textAnchor="middle" fill="#fafafa" fontSize="11">
              burn {formatCompact(state.feesBurned)}
            </text>
          </g>

          <g style={nodeStyle(flowActive(flow, 'payout'))}>
            <rect x="220" y="360" width="150" height="56" rx="14" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.12)" />
            <text x="295" y="384" textAnchor="middle" fill="#a1a1aa" fontSize="9">PAYOUT ROUTER</text>
            <text x="295" y="402" textAnchor="middle" fill="#fafafa" fontSize="11">
              stream {formatCompact(state.payoutBurnStream)}
            </text>
          </g>
        </g>
      </svg>

      {state.impairmentActive ? (
        <div className="absolute inset-x-0 top-3 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-200">
            <Snowflake className="h-3.5 w-3.5" />
            Impairment freeze — deposit / redeem halted
          </span>
        </div>
      ) : null}
    </div>
  )
}

export function CreatorVaultSim() {
  const [state, setState] = useState<CreatorVaultSimState>(() => createInitialState())
  const [draftParams, setDraftParams] = useState<CreatorVaultSimParams>(DEFAULT_PARAMS)
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)

  useEffect(() => {
    const onFrame = (now: number) => {
      const last = lastTsRef.current ?? now
      lastTsRef.current = now
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000))
      setState((prev) => tick(prev, dt))
      rafRef.current = window.requestAnimationFrame(onFrame)
    }
    rafRef.current = window.requestAnimationFrame(onFrame)
    return () => {
      if (rafRef.current != null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const updateParam = <K extends keyof CreatorVaultSimParams>(
    key: K,
    value: CreatorVaultSimParams[K],
  ) => {
    const next = { ...draftParams, [key]: value }
    setDraftParams(next)
    setState((prev) => setParams(prev, next))
  }

  const updateLeg = (key: keyof CreatorVaultSimParams['legs'], value: number) => {
    const next = { ...draftParams, legs: { ...draftParams.legs, [key]: value } }
    setDraftParams(next)
    setState((prev) => setParams(prev, next))
  }

  const updateGauge = (key: keyof CreatorVaultSimParams['gauge'], value: number) => {
    const next = { ...draftParams, gauge: { ...draftParams.gauge, [key]: value } }
    setDraftParams(next)
    setState((prev) => setParams(prev, next))
  }

  const handleReset = () => {
    const next = resetSim(draftParams)
    setState(next)
    lastTsRef.current = null
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-3 max-w-2xl"
      >
        <div className="flex items-center gap-3">
          <img src="/assets/logo-mark.svg" alt="4626" className="h-7 w-7 opacity-90" />
          <span className="label">4626 · Mechanism simulation</span>
        </div>
        <h1 className="headline text-3xl sm:text-5xl">
          Creator Vault
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base font-light leading-relaxed">
          Deposit {CREATOR_TOKEN_SYMBOL}, mint {SHARE_BOX_SYMBOL}, wrap to {SHARE_OFT_SYMBOL},
          fill the CCA arm, allocate legs (Charm / Ajna / idle), and watch trade-fee vs payout lanes —
          edit the parameters and watch the flywheel.
        </p>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Vault NAV" value={formatCompact(state.vaultNav)} hint={`${CREATOR_TOKEN_SYMBOL}`} />
        <Stat label={`${SHARE_BOX_SYMBOL} supply`} value={formatCompact(state.boxSupply)} hint="ERC-4626 redeem claim" />
        <Stat label={`${SHARE_OFT_SYMBOL} circulating`} value={formatCompact(state.oftCirculating)} hint="Trading / bridge form" />
        <Stat
          label="CCA"
          value={state.ccaGraduated ? 'Live' : formatPct(ccaProgress(state) * 100)}
          hint={`${formatCompact(state.ccaFilled)} / ${formatCompact(state.params.ccaThreshold)}`}
        />
        <Stat label="Share price" value={sharePrice(state).toFixed(4)} hint="NAV / ▢" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Charm TVL" value={formatCompact(state.charmTvl)} hint="Leg" />
        <Stat label="Ajna TVL" value={formatCompact(state.ajnaTvl)} hint="Leg" />
        <Stat label="Idle buffer" value={formatCompact(state.idleTvl)} hint="Leg" />
        <Stat label="Jackpot reserve" value={formatCompact(state.jackpotReserve)} hint="Gauge split" />
      </div>

      <div className="glass-card ring-1 ring-white/5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] overflow-hidden">
        <Flywheel state={state} />
      </div>

      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <div className="glass-card ring-1 ring-white/5 p-5 sm:p-6 space-y-5">
          <div>
            <span className="label">Parameters — edit me</span>
            <p className="mt-2 text-xs text-zinc-500 font-light">
              Share split stays 30 / 30 / 30 / 10 (CCA / vesting / Solana arm / LP). Solana is an arm, not a strategy leg.
            </p>
          </div>

          <div className="space-y-4">
            <ParamSlider
              label="Deposit rate"
              value={draftParams.depositRate}
              min={0}
              max={250_000}
              step={1_000}
              display={`${formatCompact(draftParams.depositRate)}/s`}
              onChange={(v) => updateParam('depositRate', v)}
            />
            <ParamSlider
              label="Trading activity"
              value={draftParams.tradeActivity}
              min={0}
              max={8}
              step={0.1}
              display={`${draftParams.tradeActivity.toFixed(1)}/s`}
              onChange={(v) => updateParam('tradeActivity', v)}
            />
            <ParamSlider
              label="Trading fee (buyback → gauge)"
              value={draftParams.tradingFeeBps}
              min={0}
              max={500}
              step={5}
              display={formatBpsAsPct(draftParams.tradingFeeBps)}
              onChange={(v) => updateParam('tradingFeeBps', v)}
            />
            <ParamSlider
              label="CCA graduation threshold"
              value={draftParams.ccaThreshold}
              min={1_000_000}
              max={80_000_000}
              step={1_000_000}
              display={formatCompact(draftParams.ccaThreshold)}
              onChange={(v) => updateParam('ccaThreshold', v)}
            />
            <ParamSlider
              label="Wrap ratio (▢ → ■)"
              value={draftParams.wrapRatio}
              min={0}
              max={1}
              step={0.01}
              display={formatPct(draftParams.wrapRatio * 100)}
              onChange={(v) => updateParam('wrapRatio', v)}
            />
            <ParamSlider
              label="Payout inflow (PayoutRouter lane)"
              value={draftParams.payoutInflowRate}
              min={0}
              max={20_000}
              step={100}
              display={`${formatCompact(draftParams.payoutInflowRate)}/s`}
              onChange={(v) => updateParam('payoutInflowRate', v)}
            />
          </div>

          <div className="border-t border-white/5 pt-5 space-y-4">
            <span className="label">Legs (must sum 100%)</span>
            <ParamSlider
              label="Charm"
              value={draftParams.legs.charm}
              min={0}
              max={100}
              step={1}
              display={formatPct(draftParams.legs.charm)}
              onChange={(v) => updateLeg('charm', v)}
            />
            <ParamSlider
              label="Ajna"
              value={draftParams.legs.ajna}
              min={0}
              max={100}
              step={1}
              display={formatPct(draftParams.legs.ajna)}
              onChange={(v) => updateLeg('ajna', v)}
            />
            <ParamSlider
              label="Idle"
              value={draftParams.legs.idle}
              min={0}
              max={100}
              step={1}
              display={formatPct(draftParams.legs.idle)}
              onChange={(v) => updateLeg('idle', v)}
            />
          </div>

          <div className="border-t border-white/5 pt-5 space-y-4">
            <span className="label">Gauge split (tradeFeeCollector)</span>
            <ParamSlider
              label="Burn"
              value={draftParams.gauge.burn}
              min={0}
              max={100}
              step={1}
              display={formatPct(draftParams.gauge.burn)}
              onChange={(v) => updateGauge('burn', v)}
            />
            <ParamSlider
              label="Jackpot"
              value={draftParams.gauge.jackpot}
              min={0}
              max={100}
              step={1}
              display={formatPct(draftParams.gauge.jackpot)}
              onChange={(v) => updateGauge('jackpot', v)}
            />
            <ParamSlider
              label="Creator treasury"
              value={draftParams.gauge.creatorTreasury}
              min={0}
              max={100}
              step={1}
              display={formatPct(draftParams.gauge.creatorTreasury)}
              onChange={(v) => updateGauge('creatorTreasury', v)}
            />
            <ParamSlider
              label="Protocol"
              value={draftParams.gauge.protocol}
              min={0}
              max={100}
              step={1}
              display={formatPct(draftParams.gauge.protocol)}
              onChange={(v) => updateGauge('protocol', v)}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card ring-1 ring-white/5 p-5 sm:p-6 space-y-4">
            <span className="label">Controls</span>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => setState((prev) => setPaused(prev, !prev.paused))}
              >
                {state.paused ? (
                  <>
                    <Play className="h-4 w-4" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" /> Pause
                  </>
                )}
              </Button>
              <Button variant="secondary" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setState((prev) => stressRedeem(prev, Math.max(10_000, prev.boxSupply * 0.04)))
                }
              >
                Stress redeem
              </Button>
              <Button
                variant="secondary"
                onClick={() => setState((prev) => setImpairment(prev, !prev.impairmentActive))}
              >
                <Snowflake className="h-4 w-4" />
                {state.impairmentActive ? 'Clear impairment' : 'Trigger impairment'}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <Stat label="Fees burned" value={formatCompact(state.feesBurned)} />
              <Stat label="Protocol accum" value={formatCompact(state.protocolAccum)} />
              <Stat label="Creator treasury" value={formatCompact(state.creatorTreasuryAccum)} />
              <Stat label="Payout burn stream" value={formatCompact(state.payoutBurnStream)} />
              <Stat label="Total traded" value={formatCompact(state.totalTraded)} />
              <Stat label="Total redeemed" value={formatCompact(state.totalRedeemed)} />
            </div>
          </div>

          <div className="glass-card ring-1 ring-white/5 p-5 sm:p-6 space-y-3">
            <span className="label">Lane reminder</span>
            <ul className="space-y-2 text-sm text-zinc-400 font-light leading-relaxed">
              <li>
                <span className="text-zinc-200">tradeFeeCollector</span> — ■ trade fees → gauge → burn / jackpot / treasury / protocol
              </li>
              <li>
                <span className="text-zinc-200">creatorCoinPayoutRecipient</span> — external creator-coin earnings → PayoutRouter → burn stream (PPS), not trade-fee
              </li>
              <li>
                <span className="text-zinc-200">{SHARE_BOX_SYMBOL}</span> redeems vault NAV;{' '}
                <span className="text-zinc-200">{SHARE_OFT_SYMBOL}</span> is the wrapped trading / bridge form
              </li>
            </ul>
            <div className="pt-3 flex flex-col sm:flex-row gap-3">
              <Link
                to="/faq/how-it-works"
                className="inline-flex items-center gap-2 text-sm text-brand-accent hover:text-brand-400"
              >
                How it works <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <a
                href={DOCS_LEARN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Docs · Learn <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 font-light max-w-3xl leading-relaxed">
        Illustrative simulation. Defaults mirror researched Creator Vault economics (30/30/30/10 share allocation,
        45/45/10 Charm·Ajna·idle legs, separate trade-fee and payout lanes), but rates, trade sizes, and timing are
        accelerated for visualization — not live onchain data.
      </p>
    </div>
  )
}
