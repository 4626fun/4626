import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ENTRYPOINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
const KEEPER_EOA = '0x00000000000000000000000000000000000000aa' as `0x${string}`
const GLOBAL_SMART_WALLET = '0x00000000000000000000000000000000000000ab' as `0x${string}`
const GLOBAL_OWNER = '0x00000000000000000000000000000000000000ac' as `0x${string}`
const CANONICAL_SMART_WALLET = '0x00000000000000000000000000000000000000bb' as `0x${string}`
const EMBEDDED_OWNER = '0x00000000000000000000000000000000000000cc' as `0x${string}`
const TARGET_CONTRACT = '0x00000000000000000000000000000000000000dd' as `0x${string}`
const VAULT_ADDRESS = '0x0000000000000000000000000000000000000011' as `0x${string}`
const ORACLE_ADDRESS = '0x0000000000000000000000000000000000000022' as `0x${string}`
const STRATEGY_ADDRESS = '0x0000000000000000000000000000000000000033' as `0x${string}`
const AUTH_ADDRESS = '0x0000000000000000000000000000000000000044' as `0x${string}`

const {
  getJsonMock,
  postJsonMock,
  createEvmClientForChainMock,
  createPublicClientMock,
  createWalletClientMock,
  publicReadContractMock,
  readContractBytesMock,
  resolveChainIdMock,
  simulateContractMock,
  waitForTransactionReceiptMock,
  walletWriteContractMock,
  privateKeyToAccountMock,
  toAccountMock,
  createBundlerClientMock,
  createPaymasterClientMock,
  bundlerRequestMock,
  sendUserOperationMock,
  waitForUserOperationReceiptMock,
  toCoinbaseSmartAccountMock,
  secp256k1SignHashMock,
  walletRpcMock,
} = vi.hoisted(() => ({
  getJsonMock: vi.fn(),
  postJsonMock: vi.fn(),
  createEvmClientForChainMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  createWalletClientMock: vi.fn(),
  publicReadContractMock: vi.fn(),
  readContractBytesMock: vi.fn(),
  resolveChainIdMock: vi.fn(),
  simulateContractMock: vi.fn(),
  waitForTransactionReceiptMock: vi.fn(),
  walletWriteContractMock: vi.fn(),
  privateKeyToAccountMock: vi.fn(),
  toAccountMock: vi.fn(),
  createBundlerClientMock: vi.fn(),
  createPaymasterClientMock: vi.fn(),
  bundlerRequestMock: vi.fn(),
  sendUserOperationMock: vi.fn(),
  waitForUserOperationReceiptMock: vi.fn(),
  toCoinbaseSmartAccountMock: vi.fn(),
  secp256k1SignHashMock: vi.fn(),
  walletRpcMock: vi.fn(),
}))

vi.mock('../cre-workflows/_shared/http.ts', () => ({
  getJson: getJsonMock,
  postJson: postJsonMock,
}))

vi.mock('../cre-workflows/_shared/evm.ts', () => ({
  createEvmClientForChain: createEvmClientForChainMock,
  readContractBytes: readContractBytesMock,
  resolveChainId: resolveChainIdMock,
}))

vi.mock('@chainlink/cre-sdk', () => ({
  HTTPClient: class HTTPClient {},
  bytesToHex: (value: Uint8Array) => `0x${Buffer.from(value).toString('hex')}`,
  consensusIdenticalAggregation: vi.fn(() => 'consensus'),
}))

vi.mock('viem', () => ({
  createPublicClient: createPublicClientMock,
  createWalletClient: createWalletClientMock,
  decodeFunctionResult: vi.fn(),
  encodeAbiParameters: vi.fn((_: unknown, values: unknown[]) => String(values[0]).toLowerCase()),
  encodeFunctionData: vi.fn(() => '0xdeadbeef'),
  getAddress: (value: string) => value.toLowerCase(),
  http: vi.fn((url: string) => ({ url })),
  isAddress: (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value),
  zeroAddress: '0x0000000000000000000000000000000000000000',
}))

vi.mock('viem/chains', () => ({
  base: { id: 8453 },
}))

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: privateKeyToAccountMock,
  toAccount: toAccountMock,
}))

