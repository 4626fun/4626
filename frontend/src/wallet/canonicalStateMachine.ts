export type CanonicalMachineState =
  | 'unauthenticated'
  | 'authenticating'
  | 'canonicalizing'
  | 'onboarding'
  | 'ready'
  | 'recovery_required'

export type CanonicalMachineContext = {
  userId: string | null
  canonicalCswAddress: string | null
  embeddedEoaAddress: string | null
  appAccessStatus: string | null
  tier: number
  zoraResolved: boolean
  ownerDelegationVerified: boolean | null
}

export type CanonicalMachineSnapshot = {
  state: CanonicalMachineState
  context: CanonicalMachineContext
}

export type CanonicalMachineCommand =
  | { type: 'RUN_PRIVY_SYNC' }
  | { type: 'RESOLVE_CANONICAL_FROM_SERVER'; userId: string }
  | { type: 'REFRESH_ACCOUNT_PAYLOAD'; userId: string; reason: 'auth' | 'zora' }
  | { type: 'CHECK_OWNER_DELEGATION'; userId: string }
  | { type: 'FORCE_RECOVERY_LINK_FLOW' }

export type CanonicalMachineEvent =
  | { type: 'START_AUTH'; source: 'desktop' | 'telegram' | 'wallet' | 'zora_deep_link' }
  | { type: 'PRIVY_AUTH_SUCCESS'; userId: string }
  | { type: 'PRIVY_AUTH_FAILED' }
  | { type: 'CANONICAL_CSW_RESOLVED_FROM_SERVER'; canonicalCswAddress: string; embeddedEoaAddress: string | null }
  | { type: 'ACCOUNT_PAYLOAD_REFRESHED'; appAccessStatus: string | null; tier: number }
  | { type: 'ZORA_MINT_COMPLETE' }
  | { type: 'BEFORE_SIGNER_ACTION' }
  | { type: 'OWNER_DELEGATION_VERIFIED' }
  | { type: 'OWNER_DELEGATION_FAILED' }
  | { type: 'AMBIGUOUS_MERGE_DETECTED' }
  | { type: 'RECOVERY_COMPLETED' }

export type CanonicalMachineTransition = {
  snapshot: CanonicalMachineSnapshot
  commands: CanonicalMachineCommand[]
}

function withSnapshot(
  snapshot: CanonicalMachineSnapshot,
  patch: Partial<CanonicalMachineSnapshot>,
  commands: CanonicalMachineCommand[] = [],
): CanonicalMachineTransition {
  return {
    snapshot: {
      ...snapshot,
      ...patch,
      context: {
        ...snapshot.context,
        ...(patch.context ?? {}),
      },
    },
    commands,
  }
}

export function createCanonicalMachineSnapshot(): CanonicalMachineSnapshot {
  return {
    state: 'unauthenticated',
    context: {
      userId: null,
      canonicalCswAddress: null,
      embeddedEoaAddress: null,
      appAccessStatus: null,
      tier: 0,
      zoraResolved: false,
      ownerDelegationVerified: null,
    },
  }
}

export function reduceCanonicalMachine(
  snapshot: CanonicalMachineSnapshot,
  event: CanonicalMachineEvent,
): CanonicalMachineTransition {
  if (event.type === 'AMBIGUOUS_MERGE_DETECTED') {
    return withSnapshot(
      snapshot,
      { state: 'recovery_required' },
      [{ type: 'FORCE_RECOVERY_LINK_FLOW' }],
    )
  }

  switch (snapshot.state) {
    case 'unauthenticated': {
      switch (event.type) {
        case 'START_AUTH':
          return withSnapshot(snapshot, { state: 'authenticating' }, [{ type: 'RUN_PRIVY_SYNC' }])
        case 'RECOVERY_COMPLETED':
          return withSnapshot(createCanonicalMachineSnapshot(), {})
        default:
          return { snapshot, commands: [] }
      }
    }
    case 'authenticating': {
      switch (event.type) {
        case 'PRIVY_AUTH_SUCCESS': {
          return withSnapshot(
            snapshot,
            {
              state: 'canonicalizing',
              context: {
                userId: event.userId,
              },
            },
            [{ type: 'RESOLVE_CANONICAL_FROM_SERVER', userId: event.userId }],
          )
        }
        case 'PRIVY_AUTH_FAILED':
          return withSnapshot(createCanonicalMachineSnapshot(), {})
        default:
          return { snapshot, commands: [] }
      }
    }
    case 'canonicalizing': {
      switch (event.type) {
        case 'CANONICAL_CSW_RESOLVED_FROM_SERVER': {
          const userId = snapshot.context.userId
          if (!userId) return { snapshot, commands: [] }
          return withSnapshot(
            snapshot,
            {
              state: 'onboarding',
              context: {
                canonicalCswAddress: event.canonicalCswAddress,
                embeddedEoaAddress: event.embeddedEoaAddress,
              },
            },
            [{ type: 'REFRESH_ACCOUNT_PAYLOAD', userId, reason: 'auth' }],
          )
        }
        default:
          return { snapshot, commands: [] }
      }
    }
    case 'onboarding': {
      switch (event.type) {
        case 'ACCOUNT_PAYLOAD_REFRESHED':
          return withSnapshot(snapshot, {
            state: 'ready',
            context: {
              appAccessStatus: event.appAccessStatus,
              tier: event.tier,
            },
          })
        case 'ZORA_MINT_COMPLETE': {
          const userId = snapshot.context.userId
          if (!userId) return { snapshot, commands: [] }
          return withSnapshot(
            snapshot,
            {
              context: {
                zoraResolved: true,
              },
            },
            [{ type: 'REFRESH_ACCOUNT_PAYLOAD', userId, reason: 'zora' }],
          )
        }
        default:
          return { snapshot, commands: [] }
      }
    }
    case 'ready': {
      switch (event.type) {
        case 'BEFORE_SIGNER_ACTION': {
          const userId = snapshot.context.userId
          if (!userId) return { snapshot, commands: [] }
          return withSnapshot(snapshot, {}, [{ type: 'CHECK_OWNER_DELEGATION', userId }])
        }
        case 'OWNER_DELEGATION_VERIFIED':
          return withSnapshot(snapshot, {
            context: {
              ownerDelegationVerified: true,
            },
          })
        case 'OWNER_DELEGATION_FAILED':
          return withSnapshot(snapshot, {
            context: {
              ownerDelegationVerified: false,
            },
          })
        case 'ZORA_MINT_COMPLETE': {
          const userId = snapshot.context.userId
          if (!userId) return { snapshot, commands: [] }
          return withSnapshot(
            snapshot,
            {
              state: 'onboarding',
              context: {
                zoraResolved: true,
              },
            },
            [{ type: 'REFRESH_ACCOUNT_PAYLOAD', userId, reason: 'zora' }],
          )
        }
        default:
          return { snapshot, commands: [] }
      }
    }
    case 'recovery_required': {
      switch (event.type) {
        case 'RECOVERY_COMPLETED':
          return withSnapshot(createCanonicalMachineSnapshot(), {})
        default:
          return { snapshot, commands: [] }
      }
    }
    default:
      return { snapshot, commands: [] }
  }
}
