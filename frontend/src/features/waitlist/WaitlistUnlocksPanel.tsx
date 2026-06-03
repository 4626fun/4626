import { useMemo, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { RiTelegram2Fill } from 'react-icons/ri'
import { SiFarcaster, SiX } from 'react-icons/si'

import type { AccountScore } from '@/features/accountSetup/types'
import { getMarketingWaitlistReferralUrl } from '@/lib/auth/waitlistEntry'
import { buildTwitterIntent, buildWarpcastIntent } from '@/components/share/ShareVaultButton'
import { ReferralShareBlock } from './ReferralShareBlock'
import { useMyReferralCode } from './useMyReferralCode'

type WaitlistUnlocksPanelProps = {
  score: AccountScore | null | undefined
  email?: string | null
  className?: string
}

const TELEGRAM_GROUP_URL = 'https://t.me/fun4626'
const DAILY_SHARE_TEXT = 'I just completed my daily 4626 waitlist action. Join me:'
const TELEGRAM_DAILY_PROMPT =
  'Daily 4626 check-in complete. I shared today and invited one friend. #4626'

function openWindow(href: string) {
  try {
    window.open(href, '_blank', 'noopener,noreferrer')
  } catch {
    // ignore popup blockers
  }
}

export function WaitlistUnlocksPanel({
  score: _score,
  email,
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
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        Daily point actions
      </p>

      <div className="space-y-3">
        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">1) Share once daily on X</p>
              <p className="mt-1 text-xs text-zinc-400">
                Post your invite link each day so new users can join through your referral.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openWindow(buildTwitterIntent(shareUrl, DAILY_SHARE_TEXT))}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:text-white"
            >
              <SiX className="h-3 w-3" aria-hidden="true" />
              Share on X
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-100">2) Post once daily on Farcaster</p>
              <p className="mt-1 text-xs text-zinc-400">
                Share your referral link in Farcaster as your daily social action.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openWindow(buildWarpcastIntent(shareUrl, DAILY_SHARE_TEXT))}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:text-white"
            >
              <SiFarcaster className="h-3 w-3" aria-hidden="true" />
              Post on Farcaster
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-100">3) Daily Telegram action</p>
            <p className="text-xs text-zinc-400">
              Join <span className="text-zinc-200">@fun4626</span>, then send one daily check-in message.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={TELEGRAM_GROUP_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:text-white"
            >
              <RiTelegram2Fill className="h-3 w-3" aria-hidden="true" />
              Join @fun4626
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => void copyTelegramPrompt()}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-200 transition-colors hover:border-white/20 hover:text-white"
            >
              {copiedPrompt ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              {copiedPrompt ? 'Prompt copied' : 'Copy daily check-in text'}
            </button>
          </div>
        </div>
      </div>

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
