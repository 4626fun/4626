import { useEmbeddedOwnerOnCsw } from './useEmbeddedOwnerOnCsw'
import { isWaitlistStepTwoSigningComplete } from './waitlistFlowState'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'
import type { UserFrontendExecutionTrack } from '@/lib/wallet/userExecutionTrack'

type WaitlistAccountSignals = {
  executionTrack?: UserFrontendExecutionTrack
}

export function useWaitlistSigningStepComplete(params: {
  accountSignals?: WaitlistAccountSignals
  canonicalCswAddress: string | null
  ownerInstallRequested: boolean
}) {
  const { embeddedEoaAddress } = useEnsurePrivyEmbeddedWallet()
  const shouldProbeParentEmbeddedOwner = Boolean(params.canonicalCswAddress && embeddedEoaAddress)

  const {
    isOwner: parentEmbeddedOwnerOnChain,
    refresh: refreshParentEmbeddedOwner,
    status: parentEmbeddedOwnerStatus,
  } = useEmbeddedOwnerOnCsw({
    cswAddress: params.canonicalCswAddress,
    embeddedEoaAddress,
    enabled: shouldProbeParentEmbeddedOwner,
  })

  const signingProbePending =
    shouldProbeParentEmbeddedOwner &&
    (parentEmbeddedOwnerStatus === 'checking' || parentEmbeddedOwnerStatus === 'idle')

  const signingStepComplete = params.accountSignals
    ? isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: params.ownerInstallRequested,
        accountSignals: params.accountSignals,
        parentEmbeddedOwnerOnChain,
      })
    : false

  return {
    embeddedEoaAddress,
    signingStepComplete,
    signingProbePending,
    parentEmbeddedOwnerOnChain,
    refreshParentEmbeddedOwner,
  }
}
