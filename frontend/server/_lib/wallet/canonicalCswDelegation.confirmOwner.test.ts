import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyAuthTokenMock, getUserByIdMock, isOwnerMock, ensureWaitlistSchemaMock, syncUserWalletsMock, classifyLinkedAccountsMock } =
  vi.hoisted(() => ({
    verifyAuthTokenMock: vi.fn(),
    getUserByIdMock: vi.fn(),
    isOwnerMock: vi.fn(),
    ensureWaitlistSchemaMock: vi.fn(async () => {}),
    syncUserWalletsMock: vi.fn(),
    classifyLinkedAccountsMock: vi.fn(),
  }))

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: class {
    verifyAuthToken = verifyAuthTokenMock
    getUserById = getUserByIdMock
  },
}))

vi.mock('./coinbaseSmartWalletOwner.js', () => ({
  isOwner: isOwnerMock,
}))

vi.mock('../onboarding/waitlistSchema.js', () => ({
  ensureWaitlistSchema: ensureWaitlistSchemaMock,
}))

vi.mock('./walletSync.js', () => ({
  syncUserWallets: syncUserWalletsMock,
}))

vi.mock('./walletMapping.js', () => ({
  classifyLinkedAccounts: classifyLinkedAccountsMock,
}))

import { confirmOwnerState, getBaseRpcUrls } from './canonicalCswDelegation'

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

describe('confirmOwnerState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PRIVY_APP_ID = 'test-app-id'
    process.env.PRIVY_APP_SECRET = 'test-app-secret'
    verifyAuthTokenMock.mockResolvedValue({ userId: 'did:privy:test-user' })
    getUserByIdMock.mockResolvedValue({ id: 'did:privy:test-user', linkedAccounts: [] })
    classifyLinkedAccountsMock.mockReturnValue({
      embeddedEoa: { address: '0x00000000000000000000000000000000000000ee' },
    })
    isOwnerMock.mockResolvedValue(true)
  })

  it('casts metadata parameters when confirming a non-embedded owner', async () => {
    const sqlCalls: Array<{ text: string; raw: string }> = []

    const db = {
      sql: vi.fn(async (strings: TemplateStringsArray, ...values: any[]) => {
        const text = normalizeSql(strings)
        const raw = strings.join('')
        sqlCalls.push({ text, raw })

        if (text.includes("to_regclass('public.profile_wallets') is not null as has_profile_wallets")) {
          return {
            rows: [
              {
                has_profile_wallets: true,
                has_chain_id: true,
                has_canonical_csw_address: true,
                has_canonical_source: true,
                has_privy_embedded_eoa_address: true,
                has_privy_is_owner: true,
                has_last_checked_at: true,
              },
            ],
          }
        }
        if (text.includes('select id from profiles where privy_user_id =')) {
          return { rows: [{ id: 11 }] }
        }
        if (text.includes('select pw.profile_id')) {
          return {
            rows: [
              {
                profile_id: 11,
                chain_id: 8453,
                canonical_csw_address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
                canonical_source: 'base_account',
                privy_embedded_eoa_address: '0x00000000000000000000000000000000000000ee',
                privy_is_owner: false,
                last_checked_at: null,
                address: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
                is_canonical_smart_wallet: true,
              },
            ],
          }
        }
        if (text.includes('insert into wallets')) return { rows: [] }
        if (text.includes('update profile_wallets set is_canonical_smart_wallet = false')) return { rows: [] }
        if (text.includes('insert into profile_wallets')) return { rows: [] }
        if (text.includes('update profile_wallets set chain_id = 8453')) return { rows: [] }
        if (text.includes('update profiles set primary_embedded_eoa')) return { rows: [] }
        if (text.includes('update profile_wallets set metadata = coalesce(metadata')) {
          return { rows: [{ address: '0xab6d5c10b03300326cd7fab7267ae192842967b5' }] }
        }
        if (text.includes('update profiles set privy_user_id = coalesce(privy_user_id,')) {
          return { rows: [] }
        }
        // Sub-account lookup added by bootstrapCanonicalDelegationState for
        // execution-track classification. Legacy fixture has no sub-account.
        if (text.includes('select base_sub_account from profiles where id =')) {
          return { rows: [{ base_sub_account: null }] }
        }

        throw new Error(`Unhandled SQL in test: ${text}; values=${JSON.stringify(values)}`)
      }),
    }

    const result = await confirmOwnerState({
      db: db as any,
      req: {
        headers: {
          'x-privy-token': 'test-token',
        },
      } as any,
      ownerAddress: '0x00000000000000000000000000000000000000aa',
      cswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })

    expect(result).toEqual({
      isOwner: true,
      canonicalCswAddress: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
      ownerAddress: '0x00000000000000000000000000000000000000aa',
      confirmationState: 'owner_confirmed',
    })

    const metadataQuery = sqlCalls.find((call) =>
      call.text.includes('update profile_wallets set metadata = coalesce(metadata'),
    )
    expect(metadataQuery?.raw).toContain('::text')
    expect(metadataQuery?.raw).toContain("jsonb_build_object('status', 'active', 'ownerAddress', ")
  })

  it('excludes Cloudflare-challenged public RPC hosts from owner checks', () => {
    const originalBaseRpcUrl = process.env.BASE_RPC_URL
    process.env.BASE_RPC_URL = 'https://base.llamarpc.com,https://mainnet.base.org'

    try {
      expect(getBaseRpcUrls()).toEqual(['https://mainnet.base.org'])
    } finally {
      if (originalBaseRpcUrl === undefined) delete process.env.BASE_RPC_URL
      else process.env.BASE_RPC_URL = originalBaseRpcUrl
    }
  })
})
