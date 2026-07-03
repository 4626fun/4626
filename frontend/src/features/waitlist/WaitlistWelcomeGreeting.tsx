import { useMemo } from 'react'
import { isAddress } from 'viem'

import { useChatIdentity } from '@/components/chat/useChatIdentity'
import type { AccountSetupMe } from '@/features/accountSetup/types'
import {
  isWaitlistAddressLabel,
  resolveWaitlistWelcomeCopy,
} from '@/features/waitlist/waitlistWelcomeIdentity'
import { cn } from '@/lib/shared/utils'

type WaitlistWelcomeGreetingProps = {
  accountMe: AccountSetupMe | null
  sessionAddress: string | null
  linkedEoaAddress?: string | null
  returningViaWallet?: boolean
  className?: string
}

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  if (!value || !isAddress(value)) return null
  return value as `0x${string}`
}

export function WaitlistWelcomeGreeting(props: WaitlistWelcomeGreetingProps) {
  const cswAddress = props.accountMe?.accountSignals?.canonicalCswAddress ?? null
  const zoraHandle = props.accountMe?.accountSignals?.zoraHandle ?? null
  const resolveAddress =
    normalizeAddress(cswAddress) ??
    normalizeAddress(props.linkedEoaAddress) ??
    normalizeAddress(props.sessionAddress)

  const identity = useChatIdentity(resolveAddress)

  const welcomeCopy = useMemo(
    () =>
      resolveWaitlistWelcomeCopy({
        zoraHandle,
        identityDisplayName: identity.displayName,
        identitySource: identity.source,
        linkedEoaAddress: props.linkedEoaAddress,
        cswAddress,
        sessionAddress: props.sessionAddress,
        returningViaWallet: props.returningViaWallet,
      }),
    [
      cswAddress,
      identity.displayName,
      identity.source,
      props.linkedEoaAddress,
      props.returningViaWallet,
      props.sessionAddress,
      zoraHandle,
    ],
  )

  if (!welcomeCopy && identity.loading) {
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
