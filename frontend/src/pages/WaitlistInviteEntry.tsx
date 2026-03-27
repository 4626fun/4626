import { Navigate, useParams } from 'react-router-dom'

import {
  buildCanonicalMarketingWaitlistUrl,
  buildWaitlistReferralUrl,
  normalizeWaitlistReferralCode,
  requestStoredWaitlistAuthAutoStart,
  storeWaitlistReferralCode,
  writeStoredWaitlistAuthArmed,
} from '@/lib/auth/waitlistEntry'
import { getHostMode, getMarketingBaseUrl } from '@/lib/host'

export function WaitlistInviteEntry() {
  const { referralCode } = useParams<{ referralCode?: string }>()
  const normalizedReferralCode = normalizeWaitlistReferralCode(referralCode)
  const hostMode = getHostMode()

  if (hostMode === 'app') {
    if (typeof window !== 'undefined') {
      const target = normalizedReferralCode
        ? buildWaitlistReferralUrl(getMarketingBaseUrl(), normalizedReferralCode)
        : buildCanonicalMarketingWaitlistUrl(getMarketingBaseUrl())
      window.location.replace(target)
    }
    return null
  }

  if (normalizedReferralCode) {
    storeWaitlistReferralCode(normalizedReferralCode)
    writeStoredWaitlistAuthArmed(true)
    requestStoredWaitlistAuthAutoStart()
  }

  return <Navigate to="/" replace />
}
