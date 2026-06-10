import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getKeeperAddressMock,
  readContractMock,
  writeContractMock,
  fetchActiveVaultsMock,
  filterVaultsForWorkflowMock,
  alertInfoMock,
  alertWarningMock,
  alertCriticalMock,
} = vi.hoisted(() => ({
  getKeeperAddressMock: vi.fn(),
  readContractMock: vi.fn(),
  writeContractMock: vi.fn(),
  fetchActiveVaultsMock: vi.fn(),
  filterVaultsForWorkflowMock: vi.fn(),
  alertInfoMock: vi.fn(async () => {}),
  alertWarningMock: vi.fn(async () => {}),
  alertCriticalMock: vi.fn(async () => {}),
}));

vi.mock('../utils/onchain.js', () => ({
  getKeeperAddress: getKeeperAddressMock,
  normalizeWriteExecutionContext: (
    executionContext:
      | {
          smartWallet?: `0x${string}`;
          ownerAddress?: `0x${string}`;
          privyWalletId?: string;
          version?: '1' | '1.1';
        }
      | undefined,
  ) => {
    if (executionContext === undefined) return null;

    if (
      !executionContext.smartWallet ||
      !executionContext.ownerAddress ||
      !executionContext.privyWalletId
    ) {
      throw new Error('execution_context_incomplete');
    }

    return {
      smartWallet: executionContext.smartWallet,
      ownerAddress: executionContext.ownerAddress,
      privyWalletId: executionContext.privyWalletId,
      version: executionContext.version === '1.1' ? '1.1' : '1',
    };
  },
  readContract: readContractMock,
  resolveCanonicalAjnaExecutionContext: (
    automation: {
      automationEnabled?: boolean;
      automationScope?: string;
      canonicalCswAddress?: `0x${string}` | null;
      embeddedEoaAddress?: `0x${string}` | null;
      privyWalletId?: string | null;
    } | null | undefined,
  ) => {
    if (
      !automation?.automationEnabled ||
      automation.automationScope !== 'ajna_min_bucket_only' ||
      !automation.canonicalCswAddress ||
      !automation.embeddedEoaAddress ||
      !automation.privyWalletId
    ) {
      return null;
    }

    return {
      smartWallet: automation.canonicalCswAddress,
      ownerAddress: automation.embeddedEoaAddress,
      privyWalletId: automation.privyWalletId,
      version: '1' as const,
    };
  },
  writeContract: writeContractMock,
}));

vi.mock('../utils/registry.js', () => ({
  fetchActiveVaults: fetchActiveVaultsMock,
  filterVaultsForWorkflow: filterVaultsForWorkflowMock,
}));

vi.mock('../utils/alerts.js', () => ({
  alertInfo: alertInfoMock,
  alertWarning: alertWarningMock,
  alertCritical: alertCriticalMock,
}));

import {
  bucketPriceChangeBps,
  clampBucketIndex,
  clampMinBucketIndex,
  computeSteppedBucket,
  deriveAjnaBucketFromV3Tick,
  executeAjnaBucketManager,
  pickBestLiquidityBucket,
  tickToAjnaBucket,
} from '../actions/ajna-bucket-manager.action.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`;
const GLOBAL_KEEPER = '0x00000000000000000000000000000000000000aa' as `0x${string}`;
const CANONICAL_SMART_WALLET = '0x00000000000000000000000000000000000000bb' as `0x${string}`;
const EMBEDDED_OWNER = '0x00000000000000000000000000000000000000cc' as `0x${string}`;
const VAULT_ADDRESS = '0x0000000000000000000000000000000000000011' as `0x${string}`;
const ORACLE_ADDRESS = '0x0000000000000000000000000000000000000022' as `0x${string}`;
const STRATEGY_ADDRESS = '0x0000000000000000000000000000000000000033' as `0x${string}`;
const INNER_VAULT_ADDRESS = '0x0000000000000000000000000000000000000044' as `0x${string}`;
const AJNA_POOL_ADDRESS = '0x0000000000000000000000000000000000000055' as `0x${string}`;
const AUTH_ADDRESS = '0x0000000000000000000000000000000000000066' as `0x${string}`;
const CREATOR_TOKEN = '0x0000000000000000000000000000000000000077' as `0x${string}`;
const USD_TOKEN = '0x0000000000000000000000000000000000000088' as `0x${string}`;
const CANONICAL_PRIVY_WALLET_ID = 'wallet-canonical-owner';
const ENV_KEYS = [
  'AJNA_BUCKET_VAULT_ADDRESS',
  'AJNA_BUCKET_ORACLE_ADDRESS',
  'AJNA_BUCKET_CANONICAL_CSW_ADDRESS',
  'AJNA_BUCKET_EMBEDDED_EOA_ADDRESS',
  'AJNA_BUCKET_PRIVY_WALLET_ID',
  'AJNA_BUCKET_CSW_VERSION',
  'VAULT_ADDRESS',
  'ORACLE_ADDRESS',
] as const;
const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<
  string,
  string | undefined
