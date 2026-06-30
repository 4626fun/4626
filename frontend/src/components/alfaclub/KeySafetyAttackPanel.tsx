import { ChevronDown, UserX } from 'lucide-react'
import { useId } from 'react'

import { InfoHint } from '@/components/alfaclub/InfoHint'
import { DEFAULT_DISTRIBUTION_POLICY, type KeyDefenseEvaluation } from '@/lib/alfaclub/keyDefense'
import { cn } from '@/lib/shared/utils'

type AttackBreakdown = {
  minAttackKeys: number
  minAttackKeysCostUsdc: number
  poolFeeAddedUsdc: number
  potSizeUsdc: number
  netDistributableUsdc: number
  attackerNetUsdc: number
}

export type InsiderWorstCase = {
  holderLabel: string | null
  holderKeys: number
  holderSharePercent: number
  /** Already controls ≥ threshold without buying anything. */
  alreadyControls: boolean
  keysToBuy: number
  costUsdc: number
  profitUsdc: number
}

type KeySafetyAttackPanelProps = {
  safetyStatus: 'safe' | 'caution' | 'at-risk'
  evaluation: KeyDefenseEvaluation | null
  minAttackBreakdown: AttackBreakdown | null
  insiderWorstCase: InsiderWorstCase | null
  modeledPotUsdc: number
  attackPotSource?: 'treasury' | 'distribution_fund' | 'fee_baseline'
  potAtRiskUsdc: number
  donationUsdc: number
  onDonationChange: (value: number) => void
  recoveryPercent: number
  formatUsd: (value: number) => string
}

function attackPotSourceLabel(source: KeySafetyAttackPanelProps['attackPotSource']): string {
  switch (source) {
    case 'treasury':
      return 'live trading fund (on-chain + Hyperliquid)'
    case 'distribution_fund':
      return 'snapshot trading fund'
    case 'fee_baseline':
      return 'fee baseline for this tier & supply'
    default:
      return 'fee baseline for this tier & supply'
  }
}

