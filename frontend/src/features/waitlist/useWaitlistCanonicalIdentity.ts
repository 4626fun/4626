import { useMemo } from 'react'
import { isAddress, type Address } from 'viem'

import type { AccountSetupMe } from '@/features/accountSetup/types'
import type { CanonicalIdentity } from '@/hooks/useCanonicalIdentity'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import { deriveAccountChromeExecution } from '@/lib/wallet/userExecutionTrack'
import { useEmbeddedOwnerOnCsw } from './useEmbeddedOwnerOnCsw'

function toAddressOrNull(value: string | null | undefined): Address | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return isAddress(trimmed) ? (trimmed as Address) : null
}

/**
 * Wagmi-free counterpart to `useCanonicalIdentity()` for the waitlist route.
 *
 * `/waitlist` deliberately has no `WagmiProvider` — see the "keep this module
 * wagmi-free" comment in `AppQueryProvider.tsx` and the extension-collision
 * comments in `lib/privy/client.tsx`. `useCanonicalIdentity()` reads an
 * external EOA via wagmi's `useAccount()`, which would require mounting
 * wagmi connectors on this route and reopening that already-fixed bug class.
 *
 * This hook builds the same `CanonicalIdentity` shape from data waitlist
 * already has without wagmi: `/api/accounts/me` (`accountSignals`), the
 * Privy embedded wallet, and the caller's own linked-external-wallet state
 * (`accountMe.linkedMethods.external_eoa`). It composes the exact same
 * wagmi-free building blocks `WaitlistPostJoinShell` already uses
 * (`useEnsurePrivyEmbeddedWallet`, `useEmbeddedOwnerOnCsw`).
 *
 * Keep this in shape-parity with `useCanonicalIdentity` for equivalent
 * inputs — see `useWaitlistCanonicalIdentity.test.ts`.
 */
export function useWaitlistCanonicalIdentity(params: {
  accountMe: AccountSetupMe | null
  accountMeLoading: boolean
  hasSession: boolean
  /** The user's linked external wallet address, if any (waitlist's own link flow — not a wagmi connection). */
  externalEoaAddress: string | null
}): CanonicalIdentity {
  const { accountMe, accountMeLoading, hasSession, externalEoaAddress } = params
  const accountSignals = accountMe?.accountSignals
  const { embeddedEoaAddress } = useEnsurePrivyEmbeddedWallet()

  const csw = toAddressOrNull(accountSignals?.canonicalCswAddress ?? null)
  const privyEmbeddedAddress = toAddressOrNull(embeddedEoaAddress ?? accountSignals?.embeddedEoaAddress ?? null)
  // Never treat the canonical CSW as an "active external signer" — Base App /
  // Coinbase Smart Wallet identity belongs in the CSW slot.
  const externalEoaRaw = toAddressOrNull(externalEoaAddress)
  const externalEoa =
    externalEoaRaw && csw && externalEoaRaw.toLowerCase() === csw.toLowerCase() ? null : externalEoaRaw

  const { isOwner: parentEmbeddedOwnerOnChain, status: embeddedOwnerProbeStatus } = useEmbeddedOwnerOnCsw({
    cswAddress: csw,
    embeddedEoaAddress: privyEmbeddedAddress,
    enabled: Boolean(csw && privyEmbeddedAddress && hasSession),
  })

  const embeddedSignerAuthorizedOnCsw = (() => {
    if (parentEmbeddedOwnerOnChain) return true
    if (embeddedOwnerProbeStatus === 'not-owner') return false
    const serverFlag = accountSignals?.privyEmbeddedEoaIsOwnerOfCanonicalCsw
    return serverFlag ?? null
  })()

  const activeSigner: CanonicalIdentity['activeSigner'] = externalEoa
    ? 'external'
    : privyEmbeddedAddress
      ? 'embedded'
      : null

  const executionTrack = (accountSignals?.executionTrack ?? null) as CanonicalIdentity['executionTrack']
  const accountChrome = deriveAccountChromeExecution({
    executionTrack,
    parentEmbeddedOwnerOnChain,
    privyEmbeddedEoaIsOwnerOfCanonicalCsw: embeddedSignerAuthorizedOnCsw,
    canonicalCswAddress: csw,
  })

  const loadingCsw = hasSession && accountMeLoading && !csw
  const cswMissing = hasSession && !accountMeLoading && !csw && accountMe !== null

  // Server already resolves the creator coin for this CSW's vault as part of
  // `/api/accounts/me` — no need to duplicate `useCanonicalIdentity`'s
  // client-side `getTokenForVault` RPC read/cache here.
  const creatorCoinAddress = toAddressOrNull(accountSignals?.creatorCoin?.address ?? null)

  return useMemo<CanonicalIdentity>(
    () => ({
      cswAddress: csw,
      loadingCsw,
      cswMissing,
      hasSession,
      externalEoaAddress: externalEoa,
      privyEmbeddedAddress,
      embeddedSignerAuthorizedOnCsw,
      activeSigner,
      creatorCoinAddress,
      loadingCoin: false,
      executionSubAccountAddress: null,
      executionTrack,
      effectiveExecutionTrack: accountChrome.effectiveExecutionTrack,
      accountChrome,
    }),
    [
      accountChrome,
      activeSigner,
      creatorCoinAddress,
      csw,
      cswMissing,
      embeddedSignerAuthorizedOnCsw,
      executionTrack,
      externalEoa,
      hasSession,
      loadingCsw,
      privyEmbeddedAddress,
    ],
  )
}
