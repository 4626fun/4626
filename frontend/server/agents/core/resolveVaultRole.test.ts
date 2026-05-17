import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getKeeprVaultByGroupIdMock } = vi.hoisted(() => ({
  getKeeprVaultByGroupIdMock: vi.fn(),
}))

vi.mock('../../_lib/keepr/keeprRegistry.js', () => ({
  getKeeprVaultByGroupId: getKeeprVaultByGroupIdMock,
}))

import { resolveVaultAccessRoleByGroupId, resolveVaultAccessRoleFromVault } from './resolveVaultRole.ts'

describe('resolveVaultAccessRoleFromVault', () => {
  const vault = {
    canonicalOwnerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    config: {
      roles: {
        admins: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'],
      },
    },
  } as any

  it('returns OWNER for the canonical owner wallet', () => {
    expect(resolveVaultAccessRoleFromVault({
      wallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      vault,
    })).toBe('OWNER')
  })

  it('returns ADMIN for configured admin wallets', () => {
    expect(resolveVaultAccessRoleFromVault({
      wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      vault,
    })).toBe('ADMIN')
  })

  it('falls back to MEMBER otherwise', () => {
    expect(resolveVaultAccessRoleFromVault({
      wallet: '0xcccccccccccccccccccccccccccccccccccccccc',
      vault,
    })).toBe('MEMBER')
  })

  it('honors explicit admin overrides', () => {
    expect(resolveVaultAccessRoleFromVault({
      wallet: '0xcccccccccccccccccccccccccccccccccccccccc',
      vault,
      fallbackAdmin: true,
    })).toBe('ADMIN')
  })
})

describe('resolveVaultAccessRoleByGroupId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the vault by group id and resolves the role', async () => {
    getKeeprVaultByGroupIdMock.mockResolvedValue({
      canonicalOwnerAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      config: { roles: { admins: ['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'] } },
    })

    await expect(resolveVaultAccessRoleByGroupId({
      groupId: 'group-1',
      wallet: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    })).resolves.toBe('ADMIN')
  })
})