function PrimaryMetric({
  label,
  hint,
  value,
  caption,
  tone,
}: {
  label: string
  hint?: React.ReactNode
  value: string
  caption: string
  tone: 'good' | 'warn' | 'risk' | 'neutral'
}) {
  return (
    <div className="rounded-2xl bg-white/[0.04] p-4">
      <div className="flex items-center gap-1.5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
        {hint ? <InfoHint label={`About ${label}`} content={hint} /> : null}
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tracking-tight',
          tone === 'good' && 'text-emerald-200',
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

export function KeySafetyAttackPanel({
  safetyStatus,
  evaluation,
  minAttackBreakdown,
  insiderWorstCase,
  modeledPotUsdc,
  attackPotSource,
  potAtRiskUsdc,
  donationUsdc,
  onDonationChange,
  recoveryPercent,
  formatUsd,
}: KeySafetyAttackPanelProps) {
  const donationInputId = useId()
  const voteThresholdPercent = Math.round(DEFAULT_DISTRIBUTION_POLICY.voteThresholdFraction * 100)

  return (
    <section className="space-y-4" aria-labelledby="key-safety-attack-heading">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 id="key-safety-attack-heading" className="text-lg font-semibold text-white">
            Hostile takeover scenario
          </h2>
          <InfoHint
            label="How the attack is modeled"
            content={
              <>
                <p>
                  Other holders are treated as <span className="text-white">independent</span> — they
                  do not pool votes with an attacker.
                </p>
                <p>
                  So a lone buyer must mint enough fresh keys to own {voteThresholdPercent}% of the
                  whole supply by themselves, then vote distribute and take their pro-rata share of
                  the net payout (after performance fees and the 10% reserve).
                </p>
              </>
            }
          />
        </div>
        <p className="mt-1 max-w-xl text-sm text-zinc-400">
          A single attacker can&apos;t borrow anyone else&apos;s votes, so they have to buy their way
          to {voteThresholdPercent}% alone — each buy inflates the supply, so it takes far more keys
          than the headline count.
        </p>
      </div>

      <div className="rounded-2xl bg-black/35 p-4">
        <div className="flex items-center gap-1.5">
          <label htmlFor={donationInputId} className="text-sm text-zinc-300">
            What-if donation to the pot
          </label>
          <InfoHint
            label="About the modeled pot"
            content={
              <p>
                The bigger the trading fund, the more a takeover pays. Add a hypothetical donation to
                see how much fund the room can safely hold.
              </p>
            }
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[10rem] flex-1 items-center gap-2">
            <span className="font-mono text-sm text-zinc-500">$</span>
            <input
              id={donationInputId}
              type="number"
              min={0}
              step={50}
              value={donationUsdc}
              onChange={(event) => {
                const next = Number(event.target.value)
                onDonationChange(Number.isFinite(next) ? Math.max(0, next) : 0)
              }}
              className="w-full rounded-xl bg-black/45 px-3 py-2 font-mono text-sm text-zinc-100 ring-1 ring-white/[0.08] outline-none focus:ring-sky-500/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
          <p className="text-sm text-zinc-400">
            Modeled pot:{' '}
            <span className="font-mono font-medium text-zinc-100">{formatUsd(potAtRiskUsdc)}</span>
            {donationUsdc > 0 ? (
              <span className="text-zinc-500"> (trading fund {formatUsd(modeledPotUsdc)} + donation)</span>
            ) : (
              <span className="text-zinc-500"> ({attackPotSourceLabel(attackPotSource)})</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <PrimaryMetric
          label="Keys to buy"
          hint={
            <p>
              Fresh keys a buyer with no existing position must mint to reach {voteThresholdPercent}%
              of the new total supply alone.
            </p>
          }
          value={minAttackBreakdown ? minAttackBreakdown.minAttackKeys.toLocaleString() : '—'}
          caption={`What an outside buyer needs to own ${voteThresholdPercent}% by themselves and force a distribute vote.`}
          tone={safetyStatus === 'at-risk' ? 'risk' : 'warn'}
        />
        <PrimaryMetric
          label="Curve buy cost"
          value={minAttackBreakdown ? formatUsd(minAttackBreakdown.minAttackKeysCostUsdc) : '—'}
          caption="Estimated bonding-curve spend for that buy size."
          tone="neutral"
        />
        <PrimaryMetric
          label="Attacker profit"
          hint={
            <p>
              Payout on the attacker&apos;s keys minus the round-trip trade fees. Positive means the
              takeover nets money after the fund is distributed.
            </p>
          }
          value={
            minAttackBreakdown
              ? `${minAttackBreakdown.attackerNetUsdc >= 0 ? '+' : ''}${formatUsd(minAttackBreakdown.attackerNetUsdc)}`
              : '—'
          }
          caption={
            minAttackBreakdown && minAttackBreakdown.attackerNetUsdc > 0
              ? 'Positive = attack pays off after distribution.'
              : 'Negative = attack loses money at this pot size.'
          }
          tone={minAttackBreakdown && minAttackBreakdown.attackerNetUsdc > 0 ? 'risk' : 'good'}
        />
      </div>

      {insiderWorstCase ? (
        <div
          className={cn(
            'rounded-2xl p-4 ring-1 ring-inset',
            insiderWorstCase.profitUsdc > 0 || insiderWorstCase.alreadyControls
              ? 'bg-red-500/[0.07] ring-red-400/25'
              : 'bg-amber-500/[0.06] ring-amber-400/20',
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-black/30 p-2 text-amber-200 ring-1 ring-white/10">
              <UserX className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-zinc-100">
                  Worst case: the biggest non-owner holder turns hostile
                </p>
                <InfoHint
                  label="About concentration risk"
                  content={
                    <p>
                      The owner is assumed aligned with the room, so this models the largest{' '}
                      <span className="text-zinc-200">other</span> holder. Every key already held
                      cuts the buy requirement by ~2.9, making the most concentrated outside holder
                      the cheapest attacker — a risk even when a fresh takeover looks expensive.
                    </p>
                  }
                />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                {insiderWorstCase.holderLabel ?? 'The largest non-owner holder'} already controls{' '}
                <span className="text-zinc-200">{insiderWorstCase.holderSharePercent}%</span>{' '}
                ({insiderWorstCase.holderKeys.toLocaleString()} keys).{' '}
                {insiderWorstCase.alreadyControls ? (
                  <span className="text-red-200">
                    That is already past {voteThresholdPercent}% — they could trigger a distribute
                    vote without buying anything.
                  </span>
                ) : (
                  <>
                    They would need only{' '}
                    <span className="text-zinc-200">
                      +{insiderWorstCase.keysToBuy.toLocaleString()} keys
                    </span>{' '}
                    ({formatUsd(insiderWorstCase.costUsdc)}) to seize the vote — far less than an
                    outsider.
                  </>
                )}
              </p>
              {!insiderWorstCase.alreadyControls ? (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Their take from a distribution:{' '}
                  <span
                    className={cn(
                      'font-mono',
                      insiderWorstCase.profitUsdc > 0 ? 'text-red-200' : 'text-zinc-300',
                    )}
                  >
                    {insiderWorstCase.profitUsdc >= 0 ? '+' : ''}
                    {formatUsd(insiderWorstCase.profitUsdc)}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <details className="group rounded-2xl bg-black/30">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-zinc-300 [&::-webkit-details-marker]:hidden">
          <span>Full attack breakdown</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="grid gap-3 p-4 pt-0 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Fees to pot</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {minAttackBreakdown ? formatUsd(minAttackBreakdown.poolFeeAddedUsdc) : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pot after buys</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {minAttackBreakdown ? formatUsd(minAttackBreakdown.potSizeUsdc) : '—'}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
              Trading fund + pool fees from attack key buys
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Distribution payout</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {minAttackBreakdown ? formatUsd(minAttackBreakdown.netDistributableUsdc) : '—'}
            </p>
          </div>
          {evaluation ? (
            <>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Vote control</p>
                <p className="mt-1 font-mono text-sm text-zinc-100">
                  {evaluation.hasVeto ? 'Veto held' : `+${evaluation.vetoKeysToBuy.toLocaleString()} keys to veto`}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Veto buy cost</p>
                <p className="mt-1 font-mono text-sm text-zinc-100">
                  {formatUsd(evaluation.vetoKeysToBuyCostUsdc)}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500">Safe pot ceiling</p>
                <p className="mt-1 font-mono text-sm text-zinc-100">
                  {formatUsd(evaluation.maxSafePotUsdc)}
                </p>
              </div>
              {donationUsdc > 0 ? (
                <div className="rounded-xl bg-white/[0.03] p-3 sm:col-span-2 xl:col-span-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Donation recovery</p>
                  <p className="mt-1 font-mono text-sm text-zinc-100">{recoveryPercent}%</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <p className="px-4 pb-3 text-xs leading-relaxed text-zinc-500">
          Worst case: every staked key is hostile and staked &gt;24h. Only keys staked &gt;24h can
          vote or be paid. On distribution, performance fees are paid, 10% stays as a trading
          reserve, and the remaining 90% (≈72% of the fund) is split pro-rata among eligible staked
          keys.
        </p>
      </details>
    </section>
  )
}
