import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { resolveZoraAvatar, useChatIdentity } from '@/components/chat/useChatIdentity'
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
import { fetchZoraProfile } from '@/lib/zora/client'
import { useSafePrivy } from '@/lib/privy/safeHooks'
import { cn } from '@/lib/shared/utils'

type WaitlistWelcomeGreetingProps = {
  accountMe: AccountSetupMe | null
  /** True until `/api/accounts/me` has settled at least once this session. */
  accountMeLoading?: boolean
  /** External wallet used for returning wallet sign-in (not session cookie / embedded EOA). */
  walletReturnAddress?: string | null
  returningViaWallet?: boolean
  className?: string
}

export function WaitlistWelcomeGreeting(props: WaitlistWelcomeGreetingProps) {
  const privy = useSafePrivy()
  const accountMe = props.accountMe
  // Until the server-confirmed profile has loaded, every other signal here
  // (address-based Zora/basename reverse lookup, email local-part) is a
  // guess that can name a *different* identity than the verified one — e.g.
  // a stale/unrelated Zora account tied to the connected wallet address.
  // Holding off avoids a flash of the wrong handle before the real one loads.
  const accountMeSettled = props.accountMeLoading !== true
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

  const lookupAddress = accountMeSettled
    ? resolveWaitlistIdentityLookupAddress({
        zoraCrossAppAddress: accountMe?.linkedMethods?.zora_cross_app?.[0] ?? null,
        linkedEoaAddress,
        walletReturnAddress: props.walletReturnAddress ?? null,
        cswAddress,
        primaryWalletAddress,
        embeddedEoaAddress,
        returningViaWallet: props.returningViaWallet,
        excludedAddresses,
      })
    : null

  const identity = useChatIdentity(lookupAddress)

  // Fetched by the server-verified handle (not by address) so the avatar
  // always matches the name actually shown — an address-based reverse
  // lookup can resolve to an unrelated Zora account for that wallet.
  const zoraAvatarQuery = useQuery({
    queryKey: ['waitlistWelcomeZoraAvatar', zoraHandle],
    queryFn: () => fetchZoraProfile(zoraHandle as string),
    enabled: accountMeSettled && Boolean(zoraHandle),
    staleTime: 5 * 60_000,
  })
  const [avatarFailed, setAvatarFailed] = useState(false)
  // Reset the "broken image" flag when the handle itself changes, following
  // React's "adjusting state during render" pattern (no effect needed).
  const [avatarFailedForHandle, setAvatarFailedForHandle] = useState(zoraHandle)
  if (avatarFailedForHandle !== zoraHandle) {
    setAvatarFailedForHandle(zoraHandle)
    setAvatarFailed(false)
  }
  const zoraAvatarUrl = zoraHandle && !avatarFailed ? resolveZoraAvatar(zoraAvatarQuery.data ?? undefined) : null

  const welcomeCopy = useMemo(
    () =>
      accountMeSettled
        ? resolveWaitlistWelcomeCopy({
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
          })
        : null,
    [
      accountMeSettled,
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

  const stillResolving = !accountMeSettled || (identity.loading && !welcomeEmail)

  if (!welcomeCopy && stillResolving) {
    return (
      <div className={cn('text-center', props.className)} aria-busy="true">
        <p className="text-sm font-medium text-zinc-500">Welcome…</p>
      </div>
    )
  }

  if (!welcomeCopy) return null

  const monospaceLabel = isWaitlistAddressLabel(welcomeCopy.label)

  return (
    <div className={cn('flex flex-col items-center gap-2', props.className)}>
      <div className="flex items-center justify-center gap-2">
        {zoraAvatarUrl ? (
          <img
            src={zoraAvatarUrl}
            alt=""
            aria-hidden="true"
            width={18}
            height={18}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="size-[18px] shrink-0 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : null}
        <p className="text-sm font-medium leading-snug text-zinc-300 sm:text-[15px]">
          {welcomeCopy.prefix},{' '}
          <span className={monospaceLabel ? 'font-mono text-zinc-100' : 'text-zinc-100'}>
            {welcomeCopy.label}
          </span>
        </p>
      </div>
    </div>
  )
}
