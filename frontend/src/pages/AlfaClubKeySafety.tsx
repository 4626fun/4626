import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { KeyOwnershipBar } from '@/components/alfaclub/KeyOwnershipBar'
import { TradingRoomCurvePreview } from '@/components/alfaclub/TradingRoomCurvePreview'
import {
  evaluateKeyDefense,
  poolFeeBaselineUsdc,
  raidProfit,
  type AlfaRoomTier,
  type KeyDefenseEvaluation,
} from '@/lib/alfaclub/keyDefense'
import { cn } from '@/lib/shared/utils'

const ROOM_TIERS: Array<{ id: AlfaRoomTier; label: string; formula: string }> = [
  { id: 'casual', label: 'Casual', formula: 'i² / 4000' },
  { id: 'club', label: 'Club', formula: 'i² / 40' },
  { id: 'exclusive', label: 'Exclusive', formula: 'i² / 4' },
]

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  })
}

function sliderTrack(percent: number): string {
  const active = 'rgb(var(--brand-primary) / 0.85)'
  const inactive = 'rgb(var(--vault-border-strong) / 0.35)'
  const clamped = Math.max(0, Math.min(100, percent))
  return `linear-gradient(90deg, ${active} 0%, ${active} ${clamped}%, ${inactive} ${clamped}%, ${inactive} 100%)`
}

type ControlSliderProps = {
  label: string
  valueLabel: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}

function ControlSlider({ label, valueLabel, min, max, step, value, onChange }: ControlSliderProps) {
  const percent = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</span>
        <span className="font-mono text-sm text-zinc-100">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bv-amount-slider h-1.5 w-full cursor-pointer appearance-none rounded-full accent-brand-primary"
        style={{ background: sliderTrack(percent) }}
        aria-label={label}
      />
    </div>
  )
}

type ControlSliderInputProps = {
  label: string
  min: number
  sliderMax: number
  step: number
  value: number
  onChange: (value: number) => void
  isUsd?: boolean
  caption?: ReactNode
}

function ControlSliderInput({
  label,
  min,
  sliderMax,
  step,
  value,
  onChange,
  isUsd,
  caption,
}: ControlSliderInputProps) {
  const sliderValue = Math.min(value, sliderMax)
  const percent = ((sliderValue - min) / (sliderMax - min)) * 100
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</span>
        <div className="flex items-center gap-1.5">
          {isUsd ? <span className="font-mono text-sm text-zinc-500">$</span> : null}
          <input
            type="number"
            min={min}
            step={step}
            value={value}
            onChange={(event) => {
              const next = Number(event.target.value)
              onChange(Number.isFinite(next) ? Math.max(min, next) : min)
            }}
            className="w-28 rounded-xl bg-black/45 px-2.5 py-1.5 text-right font-mono text-sm text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1px_rgba(96,165,250,0.75)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={label}
          />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={sliderMax}
        step={step}
        value={sliderValue}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bv-amount-slider h-1.5 w-full cursor-pointer appearance-none rounded-full accent-brand-primary"
        style={{ background: sliderTrack(percent) }}
        aria-label={`${label} slider`}
      />
      {caption ? <div className="mt-1.5 text-[11px] text-zinc-600">{caption}</div> : null}
    </div>
  )
}

function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 rounded-full bg-gradient-to-r from-sky-500/40 to-blue-500/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-zinc-100 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.35)] transition-all hover:from-sky-500/55 hover:to-blue-500/45"
    >
      Next
    </button>
  )
}

type StepShellProps = {
  index: number
  title: string
  description: string
  state: 'active' | 'done' | 'locked'
  children?: ReactNode
}

