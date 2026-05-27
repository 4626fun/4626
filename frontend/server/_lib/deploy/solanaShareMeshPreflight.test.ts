import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAddress, type Hex } from 'viem'

import * as shareBridge from '../../../src/lib/deploy/shareBridgeOftWiring.js'
import {
  DEFAULT_OVAULT_MESH_PREFLIGHT_RESULT,
  ensureShareMeshOvaultPreflight,
  isLegacySolanaBridgePreflightEnabled,
  isOvaultRequestEnabled,
} from './solanaShareMeshPreflight.js'

const BATCHER = getAddress('0xa99058f424FB3ACC639F59355C65C40149030651')
const HUB = getAddress('0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1')
const FINALIZE_DATA = `0x${'ab'.repeat(32)}` as Hex

describe('isLegacySolanaBridgePreflightEnabled', () => {
  afterEach(() => {
    delete process.env.DEPLOY_SOLANA_LEGACY_BRIDGE_PREFLIGHT
  })

  it('defaults to share-mesh preflight (legacy off)', () => {
    expect(isLegacySolanaBridgePreflightEnabled()).toBe(false)
  })

  it('enables legacy bridge preflight when flag is set', () => {
    process.env.DEPLOY_SOLANA_LEGACY_BRIDGE_PREFLIGHT = '1'
    expect(isLegacySolanaBridgePreflightEnabled()).toBe(true)
  })
})

describe('isOvaultRequestEnabled', () => {
  it('returns false for non-objects and disabled payloads', () => {
    expect(isOvaultRequestEnabled(null)).toBe(false)
    expect(isOvaultRequestEnabled({ enabled: false })).toBe(false)
  })

  it('returns true when solanaOvault.enabled is true', () => {
    expect(isOvaultRequestEnabled({ enabled: true })).toBe(true)
  })
})

describe('ensureShareMeshOvaultPreflight', () => {
  afterEach(() => vi.restoreAllMocks())

  it('short-circuits when OVault mesh is not requested', async () => {
    const publicClient = { readContract: vi.fn() }
    const result = await ensureShareMeshOvaultPreflight({
      publicClient: publicClient as any,
      finalizeCall: { to: BATCHER, data: FINALIZE_DATA },
      ovaultRequested: false,
    })
    expect(result).toEqual(DEFAULT_OVAULT_MESH_PREFLIGHT_RESULT)
    expect(publicClient.readContract).not.toHaveBeenCalled()
  })

  it('passes when batcher OVault runtime is enabled and share wiring ok', async () => {
    const publicClient = {
      readContract: vi.fn(async (args: { functionName?: string }) => {
        if (args.functionName === 'getOVaultRuntimeConfig') {
          return { hubComposer: HUB, solanaEid: 30168, enabled: true }
        }
        return null
      }),
    }
    vi.spyOn(shareBridge, 'assertShareBridgeOftWiringForFinalize').mockResolvedValue(undefined)

    const result = await ensureShareMeshOvaultPreflight({
      publicClient: publicClient as any,
      finalizeCall: { to: BATCHER, data: FINALIZE_DATA },
      ovaultRequested: true,
    })
    expect(result.meshStep).toBe('ovault_mesh_confirmed')
    expect(publicClient.readContract).toHaveBeenCalled()
    expect(shareBridge.assertShareBridgeOftWiringForFinalize).toHaveBeenCalledWith(
      expect.objectContaining({ batcherAddress: BATCHER }),
    )
  })

  it('throws when OVault runtime is not configured', async () => {
    const publicClient = {
      readContract: vi.fn(async () => ({ hubComposer: HUB, solanaEid: 0, enabled: false })),
    }

    await expect(
      ensureShareMeshOvaultPreflight({
        publicClient: publicClient as any,
        finalizeCall: { to: BATCHER, data: FINALIZE_DATA },
        ovaultRequested: true,
      }),
    ).rejects.toThrow(/OVault runtime config is not enabled/)
  })
})
