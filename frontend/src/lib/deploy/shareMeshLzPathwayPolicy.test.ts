import { describe, expect, it } from 'vitest'

import {
  EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS,
  EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS,
  NIL_REQUIRED_DVN_COUNT,
  asPaddedEvmPeer,
  assessShareMeshLzPathway,
  enforcedOptionsMatchSolanaTemplate,
  outboundMeetsInbound,
  resolveEffectiveSolanaUlnSlice,
  type PathwayConfirmationSnapshot,
  type UlnConfirmationsSlice,
} from './shareMeshLzPathwayPolicy'

function slice(
  confirmations: bigint,
  overrides?: Partial<{
    optionalDvnCount: number
    optionalDvnThreshold: number
    requiredDvnCount: number
  }>,
): UlnConfirmationsSlice {
  return {
    confirmations,
    optionalDvnCount: overrides?.optionalDvnCount ?? 5,
    optionalDvnThreshold: overrides?.optionalDvnThreshold ?? 3,
    requiredDvnCount: overrides?.requiredDvnCount ?? 0,
  }
}

function policySnapshot(overrides?: Partial<PathwayConfirmationSnapshot>): PathwayConfirmationSnapshot {
  return {
    baseSend: slice(EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS),
    solanaReceive: slice(EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS),
    solanaSend: slice(EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS),
    baseReceive: slice(EXPECTED_SOLANA_TO_BASE_CONFIRMATIONS),
    ...overrides,
  }
}

describe('shareMeshLzPathwayPolicy', () => {
  it('blocks when source outbound confirmations are below destination inbound', () => {
    expect(outboundMeetsInbound(10n, 15n)).toBe(false)
    expect(outboundMeetsInbound(15n, 15n)).toBe(true)
    expect(outboundMeetsInbound(32n, 15n)).toBe(true)
  })

  it('accepts the template [15, 32] pathway', () => {
    const result = assessShareMeshLzPathway(policySnapshot())
    expect(result.ok).toBe(true)
  })

  it('accepts Base getConfig shape with requiredDvnCount 0', () => {
    const result = assessShareMeshLzPathway(
      policySnapshot({
        baseSend: slice(EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS, { requiredDvnCount: 0 }),
      }),
    )
    expect(result.ok).toBe(true)
  })

  it('treats NIL 255 required DVNs as effective 0 for DVN shape', () => {
    const result = assessShareMeshLzPathway(
      policySnapshot({
        solanaReceive: slice(EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS, {
          requiredDvnCount: NIL_REQUIRED_DVN_COUNT,
        }),
      }),
    )
    expect(result.checks.find((c) => c.id === 'solana_receive_dvn_3of5')?.ok).toBe(true)
  })

  it('fails the B2 temporary [10, 32] mismatch against policy even if compatible', () => {
    const result = assessShareMeshLzPathway(
      policySnapshot({
        baseSend: slice(10n),
        solanaReceive: slice(10n),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.checks.find((c) => c.id === 'base_to_solana_confirmations_compatible')?.ok).toBe(
      true,
    )
    expect(result.checks.find((c) => c.id === 'base_send_confirmations_policy')?.ok).toBe(false)
    expect(result.checks.find((c) => c.id === 'solana_receive_confirmations_policy')?.ok).toBe(false)
  })

  it('fails hard when Base send < Solana receive (Pipe A BLOCKED class)', () => {
    const result = assessShareMeshLzPathway(
      policySnapshot({
        baseSend: slice(10n),
        solanaReceive: slice(15n),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.checks.find((c) => c.id === 'base_to_solana_confirmations_compatible')?.ok).toBe(
      false,
    )
  })

  it('fails when DVN shape is not 3-of-5', () => {
    const result = assessShareMeshLzPathway(
      policySnapshot({
        baseSend: slice(EXPECTED_BASE_TO_SOLANA_CONFIRMATIONS, {
          optionalDvnCount: 1,
          optionalDvnThreshold: 1,
          requiredDvnCount: 1,
        }),
      }),
    )
    expect(result.ok).toBe(false)
    expect(result.checks.find((c) => c.id === 'base_send_dvn_3of5')?.ok).toBe(false)
  })

  it('merges Solana custom confirmations=0 from library default (avoids false 0 inbound)', () => {
    const effective = resolveEffectiveSolanaUlnSlice(
      slice(15n, { requiredDvnCount: 2, optionalDvnCount: 3, optionalDvnThreshold: 2 }),
      slice(0n, {
        requiredDvnCount: NIL_REQUIRED_DVN_COUNT,
        optionalDvnCount: 5,
        optionalDvnThreshold: 3,
      }),
    )
    expect(effective.confirmations).toBe(15n)
    expect(effective.requiredDvnCount).toBe(0)
    expect(effective.optionalDvnCount).toBe(5)
    expect(effective.optionalDvnThreshold).toBe(3)
  })

  it('does not treat raw Solana requiredDvnCount=0 as NIL without default merge', () => {
    const effective = resolveEffectiveSolanaUlnSlice(
      slice(15n, { requiredDvnCount: 2, optionalDvnCount: 0, optionalDvnThreshold: 0 }),
      slice(15n, { requiredDvnCount: 0, optionalDvnCount: 5, optionalDvnThreshold: 3 }),
    )
    // required 0 in custom inherits default required=2
    expect(effective.requiredDvnCount).toBe(2)
    expect(assessShareMeshLzPathway(policySnapshot({ solanaReceive: effective })).ok).toBe(false)
  })


  it('inherits optionalDvnThreshold 0 from default even when optional count is set', () => {
    const effective = resolveEffectiveSolanaUlnSlice(
      slice(15n, { optionalDvnCount: 5, optionalDvnThreshold: 3, requiredDvnCount: 0 }),
      slice(15n, { optionalDvnCount: 5, optionalDvnThreshold: 0, requiredDvnCount: NIL_REQUIRED_DVN_COUNT }),
    )
    expect(effective.optionalDvnCount).toBe(5)
    expect(effective.optionalDvnThreshold).toBe(3)
    expect(effective.requiredDvnCount).toBe(0)
  })

  it('pads EVM peers and matches template enforced options markers', () => {
    expect(asPaddedEvmPeer('0x44710150A469DE368Abc82F05e6217086Be84626')).toBe(
      '0x00000000000000000000000044710150a469de368abc82f05e6217086be84626',
    )
    expect(
      enforcedOptionsMatchSolanaTemplate(
        '0x00030100210100000000000000000000000000030d40000000000000000000000000001f1df0',
      ),
    ).toBe(true)
    expect(enforcedOptionsMatchSolanaTemplate('0xdead')).toBe(false)
  })
})
