/**
 * Ajna Bucket Manager — oracle + liquidity aware bucket rebalancing.
 *
 * Goal:
 * - Follow oracle price drift without hardcoding one bucket forever.
 * - Add guardrails so bucket moves are incremental and predictable.
 * - Bias target bucket toward nearby buckets with deeper quote liquidity.
 *
 * Flow per vault:
 *  1) Read oracle suggested bucket from V3 TWAP.
 *  2) Read nested Ajna auth current min bucket.
 *  3) Apply threshold + max-step guardrails.
 *  4) Scan nearby buckets for quote liquidity and pick best local bucket.
 *  5) If keeper is auth admin, call setMinBucketIndex.
 */

import { getAddress, isAddress } from 'viem';
import {
  AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS,
  AJNA_BUCKET_MAX_STEP,
  AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS,
  AJNA_BUCKET_MOVE_THRESHOLD,
  AJNA_BUCKET_TARGET_LTV_BPS,
  AJNA_BUCKET_TWAP_DURATION,
  CHAINS,
  ORACLE_ABI,
} from '../config.js';
import {
  getKeeperAddress,
  readContract,
  writeContract,
  type WriteResult,
} from '../utils/onchain.js';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';
import { fetchActiveVaults, filterVaultsForWorkflow, type VaultConfig } from '../utils/registry.js';

const WORKFLOW_NAME = 'ajna-bucket-manager';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MIN_BUCKET_INDEX = 1;
const MAX_BUCKET_INDEX = 7388;
const MAX_STRATEGIES = 5;
const AJNA_BUCKET_PRICE_STEP = 1.005;
const LOG_1_0001 = Math.log(1.0001);
const LOG_10_BASE_1_0001 = Math.log(10) / LOG_1_0001;