function StepShell({ index, title, description, state, children }: StepShellProps) {
  return (
    <section
      className={cn(
        'rounded-2xl p-4 transition-all duration-300',
        state === 'active' &&
          'bg-white/[0.055] shadow-[0_16px_34px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(125,211,252,0.24)]',
        state === 'done' &&
          'bg-white/[0.045] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]',
        state === 'locked' && 'bg-black/20 opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors',
            state === 'active' && 'bg-sky-400/25 text-sky-200',
            state === 'done' && 'bg-white/15 text-zinc-100',
            state === 'locked' && 'bg-white/5 text-zinc-500',
          )}
          aria-hidden="true"
        >
          {state === 'done' ? '✓' : index}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              'text-sm font-medium tracking-[0.01em]',
              state === 'locked' ? 'text-zinc-500' : 'text-zinc-100',
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              'mt-0.5 text-[11px] leading-relaxed',
              state === 'locked' ? 'text-zinc-600' : 'text-zinc-500',
            )}
          >
            {description}
          </p>
        </div>
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  )
}

type StatTileProps = {
  label: string
  value: string
  caption: string
  tone: 'good' | 'warn' | 'risk' | 'neutral'
}

function StatTile({ label, value, caption, tone }: StatTileProps) {
  return (
    <div className="rounded-2xl bg-white/[0.045] p-4 shadow-[0_12px_24px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1.5 text-xl font-semibold tracking-tight',
          tone === 'good' && 'text-sky-100',
          tone === 'warn' && 'text-amber-200',
          tone === 'risk' && 'text-red-200',
          tone === 'neutral' && 'text-white',
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{caption}</p>
    </div>
  )
}

type SafetyStatus = 'safe' | 'caution' | 'at-risk'

function resolveSafetyStatus(evaluation: KeyDefenseEvaluation, potAtRiskUsdc: number): SafetyStatus {
  if (!evaluation.raid.raidUnprofitable) return 'at-risk'
  const nearThreshold =
    Number.isFinite(evaluation.maxSafePotUsdc) &&
    evaluation.maxSafePotUsdc > 0 &&
    potAtRiskUsdc / evaluation.maxSafePotUsdc >= 0.75
  return nearThreshold || !evaluation.hasVeto ? 'caution' : 'safe'
}

type StatusPresentation = {
  label: string
  title: string
  bodyLines: [string, string]
  icon: typeof CheckCircle2
  shellClassName: string
  iconClassName: string
}

function statusPresentation(status: SafetyStatus): StatusPresentation {
  switch (status) {
    case 'safe':
      return {
        label: 'Safe',
        title: 'Your current safety status',
        bodyLines: [
          'A hostile distribution is currently not profitable.',
          'Even if someone tries, expected attacker return is negative.',
        ],
        icon: CheckCircle2,
        shellClassName:
          'bg-white/[0.055] shadow-[0_16px_34px_rgba(0,0,0,0.26),inset_0_0_0_1px_rgba(125,211,252,0.22)]',
        iconClassName: 'text-sky-200',
      }
    case 'caution':
      return {
        label: 'Caution',
        title: 'Your current safety status',
        bodyLines: [
          'You are hard to exploit, but close to the edge.',
          'A larger pot or lower ownership could make attacks profitable.',
        ],
        icon: ShieldAlert,
        shellClassName:
          'bg-amber-500/[0.1] shadow-[0_16px_34px_rgba(0,0,0,0.26),inset_0_0_0_1px_rgba(245,158,11,0.3)]',
        iconClassName: 'text-amber-200',
      }
    case 'at-risk':
      return {
        label: 'At risk',
        title: 'Your current safety status',
        bodyLines: [
          'A hostile distribution can currently be profitable.',
          'You should increase key share, reduce exposed donation, or both.',
        ],
        icon: AlertTriangle,
        shellClassName:
          'bg-red-500/[0.12] shadow-[0_16px_34px_rgba(0,0,0,0.26),inset_0_0_0_1px_rgba(239,68,68,0.32)]',
        iconClassName: 'text-red-200',
      }
    default: {
      const exhaustive: never = status
      throw new Error(`Unknown safety status: ${String(exhaustive)}`)
    }
  }
}

