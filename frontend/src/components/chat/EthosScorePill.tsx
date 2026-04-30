import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'
import { cn } from '@/lib/shared/utils'

export type EthosScoreValue = {
  score: number | null
  level: string | null
}

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  return isAddress(value) ? (value.toLowerCase() as `0x${string}`) : null
}

function formatScore(score: number | null | undefined): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'No score'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score)
}

function scoreTone(score: number | null | undefined): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'border-white/10 bg-white/[0.04] text-zinc-500'
  if (score >= 1800) return 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
  if (score >= 1200) return 'border-brand-primary/25 bg-brand-primary/10 text-blue-200'
  if (score >= 700) return 'border-amber-300/25 bg-amber-400/10 text-amber-200'
  return 'border-white/10 bg-white/[0.04] text-zinc-400'
}

export function useEthosScore(address: string | null | undefined) {
  const normalized = normalizeAddress(address)

  return useQuery({
    queryKey: ['chatEthosScore', normalized],
    queryFn: async (): Promise<EthosScoreValue | null> => {
      if (!normalized) return null
      const res = await apiFetch(`/api/v1/chat/search?q=${encodeURIComponent(normalized)}`)
      if (!res.ok) throw new Error('Failed to load ETHOS score')
      const json = (await res.json()) as {
        success?: boolean
        data?: { users?: Array<{ ethosScore?: number | null; ethosLevel?: string | null }> }
      }
      const user = json.data?.users?.[0] ?? null
      if (!user) return null
      return {
        score: typeof user.ethosScore === 'number' && Number.isFinite(user.ethosScore) ? user.ethosScore : null,
        level: user.ethosLevel ?? null,
      }
    },
    enabled: Boolean(normalized),
    staleTime: 6 * 60 * 60 * 1000,
  })
}

export function EthosScorePill({
  score,
  level,
  compact = false,
  className,
  hideWhenMissing = false,
}: {
  score?: number | null
  level?: string | null
  compact?: boolean
  className?: string
  hideWhenMissing?: boolean
}) {
  const hasScore = typeof score === 'number' && Number.isFinite(score)
  if (hideWhenMissing && !hasScore) return null

  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums',
        scoreTone(score),
        className,
      )}
      title={hasScore ? `ETHOS score ${formatScore(score)}` : 'No ETHOS score'}
    >
      {formatScore(score)}
      {!compact && level ? <span className="ml-1 hidden text-current/65 xl:inline">{level}</span> : null}
    </span>
  )
}

export function EthosAvatarScoreBadge({
  score,
  level,
  className,
}: {
  score?: number | null
  level?: string | null
  className?: string
}) {
  const hasScore = typeof score === 'number' && Number.isFinite(score)
  if (!hasScore) return null

  return (
    <span
      className={cn(
        'pointer-events-none inline-flex min-w-8 items-center justify-center rounded-full border border-brand-primary/35 bg-black/90 px-1.5 py-px text-[9px] font-semibold leading-none text-blue-100 shadow-[0_6px_18px_-8px_rgba(0,82,255,0.85)] ring-1 ring-black/80',
        className,
      )}
      title={`ETHOS score ${formatScore(score)}${level ? ` · ${level}` : ''}`}
      aria-label={`ETHOS score ${formatScore(score)}`}
    >
      {formatScore(score)}
    </span>
  )
}

export function EthosScoreForAddress({
  address,
  compact = true,
  className,
}: {
  address?: string | null
  compact?: boolean
  className?: string
}) {
  const score = useEthosScore(address)
  const value = score.data

  if (!value || value.score === null) return null

  return (
    <EthosScorePill
      score={value.score}
      level={value.level}
      compact={compact}
      hideWhenMissing
      className={className}
    />
  )
}

export function EthosAvatarScoreForAddress({
  address,
  className,
}: {
  address?: string | null
  className?: string
}) {
  const score = useEthosScore(address)
  const value = score.data

  if (!value || value.score === null) return null

  return (
    <EthosAvatarScoreBadge
      score={value.score}
      level={value.level}
      className={className}
    />
  )
}
