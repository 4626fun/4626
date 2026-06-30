import { DEFAULT_DISTRIBUTION_POLICY } from '@/lib/alfaclub/keyDefense'
import { cn } from '@/lib/shared/utils'

export type KeyOwnershipBarProps = {
  keySupply: number
  yourKeys: number
}

const VOTE_THRESHOLD = DEFAULT_DISTRIBUTION_POLICY.voteThresholdFraction
const VETO_HOLD_PERCENT = (1 - VOTE_THRESHOLD) * 100
const DISTRIBUTE_VOTE_PERCENT = VOTE_THRESHOLD * 100

export function KeyOwnershipBar({ keySupply, yourKeys }: KeyOwnershipBarProps) {
  const supply = Math.max(1, keySupply)
  const yours = Math.max(0, Math.min(yourKeys, supply))
  const yourPercent = (yours / supply) * 100
  const pastVeto = yours > (1 - VOTE_THRESHOLD) * supply
  const keysToDistributeBlock = Math.max(0, Math.ceil(VOTE_THRESHOLD * supply) - yours)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-200">Key ownership vs vote thresholds</p>
        <p className="text-xs text-zinc-500">
          {pastVeto
            ? 'You hold veto (>34%) — hostile buyers cannot force a distribute vote alone.'
            : keysToDistributeBlock > 0
              ? `You are ${keysToDistributeBlock} key${keysToDistributeBlock === 1 ? '' : 's'} short of ${Math.round(DISTRIBUTE_VOTE_PERCENT)}% ownership.`
              : 'At or above the distribute threshold.'}
        </p>
      </div>

      <div
        className="flex h-5 w-full overflow-hidden rounded-full bg-white/[0.06]"
        role="img"
        aria-label={`You hold ${yours} of ${supply} keys (${Math.round(yourPercent)}%)`}
      >
        <div
          className={cn('transition-[width]', pastVeto ? 'bg-emerald-400/90' : 'bg-sky-500/90')}
          style={{ width: `${yourPercent}%` }}
        />
      </div>

      <div className="relative mt-3 h-8">
        <div
          className="absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${VETO_HOLD_PERCENT}%` }}
          aria-hidden
        >
          <span className="h-3 w-px bg-white/40" />
          <span className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-wide text-zinc-500">
            {Math.round(VETO_HOLD_PERCENT)}% veto
          </span>
        </div>
        <div
          className="absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${DISTRIBUTE_VOTE_PERCENT}%` }}
          aria-hidden
        >
          <span className="h-3 w-px bg-amber-400/70" />
          <span className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-wide text-amber-200/90">
            {Math.round(DISTRIBUTE_VOTE_PERCENT)}% distribute
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={pastVeto ? 'text-emerald-400' : 'text-sky-400'}>
          You · {yours.toLocaleString()} ({Math.round(yourPercent)}%)
        </span>
        <span className="text-zinc-500">Others · {(supply - yours).toLocaleString()}</span>
      </div>
    </div>
  )
}
