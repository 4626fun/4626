import { useState } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'

import { InfoHint } from '@/components/alfaclub/InfoHint'
import { DEFAULT_DISTRIBUTION_POLICY } from '@/lib/alfaclub/keyDefense'
import { cn } from '@/lib/shared/utils'

export type SunburstHolder = {
  address: string
  label: string | null
  avatarUrl: string | null
  keys: number | null
}

export type KeyOwnershipSunburstProps = {
  keySupply: number
  ownerKeys: number
  ownerStakedKeys: number
  stakedSupply: number
  ownerLabel: string | null
  ownerWalletKeys?: number
  dataSource?: string | null
  /** Known non-owner holders (partial roster from room activity), used by the clickable "Others" rows. */
  othersHolders?: SunburstHolder[]
  /** Simulated extra keys a hostile buyer would acquire (from dragging the bonding curve). */
  takeoverKeys?: number
  /** Clears the simulated takeover. */
  onResetTakeover?: () => void
}

const VOTE_THRESHOLD = DEFAULT_DISTRIBUTION_POLICY.voteThresholdFraction
const VETO_FRACTION = 1 - VOTE_THRESHOLD

type CategoryKey = 'unstakedOwner' | 'stakedOwner' | 'stakedOthers' | 'unstakedOthers'

type Category = {
  key: CategoryKey
  label: string
  /** Short tag shown inside the bar segment. */
  holderShort: string
  staked: boolean
  value: number
  isOthers: boolean
  /** Tailwind background for the bar fill. */
  barClass: string
  /** Tailwind text color for the in-bar number/label. */
  numberClass: string
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function HolderAvatar({ holder }: { holder: SunburstHolder }) {
  const [failed, setFailed] = useState(false)
  const initial = (holder.label?.trim()?.[0] ?? holder.address.slice(2, 3)).toUpperCase()
  if (holder.avatarUrl && !failed) {
    return (
      <img
        src={holder.avatarUrl}
        alt=""
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-semibold text-sky-200 ring-1 ring-white/10"
      aria-hidden
    >
      {initial}
    </span>
  )
}

function OthersHolderList({
  holders,
  others,
  supply,
}: {
  holders: SunburstHolder[]
  others: number
  supply: number
}) {
  if (holders.length === 0) {
    return (
      <p className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-zinc-500 ring-1 ring-white/5">
        No individual holder data yet for this room. We surface holders from on-platform room
        activity — once members chat or trade, they appear here.
      </p>
    )
  }
  const knownKeys = holders.reduce((sum, h) => sum + (h.keys ?? 0), 0)
  const unattributed = Math.max(0, others - knownKeys)
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/5">
      <ul className="max-h-64 divide-y divide-white/5 overflow-y-auto">
        {holders.map((holder) => {
          const keys = holder.keys ?? 0
          const pct = keys > 0 ? Math.round((keys / supply) * 100) : 0
          return (
            <li key={holder.address} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2.5">
                <HolderAvatar holder={holder} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-zinc-200">
                    {holder.label?.trim() || shortAddress(holder.address)}
                  </span>
                  <span className="block truncate font-mono text-[10px] text-zinc-600">
                    {shortAddress(holder.address)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-xs text-zinc-200 tabular-nums">
                  {holder.keys != null ? holder.keys.toLocaleString() : '—'}
                </span>
                <span className="block text-[10px] text-zinc-500">
                  {holder.keys != null ? `${pct}%` : 'keys unknown'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="px-3 py-2 text-[10px] leading-relaxed text-zinc-600">
        Known holders from room activity — may be partial.
        {unattributed > 0
          ? ` ${unattributed.toLocaleString()} of the ${others.toLocaleString()} "Others" keys aren't attributed to a known member yet.`
          : ''}
      </p>
    </div>
  )
}

export function KeyOwnershipSunburst({
  keySupply,
  ownerKeys,
  ownerStakedKeys,
  stakedSupply,
  ownerLabel,
  dataSource,
  othersHolders,
  takeoverKeys = 0,
  onResetTakeover,
}: KeyOwnershipSunburstProps) {
  const [hovered, setHovered] = useState<CategoryKey | null>(null)
  const [othersOpen, setOthersOpen] = useState(false)
  const holders = othersHolders ?? []

  const supply = Math.max(1, Math.floor(keySupply))
  const owner = clamp(Math.floor(ownerKeys), 0, supply)
  const others = supply - owner

  const stakedTotal = clamp(Math.floor(stakedSupply), 0, supply)
  const ownerStaked = clamp(Math.floor(ownerStakedKeys), 0, owner)
  const othersStaked = clamp(stakedTotal - ownerStaked, 0, others)
  const ownerUnstaked = clamp(owner - ownerStaked, 0, owner)
  const othersUnstaked = clamp(others - othersStaked, 0, others)

  const ownerName = ownerLabel?.trim() ? ownerLabel.trim() : 'Owner'
  const ownerSharePercent = Math.round((owner / supply) * 100)
  const stakedPercent = Math.round((stakedTotal / supply) * 100)
  const stakeAttributionGap = owner === 0 && stakedTotal > 0

  // Simulated hostile takeover (driven by dragging the bonding curve).
  const takeover = Math.max(0, Math.floor(takeoverKeys))
  const simulating = takeover > 0
  // The bar's full width represents the simulated supply (current + attacker buys).
  const denom = supply + takeover
  const attackerControlFraction = takeover / denom
  const attackerControlPercent = Math.round(attackerControlFraction * 100)
  const attackerPastVote = attackerControlFraction >= VOTE_THRESHOLD

  // Order: owner block on the left (unstaked then staked), then the two Others
  // sections together on the right — so staked keys form a contiguous bright
  // block in the centre and the owner/others split reads cleanly.
  const categories: Category[] = [
    {
      key: 'unstakedOwner',
      label: 'Unstaked (Owner)',
      holderShort: ownerName,
      staked: false,
      value: ownerUnstaked,
      isOthers: false,
      barClass: 'bg-emerald-400/20',
      numberClass: 'text-emerald-100/80',
    },
    {
      key: 'stakedOwner',
      label: 'Staked (Owner)',
      holderShort: ownerName,
      staked: true,
      value: ownerStaked,
      isOthers: false,
      barClass: 'bg-emerald-400',
      numberClass: 'text-emerald-950',
    },
    {
      key: 'stakedOthers',
      label: 'Staked (Others)',
      holderShort: 'Others',
      staked: true,
      value: othersStaked,
      isOthers: true,
      barClass: 'bg-sky-400',
      numberClass: 'text-sky-950',
    },
    {
      key: 'unstakedOthers',
      label: 'Unstaked (Others)',
      holderShort: 'Others',
      staked: false,
      value: othersUnstaked,
      isOthers: true,
      barClass: 'bg-sky-400/20',
      numberClass: 'text-sky-100/80',
    },
  ]

  const visibleCategories = categories.filter((cat) => cat.value > 0)

  // Geometry for the "staked" bracket drawn under the bar. With the owner block
  // on the left and Others on the right, the staked (votable) keys form one
  // contiguous block in the centre.
  const stakedKeysTotal = ownerStaked + othersStaked
  const stakedRegionStartPct = (ownerUnstaked / denom) * 100
  const stakedRegionWidthPct = (stakedKeysTotal / denom) * 100

  const thresholds = [
    { key: 'veto', fraction: VETO_FRACTION, label: '34% veto' },
    { key: 'distribute', fraction: VOTE_THRESHOLD, label: '66% distribute' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-zinc-200">Who controls this room</p>
          <InfoHint
            label="How to read this"
            content={
              <>
                <p>
                  The bar is the full key supply. The <span className="text-emerald-300">bright</span>{' '}
                  centre is <span className="font-medium text-white">staked</span> — only staked
                  keys (&gt;24h) can vote. The dim ends are unstaked.
                </p>
                <p>
                  <span className="text-emerald-300">Green</span> = {ownerName},{' '}
                  <span className="text-sky-300">blue</span> = everyone else.
                </p>
                <p>
                  The ticks are the <span className="text-zinc-300">34%</span> veto and{' '}
                  <span className="text-amber-200">66%</span> distribute lines (share of supply).
                  Drag the bonding curve below to simulate a hostile buyer and watch the{' '}
                  <span className="text-rose-300">takeover</span> block grow here.
                </p>
              </>
            }
          />
        </div>
        <div className="shrink-0 text-right">
          {simulating ? (
            <>
              <span
                className={cn(
                  'block text-xl font-semibold leading-none tabular-nums',
                  attackerPastVote ? 'text-rose-300' : 'text-zinc-100',
                )}
              >
                {attackerControlPercent}%
              </span>
              <span className="text-[10px] uppercase tracking-wide text-rose-300/80">
                simulated takeover
              </span>
            </>
          ) : (
            <>
              <span className="block text-xl font-semibold leading-none text-white tabular-nums">
                {stakedPercent}%
              </span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                staked · votable
              </span>
            </>
          )}
        </div>
      </div>

      {/* Control bar */}
      <div>
        <div className="relative mb-4 h-0">
          {thresholds.map((t) => (
            <span
              key={`label-${t.key}`}
              className="absolute -top-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium"
              style={{ left: `${t.fraction * 100}%` }}
            >
              <span className={t.key === 'distribute' ? 'text-amber-200' : 'text-zinc-400'}>
                {t.label}
              </span>
            </span>
          ))}
        </div>
        <div
          className="relative h-12 w-full overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/5"
          role="group"
          aria-label={`Key control: ${stakedTotal} of ${supply} keys staked (${stakedPercent}%). ${ownerName} holds ${owner} keys (${ownerSharePercent}%).${
            simulating ? ` Simulating attacker +${takeover} keys (${attackerControlPercent}% of supply).` : ''
          }`}
        >
          <div className="flex h-full w-full">
            {visibleCategories.map((cat) => {
              const pct = (cat.value / denom) * 100
              const dimmed = hovered != null && hovered !== cat.key
              return (
                <button
                  key={cat.key}
                  type="button"
                  style={{ width: `${pct}%` }}
                  onMouseEnter={() => setHovered(cat.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(cat.key)}
                  onBlur={() => setHovered(null)}
                  onClick={cat.isOthers ? () => setOthersOpen((open) => !open) : undefined}
                  className={cn(
                    'relative flex h-full items-center justify-center border-r border-black/30 transition-opacity',
                    cat.barClass,
                    cat.isOthers && 'cursor-pointer',
                    dimmed ? 'opacity-35' : 'opacity-100',
                  )}
                  title={`${cat.label}: ${cat.value.toLocaleString()} (${Math.round((cat.value / supply) * 100)}%)`}
                  aria-label={`${cat.label}: ${cat.value} keys`}
                >
                  {pct >= 7 ? (
                    <span className="flex flex-col items-center leading-none">
                      <span className={cn('font-mono text-xs font-semibold tabular-nums', cat.numberClass)}>
                        {cat.value.toLocaleString()}
                      </span>
                      {pct >= 15 ? (
                        <span
                          className={cn(
                            'mt-0.5 text-[9px] font-medium uppercase tracking-wide',
                            cat.numberClass,
                            cat.staked ? 'opacity-90' : 'opacity-70',
                          )}
                        >
                          {cat.holderShort} · {cat.staked ? 'staked' : 'idle'}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {cat.isOthers ? (
                    <ChevronDown
                      className={cn(
                        'pointer-events-none absolute right-1 top-1 h-3 w-3 text-black/50 transition-transform',
                        othersOpen && 'rotate-180',
                      )}
                      aria-hidden
                    />
                  ) : null}
                </button>
              )
            })}
            {simulating ? (
              <div
                style={{ width: `${(takeover / denom) * 100}%` }}
                className="relative flex h-full items-center justify-center bg-rose-500/85"
                title={`Simulated attacker buys: ${takeover.toLocaleString()} keys`}
              >
                {(takeover / denom) * 100 >= 7 ? (
                  <span className="font-mono text-xs font-semibold tabular-nums text-white">
                    +{takeover.toLocaleString()}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Threshold markers drawn over the bar */}
          <div className="pointer-events-none absolute inset-0">
            {thresholds.map((t) => (
              <span
                key={`tick-${t.key}`}
                className={cn(
                  'absolute top-0 bottom-0 w-px',
                  t.key === 'distribute' ? 'bg-amber-300' : 'bg-white/70',
                )}
                style={{ left: `${t.fraction * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* "Staked = votable" bracket under the contiguous staked block */}
        {stakedKeysTotal > 0 ? (
          <div className="relative mt-1.5 h-5">
            <div
              className="absolute top-0 h-1.5 rounded-b-md border-x border-b border-white/30"
              style={{ left: `${stakedRegionStartPct}%`, width: `${stakedRegionWidthPct}%` }}
            />
            {stakedRegionWidthPct >= 20 ? (
              <span
                className="absolute top-1.5 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium uppercase tracking-wide text-zinc-300"
                style={{ left: `${stakedRegionStartPct + stakedRegionWidthPct / 2}%` }}
              >
                Can vote
              </span>
            ) : null}
          </div>
        ) : null}

        {simulating ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                'leading-relaxed',
                attackerPastVote ? 'text-rose-200' : 'text-zinc-400',
              )}
            >
              Simulating a hostile buyer of{' '}
              <span className="font-medium text-rose-200">+{takeover.toLocaleString()} keys</span> →
              they would hold {attackerControlPercent}% of a {denom.toLocaleString()}-key supply.{' '}
              {attackerPastVote
                ? 'Past the 66% line — enough to force a distribution.'
                : 'Still below the 66% distribute line.'}
            </span>
            {onResetTakeover ? (
              <button
                type="button"
                onClick={onResetTakeover}
                className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.1]"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Reset
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Compact key — the counts live on the bar itself */}
      <p className="text-[11px] leading-relaxed text-zinc-500">
        <span className="font-medium text-emerald-300">Green</span> = {ownerName},{' '}
        <span className="font-medium text-sky-300">blue</span> = others · bright ={' '}
        <span className="text-zinc-300">staked</span>, dim = unstaked.
        {others > 0 ? (
          <>
            {' '}
            <button
              type="button"
              onClick={() => setOthersOpen((open) => !open)}
              aria-expanded={othersOpen}
              className="inline-flex items-center gap-0.5 text-zinc-300 underline decoration-dotted underline-offset-2 hover:text-white"
            >
              {othersOpen ? 'Hide holders' : 'See who holds keys'}
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', othersOpen && 'rotate-180')}
                aria-hidden
              />
            </button>
          </>
        ) : null}
      </p>

      {othersOpen && others > 0 ? (
        <OthersHolderList holders={holders} others={others} supply={supply} />
      ) : null}

      {dataSource ? (
        <p className="text-[11px] text-zinc-600">{dataSource}</p>
      ) : null}

      {stakeAttributionGap ? (
        <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100 ring-1 ring-amber-500/20">
          {stakedTotal.toLocaleString()} keys are staked, but none are attributed to the owner wallet
          onchain.
        </p>
      ) : null}
    </div>
  )
}
