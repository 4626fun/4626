import { Suspense, lazy, useMemo } from 'react'

import { LoadingInline } from '@/components/ui/LoadingState'
import { useAccountMe } from '@/hooks/useAccountMe'
import { isZoraLinkedFromAccountSignals } from '@/lib/wallet/userExecutionTrack'
import { WalletProviders } from '@/web3/Web3Providers'

import { useWaitlistSigningStepComplete } from './useWaitlistSigningStepComplete'
import {
  isWaitlistMessagingSigningReady,
  resolveWaitlistConnectTrack,
  type WaitlistConnectTrack,
} from './waitlistFlowState'

const LazyWaitlistGroupChatPanel = lazy(async () => {
  const mod = await import('./WaitlistGroupChatPanel')
  return { default: mod.WaitlistGroupChatPanel }
})

type WaitlistMessagingSectionProps = {
  enabled: boolean
}

export function WaitlistMessagingSection(props: WaitlistMessagingSectionProps) {
  if (!props.enabled) return null

  return (
    <WalletProviders reconnectOnMount={false}>
      <WaitlistMessagingSectionInner />
    </WalletProviders>
  )
}

function WaitlistMessagingSectionInner() {
  const { data: accountMe, isLoading } = useAccountMe()
  const accountSignals = accountMe?.accountSignals
  const canonicalCswAddress = accountSignals?.canonicalCswAddress ?? null
  const zoraLinked = isZoraLinkedFromAccountSignals(accountSignals)

  const { parentEmbeddedOwnerOnChain } = useWaitlistSigningStepComplete({
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
        embeddedEoaAvailable: Boolean(accountSignals?.embeddedEoaAddress?.trim()),
      }),
    [accountSignals, canonicalCswAddress, zoraLinked],
  )

  const messagingReady = useMemo(
    () =>
      isWaitlistMessagingSigningReady({
        connectTrack,
        accountSignals,
        parentEmbeddedOwnerOnChain,
      }),
    [accountSignals, connectTrack, parentEmbeddedOwnerOnChain],
  )

  if (isLoading && !accountMe) {
    return (
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
        <LoadingInline labelOverride="Loading messaging options…" />
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 px-4 py-5">
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
  )
}
