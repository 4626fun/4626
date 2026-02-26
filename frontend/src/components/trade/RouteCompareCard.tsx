import { GitCompareArrows, Loader2 } from 'lucide-react'

type RouteCompareCardProps = {
  enabled: boolean
  loading: boolean
  available: boolean
  reason?: string | null
  chainName?: string | null
  chainId?: number | null
  uniswapOutUnits: string
  zquoteOutUnits: string
  tokenOutSymbol: string
}

function parsePositiveNumber(value: string): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

function formatPct(deltaPct: number): string {
  const sign = deltaPct >= 0 ? '+' : ''
  return `${sign}${deltaPct.toFixed(2)}%`
}

export function RouteCompareCard(props: RouteCompareCardProps) {
  if (!props.enabled) return null
  const networkLabel = props.chainName?.trim()
    ? props.chainId
      ? `${props.chainName} (${props.chainId})`
      : props.chainName
    : props.chainId
      ? `Chain ${props.chainId}`
      : 'Base'

  const uni = parsePositiveNumber(props.uniswapOutUnits)
  const zq = parsePositiveNumber(props.zquoteOutUnits)
  const hasComparableQuotes = Boolean(uni && zq && uni! > 0 && zq! > 0)
  const deltaPct = hasComparableQuotes ? ((zq! - uni!) / uni!) * 100 : null

  let winnerLabel = '—'
  let winnerTone = 'text-zinc-500'
  if (hasComparableQuotes && deltaPct !== null) {
    if (Math.abs(deltaPct) < 0.01) {
      winnerLabel = 'Tie'
      winnerTone = 'text-zinc-300'
    } else if (deltaPct > 0) {
      winnerLabel = 'zQuoter'
      winnerTone = 'text-emerald-400'
    } else {
      winnerLabel = 'Uniswap'
      winnerTone = 'text-emerald-400'
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-vault-card/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
            <GitCompareArrows className="h-3.5 w-3.5" />
            Route compare
          </div>
          <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            {networkLabel}
          </span>
        </div>
        {props.loading ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating…
          </span>
        ) : (
          <span className={`text-[11px] font-medium ${winnerTone}`}>{winnerLabel}</span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/8 bg-white/3 px-2.5 py-2">
          <div className="text-[10px] font-medium text-zinc-500">Uniswap</div>
          <div className="mt-1 text-sm font-medium tabular-nums text-white">
            {uni ? uni.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '--'} {props.tokenOutSymbol}
          </div>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/3 px-2.5 py-2">
          <div className="text-[10px] font-medium text-zinc-500">zQuoter</div>
          <div className="mt-1 text-sm font-medium tabular-nums text-white">
            {!props.available
              ? '--'
              : zq
                ? zq.toLocaleString(undefined, { maximumFractionDigits: 6 })
                : '--'}{' '}
            {props.tokenOutSymbol}
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-zinc-600">
        {!props.available
          ? `Unavailable on Base${props.reason ? `: ${props.reason}` : ''}`
          : !hasComparableQuotes || deltaPct === null
            ? 'Waiting for both quotes to compare.'
            : `zQuoter vs Uniswap: ${formatPct(deltaPct)} output`}
      </div>
    </div>
  )
}
