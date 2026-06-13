import { useMemo, useState, type ReactNode } from 'react'

import { KeyOwnershipBar } from '@/components/alfaclub/KeyOwnershipBar'
import { KeySafetyVerdictBanner } from '@/components/alfaclub/KeySafetyVerdictBanner'
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

/** Combined number box + slider. The box accepts values beyond the slider range. */
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
      Continue
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
  tone: 'good' | 'warn' | 'neutral'
}

function StatTile({ label, value, caption, tone }: StatTileProps) {
  return (
    <div className="rounded-2xl bg-white/[0.045] p-4 shadow-[0_12px_24px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1.5 text-xl font-semibold tracking-tight',
          tone === 'good' && 'text-sky-100',
          tone === 'warn' && 'text-amber-100',
          tone === 'neutral' && 'text-white',
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{caption}</p>
    </div>
  )
}

function verdictReason(evaluation: KeyDefenseEvaluation): string {
  switch (evaluation.verdict) {
    case 'safe':
      return 'Your veto holds and raid attempts stay net negative.'
    case 'economically-protected':
      return 'Raid attempts stay net negative, but you are below veto control.'
    case 'at-risk': {
      const attack = evaluation.raid.bestAttack
      return attack
        ? `${attack.keysBought.toLocaleString()} bought keys can net ≈ ${formatUsd(attack.profitUsdc)}.`
        : 'A positive-net raid path exists.'
    }
    case 'not-applicable':
      return 'Not applicable in this mode.'
    default: {
      const exhaustive: never = evaluation.verdict
      throw new Error(`Unknown verdict: ${String(exhaustive)}`)
    }
  }
}