export function AlfaClubKeySafety() {
  const [roomTier, setRoomTier] = useState<AlfaRoomTier>('club')
  const [keySupply, setKeySupply] = useState(30)
  const [sharePercent, setSharePercent] = useState(20)
  const [donationUsdc, setDonationUsdc] = useState(0)
  const [potOverride, setPotOverride] = useState<number | null>(null)
  const [unlockedStep, setUnlockedStep] = useState(1)
  const unlock = (target: number) => setUnlockedStep((current) => Math.max(current, target))

  const yourKeys = Math.round((sharePercent / 100) * keySupply)
  const potBaseline = useMemo(() => poolFeeBaselineUsdc('trading', roomTier, keySupply), [roomTier, keySupply])
  const potUsdc = potOverride ?? potBaseline
  const potAtRiskUsdc = Math.max(0, potUsdc + donationUsdc)

  const evaluation = useMemo(
    () =>
      evaluateKeyDefense({
        roomType: 'trading',
        roomTier,
        keySupply,
        yourKeys,
        potUsdc,
        donationUsdc,
        targetRecoveryFraction: 0.5,
      }),
    [roomTier, keySupply, yourKeys, potUsdc, donationUsdc],
  )

  const minAttackBreakdown = useMemo(() => {
    const minAttackKeys = evaluation.raid.minAttackKeys
    if (minAttackKeys <= 0) return null
    const point = raidProfit(
      {
        roomType: 'trading',
        roomTier,
        keySupply,
        yourKeys,
        potUsdc: potAtRiskUsdc,
      },
      minAttackKeys,
    )
    const eligibleAfterAttack = keySupply + minAttackKeys
    return {
      minAttackKeys,
      minAttackKeysCostUsdc: evaluation.raid.minAttackKeysCostUsdc,
      poolFeeAddedUsdc: point.poolFeeAddedUsdc,
      potSizeUsdc: point.potSizeUsdc,
      distributedPerKeyUsdc: point.distributedPerKeyUsdc,
      netDistributableUsdc: point.distributedPerKeyUsdc * eligibleAfterAttack,
      attackerNetUsdc: point.profitUsdc,
    }
  }, [evaluation.raid.minAttackKeys, evaluation.raid.minAttackKeysCostUsdc, keySupply, potAtRiskUsdc, roomTier, yourKeys])

  const safetyStatus = resolveSafetyStatus(evaluation, potAtRiskUsdc)
  const safety = statusPresentation(safetyStatus)
  const SafetyIcon = safety.icon
  const recoveryPercent = Math.round(evaluation.recovery.donationRecoveryFraction * 100)
  const showResults = unlockedStep >= 4
  const clubRiskRows = useMemo(() => {
    const supplyCandidates = [20, 40, 60, 80, 100]
    const ownershipCandidates = [10, 20, 30, 40, 50]
    return supplyCandidates.map((supply) => {
      const ownershipPercent = ownershipCandidates.find((candidate) => candidate >= sharePercent) ?? 50
      const keysHeld = Math.round((ownershipPercent / 100) * supply)
      const clubEvaluation = evaluateKeyDefense({
        roomType: 'trading',
        roomTier: 'club',
        keySupply: supply,
        yourKeys: keysHeld,
        potUsdc,
        donationUsdc,
        targetRecoveryFraction: 0.5,
      })
      return {
        supply,
        ownershipPercent,
        keysHeld,
        status: resolveSafetyStatus(clubEvaluation, Math.max(0, potUsdc + donationUsdc)),
        minAttackKeys: clubEvaluation.raid.minAttackKeys,
        minAttackCostUsdc: clubEvaluation.raid.minAttackKeysCostUsdc,
      }
    })
  }, [donationUsdc, potUsdc, sharePercent])

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 rounded-3xl bg-[radial-gradient(120%_140%_at_0%_0%,rgba(56,189,248,0.18),rgba(0,0,0,0))] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <span className="label">AlfaClub</span>
            <h1 className="headline mt-3 text-3xl tracking-tight sm:text-5xl">
              How exposed is your room right now?
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Same underlying math, rewritten so first-time users can make a fast safety decision.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                Tier: {roomTier}
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                Supply: {keySupply.toLocaleString()} keys
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                Ownership: {sharePercent}%
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                Pot: {formatUsd(potUsdc)}
              </span>
              <span className="rounded-full bg-white/[0.06] px-3 py-1 text-zinc-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
                Planned donation: {formatUsd(donationUsdc)}
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.86fr)_minmax(0,1.14fr)]">
            <div className="space-y-4 rounded-3xl bg-black/45 p-5 backdrop-blur-[2px] shadow-[0_20px_55px_rgba(0,0,0,0.42),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">Input setup</p>
              <div className="space-y-5 pt-2">
                <div className="mb-1 flex items-center gap-2 px-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors duration-300',
                        unlockedStep > step && 'bg-zinc-300/65',
                        unlockedStep === step && 'bg-sky-400/85',
                        unlockedStep < step && 'bg-white/10',
                      )}
                    />
                  ))}
                </div>
                <StepShell
                  index={1}
                  title="1) Choose room type"
                  description="This controls how fast key prices rise."
                  state={unlockedStep > 1 ? 'done' : 'active'}
                >
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Trading room tier">
                    {ROOM_TIERS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setRoomTier(option.id)
                          unlock(2)
                        }}
                        aria-pressed={roomTier === option.id}
                        className={cn(
                          'rounded-xl px-2 py-2 text-xs transition-colors',
                          roomTier === option.id
                            ? 'bg-white/14 text-white'
                            : 'bg-black/30 text-zinc-400 hover:bg-white/5 hover:text-white',
                        )}
                        title={`Price formula: ${option.formula}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {unlockedStep === 1 ? <ContinueButton onClick={() => unlock(2)} /> : null}
                </StepShell>
                <StepShell
                  index={2}
                  title="2) Enter total keys in the room"
                  description="More keys usually means more money needed to shift control."
                  state={unlockedStep < 2 ? 'locked' : unlockedStep > 2 ? 'done' : 'active'}
                >
                  {unlockedStep >= 2 ? (
                    <>
                      <ControlSliderInput
                        label="Total keys in room"
                        min={1}
                        sliderMax={200}
                        step={1}
                        value={keySupply}
                        onChange={(next) => {
                          setKeySupply(next)
                          unlock(3)
                        }}
                      />
                      {unlockedStep === 2 ? <ContinueButton onClick={() => unlock(3)} /> : null}
                    </>
                  ) : null}
                </StepShell>
                <StepShell
                  index={3}
                  title="3) Enter your key share"
                  description="Your share decides how hard it is to force a distribution vote."
                  state={unlockedStep < 3 ? 'locked' : unlockedStep > 3 ? 'done' : 'active'}
                >
                  {unlockedStep >= 3 ? (
                    <>
                      <ControlSlider
                        label="Your key share"
                        valueLabel={`${sharePercent}% · ${yourKeys.toLocaleString()} keys`}
                        min={0}
                        max={100}
                        step={1}
                        value={sharePercent}
                        onChange={(next) => {
                          setSharePercent(next)
                          unlock(4)
                        }}
                      />
                      <p className="mt-2 text-[11px] text-zinc-500">
                        You currently hold {yourKeys.toLocaleString()} of {keySupply.toLocaleString()} keys ({sharePercent}%).
                      </p>
                      {unlockedStep === 3 ? <ContinueButton onClick={() => unlock(4)} /> : null}
                    </>
                  ) : null}
                </StepShell>
                <StepShell
                  index={4}
                  title="4) Enter room money"
                  description="Set today's pot and any new donation you plan to add."
                  state={unlockedStep < 4 ? 'locked' : 'active'}
                >
                  {unlockedStep >= 4 ? (
                    <>
                      <ControlSliderInput
                        label="Current room pot"
                        min={0}
                        sliderMax={Math.max(Math.ceil(potBaseline * 4), 5_000)}
                        step={potBaseline >= 1_000 ? 100 : 10}
                        value={Math.round(potUsdc * 100) / 100}
                        onChange={setPotOverride}
                        isUsd
                        caption={
                          potOverride === null ? (
                            <>Auto-filled from trading fees so far.</>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPotOverride(null)}
                              className="text-sky-400 transition-colors hover:text-sky-300"
                            >
                              Use fee-based estimate ({formatUsd(potBaseline)})
                            </button>
                          )
                        }
                      />
                      <div className="mt-4">
                        <ControlSliderInput
                          label="Planned donation"
                          min={0}
                          sliderMax={10_000}
                          step={50}
                          value={donationUsdc}
                          onChange={setDonationUsdc}
                          isUsd
                        />
                      </div>
                    </>
                  ) : null}
                </StepShell>
              </div>
              {showResults ? (
                <p className="pt-2 text-[11px] leading-relaxed text-zinc-600">
                  Worst-case assumption: all non-owned keys are hostile and eligible. Distribution pays 72% of the pot; keys must be staked &gt;24h to vote or receive payout.
                </p>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl bg-black/35 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">Why this matters</p>
                <p className="mb-3 text-xs text-zinc-400">
                  This calculator estimates whether a hostile buyer can profit by forcing a distribution event.
                </p>
                <TradingRoomCurvePreview
                  selectedTier={roomTier}
                  activeKeyIndex={keySupply}
                  raidCurve={showResults ? evaluation.raid.curve : undefined}
                  progressiveStage={unlockedStep}
                  ownerSharePercent={sharePercent}
                  onActiveKeyChange={(next) => {
                    setKeySupply(next)
                    unlock(3)
                  }}
                  maxKeys={Math.max(80, keySupply + 10)}
                  heightClassName="h-[26rem] sm:h-[30rem]"
                  withFrame={false}
                />
              </div>

              {showResults ? (
                <>
                  <div className={cn('rounded-2xl p-4', safety.shellClassName)} role="status">
                    <div className="flex items-start gap-3">
                      <SafetyIcon className={cn('mt-0.5 h-5 w-5 shrink-0', safety.iconClassName)} aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-300">{safety.title}</p>
                        <p className="mt-1 text-lg font-semibold text-white">{safety.label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-300">{safety.bodyLines[0]}</p>
                        <p className="text-xs leading-relaxed text-zinc-400">{safety.bodyLines[1]}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-black/35 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                    <KeyOwnershipBar keySupply={keySupply} yourKeys={yourKeys} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatTile
                      label="Attacker must buy"
                      value={
                        minAttackBreakdown
                          ? `${minAttackBreakdown.minAttackKeys.toLocaleString()} keys`
                          : '—'
                      }
                      caption="Minimum keys needed to force a distribution vote."
                      tone={safetyStatus === 'at-risk' ? 'risk' : 'warn'}
                    />
                    <StatTile
                      label="Estimated spend to buy"
                      value={
                        minAttackBreakdown ? formatUsd(minAttackBreakdown.minAttackKeysCostUsdc) : '—'
                      }
                      caption="Estimated attacker spend for that minimum size."
                      tone="neutral"
                    />
                    <StatTile
                      label="Expected attacker net"
                      value={
                        minAttackBreakdown
                          ? `${minAttackBreakdown.attackerNetUsdc >= 0 ? '+' : ''}${formatUsd(minAttackBreakdown.attackerNetUsdc)}`
                          : '—'
                      }
                      caption={
                        minAttackBreakdown && minAttackBreakdown.attackerNetUsdc > 0
                          ? 'Positive means this attack can be profitable.'
                          : 'Negative means this attack is expected to lose money.'
                      }
                      tone={
                        minAttackBreakdown && minAttackBreakdown.attackerNetUsdc > 0
                          ? 'risk'
                          : 'good'
                      }
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatTile
                      label="Attack adds fees to pot"
                      value={minAttackBreakdown ? formatUsd(minAttackBreakdown.poolFeeAddedUsdc) : '—'}
                      caption="Extra fees created by the attack buys."
                      tone="neutral"
                    />
                    <StatTile
                      label="Pot after attack buys"
                      value={minAttackBreakdown ? formatUsd(minAttackBreakdown.potSizeUsdc) : '—'}
                      caption="Room pot right before distribution."
                      tone="neutral"
                    />
                    <StatTile
                      label="Total distribution payout"
                      value={
                        minAttackBreakdown
                          ? formatUsd(minAttackBreakdown.netDistributableUsdc)
                          : '—'
                      }
                      caption="Estimated payout to all eligible stakers."
                      tone="neutral"
                    />
                  </div>

                  <div className="rounded-3xl bg-black/35 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                      Why this result happens
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      The chart above shows where attacker profit flips from loss to gain as key buys increase.
                    </p>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
                      <p>
                        Vote control: <span className="font-mono text-zinc-100">{evaluation.hasVeto ? 'Held' : `+${evaluation.vetoKeysToBuy.toLocaleString()} keys`}</span>
                      </p>
                      <p>
                        Vote control cost:{' '}
                        <span className="font-mono text-zinc-100">{formatUsd(evaluation.vetoKeysToBuyCostUsdc)}</span>
                      </p>
                      <p>
                        Safe pot threshold:{' '}
                        <span className="font-mono text-zinc-100">{formatUsd(evaluation.maxSafePotUsdc)}</span>
                      </p>
                      <p>
                        Donation recovery:{' '}
                        <span className="font-mono text-zinc-100">{donationUsdc > 0 ? `${recoveryPercent}%` : '—'}</span>
                      </p>
                      <p>
                        Distribution payout:{' '}
                        <span className="font-mono text-zinc-100">{formatUsd(evaluation.recovery.distributionPayoutUsdc)}</span>
                      </p>
                      <p>
                        Distribution / key:{' '}
                        <span className="font-mono text-zinc-100">{minAttackBreakdown ? formatUsd(minAttackBreakdown.distributedPerKeyUsdc) : '—'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-black/35 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">
                      Club room risk scan (model)
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      Uses current pot ({formatUsd(potUsdc)}) and donation ({formatUsd(donationUsdc)}) with club-tier curve assumptions.
                    </p>
                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full border-separate border-spacing-y-1 text-xs text-zinc-300">
                        <thead>
                          <tr className="text-zinc-500">
                            <th className="px-2 py-1 text-left font-medium">Supply</th>
                            <th className="px-2 py-1 text-left font-medium">Owner %</th>
                            <th className="px-2 py-1 text-left font-medium">Keys held</th>
                            <th className="px-2 py-1 text-left font-medium">Attacker buys</th>
                            <th className="px-2 py-1 text-left font-medium">Buy cost</th>
                            <th className="px-2 py-1 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clubRiskRows.map((row) => (
                            <tr key={`club-risk-${row.supply}`} className="bg-white/[0.03]">
                              <td className="rounded-l-lg px-2 py-1.5 font-mono">{row.supply}</td>
                              <td className="px-2 py-1.5 font-mono">{row.ownershipPercent}%</td>
                              <td className="px-2 py-1.5 font-mono">{row.keysHeld.toLocaleString()}</td>
                              <td className="px-2 py-1.5 font-mono">{row.minAttackKeys.toLocaleString()}</td>
                              <td className="px-2 py-1.5 font-mono">{formatUsd(row.minAttackCostUsdc)}</td>
                              <td
                                className={cn(
                                  'rounded-r-lg px-2 py-1.5 font-medium',
                                  row.status === 'at-risk' && 'text-red-200',
                                  row.status === 'caution' && 'text-amber-200',
                                  row.status === 'safe' && 'text-sky-200',
                                )}
                              >
                                {row.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

