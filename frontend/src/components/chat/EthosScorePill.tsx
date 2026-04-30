import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api/apiBase'
import { cn } from '@/lib/shared/utils'

export type EthosScoreValue = {
  score: number | null
  level: string | null
}

type EthosProfileSummary = EthosScoreValue & {
  userkey: string
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  description: string | null
  profileUrl: string | null
  stats: {
    reviews: {
      positive: number
      neutral: number
      negative: number
      total: number
      positivePct: number | null
    }
    vouches: {
      receivedCount: number
      receivedAmountWeiTotal: string | null
    }
  }
}

type PendingUserkeyScore = {
  resolve: (value: EthosScoreValue | null) => void
  reject: (error: Error) => void
}

const USERKEY_BATCH_DELAY_MS = 12
const pendingUserkeyScores = new Map<string, PendingUserkeyScore[]>()
let userkeyBatchTimer: ReturnType<typeof setTimeout> | null = null
const ETHOS_MARK_SRC =
  'https://cdn.prod.website-files.com/6659e70ed26d2373ff8f8c3d/66a68f3c9c2b3076186315e6_ob-ow-framed-mark-sm.png'

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
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'No Credibility Score'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, useGrouping: false }).format(score)
}

function formatCredibilityScoreLabel(score: number | null | undefined, level?: string | null): string {
  const scoreText = formatScore(score)
  return level ? `Ethos Credibility Score ${scoreText} · ${level}` : `Ethos Credibility Score ${scoreText}`
}

function formatReviewSummary(profile: EthosProfileSummary | null | undefined): string {
  if (!profile) return 'No review data'
  const pct = profile.stats.reviews.positivePct
  const label = pct === null ? '0% positive' : `${pct}% positive`
  return `${label} · ${profile.stats.reviews.total} reviews`
}

function formatVouchSummary(profile: EthosProfileSummary | null | undefined): string {
  const count = profile?.stats.vouches.receivedCount ?? 0
  return `${count.toLocaleString()} voucher${count === 1 ? '' : 's'}`
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

export function fetchEthosScoreForUserkey(userkey: string): Promise<EthosScoreValue | null> {
  return fetchBatchedEthosScoreForUserkey(userkey)
}

function EthosMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-3.5 w-3.5 items-center justify-center overflow-hidden rounded-full bg-[#171a1f]',
        className,
      )}
      aria-hidden="true"
    >
      <img src={ETHOS_MARK_SRC} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
    </span>
  )
}

function clampPopoverLeft(left: number): number {
  if (typeof window === 'undefined') return left
  return Math.max(8, Math.min(left, window.innerWidth - 268))
}

function clampPopoverTop(top: number): number {
  if (typeof window === 'undefined') return top
  return Math.max(8, Math.min(top, window.innerHeight - 230))
}

function getPopoverPositionNearPoint(point: { clientX: number; clientY: number }): { left: number; top: number } {
  return {
    left: clampPopoverLeft(point.clientX + 12),
    top: clampPopoverTop(point.clientY + 14),
  }
}

function useEthosScoreQuery(query: string | null | undefined, queryKeyKind: 'address' | 'userkey') {
  const normalized = queryKeyKind === 'address' ? normalizeAddress(query) : normalizeEthosUserkey(query)

  return useQuery({
    queryKey: ['chatEthosScore', queryKeyKind, normalized],
    queryFn: async (): Promise<EthosScoreValue | null> => {
      if (!normalized) return null
      return queryKeyKind === 'userkey'
        ? fetchEthosScoreForUserkey(normalized)
        : fetchSingleEthosScore(normalized)
    },
    enabled: Boolean(normalized),
    staleTime: 6 * 60 * 60 * 1000,
  })
}