>;

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function createAjnaVault(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    vaultAddress: VAULT_ADDRESS,
    chainId: 8453,
    groupId: 'group-1',
    oracleAddress: ORACLE_ADDRESS,
    automation: {
      automationEnabled: true,
      automationScope: 'ajna_min_bucket_only',
      canonicalCswAddress: CANONICAL_SMART_WALLET,
      embeddedEoaAddress: EMBEDDED_OWNER,
      privyWalletId: CANONICAL_PRIVY_WALLET_ID,
    },
    ...overrides,
  };
}

function installAjnaHappyPath(authAdmin: `0x${string}` = CANONICAL_SMART_WALLET): void {
  readContractMock.mockImplementation(
    async ({
      functionName,
      args,
    }: {
      functionName: string;
      args?: readonly unknown[];
    }) => {
      switch (functionName) {
        case 'getV3TWAPTick':
          return -401_529n;
        case 'v3CreatorToken':
          return CREATOR_TOKEN;
        case 'v3UsdToken':
          return USD_TOKEN;
        case 'v3CreatorDecimals':
          return 18n;
        case 'v3UsdDecimals':
          return 6n;
        case 'strategyList':
          return args?.[0] === 0n ? STRATEGY_ADDRESS : ZERO_ADDRESS;
        case 'strategyWeights':
          return 1n;
        case 'ERC4626_VAULT':
          return INNER_VAULT_ADDRESS;
        case 'AJNA_POOL':
          return AJNA_POOL_ADDRESS;
        case 'AUTH':
          return AUTH_ADDRESS;
        case 'admin':
          return authAdmin;
        case 'minBucketIndex':
          return 1_000n;
        case 'bucketInfo':
          return [0n, 0n, 0n, 1n, 0n];
        default:
          throw new Error(`Unhandled readContract mock for ${functionName}`);
      }
    },
  );
}

