import { beforeEach, describe, expect, it, vi } from 'vitest'

const RAW_SIGNATURE = '0x1234' as `0x${string}`
const CANONICAL_CSW = '0x000000000000000000000000000000000000cafe' as `0x${string}`
const CREATOR_COIN = '0x0000000000000000000000000000000000001001' as `0x${string}`
const OTHER_CREATOR_COIN = '0x0000000000000000000000000000000000002002' as `0x${string}`
const LOTTERY_MANAGER = '0x77705a2f173dd52f28300447506dc35086c34626' as `0x${string}`

const { getDbMock, verifyMessageMock, createPublicClientMock, clientGetBytecodeMock, clientReadContractMock } = vi.hoisted(
  () => ({
    getDbMock: vi.fn(),
    verifyMessageMock: vi.fn(),
    createPublicClientMock: vi.fn(),
    clientGetBytecodeMock: vi.fn(),
    clientReadContractMock: vi.fn(),
  }),
)

vi.mock('../../server/_lib/postgres.js', () => ({
  getDb: getDbMock,
}))

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
    http: vi.fn(() => ({ transport: 'http' })),
    verifyMessage: verifyMessageMock,
  }
})

vi.mock('viem/chains', () => ({
  base: {},
}))

import { buildAmoeEntryMessage, issueAmoeNonce, verifyAmoeEntryProof } from '../../server/_lib/lotteryAmoe.js'

describe('AMOE proof verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDbMock.mockResolvedValue(null)
    verifyMessageMock.mockResolvedValue(false)
    clientGetBytecodeMock.mockResolvedValue('0x1234')
    clientReadContractMock.mockImplementation(async ({ functionName, args }: any) => {
      if (functionName === 'ownerCount') return 1n
      if (functionName === 'nextOwnerIndex') return 1n
      if (functionName === 'isValidSignature') {
        return args?.[1] === RAW_SIGNATURE ? '0xffffffff' : '0x1626ba7e'
      }
      throw new Error(`Unexpected contract function: ${functionName as string}`)
    })
    createPublicClientMock.mockReturnValue({
      getBytecode: clientGetBytecodeMock,
      readContract: clientReadContractMock,
    })
  })

  it('accepts Coinbase Smart Wallet AMOE proofs when ERC-1271 requires a SignatureWrapper', async () => {
    const noncePayload = await issueAmoeNonce({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
    })
    const message = buildAmoeEntryMessage({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
      nonce: noncePayload.nonce,
      issuedAt: noncePayload.issuedAt,
      expiresAt: noncePayload.expiresAt,
      chainId: 8453,
      lotteryManager: LOTTERY_MANAGER,
    })

    await expect(
      verifyAmoeEntryProof({
        creatorCoin: CREATOR_COIN,
        message,
        signature: RAW_SIGNATURE,
        lotteryManager: LOTTERY_MANAGER,
      }),
    ).resolves.toMatchObject({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
      nonce: noncePayload.nonce,
      expiresAt: noncePayload.expiresAt,
    })

    const signatureChecks = clientReadContractMock.mock.calls
      .map(([call]) => call)
      .filter((call) => call.functionName === 'isValidSignature')

    expect(signatureChecks.length).toBeGreaterThan(1)
    expect(signatureChecks[0]?.args?.[1]).toBe(RAW_SIGNATURE)
    expect(signatureChecks.some((call) => call.args?.[1] !== RAW_SIGNATURE)).toBe(true)
  })

  it('rejects creator coin mismatches before consuming the AMOE nonce', async () => {
    verifyMessageMock.mockResolvedValue(true)

    const noncePayload = await issueAmoeNonce({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
    })
    const message = buildAmoeEntryMessage({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
      nonce: noncePayload.nonce,
      issuedAt: noncePayload.issuedAt,
      expiresAt: noncePayload.expiresAt,
      chainId: 8453,
      lotteryManager: LOTTERY_MANAGER,
    })

    await expect(
      verifyAmoeEntryProof({
        creatorCoin: OTHER_CREATOR_COIN,
        message,
        signature: RAW_SIGNATURE,
        lotteryManager: LOTTERY_MANAGER,
      }),
    ).rejects.toThrow('creator_mismatch')

    await expect(
      verifyAmoeEntryProof({
        creatorCoin: CREATOR_COIN,
        message,
        signature: RAW_SIGNATURE,
        lotteryManager: LOTTERY_MANAGER,
      }),
    ).resolves.toMatchObject({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
      nonce: noncePayload.nonce,
    })
  })

  it('rejects replayed AMOE proofs after the nonce is consumed once', async () => {
    verifyMessageMock.mockResolvedValue(true)

    const noncePayload = await issueAmoeNonce({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
    })
    const message = buildAmoeEntryMessage({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
      nonce: noncePayload.nonce,
      issuedAt: noncePayload.issuedAt,
      expiresAt: noncePayload.expiresAt,
      chainId: 8453,
      lotteryManager: LOTTERY_MANAGER,
    })

    await expect(
      verifyAmoeEntryProof({
        creatorCoin: CREATOR_COIN,
        message,
        signature: RAW_SIGNATURE,
        lotteryManager: LOTTERY_MANAGER,
      }),
    ).resolves.toMatchObject({
      wallet: CANONICAL_CSW,
      creatorCoin: CREATOR_COIN,
      nonce: noncePayload.nonce,
    })

    await expect(
      verifyAmoeEntryProof({
        creatorCoin: CREATOR_COIN,
        message,
        signature: RAW_SIGNATURE,
        lotteryManager: LOTTERY_MANAGER,
      }),
    ).rejects.toThrow(/nonce_used|nonce_invalid_or_used/)
  })
})