export function AlfaClubKeySafety() {
  const [roomTier, setRoomTier] = useState<AlfaRoomTier>('club')
  const [keySupply, setKeySupply] = useState(30)
  const [sharePercent, setSharePercent] = useState(20)
  const [donationUsdc, setDonationUsdc] = useState(0)
  const [potOverride, setPotOverride] = useState<number | null>(null)
  // Progressive disclosure: 1=tier, 2=supply, 3=ownership, 4=pot, 5=donation.
  const [unlockedStep, setUnlockedStep] = useState(1)

  const unlock = (target: number) => setUnlockedStep((current) => Math.max(current, target))

  const yourKeys = Math.round((sharePercent / 100) * keySupply)
  const potBaseline = useMemo(() => poolFeeBaselineUsdc('trading', roomTier, keySupply), [roomTier, keySupply])
  const potUsdc = potOverride ?? potBaseline

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
        potUsdc: potUsdc + donationUsdc,
      },
      minAttackKeys,
    )
    const eligibleAfterAttack = keySupply + minAttackKeys
    const netDistributableUsdc = point.distributedPerKeyUsdc * eligibleAfterAttack
    return {
      minAttackKeys,
      minAttackKeysCostUsdc: evaluation.raid.minAttackKeysCostUsdc,
      poolFeeAddedUsdc: point.poolFeeAddedUsdc,
      potSizeUsdc: point.potSizeUsdc,
      distributedPerKeyUsdc: point.distributedPerKeyUsdc,
      netDistributableUsdc,
    }
  }, [donationUsdc, evaluation.raid.minAttackKeys, evaluation.raid.minAttackKeysCostUsdc, keySupply, potUsdc, roomTier, yourKeys])

  const recoveryPercent = Math.round(evaluation.recovery.donationRecoveryFraction * 100)
  const showResults = unlockedStep >= 5

  return (
    <div className="relative pb-24 md:pb-0">
      <section className="cinematic-section">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-8 rounded-3xl bg-[radial-gradient(120%_140%_at_0%_0%,rgba(56,189,248,0.18),rgba(0,0,0,0))] p-6 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <span className="label">AlfaClub</span>
            <h1 className="headline mt-3 text-3xl tracking-tight sm:text-5xl">Key Safety</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Hold enough keys so nobody can dissolve the room and take your donation.
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
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.86fr)_minmax(0,1.14fr)]">
            <div className="space-y-4 rounded-3xl bg-black/45 p-5 backdrop-blur-[2px] shadow-[0_20px_55px_rgba(0,0,0,0.42),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                Trading room defense calculator
              </p>

              <div className="space-y-5 pt-2">
                <div className="mb-1 flex items-center gap-2 px-1" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((step) => (
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
                  title="Select Trading Room Type"
                  description="Casual: i²/4000, Club: i²/40, Exclusive: i²/4"
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
                  title="Enter Total Supply of Keys"
                  description="How many keys are in circulation now?"
                  state={unlockedStep < 2 ? 'locked' : unlockedStep > 2 ? 'done' : 'active'}
                >
                  {unlockedStep >= 2 ? (
                    <>
                      <ControlSliderInput
                        label="Total supply of keys"
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
                  title="What % Do You Hold?"
                  description="Your ownership share in this room."
                  state={unlockedStep < 3 ? 'locked' : unlockedStep > 3 ? 'done' : 'active'}
                >
                  {unlockedStep >= 3 ? (
                    <>
                      <ControlSlider
                        label="What % do you hold"
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
                      {unlockedStep === 3 ? <ContinueButton onClick={() => unlock(4)} /> : null}
                    </>
                  ) : null}
                </StepShell>

                <StepShell
                  index={4}
                  title="Current Size of Room Pot"
                  description="Defaults to fee baseline from the selected supply."
                  state={unlockedStep < 4 ? 'locked' : unlockedStep > 4 ? 'done' : 'active'}
                >
                  {unlockedStep >= 4 ? (
                    <>
                      <ControlSliderInput
                        label="Current size of room pot"
                        min={0}
                        sliderMax={Math.max(Math.ceil(potBaseline * 4), 5_000)}
                        step={potBaseline >= 1_000 ? 100 : 10}
                        value={Math.round(potUsdc * 100) / 100}
                        onChange={(value) => {
                          setPotOverride(value)
                          unlock(5)
                        }}
                        isUsd
                        caption={
                          potOverride === null ? (
                            <>Baseline = 6% x cumulative buy volume ({formatUsd(potBaseline)})</>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPotOverride(null)}
                              className="text-sky-400 transition-colors hover:text-sky-300"
                            >
                              ↺ Use fee baseline ({formatUsd(potBaseline)})
                            </button>
                          )
                        }
                      />
                      {unlockedStep === 4 ? <ContinueButton onClick={() => unlock(5)} /> : null}
                    </>
                  ) : null}
                </StepShell>

                <StepShell
                  index={5}
                  title="How Much You Plan to Donate"
                  description="Set your planned new capital."
                  state={unlockedStep < 5 ? 'locked' : 'active'}
                >
                  {unlockedStep >= 5 ? (
                    <ControlSliderInput
                      label="You plan to donate"
                      min={0}
                      sliderMax={10_000}
                      step={50}
                      value={donationUsdc}
                      onChange={setDonationUsdc}
                      isUsd
                    />
                  ) : null}
                </StepShell>
              </div>

              {showResults ? (
                <p className="pt-2 text-[11px] leading-relaxed text-zinc-600">
                  Worst case: every other key is hostile &amp; staked. Payouts return 72% of the
                  pot. Keys must be staked &gt;24h to vote or get paid.
                </p>
              ) : null}
            </div>

            <div className="space-y-4">
              {showResults ? (
                <>
                  <KeySafetyVerdictBanner
                    verdict={evaluation.verdict}
                    reason={verdictReason(evaluation)}
                  />

                  <div className="rounded-3xl bg-black/35 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                    <KeyOwnershipBar keySupply={keySupply} yourKeys={yourKeys} />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <StatTile
                      label="Veto"
                      value={
                        evaluation.hasVeto
                          ? 'Held'
                          : `+${evaluation.vetoKeysToBuy.toLocaleString()} keys`
                      }
                      caption={
                        evaluation.hasVeto
                          ? 'No vote passes without you'
                          : `≈ ${formatUsd(evaluation.vetoKeysToBuyCostUsdc)} to block all votes`
                      }
                      tone={evaluation.hasVeto ? 'good' : 'warn'}
                    />
                    <StatTile
                      label="Raid-proof"
                      value={
                        evaluation.raid.raidUnprofitable
                          ? 'Yes'
                          : evaluation.raidproofExtraKeys !== null
                            ? `+${evaluation.raidproofExtraKeys.toLocaleString()} keys`
                            : 'No'
                      }
                      caption={
                        evaluation.raid.raidUnprofitable
                          ? `Safe until pot ≈ ${formatUsd(evaluation.maxSafePotUsdc)}`
                          : evaluation.raidproofExtraKeys !== null &&
                              evaluation.raidproofExtraKeysCostUsdc !== null
                            ? `≈ ${formatUsd(evaluation.raidproofExtraKeysCostUsdc)} to neutralize raids`
                            : 'Pot too large — key buys alone cannot neutralize'
                      }
                      tone={evaluation.raid.raidUnprofitable ? 'good' : 'warn'}
                    />
                    <StatTile
                      label="Donation back"
                      value={donationUsdc > 0 ? `${recoveryPercent}%` : '—'}
                      caption={
                        donationUsdc > 0
                          ? `${formatUsd(evaluation.recovery.distributionPayoutUsdc)} if distribution fires`
                          : 'Set a donation to see recovery'
                      }
                      tone={
                        donationUsdc <= 0 ? 'neutral' : recoveryPercent >= 50 ? 'good' : 'warn'
                      }
                    />
                  </div>

                  <div className="rounded-3xl bg-black/35 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                      Curve + attack simulation
                    </p>
                    <TradingRoomCurvePreview
                      selectedTier={roomTier}
                      activeKeyIndex={keySupply}
                      raidCurve={evaluation.raid.curve}
                      progressiveStage={unlockedStep}
                      ownerSharePercent={sharePercent}
                      onActiveKeyChange={(next) => {
                        setKeySupply(next)
                        unlock(3)
                      }}
                      maxKeys={Math.max(80, keySupply + 10)}
                      heightClassName="h-96"
                      withFrame={false}
                    />
                    {minAttackBreakdown ? (
                      <div className="mt-4 rounded-2xl bg-white/[0.035] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                          Bad-actor threshold
                        </p>
                        <div className="mt-2 grid gap-2 text-xs text-zinc-300 sm:grid-cols-2">
                          <p>
                            Minimum attack keys:{' '}
                            <span className="font-mono text-zinc-100">
                              {minAttackBreakdown.minAttackKeys.toLocaleString()}
                            </span>
                          </p>
                          <p>
                            Attack buy cost:{' '}
                            <span className="font-mono text-zinc-100">
                              {formatUsd(minAttackBreakdown.minAttackKeysCostUsdc)}
                            </span>
                          </p>
                          <p>
                            Fees added to room pot:{' '}
                            <span className="font-mono text-zinc-100">
                              {formatUsd(minAttackBreakdown.poolFeeAddedUsdc)}
                            </span>
                          </p>
                          <p>
                            Pot size after attack buys:{' '}
                            <span className="font-mono text-zinc-100">
                              {formatUsd(minAttackBreakdown.potSizeUsdc)}
                            </span>
                          </p>
                          <p>
                            Distribution per key:{' '}
                            <span className="font-mono text-zinc-100">
                              {formatUsd(minAttackBreakdown.distributedPerKeyUsdc)}
                            </span>
                          </p>
                          <p>
                            Net distributed amount:{' '}
                            <span className="font-mono text-zinc-100">
                              {formatUsd(minAttackBreakdown.netDistributableUsdc)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="rounded-3xl bg-black/35 p-5 shadow-[0_16px_36px_rgba(0,0,0,0.35),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                    Trading room curve preview
                  </p>
                  <TradingRoomCurvePreview
                    selectedTier={roomTier}
                    activeKeyIndex={keySupply}
                    progressiveStage={unlockedStep}
                    ownerSharePercent={sharePercent}
                    onActiveKeyChange={(next) => {
                      setKeySupply(next)
                      unlock(3)
                    }}
                    maxKeys={Math.max(80, keySupply + 10)}
                    heightClassName="h-96"
                    withFrame={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

