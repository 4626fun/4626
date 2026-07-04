import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveCommandIssuerContextByProfileIdMock = vi.fn()

vi.mock('@4626/server-core', () => ({
  resolveCommandIssuerContextByProfileId: (...args: unknown[]) =>
    resolveCommandIssuerContextByProfileIdMock(...args),
}))

vi.mock('./canonicalWalletResolver.js', () => ({
  readProfileWalletAuthority: vi.fn(async () => ({
    profileId: 42,
    canonicalSmartWalletAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    activeOwnerWalletAddress: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
  })),
}))

import {
  CreatorInfrastructureNotProvisionedError,
  CreatorInfrastructureMismatchError,
  resolveCreatorInfrastructure,
} from './creatorInfrastructure.js'

describe('resolveCreatorInfrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns CSW infrastructure from creator_infrastructure row', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase()
        if (text.includes('from creator_infrastructure')) {
          return {
            rows: [
              {
                creator_address: '0x1234567890123456789012345678901234567890',
                csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
                privy_wallet_id: 'privy-test-wallet',
                agent_type: 'csw',
              },
            ],
          }
        }
        if (text.includes('from account_zora_signals')) return { rows: [{ id: 42 }] }
        return { rows: [] }
      }),
    }

    const ctx = await resolveCreatorInfrastructure({
      creatorToken: '0x1234567890123456789012345678901234567890',
      db: db as any,
    })

    expect(ctx.cswAddress).toBe('0xab6d5c10b03300326cd7fab7267ae192842967b5')
    expect(ctx.privyOwnerWalletId).toBe('privy-test-wallet')
    expect(ctx.agentType).toBe('csw')
  })

  it('throws when CSW infrastructure is missing', async () => {
    const db = {
      sql: vi.fn(async () => ({ rows: [] })),
    }

    await expect(
      resolveCreatorInfrastructure({
        creatorToken: '0x1234567890123456789012345678901234567890',
        db: db as any,
      }),
    ).rejects.toBeInstanceOf(CreatorInfrastructureNotProvisionedError)
  })

  it('throws when CSW infrastructure row is missing privy_wallet_id', async () => {
    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase()
        if (text.includes('from creator_infrastructure')) {
          return {
            rows: [
              {
                creator_address: '0x1234567890123456789012345678901234567890',
                csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
                privy_wallet_id: '',
                agent_type: 'csw',
              },
            ],
          }
        }
        return { rows: [] }
      }),
    }

    await expect(
      resolveCreatorInfrastructure({
        creatorToken: '0x1234567890123456789012345678901234567890',
        db: db as any,
      }),
    ).rejects.toBeInstanceOf(CreatorInfrastructureNotProvisionedError)
  })

  it('throws mismatch when profile canonical CSW differs from infrastructure row', async () => {
    const { readProfileWalletAuthority } = await import('./canonicalWalletResolver.js')
    vi.mocked(readProfileWalletAuthority).mockResolvedValueOnce({
      profileId: 42,
      canonicalSmartWalletAddress: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      activeOwnerWalletAddress: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
    })

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray) => {
        const text = strings.join(' ').toLowerCase()
        if (text.includes('from creator_infrastructure')) {
          return {
            rows: [
              {
                creator_address: '0x1234567890123456789012345678901234567890',
                csw_address: '0x1111111111111111111111111111111111111111',
                privy_wallet_id: 'privy-test-wallet',
                agent_type: 'csw',
              },
            ],
          }
        }
        if (text.includes('from account_zora_signals')) return { rows: [{ id: 42 }] }
        return { rows: [] }
      }),
    }

    await expect(
      resolveCreatorInfrastructure({
        creatorToken: '0x1234567890123456789012345678901234567890',
        db: db as any,
      }),
    ).rejects.toBeInstanceOf(CreatorInfrastructureMismatchError)
  })
})
