import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  readVigilanteFlagsMock,
  resolveCommandIssuerContextByAddressMock,
  assertTeeAttestationOrThrowMock,
  submitUserOpOrRefuseMock,
  readContractMock,
} = vi.hoisted(() => ({
  readVigilanteFlagsMock: vi.fn(),
  resolveCommandIssuerContextByAddressMock: vi.fn(),
  assertTeeAttestationOrThrowMock: vi.fn(),
  submitUserOpOrRefuseMock: vi.fn(),
  readContractMock: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/publicationLedger.js', () => ({
  getLatestSnapshotTs: vi.fn(),
  getSnapshotAt: vi.fn(),
  listRecentPublications: vi.fn(),
  recentPublicationsForCreator: vi.fn(),
}))

vi.mock('../../server/_lib/alfaclub/vigilante.js', () => ({
  readVigilanteFlags: (...args: unknown[]) => readVigilanteFlagsMock(...args),
}))

vi.mock('../../server/_lib/agent/teeAttestationGate.js', () => ({
  assertTeeAttestationOrThrow: (...args: unknown[]) =>
    assertTeeAttestationOrThrowMock(...args),
}))

vi.mock('../../server/_lib/wallet/commandIssuerContext.js', () => ({
  resolveCommandIssuerContextByAddress: (...args: unknown[]) =>
    resolveCommandIssuerContextByAddressMock(...args),
  isExecutionReady: (resolution: { status: string }) => resolution.status === 'ready',
}))

vi.mock('../../server/_lib/wallet/userOperationSubmitter.js', () => ({
  submitUserOpOrRefuse: (...args: unknown[]) => submitUserOpOrRefuseMock(...args),
}))

vi.mock('../../server/_lib/wallet/walletBalancePreflight.js', () => ({
  getBasePreflightPublicClient: () => ({
    readContract: (...args: unknown[]) => readContractMock(...args),
  }),
}))

vi.mock('../../server/_lib/infra/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const { executeAlfaclubCommandFamily } = await import(
  '../../server/commands/families/alfaclub.ts'
)

