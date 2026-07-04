import { useMemo } from 'react'

import { useChatIdentity } from '@/components/chat/useChatIdentity'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import {
  buildWaitlistExcludedSignerAddresses,
  isWaitlistAddressLabel,
  resolvePrivyEmbeddedEoaAddress,
  resolveWaitlistIdentityLookupAddress,
  resolveWaitlistWelcomeCopy,
  sanitizeWaitlistZoraHandle,
} from '@/features/waitlist/waitlistWelcomeIdentity'
import { resolveWaitlistPrivyDisplayEmail, resolveWaitlistVerifiedEmailHint } from '@/features/waitlist/waitlistStorage'
import { useSafePrivy } from '@/lib/privy/safeHooks'
import { cn } from '@/lib/shared/utils'

type WaitlistWelcomeGreetingProps = {
  accountMe: AccountSetupMe | null
  /** External wallet used for returning wallet sign-in (not session cookie / embedded EOA). */
  walletReturnAddress?: string | null
  returningViaWallet?: boolean
  className?: string
}

export function WaitlistWelcomeGreeting(props: WaitlistWelcomeGreetingProps) {
  const privy = useSafePrivy()
  const accountMe = props.accountMe
  const linkedEoaAddress = accountMe?.linkedMethods?.external_eoa?.[0] ?? null
  const cswAddress = accountMe?.accountSignals?.canonicalCswAddress ?? null
  const zoraHandle = sanitizeWaitlistZoraHandle(accountMe?.accountSignals?.zoraHandle)
  const basename = accountMe?.accountSignals?.basename ?? null
  const primaryWalletAddress = accountMe?.accountSignals?.primaryWalletAddress ?? null
  const embeddedEoaAddress = accountMe?.accountSignals?.embeddedEoaAddress ?? null
  const welcomeEmail =
    accountMe?.email?.trim().toLowerCase() ??
    resolveWaitlistPrivyDisplayEmail(privy.user)?.trim().toLowerCase() ??
    resolveWaitlistVerifiedEmailHint(privy.user)?.trim().toLowerCase() ??
    null

  const excludedAddresses = useMemo(
    () =>
      buildWaitlistExcludedSignerAddresses({
        privyEmbeddedEoaAddress: resolvePrivyEmbeddedEoaAddress(privy.user, cswAddress),
      }),
    [cswAddress, privy.user],
  )

  const lookupAddress = resolveWaitlistIdentityLookupAddress({
    zoraCrossAppAddress: accountMe?.linkedMethods?.zora_cross_app?.[0] ?? null,
    linkedEoaAddress,
    walletReturnAddress: props.walletReturnAddress ?? null,
    cswAddress,
    primaryWalletAddress,
    embeddedEoaAddress,
    returningViaWallet: props.returningViaWallet,
    excludedAddresses,
  })

  const identity = useChatIdentity(lookupAddress)

  const welcomeCopy = useMemo(
    () =>
      resolveWaitlistWelcomeCopy({
        zoraHandle,
        basename,
        identityDisplayName: identity.displayName,
        identitySource: identity.source,
        linkedEoaAddress,
        cswAddress,
        walletReturnAddress: props.walletReturnAddress ?? null,
        returningViaWallet: props.returningViaWallet,
        email: welcomeEmail,
        excludedAddresses,
        primaryWalletAddress,
        embeddedEoaAddress,
      }),
    [
      basename,
      cswAddress,
      embeddedEoaAddress,
      excludedAddresses,
      identity.displayName,
      identity.source,
      linkedEoaAddress,
      primaryWalletAddress,
      props.returningViaWallet,
      props.walletReturnAddress,
      welcomeEmail,
      zoraHandle,
    ],
  )

  if (!welcomeCopy && identity.loading && !welcomeEmail) {
    return (
      <div className={cn('text-center', props.className)} aria-busy="true">
        <p className="text-sm font-medium text-zinc-500">Welcome…</p>
      </div>
    )
  }

  if (!welcomeCopy) return null

  const monospaceLabel = isWaitlistAddressLabel(welcomeCopy.label)

  return (
    <div className={cn('text-center', props.className)}>
      <p className="text-sm font-medium leading-snug text-zinc-300 sm:text-[15px]">
        {welcomeCopy.prefix},{' '}
        <span className={monospaceLabel ? 'font-mono text-zinc-100' : 'text-zinc-100'}>
          {welcomeCopy.label}
        </span>
      </p>
    </div>
  )
}
