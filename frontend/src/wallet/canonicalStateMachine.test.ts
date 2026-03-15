import { describe, expect, it } from 'vitest'

import { createCanonicalMachineSnapshot, reduceCanonicalMachine, type CanonicalMachineEvent, type CanonicalMachineSnapshot } from './canonicalStateMachine'

function applyEvents(initial: CanonicalMachineSnapshot, events: CanonicalMachineEvent[]) {
  let snapshot = initial
  const commands: string[] = []
  for (const event of events) {
    const transition = reduceCanonicalMachine(snapshot, event)
    snapshot = transition.snapshot
    commands.push(...transition.commands.map((command) => command.type))
  }
  return { snapshot, commands }
}

describe('canonical state machine invariants', () => {
  it('sets userId only after PRIVY_AUTH_SUCCESS', () => {
    const initial = createCanonicalMachineSnapshot()
    const afterStart = reduceCanonicalMachine(initial, { type: 'START_AUTH', source: 'desktop' })
    expect(afterStart.snapshot.context.userId).toBeNull()

    const afterAuth = reduceCanonicalMachine(afterStart.snapshot, {
      type: 'PRIVY_AUTH_SUCCESS',
      userId: 'did:privy:user-1',
    })
    expect(afterAuth.snapshot.context.userId).toBe('did:privy:user-1')
  })

  it('never overwrites canonical CSW on ZORA_MINT_COMPLETE', () => {
    const { snapshot: ready } = applyEvents(createCanonicalMachineSnapshot(), [
      { type: 'START_AUTH', source: 'desktop' },
      { type: 'PRIVY_AUTH_SUCCESS', userId: 'did:privy:user-1' },
      {
        type: 'CANONICAL_CSW_RESOLVED_FROM_SERVER',
        canonicalCswAddress: '0x1111111111111111111111111111111111111111',
        embeddedEoaAddress: '0x2222222222222222222222222222222222222222',
      },
      { type: 'ACCOUNT_PAYLOAD_REFRESHED', appAccessStatus: null, tier: 1 },
    ])

    const afterZora = reduceCanonicalMachine(ready, { type: 'ZORA_MINT_COMPLETE' })
    expect(afterZora.snapshot.context.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
    expect(afterZora.commands).toEqual([{ type: 'REFRESH_ACCOUNT_PAYLOAD', userId: 'did:privy:user-1', reason: 'zora' }])
  })

  it('emits signer preflight command only from ready state', () => {
    const { snapshot: ready } = applyEvents(createCanonicalMachineSnapshot(), [
      { type: 'START_AUTH', source: 'wallet' },
      { type: 'PRIVY_AUTH_SUCCESS', userId: 'did:privy:user-1' },
      {
        type: 'CANONICAL_CSW_RESOLVED_FROM_SERVER',
        canonicalCswAddress: '0x1111111111111111111111111111111111111111',
        embeddedEoaAddress: '0x2222222222222222222222222222222222222222',
      },
      { type: 'ACCOUNT_PAYLOAD_REFRESHED', appAccessStatus: null, tier: 1 },
    ])

    const transition = reduceCanonicalMachine(ready, { type: 'BEFORE_SIGNER_ACTION' })
    expect(transition.commands).toEqual([{ type: 'CHECK_OWNER_DELEGATION', userId: 'did:privy:user-1' }])
  })

  it('enters recovery_required on ambiguous merge', () => {
    const transition = reduceCanonicalMachine(createCanonicalMachineSnapshot(), {
      type: 'AMBIGUOUS_MERGE_DETECTED',
    })
    expect(transition.snapshot.state).toBe('recovery_required')
    expect(transition.commands).toEqual([{ type: 'FORCE_RECOVERY_LINK_FLOW' }])
  })
})

describe('canonical state machine scenario matrix', () => {
  const scenarios: Array<{ name: string; events: CanonicalMachineEvent[] }> = [
    {
      name: 'desktop auth first',
      events: [
        { type: 'START_AUTH', source: 'desktop' },
        { type: 'PRIVY_AUTH_SUCCESS', userId: 'did:privy:user-1' },
        {
          type: 'CANONICAL_CSW_RESOLVED_FROM_SERVER',
          canonicalCswAddress: '0x1111111111111111111111111111111111111111',
          embeddedEoaAddress: '0x2222222222222222222222222222222222222222',
        },
        { type: 'ACCOUNT_PAYLOAD_REFRESHED', appAccessStatus: null, tier: 1 },
      ],
    },
    {
      name: 'telegram entry with zora completion',
      events: [
        { type: 'START_AUTH', source: 'telegram' },
        { type: 'PRIVY_AUTH_SUCCESS', userId: 'did:privy:user-1' },
        {
          type: 'CANONICAL_CSW_RESOLVED_FROM_SERVER',
          canonicalCswAddress: '0x1111111111111111111111111111111111111111',
          embeddedEoaAddress: '0x2222222222222222222222222222222222222222',
        },
        { type: 'ACCOUNT_PAYLOAD_REFRESHED', appAccessStatus: null, tier: 1 },
        { type: 'ZORA_MINT_COMPLETE' },
        { type: 'ACCOUNT_PAYLOAD_REFRESHED', appAccessStatus: null, tier: 1 },
      ],
    },
    {
      name: 'wallet entry with zora callback during onboarding',
      events: [
        { type: 'START_AUTH', source: 'wallet' },
        { type: 'PRIVY_AUTH_SUCCESS', userId: 'did:privy:user-1' },
        {
          type: 'CANONICAL_CSW_RESOLVED_FROM_SERVER',
          canonicalCswAddress: '0x1111111111111111111111111111111111111111',
          embeddedEoaAddress: '0x2222222222222222222222222222222222222222',
        },
        { type: 'ZORA_MINT_COMPLETE' },
        { type: 'ACCOUNT_PAYLOAD_REFRESHED', appAccessStatus: null, tier: 1 },
      ],
    },
  ]

  it('converges all entry permutations to the same canonical identity state', () => {
    const finals = scenarios.map((scenario) => applyEvents(createCanonicalMachineSnapshot(), scenario.events).snapshot)
    for (const finalSnapshot of finals) {
      expect(finalSnapshot.state).toBe('ready')
      expect(finalSnapshot.context.userId).toBe('did:privy:user-1')
      expect(finalSnapshot.context.canonicalCswAddress).toBe('0x1111111111111111111111111111111111111111')
      expect(finalSnapshot.context.appAccessStatus).toBeNull()
      expect(finalSnapshot.context.tier).toBe(1)
    }
  })
})