vi.mock('viem/account-abstraction', () => ({
  createBundlerClient: createBundlerClientMock,
  createPaymasterClient: createPaymasterClientMock,
  entryPoint06Address: ENTRYPOINT_V06,
  sendUserOperation: sendUserOperationMock,
  toCoinbaseSmartAccount: toCoinbaseSmartAccountMock,
  waitForUserOperationReceipt: waitForUserOperationReceiptMock,
}))

vi.mock('../utils/privyWalletApi.js', () => ({
  secp256k1SignHash: secp256k1SignHashMock,
  walletRpc: walletRpcMock,
}))

function installOnchainClientMocks(): void {
  createEvmClientForChainMock.mockReturnValue({})

  createPublicClientMock.mockReturnValue({
    simulateContract: simulateContractMock,
    waitForTransactionReceipt: waitForTransactionReceiptMock,
    readContract: publicReadContractMock,
    getBlock: vi.fn(),
    getBalance: vi.fn(),
    getBlockNumber: vi.fn(),
    getLogs: vi.fn(),
  })

  createWalletClientMock.mockReturnValue({
    account: { address: KEEPER_EOA },
    writeContract: walletWriteContractMock,
  })

  createBundlerClientMock.mockReturnValue({
    request: bundlerRequestMock,
  })

  createPaymasterClientMock.mockReturnValue({
    getPaymasterData: vi.fn(),
    getPaymasterStubData: vi.fn(),
  })

  privateKeyToAccountMock.mockImplementation(() => ({ address: KEEPER_EOA }))
  toAccountMock.mockImplementation((config: { address: `0x${string}` }) => ({
    address: config.address,
  }))
  toCoinbaseSmartAccountMock.mockImplementation(
    async (config: { address: `0x${string}`; ownerIndex: number; version: '1' | '1.1' }) => ({
      address: config.address,
      ownerIndex: config.ownerIndex,
      version: config.version,
    }),
  )

  bundlerRequestMock.mockResolvedValue([ENTRYPOINT_V06])
  resolveChainIdMock.mockReturnValue(8453)
  sendUserOperationMock.mockResolvedValue('0xuserop')
  waitForUserOperationReceiptMock.mockResolvedValue({
    receipt: {
      transactionHash: '0xtxhash',
      status: 'success',
    },
  })

  walletWriteContractMock.mockResolvedValue('0xlegacytx')
  waitForTransactionReceiptMock.mockResolvedValue({ status: 'success' })
  simulateContractMock.mockResolvedValue({})
  secp256k1SignHashMock.mockResolvedValue('0xsigned')
  walletRpcMock.mockResolvedValue({ data: { signature: '0xpersonal' } })
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

const ENV_KEYS = [
  'DRY_RUN',
  'CRE_ERC4337_ENABLED',
  'CRE_ERC4337_SMART_WALLET',
  'CRE_ERC4337_OWNER',
  'CRE_ERC4337_PRIVY_WALLET_ID',
  'CRE_ERC4337_BUNDLER_URL',
  'CRE_ERC4337_PAYMASTER_URL',
  'CRE_ERC4337_VERSION',
  'KEEPR_PRIVATE_KEY',
  'BASE_RPC_URL',
] as const

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  string,
  string | undefined
>

describe('canonical sender context plumbing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    installOnchainClientMocks()
    process.env.KEEPR_PRIVATE_KEY =
      '0x0000000000000000000000000000000000000000000000000000000000000001'
    process.env.BASE_RPC_URL = 'https://mainnet.base.org'
    delete process.env.DRY_RUN
    delete process.env.CRE_ERC4337_ENABLED
    delete process.env.CRE_ERC4337_SMART_WALLET
    delete process.env.CRE_ERC4337_OWNER
    delete process.env.CRE_ERC4337_PRIVY_WALLET_ID
    delete process.env.CRE_ERC4337_BUNDLER_URL
    delete process.env.CRE_ERC4337_PAYMASTER_URL
    delete process.env.CRE_ERC4337_VERSION
  })

  afterEach(() => {
    restoreEnv(ORIGINAL_ENV)
  })

  it('preserves the protected automation block from the CRE active-vault feed', async () => {
    getJsonMock.mockReturnValue({
      success: true,
      data: {
        vaults: [
          {
            vaultAddress: VAULT_ADDRESS,
            chainId: 8453,
            groupId: 'group-1',
            oracleAddress: ORACLE_ADDRESS,
            automation: {
              automationEnabled: true,
              automationScope: 'ajna_min_bucket_only',
              canonicalCswAddress: CANONICAL_SMART_WALLET,
              embeddedEoaAddress: EMBEDDED_OWNER,
              privyWalletId: 'wallet-canonical-owner',
            },
          },
        ],
      },
    })

    const { fetchActiveVaults } = await import('../cre-workflows/_shared/strategyQueue.js')
    const vaults = fetchActiveVaults({} as never, {} as never, 'secret', 8453)

    expect(vaults).toEqual([
      {
        vaultAddress: VAULT_ADDRESS,
        chainId: 8453,
        groupId: 'group-1',
        oracleAddress: ORACLE_ADDRESS,
        automation: {
          automationEnabled: true,
          automationScope: 'ajna_min_bucket_only',
          canonicalCswAddress: CANONICAL_SMART_WALLET,
          embeddedEoaAddress: EMBEDDED_OWNER,
          privyWalletId: 'wallet-canonical-owner',
        },
      },
    ])
  })

  it(
    'derives Ajna execution context only from enabled canonical automation and carries it into payloads',
    async () => {
    const {
      buildAjnaRebucketActionPayload,
      getAjnaVaultExecutionContext,
    } = await import('../cre-workflows/_shared/ajnaManager.js')

    const executionContext = getAjnaVaultExecutionContext({
      automation: {
        automationEnabled: true,
        automationScope: 'ajna_min_bucket_only',
        canonicalCswAddress: CANONICAL_SMART_WALLET,
        embeddedEoaAddress: EMBEDDED_OWNER,
        privyWalletId: 'wallet-canonical-owner',
      },
    })

    expect(executionContext).toEqual({
      smartWallet: CANONICAL_SMART_WALLET,
      ownerAddress: EMBEDDED_OWNER,
      privyWalletId: 'wallet-canonical-owner',
      version: '1',
    })

    expect(
      getAjnaVaultExecutionContext({
        automation: {
          automationEnabled: true,
          automationScope: 'vault',
          canonicalCswAddress: CANONICAL_SMART_WALLET,
          embeddedEoaAddress: EMBEDDED_OWNER,
          privyWalletId: 'wallet-canonical-owner',
        },
      }),
    ).toBeNull()

    expect(
      buildAjnaRebucketActionPayload({
        vaultAddress: VAULT_ADDRESS,
        strategyAddress: STRATEGY_ADDRESS,
        authAddress: AUTH_ADDRESS,
        oracleAddress: ORACLE_ADDRESS,
        currentBucket: 1_000,
        suggestedBucket: 1_500,
        steppedBucket: 1_250,
        targetBucket: 1_250,
        timestamp: '2026-03-10T00:00:00.000Z',
        executionContext: executionContext!,
      }).executionContext,
    ).toEqual(executionContext)
    },
    15_000,
  )

  it('fails closed when a provided execution context is empty', async () => {
    process.env.DRY_RUN = 'true'

    const { writeContract } = await import('../utils/onchain.js')
    const result = await writeContract({
      address: TARGET_CONTRACT,
      abi: [],
      functionName: 'setMinBucketIndex',
      args: [1_250n],
      executionContext: {},
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('execution_context_incomplete')
    expect(simulateContractMock).not.toHaveBeenCalled()
  })

  it('simulates Ajna writes as the per-vault canonical smart wallet in dry-run mode', async () => {
    process.env.DRY_RUN = 'true'
    process.env.CRE_ERC4337_ENABLED = 'false'

    const { writeContract } = await import('../utils/onchain.js')
    const result = await writeContract({
      address: TARGET_CONTRACT,
      abi: [],
      functionName: 'setMinBucketIndex',
      args: [1_250n],
      executionContext: {
        smartWallet: CANONICAL_SMART_WALLET,
        ownerAddress: EMBEDDED_OWNER,
        privyWalletId: 'wallet-canonical-owner',
        version: '1.1',
      },
    })

    expect(result.success).toBe(true)
    expect(simulateContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        account: CANONICAL_SMART_WALLET,
      }),
    )
  })

  it('prefers the per-call ERC-4337 context over the global Ajna sender fallback', async () => {
    process.env.CRE_ERC4337_ENABLED = 'true'
    process.env.CRE_ERC4337_SMART_WALLET = GLOBAL_SMART_WALLET
    process.env.CRE_ERC4337_OWNER = GLOBAL_OWNER
    process.env.CRE_ERC4337_PRIVY_WALLET_ID = 'wallet-global-owner'
    process.env.CRE_ERC4337_BUNDLER_URL = 'https://bundler.test'
    process.env.CRE_ERC4337_PAYMASTER_URL = 'https://paymaster.test'

    publicReadContractMock.mockImplementation(
      async ({
        address,
        functionName,
      }: {
        address: `0x${string}`
        functionName: string
      }) => {
        switch (functionName) {
          case 'ownerCount':
            return 1n
          case 'nextOwnerIndex':
            return 1n
          case 'ownerAtIndex':
            return address.toLowerCase() === GLOBAL_SMART_WALLET.toLowerCase()
              ? GLOBAL_OWNER.toLowerCase()
              : EMBEDDED_OWNER.toLowerCase()
          default:
            throw new Error(`Unhandled public read mock for ${functionName}`)
        }
      },
    )

    const { writeContract } = await import('../utils/onchain.js')
    const result = await writeContract({
      address: TARGET_CONTRACT,
      abi: [],
      functionName: 'setMinBucketIndex',
      args: [1_250n],
      executionContext: {
        smartWallet: CANONICAL_SMART_WALLET,
        ownerAddress: EMBEDDED_OWNER,
        privyWalletId: 'wallet-canonical-owner',
        version: '1.1',
      },
    })

    expect(result.success).toBe(true)
    expect(toAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: EMBEDDED_OWNER,
      }),
    )
    expect(toCoinbaseSmartAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CANONICAL_SMART_WALLET,
        version: '1.1',
      }),
    )
  })

  it('surfaces enabled-but-unusable Ajna automation as a canonical sender error', async () => {
    getJsonMock.mockReturnValue({
      success: true,
      data: {
        vaults: [
          {
            vaultAddress: VAULT_ADDRESS,
            chainId: 8453,
            groupId: 'group-1',
            oracleAddress: ORACLE_ADDRESS,
            automation: {
              automationEnabled: true,
              automationScope: 'ajna_min_bucket_only',
              canonicalCswAddress: CANONICAL_SMART_WALLET,
              privyWalletId: 'wallet-canonical-owner',
            },
          },
        ],
      },
    })

    const runtime = {
      config: {
        apiBaseUrl: 'https://4626.fun/api',
        chainName: 'base',
        twapDuration: 1800,
        targetLtvBps: 7000,
        priceChangeTriggerBps: 1000,
        moveThreshold: 50,
        maxStep: 250,
        liquiditySearchRadius: 20,
        maxVaultsPerExecution: 10,
        maxStrategiesPerVault: 5,
        rotationIntervalSeconds: 300,
      },
      getSecret: () => ({
        result: () => ({ value: 'secret' }),
      }),
      runInNodeMode:
        (fn: (nodeRuntime: unknown) => unknown) =>
        () => ({
          result: () => fn({}),
        }),
      now: () => new Date('2026-03-10T00:00:00.000Z'),
      log: vi.fn(),
    }

    const { evaluateAndEnqueueAjnaActions } = await import('../cre-workflows/_shared/ajnaManager.js')
    const result = evaluateAndEnqueueAjnaActions(runtime as never)

    expect(result.eligibleVaults).toBe(1)
    expect(result.selectedVaults).toBe(1)
    expect(result.enqueuedActions).toBe(0)
    expect(result.errors).toEqual([
      `${VAULT_ADDRESS}:canonical_sender_required:missing_execution_context`,
    ])
    expect(readContractBytesMock).not.toHaveBeenCalled()
    expect(postJsonMock).not.toHaveBeenCalled()
  }, 15_000)
})
