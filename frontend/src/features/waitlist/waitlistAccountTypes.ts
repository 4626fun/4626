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

export function getSubAccountCompletionAccountKey(
  account: Pick<WaitlistAccountsSummary, 'privyUserId' | 'email'> | null,
): string | null {
  const privyUserId = account?.privyUserId?.trim()
  if (privyUserId) return `privy:${privyUserId}`
  const email = account?.email?.trim().toLowerCase()
  if (email) return `email:${email}`
  return null
}
