import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'

import { useEmbeddedOwnerOnCsw } from './useEmbeddedOwnerOnCsw'
import { isWaitlistStepTwoSigningComplete } from './waitlistFlowState'

type WaitlistAccountSignals = {
  executionTrack?: 'sub-account' | 'legacy-owner-install' | 'migration-pending' | 'none-yet'
  baseSubAccount?: {
    address?: string | null
    registered?: boolean
    isDistinctFromCsw?: boolean
  }
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