function useEthosProfileSummary(
  query: string | null | undefined,
  queryKeyKind: 'address' | 'userkey',
  enabled: boolean,
) {
  const normalized = queryKeyKind === 'address' ? normalizeAddress(query) : normalizeEthosUserkey(query)

  return useQuery({
    queryKey: ['chatEthosProfileSummary', queryKeyKind, normalized],
    queryFn: async (): Promise<EthosProfileSummary | null> => {
      if (!normalized) return null
      const res = await apiFetch(`/api/v1/chat/search?q=${encodeURIComponent(normalized)}&profile=1`)
      if (!res.ok) throw new Error('Failed to load Ethos profile')
      const json = (await res.json()) as {
        data?: { users?: Array<{ ethosProfile?: EthosProfileSummary | null }> }
      }
      return json.data?.users?.[0]?.ethosProfile ?? null
    },
    enabled: Boolean(enabled && normalized),
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
      title={hasScore ? formatCredibilityScoreLabel(score, level) : 'No Ethos Credibility Score'}
    >
      {formatScore(score)}
      {!compact && level ? <span className="ml-1 hidden text-current/65 xl:inline">{level}</span> : null}
    </span>
  )
}

export function EthosAvatarScoreBadge({
  score,
  level,
  profileQuery,
  profileQueryKind = 'userkey',
  className,
}: {
  score?: number | null
  level?: string | null
  profileQuery?: string | null
  profileQueryKind?: 'address' | 'userkey'
  className?: string
}) {
  const hasScore = typeof score === 'number' && Number.isFinite(score)
  const [hoverIntent, setHoverIntent] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number } | null>(null)
  const badgeRef = useRef<HTMLSpanElement | null>(null)
  const profile = useEthosProfileSummary(profileQuery, profileQueryKind, hoverIntent)
  const profileValue = profile.data ?? null
  if (!hasScore) return null

  const showPopoverNearBadge = () => {
    setHoverIntent(true)
    const rect = badgeRef.current?.getBoundingClientRect()
    if (!rect) return
    setPopoverPosition({
      left: clampPopoverLeft(rect.left),
      top: clampPopoverTop(rect.bottom + 7),
    })
  }

  const showPopoverNearMouse = (point: { clientX: number; clientY: number }) => {
    setHoverIntent(true)
    setPopoverPosition(getPopoverPositionNearPoint(point))
  }

  const hidePopover = () => {
    setPopoverPosition(null)
  }

  return (
    <span
      ref={badgeRef}
      className={cn(
        'group/ethos pointer-events-auto relative inline-flex h-[16px] items-center gap-0.5 rounded-md border border-white/15 bg-[#07080a]/95 py-0 pl-1.5 pr-0.5 text-[9px] font-semibold leading-none text-white shadow-[0_1px_2px_rgba(0,0,0,0.55)]',
        className,
      )}
      title={formatCredibilityScoreLabel(score, level)}
      aria-label={formatCredibilityScoreLabel(score, level)}
      onMouseEnter={showPopoverNearMouse}
      onMouseMove={showPopoverNearMouse}
      onMouseLeave={hidePopover}
      onFocus={showPopoverNearBadge}
      onBlur={hidePopover}
      tabIndex={-1}
    >
      <span className="min-w-[1.6rem] text-center tabular-nums tracking-[-0.02em]">{formatScore(score)}</span>
      <EthosMark />
      {popoverPosition ? (
        <span
          className="pointer-events-none fixed z-[9999] block w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-[#050607] text-left text-white shadow-[0_18px_56px_-18px_rgba(0,0,0,0.95)] ring-1 ring-black/60"
          style={{ left: popoverPosition.left, top: popoverPosition.top }}
          role="tooltip"
        >
          <span className="block p-3">
            <span className="flex items-start gap-3">
              <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/12 bg-white/8">
                {profileValue?.avatarUrl ? (
                  <img src={profileValue.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[11px] text-zinc-500">E</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight text-white">
                  {profileValue?.displayName ?? 'Ethos profile'}
                </span>
                {profileValue?.username ? (
                  <span className="mt-0.5 block truncate text-xs font-normal text-zinc-500">@{profileValue.username}</span>
                ) : null}
                {profileValue?.description ? (
                  <span className="mt-2 line-clamp-2 block text-[11px] font-normal leading-snug text-zinc-300">
                    {profileValue.description}
                  </span>
                ) : null}
              </span>
            </span>
          </span>
          <span className="grid grid-cols-[1fr_auto] items-end gap-3 border-t border-white/10 px-3 py-2.5">
            <span className="space-y-1.5 text-[11px] font-normal leading-tight">
              <span className="block text-zinc-300">{formatReviewSummary(profileValue)}</span>
              <span className="block text-zinc-400">{formatVouchSummary(profileValue)}</span>
            </span>
            <span className="text-right">
              <span className="block font-serif text-[30px] leading-none text-white">{formatScore(score)}</span>
              <span className="mt-0.5 block text-[10px] font-semibold capitalize text-zinc-300">{level ?? 'Neutral'}</span>
            </span>
          </span>
          {profileValue?.profileUrl ? (
            <span className="block border-t border-white/10 px-3 py-2 text-center text-[11px] font-semibold text-white">
              View profile
            </span>
          ) : null}
        </span>
      ) : null}
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
      profileQuery={address}
      profileQueryKind="address"
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
      profileQuery={userkey}
      profileQueryKind="userkey"
      className={className}
    />
  )
}
