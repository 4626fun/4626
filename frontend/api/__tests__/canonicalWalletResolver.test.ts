import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureCanonicalWalletsSchemaMock,
  getDbMock,
  isDbConfiguredMock,
  readPersistedIdentityMock,
} = vi.hoisted(() => ({
  ensureCanonicalWalletsSchemaMock: vi.fn(async () => undefined),
  getDbMock: vi.fn(),
  isDbConfiguredMock: vi.fn(() => true),
  readPersistedIdentityMock: vi.fn(),
}))

vi.mock('../../server/_lib/canonicalWalletsSchema.js', () => ({
  ensureCanonicalWalletsSchema: ensureCanonicalWalletsSchemaMock,
}))

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
  isDbConfigured: isDbConfiguredMock,
}))

vi.mock('../../server/_lib/walletSync.js', () => ({
  readPersistedIdentity: readPersistedIdentityMock,
}))

import {
  resolveCanonicalSmartWalletAddress,
  resolvePersistedWalletIdentity,
} from '../../server/_lib/canonicalWalletResolver.js'

const PROFILE_ID = 42
const PRIVY_USER_ID = 'did:privy:user-1'
const CANONICAL_CSW = '0x00000000000000000000000000000000000000cc'
const EMBEDDED_EOA = '0x00000000000000000000000000000000000000ee'
const PROFILE_WALLET_ALIAS = '0x00000000000000000000000000000000000000aa'

function buildBroadOnlyAddress(seed: string): `0x${string}` {
  return (`0x${seed.repeat(40).slice(0, 40)}` as `0x${string}`).toLowerCase() as `0x${string}`
}

const BROAD_ONLY_MATCHES = [
  {
    label: 'primary_wallet',
    address: buildBroadOnlyAddress('1'),
    matchFragment: 'lower(primary_wallet)',
  },
  {
    label: 'embedded_wallet',
    address: buildBroadOnlyAddress('2'),
    matchFragment: 'lower(embedded_wallet)',
  },
  {
    label: 'primary_embedded_eoa',
    address: buildBroadOnlyAddress('3'),
    matchFragment: 'lower(primary_embedded_eoa)',
  },
  {
    label: 'base_sub_account',
    address: buildBroadOnlyAddress('4'),
    matchFragment: 'lower(base_sub_account)',
  },
] as const

type MockProfileRow = {
  id: number
  privy_user_id: string | null
}

function normalizeSql(strings: TemplateStringsArray): string {
  return strings.join(' ').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildPersistedIdentity() {
  return {
    primaryWallet: PROFILE_WALLET_ALIAS,
    canonicalSmartWallet: CANONICAL_CSW,
    canonicalSolanaWallet: null,
    operationalSolanaWallet: null,
    embeddedEoa: EMBEDDED_EOA,
    preprovZoraHandle: null,
  }
}

function createBroadOnlyMatchDb(params: {
  address: string
  matchFragment: string
  profileRow?: MockProfileRow
}) {
  const profileRow = params.profileRow ?? {
    id: PROFILE_ID,
    privy_user_id: PRIVY_USER_ID,
  }

  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = normalizeSql(strings)
      const input = String(values[0] ?? '').toLowerCase()

      if (sql.includes('from profiles')) {
        const matched = input === params.address.toLowerCase() && sql.includes(params.matchFragment)
        return { rows: matched ? [profileRow] : [] }
      }

      if (sql.includes('from profile_wallets') && sql.includes('is_canonical_smart_wallet = true')) {
        return { rows: [{ address: CANONICAL_CSW }] }
      }

      return { rows: [] }
    }),
  }
}

function createCanonicalProfileLookupDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = normalizeSql(strings)
      const input = String(values[0] ?? '').toLowerCase()

      if (sql.includes('from profiles')) {
        const matchedProfileWalletLookup =
          input === PROFILE_WALLET_ALIAS.toLowerCase() &&
          sql.includes('from profile_wallets') &&
          sql.includes('where lower(address) =')

        return {
          rows: matchedProfileWalletLookup
            ? [{ id: PROFILE_ID, privy_user_id: PRIVY_USER_ID }]
            : [],
        }
      }

      if (sql.includes('from profile_wallets') && sql.includes('is_canonical_smart_wallet = true')) {
        return { rows: [{ address: CANONICAL_CSW }] }
      }

      return { rows: [] }
    }),
  }
}

function createBroadProfileLookupDb() {
  return {
    sql: vi.fn(async (strings: TemplateStringsArray) => {
      const sql = normalizeSql(strings)
      if (sql.includes('from profiles') && sql.includes('lower(primary_wallet)')) {
        return {
          rows: [{ id: PROFILE_ID, privy_user_id: PRIVY_USER_ID }],
        }
      }

      return { rows: [] }
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  isDbConfiguredMock.mockReturnValue(true)
  ensureCanonicalWalletsSchemaMock.mockResolvedValue(undefined)
  readPersistedIdentityMock.mockResolvedValue(buildPersistedIdentity())
})

describe('resolveCanonicalSmartWalletAddress', () => {
  it.each(BROAD_ONLY_MATCHES)(
    'does not resolve canonical CSW from $label-only profile matches',
    async ({ address, matchFragment }) => {
      getDbMock.mockResolvedValue(
        createBroadOnlyMatchDb({
          address,
          matchFragment,
        }),
      )

      await expect(resolveCanonicalSmartWalletAddress(address)).resolves.toBeNull()
    },
  )

  it('still resolves canonical CSW from canonical-wallet-oriented profile lookups', async () => {
    getDbMock.mockResolvedValue(createCanonicalProfileLookupDb())

    await expect(resolveCanonicalSmartWalletAddress(PROFILE_WALLET_ALIAS)).resolves.toBe(CANONICAL_CSW)
  })
})

describe('resolvePersistedWalletIdentity', () => {
  it.each([
    { label: 'canonical smart wallet', actor: CANONICAL_CSW },
    { label: 'embedded eoa', actor: EMBEDDED_EOA },
  ])('returns the persisted identity for the current $label principal', async ({ actor }) => {
    getDbMock.mockResolvedValue(createBroadProfileLookupDb())

    await expect(resolvePersistedWalletIdentity(actor)).resolves.toEqual({
      profileId: PROFILE_ID,
      canonicalSmartWallet: CANONICAL_CSW,
      embeddedEoa: EMBEDDED_EOA,
      privyUserId: PRIVY_USER_ID,
    })
  })

  it('fails closed for broad historical principals that are no longer current', async () => {
    const staleHistoricalWallet = buildBroadOnlyAddress('5')
    getDbMock.mockResolvedValue(createBroadProfileLookupDb())

    await expect(resolvePersistedWalletIdentity(staleHistoricalWallet)).resolves.toBeNull()
  })
})
