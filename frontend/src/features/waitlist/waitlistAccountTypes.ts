import type { AccountSetupMe } from '@/features/accountSetup/types'

export type WaitlistAccountsSummary = AccountSetupMe

export type WaitlistBootstrapResponse =
  | {
      requiresPrivyAuth: true
      email: string | null
      waitlistEntryId: number | null
    }
  | ({
      requiresPrivyAuth: false
    } & WaitlistAccountsSummary)
