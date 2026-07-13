import { UserX } from 'lucide-react'
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
  breakEvenPotUsdc: number
  fundGrowthToBreakEvenUsdc: number
}

export type AttackExitScenario = 'holders-stay' | 'holders-exit'

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
  reportedTradingFundUsdc: number
  attackPotSource?: 'treasury' | 'distribution_fund' | 'fee_baseline'
  potAtRiskUsdc: number
  donationUsdc: number
  onDonationChange: (value: number) => void
  exitScenario: AttackExitScenario
  onExitScenarioChange: (scenario: AttackExitScenario) => void
  recoveryPercent: number
  formatUsd: (value: number) => string
}

function attackPotSourceLabel(source: KeySafetyAttackPanelProps['attackPotSource']): string {
  switch (source) {
    case 'treasury':
      return 'live treasury NAV · DeBank + Hyperliquid'
    case 'distribution_fund':
      return 'from snapshot'
    case 'fee_baseline':
      return 'fee baseline estimate'
    default:
      return 'fee baseline estimate'
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
  reportedTradingFundUsdc,
  attackPotSource,
  potAtRiskUsdc,
  donationUsdc,
  onDonationChange,
  exitScenario,
  onExitScenarioChange,
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
                  whole supply by themselves, then wait for their stake to become eligible before
                  voting to distribute.
                </p>
                <p>
                  {exitScenario === 'holders-exit'
                    ? 'In this stress test, all original holders unstake and sell before lock. The attacker receives the full net payout, but those earlier sellers drain the expensive upper curve before the attacker can exit.'
                    : 'When holders stay, the attacker receives only their pro-rata share of the net payout after performance fees and the 10% reserve.'}
                </p>
              </>
            }
          />
        </div>
        <p className="mt-1 max-w-xl text-sm text-zinc-400">
          A single attacker can&apos;t borrow anyone else&apos;s votes, so they have to buy their way
          to {voteThresholdPercent}% alone — each buy inflates the supply, so it takes far more keys
          than the headline count.{' '}
          {exitScenario === 'holders-exit'
            ? 'This mode then models every original holder selling before distribution.'
            : null}
        </p>
      </div>

      <div className="rounded-2xl bg-black/35 p-4">
        <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Holder exit scenario">
          <button
            type="button"
            onClick={() => onExitScenarioChange('holders-stay')}
            aria-pressed={exitScenario === 'holders-stay'}
            className={cn(
              'rounded-xl px-3 py-2 text-left text-xs ring-1 ring-inset transition-colors',
              exitScenario === 'holders-stay'
                ? 'bg-sky-500/10 text-sky-100 ring-sky-400/30'
                : 'bg-white/[0.03] text-zinc-400 ring-white/[0.06] hover:bg-white/[0.06]',
            )}
          >
            <span className="block font-medium">Holders stay</span>
            <span className="mt-0.5 block text-[10px] opacity-70">All keys remain payout-eligible</span>
          </button>
          <button
            type="button"
            onClick={() => onExitScenarioChange('holders-exit')}
            aria-pressed={exitScenario === 'holders-exit'}
            className={cn(
              'rounded-xl px-3 py-2 text-left text-xs ring-1 ring-inset transition-colors',
              exitScenario === 'holders-exit'
                ? 'bg-amber-500/10 text-amber-100 ring-amber-400/30'
                : 'bg-white/[0.03] text-zinc-400 ring-white/[0.06] hover:bg-white/[0.06]',
            )}
          >
            <span className="block font-medium">Everyone exits</span>
            <span className="mt-0.5 block text-[10px] opacity-70">Original holders sell before lock</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor={donationInputId} className="text-sm text-zinc-300">
            Test a bigger payout pot
          </label>
          <InfoHint
            label="Why test a bigger fund"
            content={
              <p>
                A bigger payout pot pays a takeover more. Add a what-if amount to see how large the
                available treasury NAV can grow before this selected attack scenario becomes
                profitable.
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
            Modeled payout pot:{' '}
            <span className="font-mono font-medium text-zinc-100">{formatUsd(potAtRiskUsdc)}</span>
            <span className="text-zinc-500">
              {' · '}
              {donationUsdc > 0
                ? `${formatUsd(modeledPotUsdc)} + your what-if`
                : attackPotSourceLabel(attackPotSource)}
            </span>
          </p>
        </div>
        {Math.abs(reportedTradingFundUsdc - modeledPotUsdc) >= 0.01 ? (
          <p className="mt-2 text-xs text-zinc-500">
            AlfaClub reported fund:{' '}
            <span className="font-mono text-zinc-300">{formatUsd(reportedTradingFundUsdc)}</span>.
            Attack payouts use available treasury NAV, which can differ as positions move.
          </p>
        ) : null}
        {minAttackBreakdown ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                Selected scenario break-even fund
              </p>
              <p className="mt-0.5 font-mono text-sm text-zinc-100">
                {formatUsd(minAttackBreakdown.breakEvenPotUsdc)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                Fund growth until profitable
              </p>
              <p className="mt-0.5 font-mono text-sm text-zinc-100">
                {minAttackBreakdown.fundGrowthToBreakEvenUsdc > 0
                  ? `+${formatUsd(minAttackBreakdown.fundGrowthToBreakEvenUsdc)}`
                  : '$0.00 · threshold reached'}
              </p>
            </div>
          </div>
        ) : null}
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
              {exitScenario === 'holders-exit'
                ? 'Full net distribution payout plus the attacker’s final key-sale proceeds, minus their initial curve purchase. One final room key cannot be sold.'
                : 'Payout on the attacker’s keys minus the round-trip trade fees. Positive means the takeover nets money after the fund is distributed.'}
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
          tone="risk"
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

      <div className="rounded-2xl bg-black/30 p-4">
        <h3 className="text-sm font-medium text-zinc-300">Full attack breakdown</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          {exitScenario === 'holders-exit'
            ? 'Exit stress test: the attacker stakes for >24h; every original holder unstakes and sells before lock; the attacker receives the net distributable pool, then sells all but the final unsellable key. Sell order matters because earlier sellers withdraw the upper curve reserve.'
            : 'Worst case: every staked key is hostile and staked >24h. Only keys staked >24h can vote or be paid. On distribution, performance fees are paid, 10% stays as a trading reserve, and the remaining 90% (≈72% of the fund) is split pro-rata among eligible staked keys.'}
        </p>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Payout waterfall
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Fees to pot</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {minAttackBreakdown ? formatUsd(minAttackBreakdown.poolFeeAddedUsdc) : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pot before payout</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {minAttackBreakdown ? formatUsd(minAttackBreakdown.potSizeUsdc) : '—'}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
              {exitScenario === 'holders-exit'
                ? 'Trading fund + pool fees from the attack buy and original-holder exits'
                : 'Trading fund + pool fees from attack key buys'}
            </p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">Distribution payout</p>
            <p className="mt-1 font-mono text-sm text-zinc-100">
              {minAttackBreakdown ? formatUsd(minAttackBreakdown.netDistributableUsdc) : '—'}
            </p>
          </div>
        </div>

        {evaluation ? (
          <>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Vote defense
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
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
                <div className="rounded-xl bg-white/[0.03] p-3 sm:col-span-3">
                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">Donation recovery</p>
                  <p className="mt-1 font-mono text-sm text-zinc-100">{recoveryPercent}%</p>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