const VAULT_STRATEGY_VIEW_ABI = [
  {
    type: 'function',
    name: 'strategyList',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'strategyWeights',
    stateMutability: 'view',
    inputs: [{ name: 'strategy', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const AJNA_ADAPTER_VIEW_ABI = [
  { type: 'function', name: 'ERC4626_VAULT', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const AJNA_INNER_VAULT_VIEW_ABI = [
  { type: 'function', name: 'AJNA_POOL', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'AUTH', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const AJNA_AUTH_VIEW_ABI = [
  { type: 'function', name: 'admin', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'minBucketIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const AJNA_AUTH_ADMIN_ABI = [
  {
    type: 'function',
    name: 'setMinBucketIndex',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'nextMinBucketIndex', type: 'uint256' }],
    outputs: [],
  },
] as const;

const AJNA_POOL_VIEW_ABI = [
  {
    type: 'function',
    name: 'lenderInfo',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }, { name: 'lender', type: 'address' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'bucketInfo',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [
      { name: 'lpBalance', type: 'uint256' },
      { name: 'collateral', type: 'uint256' },
      { name: 'bankruptcyTime', type: 'uint256' },
      { name: 'deposit', type: 'uint256' },
      { name: 'scale', type: 'uint256' },
    ],
  },
] as const;

interface RuntimeConfig {
  twapDuration: number;
  targetLtvBps: number;
  priceChangeTriggerBps: number;
  moveThreshold: number;
  maxStep: number;
  searchRadius: number;
}

export interface AjnaAdapterContext {
  strategyAddress: `0x${string}`;
  ajnaPool: `0x${string}`;
  authAddress: `0x${string}`;
  currentBucket: number;
  authAdmin: `0x${string}`;
  weight: bigint;
}

export interface BucketMoveResult {
  vaultAddress: `0x${string}`;
  strategyAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  currentBucket: number;
  suggestedBucket: number;
  steppedBucket: number;
  targetBucket: number;
  moved: boolean;
  method?: 'setMinBucketIndex';
  txHash?: `0x${string}`;
  skippedReason?: string;
  error?: string;
}

export interface BatchAjnaBucketResult {
  totalVaults: number;
  totalStrategies: number;
  processed: number;
  moved: number;
  skipped: number;
  errors: number;
  results: BucketMoveResult[];
}

function parsePositiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseBpsEnv(key: string, fallback: number): number {
  const value = parsePositiveIntEnv(key, fallback);
  if (value > 10_000) return fallback;
  return value;
}

function buildRuntimeConfig(): RuntimeConfig {
  return {
    twapDuration: parsePositiveIntEnv('AJNA_BUCKET_TWAP_DURATION', AJNA_BUCKET_TWAP_DURATION),
    targetLtvBps: parseBpsEnv('AJNA_BUCKET_TARGET_LTV_BPS', AJNA_BUCKET_TARGET_LTV_BPS),
    priceChangeTriggerBps: parseBpsEnv(
      'AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS',
      AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS,
    ),
    moveThreshold: parsePositiveIntEnv('AJNA_BUCKET_MOVE_THRESHOLD', AJNA_BUCKET_MOVE_THRESHOLD),
    maxStep: parsePositiveIntEnv('AJNA_BUCKET_MAX_STEP', AJNA_BUCKET_MAX_STEP),
    searchRadius: parsePositiveIntEnv(
      'AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS',
      AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS,
    ),
  };
}

function asAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value) as `0x${string}`;
}

export function clampBucketIndex(index: number): number {
  return Math.max(MIN_BUCKET_INDEX, Math.min(MAX_BUCKET_INDEX, Math.floor(index)));
}

export function clampMinBucketIndex(index: number): number {
  return Math.max(0, Math.min(MAX_BUCKET_INDEX, Math.floor(index)));
}

function floorDiv(a: number, b: number): number {
  const q = Math.trunc(a / b);
  const r = a % b;
  if (a < 0 && r !== 0) return q - 1;
  return q;
}

export function tickToAjnaBucket(tick: number): number {
  const q = floorDiv(tick, 50);
  return clampBucketIndex(4156 - q);
}

/**
 * Approximate implied price-change threshold between two Ajna buckets.
 * Each bucket step is ~0.5% (x1.005) on quote/collateral price.
 */
export function bucketPriceChangeBps(params: {
  currentBucket: number;
  suggestedBucket: number;
}): number {
  const current = clampMinBucketIndex(params.currentBucket);
  const suggested = clampMinBucketIndex(params.suggestedBucket);
  const delta = Math.abs(suggested - current);
  if (delta === 0) return 0;

  const ratio = Math.pow(AJNA_BUCKET_PRICE_STEP, delta);
  if (!Number.isFinite(ratio) || ratio <= 1) return Number.MAX_SAFE_INTEGER;

  const bps = Math.floor((ratio - 1) * 10_000);
  if (!Number.isFinite(bps) || bps < 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(Number.MAX_SAFE_INTEGER, bps);
}

function compareAddressNumeric(a: `0x${string}`, b: `0x${string}`): number {
  const av = BigInt(a);
  const bv = BigInt(b);
  if (av === bv) return 0;
  return av > bv ? 1 : -1;
}

export function deriveAjnaBucketFromV3Tick(params: {
  twapTick: number;
  creatorToken: `0x${string}`;
  usdToken: `0x${string}`;
  creatorDecimals: number;
  usdDecimals: number;
  targetLtvBps: number;
}): number | null {
  if (!Number.isFinite(params.twapTick)) return null;
  if (params.targetLtvBps <= 0 || params.targetLtvBps > 10_000) return null;
  if (params.creatorToken.toLowerCase() === params.usdToken.toLowerCase()) return null;

  const creatorIsToken1 = compareAddressNumeric(params.creatorToken, params.usdToken) > 0;
  const orientedTick = creatorIsToken1 ? params.twapTick : -params.twapTick;

  // Uniswap tick is in raw token units; Ajna bucket targets human quote/collateral price.
  const decimalsTickOffset = (params.usdDecimals - params.creatorDecimals) * LOG_10_BASE_1_0001;

  // For short lending, tighten borrowable quote by applying a collateralized LTV discount.
  const ltvFactor = params.targetLtvBps / 10_000;
  const ltvTickOffset = Math.log(ltvFactor) / LOG_1_0001;

  const adjustedTick = Math.floor(orientedTick + decimalsTickOffset + ltvTickOffset);
  if (!Number.isFinite(adjustedTick)) return null;
  return tickToAjnaBucket(adjustedTick);
}

export function computeSteppedBucket(params: {
  currentBucket: number;
  suggestedBucket: number;
  moveThreshold: number;
  maxStep: number;
}): {
  shouldMove: boolean;
  rawDelta: number;
  steppedBucket: number;
} {
  const current = clampMinBucketIndex(params.currentBucket);
  const suggested = clampMinBucketIndex(params.suggestedBucket);
  const rawDelta = suggested - current;
  const absDelta = Math.abs(rawDelta);
  if (absDelta < params.moveThreshold) {
    return { shouldMove: false, rawDelta, steppedBucket: current };
  }

  const capped = Math.min(absDelta, Math.max(1, params.maxStep));
  const step = rawDelta < 0 ? -capped : capped;
  return {
    shouldMove: true,
    rawDelta,
    steppedBucket: clampBucketIndex(current + step),
  };
}

export function pickBestLiquidityBucket(params: {
  centerBucket: number;
  candidates: Array<{ index: number; deposit: bigint }>;
}): number {
  let bestIndex = clampBucketIndex(params.centerBucket);
  let bestDeposit = -1n;
  let bestDistance = Number.MAX_SAFE_INTEGER;

  for (const c of params.candidates) {
    const index = clampBucketIndex(c.index);
    const deposit = c.deposit >= 0n ? c.deposit : 0n;
    const distance = Math.abs(index - params.centerBucket);
    if (deposit > bestDeposit) {
      bestDeposit = deposit;
      bestDistance = distance;
      bestIndex = index;
      continue;
    }
    if (deposit === bestDeposit && distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export async function readAjnaStrategiesForVault(
  vaultAddress: `0x${string}`,
): Promise<AjnaAdapterContext[]> {
  const out: AjnaAdapterContext[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < MAX_STRATEGIES; i += 1) {
    const rawStrategy = await readContract<unknown>({
      address: vaultAddress,
      abi: VAULT_STRATEGY_VIEW_ABI,
      functionName: 'strategyList',
      args: [BigInt(i)],
    }).catch(() => null);

    const strategyAddress = asAddress(rawStrategy);
    if (!strategyAddress || strategyAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) break;
    const key = strategyAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const weight = await readContract<bigint>({
      address: vaultAddress,
      abi: VAULT_STRATEGY_VIEW_ABI,
      functionName: 'strategyWeights',
      args: [strategyAddress],
    }).catch(() => 0n);
    if (weight === 0n) continue;

    const adapterVaultRaw = await readContract<unknown>({
      address: strategyAddress,
      abi: AJNA_ADAPTER_VIEW_ABI,
      functionName: 'ERC4626_VAULT',
    }).catch(() => null);
    const adapterVault = asAddress(adapterVaultRaw);
    if (!adapterVault || adapterVault.toLowerCase() === ZERO_ADDRESS.toLowerCase()) continue;

    const [ajnaPoolRaw, authRaw] = await Promise.all([
      readContract<unknown>({
        address: adapterVault,
        abi: AJNA_INNER_VAULT_VIEW_ABI,
        functionName: 'AJNA_POOL',
      }).catch(() => null),
      readContract<unknown>({
        address: adapterVault,
        abi: AJNA_INNER_VAULT_VIEW_ABI,
        functionName: 'AUTH',
      }).catch(() => null),
    ]);
    const ajnaPool = asAddress(ajnaPoolRaw);
    const authAddress = asAddress(authRaw);
    if (!ajnaPool || ajnaPool.toLowerCase() === ZERO_ADDRESS.toLowerCase()) continue;
    if (!authAddress || authAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) continue;

    const [authAdminRaw, minBucketRaw] = await Promise.all([
      readContract<unknown>({
        address: authAddress,
        abi: AJNA_AUTH_VIEW_ABI,
        functionName: 'admin',
      }).catch(() => null),
      readContract<bigint>({
        address: authAddress,
        abi: AJNA_AUTH_VIEW_ABI,
        functionName: 'minBucketIndex',
      }).catch(() => 0n),
    ]);
    const authAdmin = asAddress(authAdminRaw);
    if (!authAdmin) continue;

    out.push({
      strategyAddress,
      ajnaPool,
      authAddress,
      currentBucket: clampMinBucketIndex(Number(minBucketRaw)),
      authAdmin,
      weight,
    });
  }

  return out;
}

export async function readOracleSuggestedBucket(params: {
  oracleAddress: `0x${string}`;
  twapDuration: number;
  targetLtvBps: number;
}): Promise<number | null> {
  const [tickRaw, creatorRaw, usdRaw, creatorDecimalsRaw, usdDecimalsRaw] = await Promise.all([
    readContract<bigint>({
      address: params.oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'getV3TWAPTick',
      args: [params.twapDuration],
    }).catch(() => null),
    readContract<unknown>({
      address: params.oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3CreatorToken',
    }).catch(() => null),
    readContract<unknown>({
      address: params.oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3UsdToken',
    }).catch(() => null),
    readContract<bigint>({
      address: params.oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3CreatorDecimals',
    }).catch(() => null),
    readContract<bigint>({
      address: params.oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3UsdDecimals',
    }).catch(() => null),
  ]);

  const creatorToken = asAddress(creatorRaw);
  const usdToken = asAddress(usdRaw);
  if (tickRaw === null || !creatorToken || !usdToken || creatorDecimalsRaw === null || usdDecimalsRaw === null) {
    return null;
  }

  const twapTick = Number(tickRaw);
  const creatorDecimals = Number(creatorDecimalsRaw);
  const usdDecimals = Number(usdDecimalsRaw);
  if (!Number.isFinite(twapTick) || !Number.isFinite(creatorDecimals) || !Number.isFinite(usdDecimals)) {
    return null;
  }

  return deriveAjnaBucketFromV3Tick({
    twapTick,
    creatorToken,
    usdToken,
    creatorDecimals,
    usdDecimals,
    targetLtvBps: params.targetLtvBps,
  });
}

export async function pickLiquidityAwareTarget(params: {
  ajnaPool: `0x${string}`;
  steppedBucket: number;
  searchRadius: number;
}): Promise<number> {
  const radius = Math.max(0, params.searchRadius);
  const start = clampBucketIndex(params.steppedBucket - radius);
  const end = clampBucketIndex(params.steppedBucket + radius);

  const candidates: Array<{ index: number; deposit: bigint }> = [];
  for (let idx = start; idx <= end; idx += 1) {
    const bucketInfo = await readContract<[bigint, bigint, bigint, bigint, bigint]>({
      address: params.ajnaPool,
      abi: AJNA_POOL_VIEW_ABI,
      functionName: 'bucketInfo',
      args: [BigInt(idx)],
    }).catch(() => null);

    const deposit = bucketInfo?.[3] ?? 0n;
    candidates.push({ index: idx, deposit });
  }

  if (candidates.length === 0) return params.steppedBucket;
  return pickBestLiquidityBucket({
    centerBucket: params.steppedBucket,
    candidates,
  });
}

function resolveSingleVaultMode(): { vaultAddress: `0x${string}`; oracleAddress: `0x${string}` } | null {
  const vaultAddress =
    asAddress(process.env.AJNA_BUCKET_VAULT_ADDRESS) ?? asAddress(process.env.VAULT_ADDRESS);
  const oracleAddress =
    asAddress(process.env.AJNA_BUCKET_ORACLE_ADDRESS) ?? asAddress(process.env.ORACLE_ADDRESS);
  if (!vaultAddress || !oracleAddress) return null;
  return { vaultAddress, oracleAddress };
}

async function resolveVaults(): Promise<Array<{ vaultAddress: `0x${string}`; oracleAddress: `0x${string}` }>> {
  const single = resolveSingleVaultMode();
  if (single) return [single];

  const allVaults = await fetchActiveVaults(CHAINS.base.id);
  const candidates = filterVaultsForWorkflow(allVaults, 'ajna-bucket-manager');
  return candidates
    .map((v: VaultConfig) => {
      const vaultAddress = asAddress(v.vaultAddress);
      const oracleAddress = asAddress(v.oracleAddress);
      if (!vaultAddress || !oracleAddress) return null;
      return { vaultAddress, oracleAddress };
    })
    .filter((v): v is { vaultAddress: `0x${string}`; oracleAddress: `0x${string}` } => Boolean(v));
}

export async function executeAjnaBucketManager(): Promise<BatchAjnaBucketResult> {
  const cfg = buildRuntimeConfig();
  const keeperAddress = getKeeperAddress();

  let vaults: Array<{ vaultAddress: `0x${string}`; oracleAddress: `0x${string}` }> = [];
  try {
    vaults = await resolveVaults();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Failed to resolve vault/oracle list', { error: message });
    throw err;
  }

  const batch: BatchAjnaBucketResult = {
    totalVaults: vaults.length,
    totalStrategies: 0,
    processed: 0,
    moved: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  if (vaults.length === 0) {
    return batch;
  }

  for (const vault of vaults) {
    const suggestedBucket = await readOracleSuggestedBucket({
      oracleAddress: vault.oracleAddress,
      twapDuration: cfg.twapDuration,
      targetLtvBps: cfg.targetLtvBps,
    });

    if (suggestedBucket === null) {
      batch.skipped += 1;
      batch.results.push({
        vaultAddress: vault.vaultAddress,
        strategyAddress: ZERO_ADDRESS as `0x${string}`,
        oracleAddress: vault.oracleAddress,
        currentBucket: 0,
        suggestedBucket: 0,
        steppedBucket: 0,
        targetBucket: 0,
        moved: false,
        skippedReason: 'oracle_bucket_unavailable',
      });
      continue;
    }

    const strategies = await readAjnaStrategiesForVault(vault.vaultAddress).catch(() => []);
    batch.totalStrategies += strategies.length;
    if (strategies.length === 0) continue;

    for (const strategy of strategies) {
      const priceChangeBps = bucketPriceChangeBps({
        currentBucket: strategy.currentBucket,
        suggestedBucket,
      });
      if (priceChangeBps < cfg.priceChangeTriggerBps) {
        batch.processed += 1;
        batch.skipped += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          oracleAddress: vault.oracleAddress,
          currentBucket: strategy.currentBucket,
          suggestedBucket,
          steppedBucket: strategy.currentBucket,
          targetBucket: strategy.currentBucket,
          moved: false,
          skippedReason: 'price_change_below_trigger',
        });
        continue;
      }

      const step = computeSteppedBucket({
        currentBucket: strategy.currentBucket,
        suggestedBucket,
        moveThreshold: cfg.moveThreshold,
        maxStep: cfg.maxStep,
      });

      if (!step.shouldMove) {
        batch.processed += 1;
        batch.skipped += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          oracleAddress: vault.oracleAddress,
          currentBucket: strategy.currentBucket,
          suggestedBucket,
          steppedBucket: step.steppedBucket,
          targetBucket: step.steppedBucket,
          moved: false,
          skippedReason: 'within_threshold',
        });
        continue;
      }

      const targetBucket = await pickLiquidityAwareTarget({
        ajnaPool: strategy.ajnaPool,
        steppedBucket: step.steppedBucket,
        searchRadius: cfg.searchRadius,
      }).catch(() => step.steppedBucket);

      if (targetBucket === strategy.currentBucket) {
        batch.processed += 1;
        batch.skipped += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          oracleAddress: vault.oracleAddress,
          currentBucket: strategy.currentBucket,
          suggestedBucket,
          steppedBucket: step.steppedBucket,
          targetBucket,
          moved: false,
          skippedReason: 'already_at_target',
        });
        continue;
      }

      if (strategy.authAdmin.toLowerCase() !== keeperAddress.toLowerCase()) {
        batch.processed += 1;
        batch.skipped += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          oracleAddress: vault.oracleAddress,
          currentBucket: strategy.currentBucket,
          suggestedBucket,
          steppedBucket: step.steppedBucket,
          targetBucket,
          moved: false,
          skippedReason: 'keeper_not_auth_admin',
        });
        continue;
      }
      const method: 'setMinBucketIndex' = 'setMinBucketIndex';

      const write: WriteResult = await writeContract({
        address: strategy.authAddress,
        abi: AJNA_AUTH_ADMIN_ABI,
        functionName: 'setMinBucketIndex',
        args: [BigInt(targetBucket)],
      });

      batch.processed += 1;
      if (write.success) {
        batch.moved += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          oracleAddress: vault.oracleAddress,
          currentBucket: strategy.currentBucket,
          suggestedBucket,
          steppedBucket: step.steppedBucket,
          targetBucket,
          moved: true,
          method,
          txHash: write.txHash,
        });
      } else {
        batch.errors += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          oracleAddress: vault.oracleAddress,
          currentBucket: strategy.currentBucket,
          suggestedBucket,
          steppedBucket: step.steppedBucket,
          targetBucket,
          moved: false,
          method,
          error: write.error ?? 'unknown_error',
        });
      }
    }
  }

  if (batch.moved > 0) {
    await alertInfo(WORKFLOW_NAME, 'Ajna bucket manager moved liquidity', {
      totalVaults: batch.totalVaults,
      totalStrategies: batch.totalStrategies,
      moved: batch.moved,
      skipped: batch.skipped,
      errors: batch.errors,
    });
  } else if (batch.errors > 0) {
    await alertWarning(WORKFLOW_NAME, 'Ajna bucket manager completed with errors', {
      totalVaults: batch.totalVaults,
      totalStrategies: batch.totalStrategies,
      moved: batch.moved,
      skipped: batch.skipped,
      errors: batch.errors,
    });
  }

  return batch;
}

