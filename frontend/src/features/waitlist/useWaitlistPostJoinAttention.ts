import { useMemo } from 'react'

import { useAccountMe } from '@/hooks/useAccountMe'
import { detectInAppEnvironment, isBaseAppInAppContext } from '@/lib/wallet/inAppBrowser'
import { isZoraLinkedFromAccountSignals } from '@/lib/wallet/userExecutionTrack'

import { useWaitlistSigningStepComplete } from './useWaitlistSigningStepComplete'
import {
  isWaitlistMessagingSigningReady,
  resolveWaitlistConnectTrack,
  shouldShowParentCswAddOwnerPanel,
  type WaitlistConnectTrack,
} from './waitlistFlowState'
import type { AccountSetupMe } from '@/features/accountSetup/types'

export type WaitlistPostJoinAttentionState = {
  accountMe: AccountSetupMe | null
  loading: boolean
  refresh: () => void
  accountStateReady: boolean
  connectTrack: WaitlistConnectTrack
  canonicalCswAddress: string | null
  embeddedEoaAddress: string | null
  showOwnerInstall: boolean
  messagingReady: boolean
  parentEmbeddedOwnerOnChain: boolean
  refreshParentEmbeddedOwner: () => Promise<void>
  /** True while the "Enable 4626 signing" owner-install step is pending — the same
   * condition `WaitlistPostJoinShell` uses to decide whether to render its wallet-setup
   * section. Exposed so a host surface (the account tray) can know setup is required
   * without needing `WaitlistPostJoinShell` mounted and visible first.
   * Missing CSW is handled by explicit wallet link, not auto-provision. */
  setupRequired: boolean
}

/**
 * Shared attention/gating state for the post-join wallet setup flow.
 *
 * Extracted out of `WaitlistPostJoinShell` so a host surface (e.g. a
 * closed-by-default account tray) can read `setupRequired` at all times —
 * not only while `WaitlistPostJoinShell` itself happens to be mounted and
 * visible — without duplicating the CSW/owner-install gating logic in two
 * places. `WaitlistPostJoinShell` is the only consumer that renders UI from
 * this state; this hook must stay logic-only.
 */
export function useWaitlistPostJoinAttention(): WaitlistPostJoinAttentionState {
  const { me: accountMe, loading, refresh } = useAccountMe()
  const inBaseApp = isBaseAppInAppContext(detectInAppEnvironment())
  const accountSignals = accountMe?.accountSignals
  const canonicalCswAddress = accountSignals?.canonicalCswAddress ?? null
  const zoraLinked = isZoraLinkedFromAccountSignals(accountSignals)
  const accountStateReady = Boolean(accountMe) && !loading

  const {
    embeddedEoaAddress,
    signingStepComplete,
    parentEmbeddedOwnerOnChain,
    refreshParentEmbeddedOwner,
  } = useWaitlistSigningStepComplete({
    accountSignals,
    canonicalCswAddress,
    ownerInstallRequested: false,
  })

  const connectTrack = useMemo<WaitlistConnectTrack>(
    () =>
      resolveWaitlistConnectTrack({
        executionTrack: accountSignals?.executionTrack,
        accountSignals,
        zoraLinked,
        canonicalCswAddress,
        embeddedEoaAvailable: Boolean(accountSignals?.embeddedEoaAddress?.trim() || embeddedEoaAddress),
      }),
    [accountSignals, canonicalCswAddress, embeddedEoaAddress, zoraLinked],
  )

  const showOwnerInstall = shouldShowParentCswAddOwnerPanel({
    inBaseApp,
    connectTrack,
    zoraLinked,
    ownerInstallRequested: false,
    signingStepComplete,
    executionTrack: accountSignals?.executionTrack,
    accountSignals,
    parentEmbeddedOwnerOnChain,
  })

  const messagingReady = useMemo(
    () =>
      isWaitlistMessagingSigningReady({
        connectTrack,
        accountSignals,
        parentEmbeddedOwnerOnChain,
      }),
    [accountSignals, connectTrack, parentEmbeddedOwnerOnChain],
  )

  // Do not treat a missing CSW as setup-required. Waitlist never auto-creates a
  // Privy Smart Wallet; users link their Coinbase/Base CSW (or EOA) explicitly.
  // Owner-install is the only post-join wallet setup gate.
  const setupRequired = accountStateReady && showOwnerInstall

  return {
    accountMe,
    loading,
    refresh,
    accountStateReady,
    connectTrack,
    canonicalCswAddress,
    embeddedEoaAddress,
    showOwnerInstall,
    messagingReady,
    parentEmbeddedOwnerOnChain,
    refreshParentEmbeddedOwner,
    setupRequired,
  }
}
