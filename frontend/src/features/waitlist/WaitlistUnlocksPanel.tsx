import { Check, Sparkles, TrendingUp } from 'lucide-react'

import type { AccountScore } from '@/features/accountSetup/types'
import { ReferralShareBlock } from './ReferralShareBlock'
import { useMyReferralCode } from './useMyReferralCode'
import {
  POINT_SUGGESTIONS,
  WAITLIST_TIERS,
  computeProgress,
  type WaitlistTier,
} from './waitlistTiers'

type WaitlistUnlocksPanelProps = {
  score: AccountScore | null | undefined
  email?: string | null
  className?: string
}

function TierRow({
  tier,
  state,
}: {
  tier: WaitlistTier
  state: 'achieved' | 'current' | 'locked'
}) {
  const ringClass =
    state === 'current'
      ? 'border-brand-primary/40 bg-brand-primary/10'
      : state === 'achieved'
        ? 'border-emerald-400/20 bg-emerald-400/5'
        : 'border-white/10 bg-black/20'
  const markerClass =
    state === 'current'
      ? 'bg-brand-primary text-black'
      : state === 'achieved'
        ? 'bg-emerald-400/20 text-emerald-300'
        : 'bg-white/10 text-zinc-500'
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${ringClass}`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-semibold ${markerClass}`}
        >
          {state === 'achieved' ? <Check className="w-3 h-3" /> : tier.id}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white truncate">{tier.name}</div>
          <div className="text-[11px] text-zinc-500 truncate">{tier.tagline}</div>
        </div>
        <div className="shrink-0 text-[10px] tabular-nums text-zinc-500">
          {tier.pointsRequired === 0 ? 'start' : `${tier.pointsRequired} pts`}
        </div>
      </div>
      {state !== 'locked' ? (
        <ul className="mt-1.5 ml-7 space-y-0.5">
          {tier.highlights.map((highlight) => (
            <li key={highlight} className="text-[11px] text-zinc-400 flex items-start gap-1.5">
              <Check className="w-3 h-3 mt-0.5 text-emerald-400/80 shrink-0" />
              <span className="truncate">{highlight}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function WaitlistUnlocksPanel({ score, email, className = '' }: WaitlistUnlocksPanelProps) {
  const points = typeof score?.points === 'number' ? score.points : 0
  const progress = computeProgress(points)
  const referral = useMyReferralCode(email)

  return (
    <div className={`rounded-xl border border-white/10 bg-black/25 p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="bv-kicker text-brand-300 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" /> Your progress
          </div>
          <div className="mt-1 text-sm text-zinc-200">
            <span className="font-display text-lg text-white">{progress.points.toLocaleString()}</span>
            <span className="text-zinc-500 text-xs ml-1">
              {progress.points === 1 ? 'point' : 'points'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Tier</div>
          <div className="text-sm text-white">
            {progress.currentTier.id} · {progress.currentTier.name}
          </div>
        </div>
      </div>

      {progress.nextTier ? (
        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
            <span>Next: {progress.nextTier.name}</span>
            <span className="tabular-nums">{progress.pointsToNext} pts to go</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full bg-brand-primary/70 transition-all"
              style={{ width: `${progress.progressPercent}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" /> Top tier reached — thank you.
        </div>
      )}

      <div className="space-y-1.5">
        {WAITLIST_TIERS.map((tier) => {
          const state: 'achieved' | 'current' | 'locked' =
            tier.id < progress.currentTier.id
              ? 'achieved'
              : tier.id === progress.currentTier.id
                ? 'current'
                : 'locked'
          return <TierRow key={tier.id} tier={tier} state={state} />
        })}
      </div>

      {progress.nextTier ? (
        <div className="pt-2 border-t border-white/5">
          <div className="bv-kicker text-zinc-400 mb-1.5">Earn more points</div>
          <ul className="space-y-1">
            {POINT_SUGGESTIONS.slice(0, 4).map((suggestion) => (
              <li
                key={suggestion.label}
                className="flex items-center justify-between gap-3 text-[11px]"
              >
                <span className="text-zinc-300 truncate">{suggestion.label}</span>
                <span className="shrink-0 tabular-nums text-zinc-500">
                  +{suggestion.points}
                  {suggestion.hint ? (
                    <span className="ml-1 text-zinc-600">· {suggestion.hint}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {referral.data?.referralCode ? (
        <ReferralShareBlock
          referralCode={referral.data.referralCode}
          qualifiedCount={referral.data.referrals.qualifiedCount}
          pendingCount={referral.data.referrals.pendingCount}
        />
      ) : null}
    </div>
  )
}
