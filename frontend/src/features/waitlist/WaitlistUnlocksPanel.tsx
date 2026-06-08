import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'

import type { AccountScore } from '@/features/accountSetup/types'
import { getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'
import { WaitlistDailyActionsHub } from './WaitlistDailyActionsHub'
import { useMyReferralCode } from './useMyReferralCode'

type WaitlistUnlocksPanelProps = {
  score: AccountScore | null | undefined
  email?: string | null
  linkedMethods?: Record<string, string[]>
  busyProvider?: string | null
  onLinkProvider?: (provider: string) => void | Promise<void>
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

  return (
    <div className={`space-y-4 ${className}`}>
      <section className="rounded-xl border border-brand-primary/20 bg-brand-primary/[0.08] px-3.5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-200">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Daily
            </p>
            <p className="mt-1 text-xs text-zinc-300">Connect → action → reward.</p>
          </div>
          <div className="shrink-0 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Current</p>
            <p className="text-sm font-semibold text-white tabular-nums">
              {(score?.points ?? 0).toLocaleString()} pts
            </p>
            <p className="text-[10px] text-zinc-400">Tier {score?.tier ?? 0}</p>
          </div>
        </div>
      </section>

      <WaitlistDailyActionsHub
        linkedMethods={linkedMethods}
        busyProvider={busyProvider}
        onLinkProvider={onLinkProvider}
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