describe('ajna bucket manager helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperAddressMock.mockReturnValue(GLOBAL_KEEPER);
    writeContractMock.mockResolvedValue({
      txHash: '0x1234' as `0x${string}`,
      success: true,
    });
    fetchActiveVaultsMock.mockResolvedValue([]);
    filterVaultsForWorkflowMock.mockImplementation((vaults: unknown[]) => vaults);
  });

  it('clamps bucket index bounds', () => {
    expect(clampBucketIndex(0)).toBe(1);
    expect(clampBucketIndex(9_999)).toBe(7_388);
    expect(clampBucketIndex(4_156)).toBe(4_156);
  });

  it('preserves zero for min-bucket floor bounds', () => {
    expect(clampMinBucketIndex(0)).toBe(0);
    expect(clampMinBucketIndex(9_999)).toBe(7_388);
    expect(clampMinBucketIndex(4_156)).toBe(4_156);
  });

  it('does not move when delta is under threshold', () => {
    const out = computeSteppedBucket({
      currentBucket: 4_156,
      suggestedBucket: 4_180,
      moveThreshold: 50,
      maxStep: 250,
    });
    expect(out.shouldMove).toBe(false);
    expect(out.steppedBucket).toBe(4_156);
    expect(out.rawDelta).toBe(24);
  });

  it('caps upward move by max step', () => {
    const out = computeSteppedBucket({
      currentBucket: 4_156,
      suggestedBucket: 5_000,
      moveThreshold: 50,
      maxStep: 250,
    });
    expect(out.shouldMove).toBe(true);
    expect(out.steppedBucket).toBe(4_406);
    expect(out.rawDelta).toBe(844);
  });

  it('caps downward move by max step', () => {
    const out = computeSteppedBucket({
      currentBucket: 4_156,
      suggestedBucket: 3_000,
      moveThreshold: 50,
      maxStep: 250,
    });
    expect(out.shouldMove).toBe(true);
    expect(out.steppedBucket).toBe(3_906);
    expect(out.rawDelta).toBe(-1_156);
  });

  it('picks bucket with highest nearby liquidity', () => {
    const chosen = pickBestLiquidityBucket({
      centerBucket: 4_406,
      candidates: [
        { index: 4_390, deposit: 100n },
        { index: 4_406, deposit: 250n },
        { index: 4_420, deposit: 600n },
      ],
    });
    expect(chosen).toBe(4_420);
  });

  it('breaks equal-liquidity ties by closest distance to center', () => {
    const chosen = pickBestLiquidityBucket({
      centerBucket: 4_406,
      candidates: [
        { index: 4_370, deposit: 600n },
        { index: 4_410, deposit: 600n },
      ],
    });
    expect(chosen).toBe(4_410);
  });

  it('derives practical short bucket for 18/6 CREATOR-USDC pricing', () => {
    const bucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });
    expect(bucket).not.toBeNull();
    expect(bucket).toBeGreaterThan(1);
    expect(bucket).toBeLessThan(7_388);
    expect(bucket).toBeGreaterThan(1_400);
    expect(bucket).toBeLessThan(2_000);
  });

  it('keeps bucket derivation stable across token ordering flips', () => {
    const creatorAsToken0 = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x0000000000000000000000000000000000000011',
      usdToken: '0x0000000000000000000000000000000000000022',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    const creatorAsToken1 = deriveAjnaBucketFromV3Tick({
      twapTick: 401_529,
      creatorToken: '0x0000000000000000000000000000000000000022',
      usdToken: '0x0000000000000000000000000000000000000011',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    expect(creatorAsToken0).toBe(creatorAsToken1);
  });

  it('moves to more conservative bucket as LTV decreases', () => {
    const marketLtvBucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 10_000,
    });
    const conservativeLtvBucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    expect(marketLtvBucket).not.toBeNull();
    expect(conservativeLtvBucket).not.toBeNull();
    expect(conservativeLtvBucket!).toBeGreaterThan(marketLtvBucket!);
  });

  it('shows why non-normalized tick orientation clamps to bucket 1', () => {
    const naiveBucket = tickToAjnaBucket(401_529);
    const normalizedBucket = deriveAjnaBucketFromV3Tick({
      twapTick: -401_529,
      creatorToken: '0x5b674196812451B7cEC024FE9d22D2c0b172fa75',
      usdToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      creatorDecimals: 18,
      usdDecimals: 6,
      targetLtvBps: 7_000,
    });

    expect(naiveBucket).toBe(1);
    expect(normalizedBucket).not.toBe(1);
  });

  it('computes bucket price change in bps', () => {
    expect(
      bucketPriceChangeBps({
        currentBucket: 1000,
        suggestedBucket: 1000,
      }),
    ).toBe(0);

    // One bucket step is roughly +0.5% => 50 bps.
    expect(
      bucketPriceChangeBps({
        currentBucket: 1000,
        suggestedBucket: 1001,
      }),
    ).toBe(49);
  });

  it('10% trigger gate aligns with bucket distance', () => {
    const nineBucketMove = bucketPriceChangeBps({
      currentBucket: 1200,
      suggestedBucket: 1209,
    });
    const nineteenBucketMove = bucketPriceChangeBps({
      currentBucket: 1200,
      suggestedBucket: 1219,
    });
    const twentyBucketMove = bucketPriceChangeBps({
      currentBucket: 1200,
      suggestedBucket: 1220,
    });
    expect(nineBucketMove).toBeLessThan(1_000); // <10%
    expect(nineteenBucketMove).toBeLessThan(1_000); // still <10% with flooring
    expect(twentyBucketMove).toBeGreaterThanOrEqual(1_000); // >=10%
  });
});

