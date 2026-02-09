import { beforeEach, describe, expect, it, vi } from 'vitest'

import handler from '../_handlers/keepr/vault/_upsert.ts'
import { createMockReq, createMockRes } from './helpers'

const { getSessionAddressMock, computeConfigHashMock, upsertKeeprVaultMock } = vi.hoisted(() => ({
  getSessionAddressMock: vi.fn(),
  computeConfigHashMock: vi.fn(),
  upsertKeeprVaultMock: vi.fn(),
}))

vi.mock('../../server/_lib/session.js', () => ({
  getSessionAddress: getSessionAddressMock,
}))

vi.mock('../../server/_lib/keeprRegistry.js', () => ({
  computeConfigHash: computeConfigHashMock,
  upsertKeeprVault: upsertKeeprVaultMock,
}))

const OWNER = '0x00000000000000000000000000000000000000aa'
const VAULT = '0x00000000000000000000000000000000000000bb'
const CREATOR_COIN = '0x00000000000000000000000000000000000000cc'
const LENS_GROUP = '0x00000000000000000000000000000000000000dd'

function buildConfig(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    chainId: 8453,
    vault: {
      vaultAddress: VAULT,
      creatorCoinAddress: CREATOR_COIN,
      canonicalOwnerAddress: OWNER,
    },
    xmtp: {
      groupId: 'group-1',
    },
    gating: {
      enabled: true,
      joinLocked: false,
      mode: 'shares',
      thresholds: { minShares: '1' },
      failClosed: true,
    },
    roles: {
      owner: OWNER,
    },
    ...overrides,
  }
}

describe('keepr/vault/upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSessionAddressMock.mockReturnValue(OWNER)
    computeConfigHashMock.mockReturnValue('cfg-hash-1')
    upsertKeeprVaultMock.mockResolvedValue({
      vaultAddress: VAULT,
      chainId: 8453,
      groupId: 'group-1',
      lensGroupAddress: null,
      creatorCoinAddress: CREATOR_COIN,
      canonicalOwnerAddress: OWNER,
      shareTokenAddress: null,
      gatingEnabled: true,
      joinLocked: false,
      gatingMode: 'shares',
      minShares: '1',
      failClosed: true,
      configVersion: 1,
      configHash: 'cfg-hash-1',
      config: buildConfig(),
    })
  })

  it('rejects invalid lens group address', async () => {
    const req = createMockReq({
      method: 'POST',
      body: {
        config: buildConfig({
          lens: { groupAddress: 'not-an-address' },
        }),
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(400)
    expect(res.body?.success).toBe(false)
    expect(String(res.body?.error ?? '')).toContain('Invalid lens group address')
    expect(upsertKeeprVaultMock).not.toHaveBeenCalled()
  })

  it('accepts valid lens group address and returns it', async () => {
    upsertKeeprVaultMock.mockResolvedValueOnce({
      vaultAddress: VAULT,
      chainId: 8453,
      groupId: 'group-1',
      lensGroupAddress: LENS_GROUP.toLowerCase(),
      creatorCoinAddress: CREATOR_COIN,
      canonicalOwnerAddress: OWNER,
      shareTokenAddress: null,
      gatingEnabled: true,
      joinLocked: false,
      gatingMode: 'shares',
      minShares: '1',
      failClosed: true,
      configVersion: 1,
      configHash: 'cfg-hash-1',
      config: buildConfig({
        lens: { groupAddress: LENS_GROUP },
      }),
    })

    const req = createMockReq({
      method: 'POST',
      body: {
        config: buildConfig({
          lens: {
            groupAddress: LENS_GROUP,
            metadataUri: 'lens://group-meta-1',
          },
        }),
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.body?.success).toBe(true)
    expect(res.body?.data?.lensGroupAddress).toBe(LENS_GROUP.toLowerCase())
    expect(upsertKeeprVaultMock).toHaveBeenCalledTimes(1)
    const passed = upsertKeeprVaultMock.mock.calls[0]?.[0]
    expect(passed?.actorWallet).toBe(OWNER)
    expect(passed?.config?.lens?.groupAddress).toBe(LENS_GROUP)
    expect(passed?.config?.lens?.metadataUri).toBe('lens://group-meta-1')
  })
})

