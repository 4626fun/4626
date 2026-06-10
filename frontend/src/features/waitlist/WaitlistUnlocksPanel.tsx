import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'

import type { AccountScore } from '@/features/accountSetup/types'
import { getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'
import { resolvePublicPointsDisplay } from '@/lib/waitlist/canonicalAccountScore'
import { WaitlistDailyActionsHub } from './WaitlistDailyActionsHub'
import { useMyReferralCode } from './useMyReferralCode'

type WaitlistUnlocksPanelProps = {
  score: AccountScore | null | undefined
  email?: string | null
  linkedMethods?: Record<string, string[]>
  busyProvider?: string | null
  onLinkProvider?: (provider: string) => void | Promise<void>
  zoraHandle?: string | null
  canonicalCswAddress?: string | null
  signingStepComplete?: boolean
  className?: string
}

const TELEGRAM_GROUP_URL = 'https://t.me/fun4626'
const TELEGRAM_DAILY_PROMPT =
  'Daily 4626 check-in complete. I shared today and invited one friend. #4626'

export function WaitlistUnlocksPanel({
  score,
  email,
  linkedMethods = {},
  busyProvider = null,
  onLinkProvider,
  zoraHandle = null,
  canonicalCswAddress = null,
  signingStepComplete = false,
  className = '',
}: WaitlistUnlocksPanelProps) {
  const referral = useMyReferralCode(email)
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const shareUrl = useMemo(
    () => getMarketingWaitlistReferralUrl(referral.data?.referralCode ?? null),
    [referral.data?.referralCode],
  )

  const copyTelegramPrompt = async () => {
    try {
      await navigator.clipboard.writeText(TELEGRAM_DAILY_PROMPT)
      setCopiedPrompt(true)
      window.setTimeout(() => setCopiedPrompt(false), 1500)
    } catch {
      // best-effort
    }
  }
  const publicPoints = resolvePublicPointsDisplay({
    score: score ?? null,
    positionTotal: referral.data?.pointsTotal ?? null,
  }).points

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3 px-0.5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-200">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Lottery Points
        </p>
        <div className="inline-flex items-center gap-2 rounded-full bg-black/30 px-2.5 py-1 text-[11px] text-zinc-300">
          <span className="font-semibold tabular-nums text-white">
            {publicPoints.toLocaleString()} pts
          </span>
        </div>
      </div>

      <WaitlistDailyActionsHub
        linkedMethods={linkedMethods}
        busyProvider={busyProvider}
        onLinkProvider={onLinkProvider}
        zoraHandle={zoraHandle}
        canonicalCswAddress={canonicalCswAddress}
        signingStepComplete={signingStepComplete}
        shareUrl={shareUrl}
        telegramGroupUrl={TELEGRAM_GROUP_URL}
        copiedPrompt={copiedPrompt}
        onCopyTelegramPrompt={copyTelegramPrompt}
        referralCode={referral.data?.referralCode ?? null}
        qualifiedCount={referral.data?.referrals.qualifiedCount ?? 0}
        pendingCount={referral.data?.referrals.pendingCount ?? 0}
      />
    </div>
  )
}
