import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'
import { cn } from '@/lib/shared/utils'

export type EthosScoreValue = {
  score: number | null
  level: string | null
}

type PendingUserkeyScore = {
  resolve: (value: EthosScoreValue | null) => void
  reject: (error: Error) => void
}

const USERKEY_BATCH_DELAY_MS = 12
const pendingUserkeyScores = new Map<string, PendingUserkeyScore[]>()
let userkeyBatchTimer: ReturnType<typeof setTimeout> | null = null

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  return isAddress(value) ? (value.toLowerCase() as `0x${string}`) : null
}

function normalizeEthosUserkey(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null
  if (/[\s<>]/.test(trimmed)) return null
  if (
    trimmed.startsWith('profileId:')
    || trimmed.startsWith('address:')
    || trimmed.startsWith('service:discord:')
    || trimmed.startsWith('service:farcaster:')
    || trimmed.startsWith('service:telegram:')
    || trimmed.startsWith('service:x.com:')
    || trimmed.startsWith('service:x.com:username:')
  ) {
    return trimmed
  }
  return null
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

async function fetchSingleEthosScore(query: string): Promise<EthosScoreValue | null> {
  const res = await apiFetch(`/api/v1/chat/search?q=${encodeURIComponent(query)}`)
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
}

function parseBulkEthosUsers(json: unknown): Map<string, EthosScoreValue | null> {
  const out = new Map<string, EthosScoreValue | null>()
  const obj = json && typeof json === 'object' ? (json as { data?: { users?: unknown } }) : {}
  const users = Array.isArray(obj.data?.users) ? obj.data.users : []
  for (const rawUser of users) {
    const user = rawUser && typeof rawUser === 'object'
      ? rawUser as { userkey?: unknown; ethosScore?: unknown; ethosLevel?: unknown }
      : null
    if (!user) continue
    const userkey = typeof user?.userkey === 'string' ? user.userkey : null
    if (!userkey) continue
    out.set(userkey, {
      score: typeof user.ethosScore === 'number' && Number.isFinite(user.ethosScore) ? user.ethosScore : null,
      level: typeof user.ethosLevel === 'string' ? user.ethosLevel : null,
    })
  }
  return out
}

function flushUserkeyScoreBatch(): void {
  const userkeys = Array.from(pendingUserkeyScores.keys())
  const pending = new Map(pendingUserkeyScores)
  pendingUserkeyScores.clear()
  userkeyBatchTimer = null

  void (async () => {
    try {
      const res = await apiFetch('/api/v1/chat/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userkeys }),
      })
      if (!res.ok) throw new Error('Failed to load ETHOS scores')
      const scores = parseBulkEthosUsers(await res.json())
      for (const userkey of userkeys) {
        const listeners = pending.get(userkey) ?? []
        const value = scores.get(userkey) ?? null
        for (const listener of listeners) listener.resolve(value)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to load ETHOS scores')
      for (const listeners of pending.values()) {
        for (const listener of listeners) listener.reject(err)
      }
    }
  })()
}

function fetchBatchedEthosScoreForUserkey(userkey: string): Promise<EthosScoreValue | null> {
  return new Promise((resolve, reject) => {
    const listeners = pendingUserkeyScores.get(userkey) ?? []
    listeners.push({ resolve, reject })
    pendingUserkeyScores.set(userkey, listeners)
    if (userkeyBatchTimer) return
    userkeyBatchTimer = setTimeout(flushUserkeyScoreBatch, USERKEY_BATCH_DELAY_MS)
  })
}

function EthosMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#00b3ff] text-black shadow-[0_0_10px_rgba(0,179,255,0.45)]',
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="h-2.5 w-2.5" fill="currentColor">
        <path d="M16.035 14.286a2.188 2.188 0 0 0 2.159-2.188 1.698 1.698 0 0 1 .756-1.42 1.705 1.705 0 0 1 2.477.64 1.72 1.72 0 0 1-1.524 2.49 2.188 2.188 0 0 0-2.183 2.326 2.188 2.188 0 0 0 2.184 2.058 1.694 1.694 0 0 1 1.419.756 1.718 1.718 0 0 1-.743 2.526 1.723 1.723 0 0 1-1.341.005 1.727 1.727 0 0 1-1.045-1.577 2.188 2.188 0 0 0-2.2-2.188 2.188 2.188 0 0 0-2.188 2.188 1.7 1.7 0 0 1-.756 1.42 1.706 1.706 0 0 1-2.184-.231 1.71 1.71 0 0 1 1.23-2.897 2.188 2.188 0 0 0 2.18-2.39 2.188 2.188 0 0 0-2.18-1.994 1.707 1.707 0 0 1-.665-.133 1.707 1.707 0 0 1 0-3.153 1.723 1.723 0 0 1 1.33 0 1.7 1.7 0 0 1 1.044 1.576 2.188 2.188 0 0 0 2.23 2.188Z" />
        <path d="M16 32C7.163 32 0 24.837 0 16S7.163 0 16 0s16 7.163 16 16-7.163 16-16 16Zm0-24.574A6.081 6.081 0 0 0 7.792 7.793a6.086 6.086 0 0 0-.37 8.208 6.087 6.087 0 0 0 .293 8.127A6.085 6.085 0 0 0 16 24.575a6.084 6.084 0 0 0 8.27-.43 6.094 6.094 0 0 0 .307-8.147 6.09 6.09 0 0 0-1.038-8.783A6.085 6.085 0 0 0 16 7.425Z" />
      </svg>
    </span>
  )
}

function useEthosScoreQuery(query: string | null | undefined, queryKeyKind: 'address' | 'userkey') {
  const normalized = queryKeyKind === 'address' ? normalizeAddress(query) : normalizeEthosUserkey(query)

  return useQuery({
    queryKey: ['chatEthosScore', queryKeyKind, normalized],
    queryFn: async (): Promise<EthosScoreValue | null> => {
      if (!normalized) return null
      return queryKeyKind === 'userkey'
        ? fetchBatchedEthosScoreForUserkey(normalized)
        : fetchSingleEthosScore(normalized)
    },
    enabled: Boolean(normalized),
    staleTime: 6 * 60 * 60 * 1000,
  })
}

export function useEthosScore(address: string | null | undefined) {
  return useEthosScoreQuery(address, 'address')
}

export function useEthosScoreForUserkey(userkey: string | null | undefined) {
  return useEthosScoreQuery(userkey, 'userkey')
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
        'pointer-events-none inline-flex items-center gap-1 rounded-full border border-brand-primary/35 bg-black/90 py-px pl-1.5 pr-0.5 text-[9px] font-semibold leading-none text-blue-100 shadow-[0_6px_18px_-8px_rgba(0,82,255,0.85)] ring-1 ring-black/80',
        className,
      )}
      title={`ETHOS score ${formatScore(score)}${level ? ` · ${level}` : ''}`}
      aria-label={`ETHOS score ${formatScore(score)}`}
    >
      <span className="min-w-4 text-center tabular-nums">{formatScore(score)}</span>
      <EthosMark />
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

export function EthosAvatarScoreForUserkey({
  userkey,
  className,
}: {
  userkey?: string | null
  className?: string
}) {
  const score = useEthosScoreForUserkey(userkey)
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
