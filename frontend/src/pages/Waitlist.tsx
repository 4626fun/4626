import { ThinWaitlistFlow } from '@/components/waitlist/ThinWaitlistFlow'

/**
 * /waitlist route.
 *
 * After the domain merge, this always renders the full WaitlistFlow
 * (verify step for new users, DoneStep with position/referral for
 * returning users). The old sparse "You're on the waitlist" card and
 * cross-domain redirects have been removed.
 */
export function Waitlist() {
  return <ThinWaitlistFlow variant="page" />
}
