import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'

import { apiFetch } from '@/lib/apiBase'
import {
  WAITLIST_REFERRAL_CLICK_SESSION_KEY,
  storeWaitlistReferralCode,
} from '@/lib/auth/waitlistEntry'

function buildReferralClickSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wl-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

export function PublicWaitlistOverview(props: {
  referralCode: string | null
  onContinueWithEmail: () => void
  primaryButtonClassName: string
}) {
  const { referralCode, onContinueWithEmail, primaryButtonClassName } = props

  useEffect(() => {
    storeWaitlistReferralCode(referralCode)
  }, [referralCode])

  useEffect(() => {
    if (!referralCode || typeof window === 'undefined') return

    let sessionId = ''
    try {
      sessionId = String(window.sessionStorage.getItem(WAITLIST_REFERRAL_CLICK_SESSION_KEY) ?? '').trim()
      if (!sessionId) {
        sessionId = buildReferralClickSessionId()
        window.sessionStorage.setItem(WAITLIST_REFERRAL_CLICK_SESSION_KEY, sessionId)
      }
    } catch {
      sessionId = buildReferralClickSessionId()
    }

    void apiFetch('/api/referrals/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        referralCode,
        sessionId,
        landingUrl: window.location.href,
      }),
    }).catch(() => null)
  }, [referralCode])

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl border border-white/10 bg-black/30 p-5 sm:p-6">
      <div className="flex h-full flex-col gap-5">
        <div className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">Sign up</div>
          <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">Join the 4626 waitlist</h3>
          <p className="max-w-lg text-sm text-zinc-300 sm:text-[15px]">
            Sign up for the waitlist by verifying your email address.
          </p>
        </div>

        <button
          type="button"
          onClick={onContinueWithEmail}
          className={`${primaryButtonClassName} w-full whitespace-nowrap justify-center sm:min-w-[288px]`}
        >
          Continue with email
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
