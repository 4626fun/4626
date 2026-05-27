import { ArrowUpRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { AccountScore } from '@/features/accountSetup/types'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'
import { ReferralShareBlock } from './ReferralShareBlock'
import { useMyReferralCode } from './useMyReferralCode'
import { computeProgress } from './waitlistTiers'

type WaitlistUnlocksPanelProps = {
  score: AccountScore | null | undefined
  email?: string | null
  className?: string
}

export function WaitlistUnlocksPanel({
  score,
  email,
  className = '',
}: WaitlistUnlocksPanelProps) {
  const { points } = resolvePublicPointsDisplay({ score: score ?? null })
  const progress = computeProgress(points)
  const referral = useMyReferralCode(email)

  return (
    <div className={`space-y-3.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <Link
          to="/leaderboard"
          className="group inline-flex items-center gap-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-200"
        >
          <span>
            Tier {progress.currentTier.id} · <span className="text-zinc-200">{progress.currentTier.name}</span>
          </span>
          <ArrowUpRight className="h-3 w-3 text-zinc-400 transition-colors group-hover:text-brand-200" aria-hidden="true" />
        </Link>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-xl leading-none text-white tabular-nums">
            {progress.points.toLocaleString()}
          </span>
          <span className="text-[11px] text-zinc-400">{progress.points === 1 ? 'point' : 'points'}</span>
        </div>
      </div>

      {progress.nextTier ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span>{progress.pointsToNext} points to {progress.nextTier.name}</span>
            <span className="tabular-nums">{Math.round(progress.progressPercent)}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-primary/80 transition-[width] duration-500 ease-out"
              style={{ width: `${progress.progressPercent}%` }}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Check className="w-3 h-3" /> Top tier reached.
        </div>
      )}

      {referral.data?.referralCode ? (
        <div className="border-t border-white/[0.05] pt-3">
          <ReferralShareBlock
            referralCode={referral.data.referralCode}
            qualifiedCount={referral.data.referrals.qualifiedCount}
            pendingCount={referral.data.referrals.pendingCount}
          />
        </div>
      ) : null}
    </div>
  )
}
