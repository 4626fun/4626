import { Gift, Sparkles } from 'lucide-react'

import { useReferrerByCode } from './useReferrerByCode'

type ReferrerGreetingBannerProps = {
  /** Stored referral code (from sessionStorage / route). Pass null to hide. */
  referralCode: string | null | undefined
  className?: string
}

/**
 * Small banner shown above the waitlist auth step when the user arrived via
 * a referral link. Looks up the referrer's public display name via the
 * rate-limited `/api/waitlist/referrer` endpoint and renders a personalized
 * "Invited by {display}" greeting so the referral link doesn't feel
 * anonymous.
 *
 * Intentionally fails soft: if the code is empty, invalid, unknown, or the
 * lookup errors, the banner simply doesn't render and the page falls back
 * to its generic copy.
 */
export function ReferrerGreetingBanner({ referralCode, className = '' }: ReferrerGreetingBannerProps) {
  const query = useReferrerByCode(referralCode)
  const referrer = query.data

  if (!referralCode || !referrer) return null

  return (
    <div
      className={`rounded-xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/10 via-black/40 to-black/40 px-4 py-3 ${className}`}
      role="region"
      aria-label="Referral greeting"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary/15 text-brand-300">
          <Gift className="w-3.5 h-3.5" />
        </span>
        <div className="text-xs text-zinc-200 leading-tight">
          <span className="text-zinc-400">Invited by</span>{' '}
          <span className="font-mono text-white" title={referrer.display}>
            {referrer.display}
          </span>
          {referrer.rank !== null ? (
            <span className="ml-1 text-zinc-400">
              · rank #{referrer.rank.toLocaleString()}
            </span>
          ) : null}
        </div>
        <div className="ml-auto inline-flex items-center gap-1 text-[11px] text-brand-300">
          <Sparkles className="w-3 h-3" />
          <span>They get points when you join</span>
        </div>
      </div>
    </div>
  )
}