describe('executeAlfaclubCommandFamily /alfa buy-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    readVigilanteFlagsMock.mockReturnValue({
      killSwitch: false,
      readEnabled: true,
      postEnabled: false,
      feedbackEnabled: false,
      topN: 5,
      cooldownHours: 24,
    })
    assertTeeAttestationOrThrowMock.mockResolvedValue(undefined)
  })

  it('returns usage for missing tokenId', async () => {
    const result = await executeAlfaclubCommandFamily({
      text: '/alfa buy-key',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Usage:')
    expect(submitUserOpOrRefuseMock).not.toHaveBeenCalled()
  })

  it('returns usage for missing tokenId on quote-key', async () => {
    const result = await executeAlfaclubCommandFamily({
      text: '/alfa quote-key',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Usage:')
    expect(submitUserOpOrRefuseMock).not.toHaveBeenCalled()
  })

  it('returns usage for missing create-room payload', async () => {
    const result = await executeAlfaclubCommandFamily({
      text: '/alfa create-room',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Usage:')
    expect(submitUserOpOrRefuseMock).not.toHaveBeenCalled()
  })

  it('returns invalid-payload refusal for malformed create-room payload', async () => {
    const result = await executeAlfaclubCommandFamily({
      text: '/alfa create-room {"roomType":"social"}',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain('Invalid create-room payload')
    expect(submitUserOpOrRefuseMock).not.toHaveBeenCalled()
  })

  it('hard-fails when execution context is not provisioned', async () => {
    resolveCommandIssuerContextByAddressMock.mockResolvedValue({
      status: 'not_provisioned',
      profileId: null,
    })
    const result = await executeAlfaclubCommandFamily({
      text: '/alfa buy-key 42',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })
    expect(result.ok).toBe(false)
    expect(result.response).toContain("isn't provisioned")
    expect(submitUserOpOrRefuseMock).not.toHaveBeenCalled()
  })

  it('submits approve + buy UserOp when allowance is insufficient', async () => {
    resolveCommandIssuerContextByAddressMock.mockResolvedValue({
      status: 'ready',
      context: {
        profileId: 7,
        smartWallet: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        privyOwnerWalletId: 'privy-wallet-id',
        ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        ownerIndex: 0,
        paymasterPolicy: 'cdp_default',
        capsVersion: 1,
        perTxCapWei: 1n,
        dailyCapWei: 1n,
        provisionedAt: new Date(),
        revokedAt: null,
        subAccount: null,
      },
    })

    readContractMock.mockImplementation(async (request: any) => {
      switch (request.functionName) {
        case 'creatorByTokenId':
          return '0x1111111111111111111111111111111111111111'
        case 'getBuyPriceAfterFee':
          return 1_250_000n
        case 'bondingToken':
          return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        case 'decimals':
          return 6
        case 'symbol':
          return 'USDC'
        case 'allowance':
          return 0n
        default:
          throw new Error(`unexpected readContract function: ${String(request.functionName)}`)
      }
    })

    submitUserOpOrRefuseMock.mockResolvedValue({
      ok: true,
      userOpHash: '0xuophash',
      txHash: '0xtxhash',
      smartWallet: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      ownerAddress: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 0,
    })

    const result = await executeAlfaclubCommandFamily({
      text: '/alfa buy-key 42',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Room key purchase submitted')
    expect(result.response).toContain('Approval: included in this UserOp')
    expect(result.response).toContain('https://basescan.org/tx/0xtxhash')
    expect(submitUserOpOrRefuseMock).toHaveBeenCalledTimes(1)
    expect(submitUserOpOrRefuseMock.mock.calls[0][0]?.calls).toHaveLength(2)
  })

  it('returns a quote without submitting a UserOp', async () => {
    readContractMock.mockImplementation(async (request: any) => {
      switch (request.functionName) {
        case 'creatorByTokenId':
          return '0x1111111111111111111111111111111111111111'
        case 'getBuyPriceAfterFee':
          return 2_000_000n
        case 'bondingToken':
          return '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
        case 'decimals':
          return 6
        case 'symbol':
          return 'USDC'
        default:
          throw new Error(`unexpected readContract function: ${String(request.functionName)}`)
      }
    })

    const result = await executeAlfaclubCommandFamily({
      text: '/alfa quote-key 42 2',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Room key quote')
    expect(result.response).toContain('TokenId: 42')
    expect(result.response).toContain('Amount: 2 key(s)')
    expect(result.response).toContain('Estimated cost: 2 USDC')
    expect(result.response).toContain('Suggested max spend: 2.06 USDC')
    expect(result.response).toContain('/alfa buy-key 42 2')
    expect(resolveCommandIssuerContextByAddressMock).not.toHaveBeenCalled()
    expect(submitUserOpOrRefuseMock).not.toHaveBeenCalled()
  })

  it('submits create-room UserOp when payload is valid', async () => {
    resolveCommandIssuerContextByAddressMock.mockResolvedValue({
      status: 'ready',
      context: {
        profileId: 7,
        smartWallet: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        privyOwnerWalletId: 'privy-wallet-id',
        ownerEoa: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
        ownerIndex: 0,
        paymasterPolicy: 'cdp_default',
        capsVersion: 1,
        perTxCapWei: 1n,
        dailyCapWei: 1n,
        provisionedAt: new Date(),
        revokedAt: null,
        subAccount: null,
      },
    })

    readContractMock.mockImplementation(async (request: any) => {
      switch (request.functionName) {
        case 'canRegisterRoom':
          return true
        default:
          throw new Error(`unexpected readContract function: ${String(request.functionName)}`)
      }
    })

    submitUserOpOrRefuseMock.mockResolvedValue({
      ok: true,
      userOpHash: '0xuopcreate',
      txHash: '0xtxcreate',
      smartWallet: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      ownerAddress: '0x6c0ea422aa7bb7e1e17c5257f7023c8f05ddf9b3',
      ownerIndex: 0,
    })

    const result = await executeAlfaclubCommandFamily({
      text: '/alfa create-room {"roomType":"social","tier":"club","additionalKeys":"0","metadata":"ipfs://foo","signature":"0x1234"}',
      senderWallet: '0xab6d5c10b03300326cd7fab7267ae192842967b5',
    })

    expect(result.ok).toBe(true)
    expect(result.response).toContain('Room creation submitted')
    expect(result.response).toContain('Type: social')
    expect(result.response).toContain('Tier: club')
    expect(result.response).toContain('https://basescan.org/tx/0xtxcreate')
    expect(submitUserOpOrRefuseMock).toHaveBeenCalledTimes(1)
    const submitArg = submitUserOpOrRefuseMock.mock.calls[0][0]
    expect(submitArg.calls).toHaveLength(1)
    expect(submitArg.calls[0]?.to).toBe('0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F')
  })
})
