import { ThinWaitlistFlow } from '@/components/waitlist/ThinWaitlistFlow'

/**
 * /waitlist route.
 *
 * The canonical waitlist surface is now the thin email-first flow:
 * email required, background auth, optional Zora, then accounts/app
 * continuation. Legacy heavier waitlist flows remain isolated elsewhere.
 */
export function Waitlist() {
  return <ThinWaitlistFlow variant="page" />
}