describe('ajna bucket manager canonical execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getKeeperAddressMock.mockReturnValue(GLOBAL_KEEPER);
    writeContractMock.mockResolvedValue({
      txHash: '0x1234' as `0x${string}`,
      success: true,
    });
    fetchActiveVaultsMock.mockResolvedValue([]);
    filterVaultsForWorkflowMock.mockImplementation((vaults: unknown[]) => vaults);
    for (const key of ENV_KEYS) {
      setEnv(key, undefined);
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, ORIGINAL_ENV[key]);
    }
  });

  it('skips feed vaults that do not expose enabled canonical Ajna automation', async () => {
    fetchActiveVaultsMock.mockResolvedValue([
      createAjnaVault({ automation: undefined }),
    ]);

    const result = await executeAjnaBucketManager();

    expect(result.totalVaults).toBe(0);
    expect(readContractMock).not.toHaveBeenCalled();
    expect(writeContractMock).not.toHaveBeenCalled();
    expect(getKeeperAddressMock).not.toHaveBeenCalled();
  });

  it('hard-stops feed vaults whose enabled canonical automation is incomplete', async () => {
    fetchActiveVaultsMock.mockResolvedValue([
      createAjnaVault({
        automation: {
          automationEnabled: true,
          automationScope: 'ajna_min_bucket_only',
          canonicalCswAddress: CANONICAL_SMART_WALLET,
          privyWalletId: CANONICAL_PRIVY_WALLET_ID,
        },
      }),
    ]);

    const result = await executeAjnaBucketManager();

    expect(result.totalVaults).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.results[0]?.error).toBe('canonical_sender_required:feed');
    expect(readContractMock).not.toHaveBeenCalled();
    expect(writeContractMock).not.toHaveBeenCalled();
  });

  it('writes Ajna rebuckets with the vault canonical execution context', async () => {
    fetchActiveVaultsMock.mockResolvedValue([createAjnaVault()]);
    installAjnaHappyPath();

    const result = await executeAjnaBucketManager();

    expect(result.moved).toBe(1);
    expect(writeContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AUTH_ADDRESS,
        functionName: 'setMinBucketIndex',
        executionContext: {
          smartWallet: CANONICAL_SMART_WALLET,
          ownerAddress: EMBEDDED_OWNER,
          privyWalletId: CANONICAL_PRIVY_WALLET_ID,
          version: '1',
        },
      }),
    );
    expect(getKeeperAddressMock).not.toHaveBeenCalled();
  });

  it('supports explicit single-vault canonical execution context from env', async () => {
    setEnv('AJNA_BUCKET_VAULT_ADDRESS', VAULT_ADDRESS);
    setEnv('AJNA_BUCKET_ORACLE_ADDRESS', ORACLE_ADDRESS);
    setEnv('AJNA_BUCKET_CANONICAL_CSW_ADDRESS', CANONICAL_SMART_WALLET);
    setEnv('AJNA_BUCKET_EMBEDDED_EOA_ADDRESS', EMBEDDED_OWNER);
    setEnv('AJNA_BUCKET_PRIVY_WALLET_ID', CANONICAL_PRIVY_WALLET_ID);
    setEnv('AJNA_BUCKET_CSW_VERSION', '1.1');
    installAjnaHappyPath();

    const result = await executeAjnaBucketManager();

    expect(result.moved).toBe(1);
    expect(writeContractMock).toHaveBeenCalledWith(
      expect.objectContaining({
        address: AUTH_ADDRESS,
        executionContext: {
          smartWallet: CANONICAL_SMART_WALLET,
          ownerAddress: EMBEDDED_OWNER,
          privyWalletId: CANONICAL_PRIVY_WALLET_ID,
          version: '1.1',
        },
      }),
    );
    expect(fetchActiveVaultsMock).not.toHaveBeenCalled();
  });

  it('hard-stops instead of falling back to the global signer when auth admin mismatches', async () => {
    fetchActiveVaultsMock.mockResolvedValue([createAjnaVault()]);
    installAjnaHappyPath(GLOBAL_KEEPER);

    const result = await executeAjnaBucketManager();

    expect(writeContractMock).not.toHaveBeenCalled();
    expect(result.errors).toBe(1);
    expect(result.results[0]?.error).toContain('canonical_sender_required');
    expect(getKeeperAddressMock).not.toHaveBeenCalled();
  });
});

