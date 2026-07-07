import { useMemo } from 'react'

import { LoadingInline } from '@/components/ui/LoadingState'
import { WaitlistModernParentOwnerInstall } from '@/features/accountSetup/WaitlistModernParentOwnerInstall'
import { useAccountSetupController } from '@/features/accountSetup/useAccountSetupController'
import { useAccountMe } from '@/hooks/useAccountMe'
import { isZoraLinkedFromAccountSignals } from '@/lib/wallet/userExecutionTrack'
import { WalletProviders } from '@/web3/Web3Providers'

import { useWaitlistSigningStepComplete } from './useWaitlistSigningStepComplete'
import { WaitlistWalletProvision } from './WaitlistWalletProvision'
import {
  resolveWaitlistConnectTrack,
  shouldShowParentCswAddOwnerPanel,
  type WaitlistConnectTrack,
} from './waitlistFlowState'

type WaitlistWalletSetupSectionProps = {
  enabled: boolean
}

export function WaitlistWalletSetupSection(props: WaitlistWalletSetupSectionProps) {
  if (!props.enabled) return null

  return (
    <WalletProviders reconnectOnMount={false}>
      <WaitlistWalletSetupSectionInner />
    </WalletProviders>
  )
}

function WaitlistWalletSetupSectionInner() {
  const { me: accountMe, loading, refresh } = useAccountMe()
  const controller = useAccountSetupController({ zoraReturnPath: '/waitlist' })
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
    zoraLinked,
    ownerInstallRequested: false,
    signingStepComplete,
    executionTrack: accountSignals?.executionTrack,
    accountSignals,
    parentEmbeddedOwnerOnChain,
  })

  if (loading && !accountMe) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
        <LoadingInline labelOverride="Loading wallet setup…" />
      </div>
    )
  }

  if (!needsProvision && !showOwnerInstall) return null

  return (
    <div className="mt-5 space-y-4">
      <WaitlistWalletProvision enabled needsProvision={needsProvision} />

      {showOwnerInstall ? (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4">
          <p className="mb-3 text-sm font-medium text-zinc-200">Enable 4626 signing</p>
          <WaitlistModernParentOwnerInstall
            controller={controller}
            embeddedEoaAddress={embeddedEoaAddress ?? accountSignals?.embeddedEoaAddress ?? null}
            onOwnerInstallSuccess={async () => {
              await refreshParentEmbeddedOwner()
              refresh()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
