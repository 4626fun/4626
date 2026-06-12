export type KeyOwnershipBarProps = {
  keySupply: number
  yourKeys: number
}

/**
 * Visual split of room keys: your share (blue) vs everyone else, with the
 * 50% veto line marked. Holding past the line blocks any distribute vote.
 */
export function KeyOwnershipBar({ keySupply, yourKeys }: KeyOwnershipBarProps) {
  const supply = Math.max(1, keySupply)
  const yours = Math.max(0, Math.min(yourKeys, supply))
  const yourPercent = (yours / supply) * 100
  const pastVeto = yourPercent > 50

  return (
    <div>
      <div className="relative pt-5">
        <div
          className="absolute bottom-0 top-0 z-10 w-px bg-white/50"
          style={{ left: '50%' }}
          aria-hidden
        >
          <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-[10px] uppercase tracking-wide text-zinc-500">
            50% veto
          </span>
        </div>
        <div
          className="flex h-4 w-full overflow-hidden rounded-full bg-white/[0.06]"
          role="img"
          aria-label={`You hold ${yours} of ${supply} keys (${Math.round(yourPercent)}%)`}
        >
          <div
            className={pastVeto ? 'bg-emerald-400/90' : 'bg-sky-500/90'}
            style={{ width: `${yourPercent}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className={pastVeto ? 'text-emerald-400' : 'text-sky-400'}>
          you · {yours.toLocaleString()} ({Math.round(yourPercent)}%)
        </span>
        <span className="text-zinc-500">others · {(supply - yours).toLocaleString()}</span>
      </div>
    </div>
  )
}
