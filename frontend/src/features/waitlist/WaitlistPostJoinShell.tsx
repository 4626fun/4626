import { Suspense, lazy, useMemo } from 'react'

import { LoadingInline } from '@/components/ui/LoadingState'
import { useAccountMe } from '@/hooks/useAccountMe'
import { isZoraLinkedFromAccountSignals } from '@/lib/wallet/userExecutionTrack'

import { WaitlistOwnerInstallPanel } from './WaitlistOwnerInstallPanel'
import { WaitlistWalletProvision } from './WaitlistWalletProvision'
import { useWaitlistSigningStepComplete } from './useWaitlistSigningStepComplete'
import {
  isWaitlistMessagingSigningReady,
  resolveWaitlistConnectTrack,
  shouldShowParentCswAddOwnerPanel,
  type WaitlistConnectTrack,
} from './waitlistFlowState'

const LazyWaitlistGroupChatPanel = lazy(async () => {
  const mod = await import('./WaitlistGroupChatPanel')
  return { default: mod.WaitlistGroupChatPanel }
})

type WaitlistPostJoinShellProps = {
  enabled: boolean
}

export function WaitlistPostJoinShell(props: WaitlistPostJoinShellProps) {
  if (!props.enabled) return null
  return <WaitlistPostJoinShellInner />
}

function WaitlistPostJoinShellInner() {
  const { me: accountMe, loading, refresh } = useAccountMe()
  const accountSignals = accountMe?.accountSignals
  const canonicalCswAddress = accountSignals?.canonicalCswAddress ?? null
  const zoraLinked = isZoraLinkedFromAccountSignals(accountSignals)

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

  const needsProvision =
    connectTrack !== 'base-app-direct' &&
    !zoraLinked &&
    !canonicalCswAddress?.trim()

  const showOwnerInstall = shouldShowParentCswAddOwnerPanel({
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

  const handleOwnerInstallSuccess = async () => {
    await refreshParentEmbeddedOwner()
    refresh()
  }

  if (loading && !accountMe) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
        <LoadingInline labelOverride="Loading wallet setup…" />
      </div>
    )
  }

  const showWalletSection = needsProvision || showOwnerInstall

  return (
    <div className="mt-5 space-y-4">
      {showWalletSection ? (
        <div className="space-y-4">
          <WaitlistWalletProvision enabled needsProvision={needsProvision} />

          {showOwnerInstall ? (
            <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
              <p className="mb-3 text-sm font-medium text-zinc-200">Enable 4626 signing</p>
              <WaitlistOwnerInstallPanel
                connectTrack={connectTrack}
                canonicalCswAddress={canonicalCswAddress}
                embeddedEoaAddress={embeddedEoaAddress ?? accountSignals?.embeddedEoaAddress ?? null}
                onSuccess={handleOwnerInstallSuccess}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <Suspense
        fallback={
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
            <LoadingInline labelOverride="Loading waitlist chat…" />
          </div>
        }
      >
        <LazyWaitlistGroupChatPanel
          setupComplete
          messagingReady={messagingReady}
          connectTrack={connectTrack}
        />
      </Suspense>
    </div>
  )
}
