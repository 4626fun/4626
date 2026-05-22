import { useMemo } from 'react'

import { waitlistSubAccountFlowFlag } from '@/lib/flags/featureFlags'
import { useEnsurePrivyEmbeddedWallet } from '@/lib/privy/embeddedWallet'

import { useEmbeddedOwnerOnSubAccount } from './useEmbeddedOwnerOnSubAccount'
import {
  isWaitlistStepTwoSigningComplete,
  resolveSubAccountAddress,
} from './waitlistFlowState'

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
  baseSubAccount?: string | null
  canonicalCswAddress: string | null
  ownerInstallRequested: boolean
}) {
  const subAccountFlowEnabled = useMemo(() => waitlistSubAccountFlowFlag(), [])
  const { embeddedEoaAddress } = useEnsurePrivyEmbeddedWallet()
  const executionTrack = params.accountSignals?.executionTrack
  const shouldProbeParentEmbeddedOwner =
    Boolean(params.canonicalCswAddress && embeddedEoaAddress) &&
    (params.ownerInstallRequested ||
      executionTrack === 'none-yet' ||
      executionTrack === 'legacy-owner-install')

  const { isOwner: parentEmbeddedOwnerOnChain, refresh: refreshParentEmbeddedOwner } =
    useEmbeddedOwnerOnSubAccount({
      subAccountAddress: params.canonicalCswAddress,
      embeddedEoaAddress,
      enabled: shouldProbeParentEmbeddedOwner,
    })

  const persistedSubAccountAddress = resolveSubAccountAddress({
    baseSubAccount: params.baseSubAccount ?? null,
    accountSignals: params.accountSignals,
  })

  const { isOwner: subAccountEmbeddedOwnerOnChain } = useEmbeddedOwnerOnSubAccount({
    subAccountAddress: persistedSubAccountAddress,
    embeddedEoaAddress,
    enabled: subAccountFlowEnabled && Boolean(persistedSubAccountAddress && embeddedEoaAddress),
  })

  const signingStepComplete = params.accountSignals
    ? isWaitlistStepTwoSigningComplete({
        ownerInstallRequested: params.ownerInstallRequested,
        accountSignals: params.accountSignals,
        parentEmbeddedOwnerOnChain,
        subAccountEmbeddedOwnerOnChain,
      })
    : false

  return {
    embeddedEoaAddress,
    signingStepComplete,
    parentEmbeddedOwnerOnChain,
    refreshParentEmbeddedOwner,
    persistedSubAccountAddress,
    subAccountEmbeddedOwnerOnChain,
    subAccountFlowEnabled,
  }
}
