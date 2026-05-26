/**
 * Charm Rebalance Manager — oracle-triggered Charm vault rebalancing.
 *
 * Goal:
 * - Rebalance Charm vault positions when price has moved materially.
 * - Avoid constant churn by requiring a minimum implied price move threshold.
 *
 * Flow per vault:
 *  1) Read oracle V3 TWAP tick (normalized to CREATOR/USDC human price).
 *  2) Read Charm vault base range center tick for each active Charm strategy.
 *  3) Compute implied price change between current TWAP and base range center.
 *  4) If price move >= trigger threshold, call charmVault.rebalance().
 */

import { getAddress, isAddress } from 'viem';
import {
  CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS,
  CHARM_REBALANCE_TWAP_DURATION,
  CHARM_FACTORY_ABI,
  CHARM_FACTORY_ADDRESS,
  CHAINS,
  ORACLE_ABI,
} from '../config.js';
import { getKeeperAddress, readContract, writeContract, type WriteResult } from '../utils/onchain.js';
import {
  executeCharmRebalanceViaProtocolTreasurySafe,
  isProtocolTreasuryManager,
  resolveCharmAutomationAuthorization,
} from '../utils/protocolTreasurySafe.js';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';
import { fetchActiveVaults, filterVaultsForWorkflow, type VaultConfig } from '../utils/registry.js';

const WORKFLOW_NAME = 'charm-rebalance-manager';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_STRATEGIES = 5;
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

const CHARM_STRATEGY_VIEW_ABI = [
  { type: 'function', name: 'charmVault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const CHARM_VAULT_VIEW_ABI = [
  { type: 'function', name: 'baseLower', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { type: 'function', name: 'baseUpper', stateMutability: 'view', inputs: [], outputs: [{ type: 'int24' }] },
  { type: 'function', name: 'keeper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'manager', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'rebalanceDelegate', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const CHARM_VAULT_ADMIN_ABI = [
  { type: 'function', name: 'rebalance', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

interface RuntimeConfig {
  twapDuration: number;
  priceChangeTriggerBps: number;
}

export interface CharmStrategyContext {
  strategyAddress: `0x${string}`;
  charmVaultAddress: `0x${string}`;
}

export interface OraclePriceContext {
  normalizedTick: number;
  creatorToken: `0x${string}`;
  usdToken: `0x${string}`;
  creatorDecimals: number;
  usdDecimals: number;
}

export interface CharmRangeContext {
  centerTickNormalized: number;
}

export interface CharmRebalanceResult {
  vaultAddress: `0x${string}`;
  strategyAddress: `0x${string}`;
  charmVaultAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  oracleTickNormalized: number;
  charmCenterTickNormalized: number;
  priceChangeBps: number;
  rebalanced: boolean;
  txHash?: `0x${string}`;
  skippedReason?: string;
  error?: string;
}

export interface BatchCharmRebalanceResult {
  totalVaults: number;
  totalStrategies: number;
  processed: number;
  rebalanced: number;
  skipped: number;
  errors: number;
  results: CharmRebalanceResult[];
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
    twapDuration: parsePositiveIntEnv('CHARM_REBALANCE_TWAP_DURATION', CHARM_REBALANCE_TWAP_DURATION),
    priceChangeTriggerBps: parseBpsEnv(
      'CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS',
      CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS,
    ),
  };
}

function asAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value) as `0x${string}`;
}

async function isOfficialCharmVaultAddress(charmVaultAddress: `0x${string}`): Promise<boolean> {
  const result = await readContract<unknown>({
    address: CHARM_FACTORY_ADDRESS,
    abi: CHARM_FACTORY_ABI,
    functionName: 'isVault',
    args: [charmVaultAddress],
  }).catch(() => null);
  return result === true;
}

function compareAddressNumeric(a: `0x${string}`, b: `0x${string}`): number {
  const av = BigInt(a);
  const bv = BigInt(b);
  if (av === bv) return 0;
  return av > bv ? 1 : -1;
}

export function normalizeTickToCreatorPerUsdcTick(params: {
  rawTick: number;
  creatorToken: `0x${string}`;
  usdToken: `0x${string}`;
  creatorDecimals: number;
  usdDecimals: number;
}): number | null {
  if (!Number.isFinite(params.rawTick)) return null;
  if (!Number.isFinite(params.creatorDecimals) || !Number.isFinite(params.usdDecimals)) return null;
  if (params.creatorToken.toLowerCase() === params.usdToken.toLowerCase()) return null;

  const creatorIsToken1 = compareAddressNumeric(params.creatorToken, params.usdToken) > 0;
  const orientedTick = creatorIsToken1 ? params.rawTick : -params.rawTick;
  const decimalsTickOffset = (params.usdDecimals - params.creatorDecimals) * LOG_10_BASE_1_0001;
  const normalized = Math.floor(orientedTick + decimalsTickOffset);
  if (!Number.isFinite(normalized)) return null;
  return normalized;
}

export function tickPriceChangeBps(params: { currentTick: number; referenceTick: number }): number {
  const delta = Math.abs(params.currentTick - params.referenceTick);
  if (delta === 0) return 0;

  const ratio = Math.pow(1.0001, delta);
  if (!Number.isFinite(ratio) || ratio <= 1) return Number.MAX_SAFE_INTEGER;

  const bps = Math.floor((ratio - 1) * 10_000);
  if (!Number.isFinite(bps) || bps < 0) return Number.MAX_SAFE_INTEGER;
  return Math.min(Number.MAX_SAFE_INTEGER, bps);
}

export async function readOraclePriceContext(
  oracleAddress: `0x${string}`,
  twapDuration: number,
): Promise<OraclePriceContext | null> {
  const [tickRaw, creatorRaw, usdRaw, creatorDecimalsRaw, usdDecimalsRaw] = await Promise.all([
    readContract<bigint>({
      address: oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'getV3TWAPTick',
      args: [twapDuration],
    }).catch(() => null),
    readContract<unknown>({
      address: oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3CreatorToken',
    }).catch(() => null),
    readContract<unknown>({
      address: oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3UsdToken',
    }).catch(() => null),
    readContract<bigint>({
      address: oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3CreatorDecimals',
    }).catch(() => null),
    readContract<bigint>({
      address: oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'v3UsdDecimals',
    }).catch(() => null),
  ]);

  const creatorToken = asAddress(creatorRaw);
  const usdToken = asAddress(usdRaw);
  if (tickRaw === null || !creatorToken || !usdToken || creatorDecimalsRaw === null || usdDecimalsRaw === null) {
    return null;
  }

  const rawTick = Number(tickRaw);
  const creatorDecimals = Number(creatorDecimalsRaw);
  const usdDecimals = Number(usdDecimalsRaw);
  const normalizedTick = normalizeTickToCreatorPerUsdcTick({
    rawTick,
    creatorToken,
    usdToken,
    creatorDecimals,
    usdDecimals,
  });
  if (normalizedTick === null) return null;

  return {
    normalizedTick,
    creatorToken,
    usdToken,
    creatorDecimals,
    usdDecimals,
  };
}

export async function readCharmStrategiesForVault(
  vaultAddress: `0x${string}`,
): Promise<CharmStrategyContext[]> {
  const out: CharmStrategyContext[] = [];
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

    const charmVaultRaw = await readContract<unknown>({
      address: strategyAddress,
      abi: CHARM_STRATEGY_VIEW_ABI,
      functionName: 'charmVault',
    }).catch(() => null);
    const charmVaultAddress = asAddress(charmVaultRaw);
    if (!charmVaultAddress || charmVaultAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) continue;
    const isOfficialVault = await isOfficialCharmVaultAddress(charmVaultAddress);
    if (!isOfficialVault) continue;

    out.push({
      strategyAddress,
      charmVaultAddress,
    });
  }

  return out;
}

export async function readCharmRangeContext(
  charmVaultAddress: `0x${string}`,
  oracleContext: OraclePriceContext,
): Promise<CharmRangeContext | null> {
  const [baseLowerRaw, baseUpperRaw] = await Promise.all([
    readContract<bigint>({
      address: charmVaultAddress,
      abi: CHARM_VAULT_VIEW_ABI,
      functionName: 'baseLower',
    }).catch(() => null),
    readContract<bigint>({
      address: charmVaultAddress,
      abi: CHARM_VAULT_VIEW_ABI,
      functionName: 'baseUpper',
    }).catch(() => null),
  ]);
  if (baseLowerRaw === null || baseUpperRaw === null) return null;

  const baseLower = Number(baseLowerRaw);
  const baseUpper = Number(baseUpperRaw);
  if (!Number.isFinite(baseLower) || !Number.isFinite(baseUpper)) return null;

  const centerRawTick = Math.floor((baseLower + baseUpper) / 2);
  const centerTickNormalized = normalizeTickToCreatorPerUsdcTick({
    rawTick: centerRawTick,
    creatorToken: oracleContext.creatorToken,
    usdToken: oracleContext.usdToken,
    creatorDecimals: oracleContext.creatorDecimals,
    usdDecimals: oracleContext.usdDecimals,
  });
  if (centerTickNormalized === null) return null;

  return { centerTickNormalized };
}

function resolveSingleVaultMode(): { vaultAddress: `0x${string}`; oracleAddress: `0x${string}` } | null {
  const vaultAddress =
    asAddress(process.env.CHARM_REBALANCE_VAULT_ADDRESS) ?? asAddress(process.env.VAULT_ADDRESS);
  const oracleAddress =
    asAddress(process.env.CHARM_REBALANCE_ORACLE_ADDRESS) ?? asAddress(process.env.ORACLE_ADDRESS);
  if (!vaultAddress || !oracleAddress) return null;
  return { vaultAddress, oracleAddress };
}

async function resolveVaults(): Promise<Array<{ vaultAddress: `0x${string}`; oracleAddress: `0x${string}` }>> {
  const single = resolveSingleVaultMode();
  if (single) return [single];

  const allVaults = await fetchActiveVaults(CHAINS.base.id);
  const candidates = filterVaultsForWorkflow(allVaults, 'charm-rebalance-manager');
  return candidates
    .map((v: VaultConfig) => {
      const vaultAddress = asAddress(v.vaultAddress);
      const oracleAddress = asAddress(v.oracleAddress);
      if (!vaultAddress || !oracleAddress) return null;
      return { vaultAddress, oracleAddress };
    })
    .filter((v): v is { vaultAddress: `0x${string}`; oracleAddress: `0x${string}` } => Boolean(v));
}

export async function executeCharmRebalanceManager(): Promise<BatchCharmRebalanceResult> {
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

  const batch: BatchCharmRebalanceResult = {
    totalVaults: vaults.length,
    totalStrategies: 0,
    processed: 0,
    rebalanced: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  if (vaults.length === 0) {
    return batch;
  }

  for (const vault of vaults) {
    const oracleContext = await readOraclePriceContext(vault.oracleAddress, cfg.twapDuration);
    if (!oracleContext) {
      batch.skipped += 1;
      batch.results.push({
        vaultAddress: vault.vaultAddress,
        strategyAddress: ZERO_ADDRESS as `0x${string}`,
        charmVaultAddress: ZERO_ADDRESS as `0x${string}`,
        oracleAddress: vault.oracleAddress,
        oracleTickNormalized: 0,
        charmCenterTickNormalized: 0,
        priceChangeBps: 0,
        rebalanced: false,
        skippedReason: 'oracle_price_unavailable',
      });
      continue;
    }

    const strategies = await readCharmStrategiesForVault(vault.vaultAddress).catch(() => []);
    batch.totalStrategies += strategies.length;
    if (strategies.length === 0) continue;

    for (const strategy of strategies) {
      const rangeContext = await readCharmRangeContext(strategy.charmVaultAddress, oracleContext);
      if (!rangeContext) {
        batch.processed += 1;
        batch.skipped += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          charmVaultAddress: strategy.charmVaultAddress,
          oracleAddress: vault.oracleAddress,
          oracleTickNormalized: oracleContext.normalizedTick,
          charmCenterTickNormalized: 0,
          priceChangeBps: 0,
          rebalanced: false,
          skippedReason: 'charm_range_unavailable',
        });
        continue;
      }

      const priceChangeBps = tickPriceChangeBps({
        currentTick: oracleContext.normalizedTick,
        referenceTick: rangeContext.centerTickNormalized,
      });
      if (priceChangeBps < cfg.priceChangeTriggerBps) {
        batch.processed += 1;
        batch.skipped += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          charmVaultAddress: strategy.charmVaultAddress,
          oracleAddress: vault.oracleAddress,
          oracleTickNormalized: oracleContext.normalizedTick,
          charmCenterTickNormalized: rangeContext.centerTickNormalized,
          priceChangeBps,
          rebalanced: false,
          skippedReason: 'price_change_below_trigger',
        });
        continue;
      }

      const [managerRaw, delegateRaw] = await Promise.all([
        readContract<unknown>({
          address: strategy.charmVaultAddress,
          abi: CHARM_VAULT_VIEW_ABI,
          functionName: 'manager',
        }).catch(() => null),
        readContract<unknown>({
          address: strategy.charmVaultAddress,
          abi: CHARM_VAULT_VIEW_ABI,
          functionName: 'rebalanceDelegate',
        }).catch(() => null),
      ]);
      const managerAddress = asAddress(managerRaw);
      const delegateAddress = asAddress(delegateRaw);

      if (isProtocolTreasuryManager(managerAddress)) {
        try {
          const viaSafe = await executeCharmRebalanceViaProtocolTreasurySafe({
            charmVaultAddress: strategy.charmVaultAddress,
          });
          batch.processed += 1;
          batch.rebalanced += 1;
          batch.results.push({
            vaultAddress: vault.vaultAddress,
            strategyAddress: strategy.strategyAddress,
            charmVaultAddress: strategy.charmVaultAddress,
            oracleAddress: vault.oracleAddress,
            oracleTickNormalized: oracleContext.normalizedTick,
            charmCenterTickNormalized: rangeContext.centerTickNormalized,
            priceChangeBps,
            rebalanced: true,
            txHash: viaSafe.txHash,
          });
          continue;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          batch.processed += 1;
          batch.errors += 1;
          batch.results.push({
            vaultAddress: vault.vaultAddress,
            strategyAddress: strategy.strategyAddress,
            charmVaultAddress: strategy.charmVaultAddress,
            oracleAddress: vault.oracleAddress,
            oracleTickNormalized: oracleContext.normalizedTick,
            charmCenterTickNormalized: rangeContext.centerTickNormalized,
            priceChangeBps,
            rebalanced: false,
            error: message,
          });
          continue;
        }
      }

      const [charmKeeperRaw, charmOwnerRaw] = await Promise.all([
        readContract<unknown>({
          address: strategy.charmVaultAddress,
          abi: CHARM_VAULT_VIEW_ABI,
          functionName: 'keeper',
        }).catch(() => null),
        readContract<unknown>({
          address: strategy.charmVaultAddress,
          abi: CHARM_VAULT_VIEW_ABI,
          functionName: 'owner',
        }).catch(() => null),
      ]);
      const authorization = resolveCharmAutomationAuthorization({
        managerAddress,
        delegateAddress,
        charmKeeper: asAddress(charmKeeperRaw),
        charmOwner: asAddress(charmOwnerRaw),
        keeperAddress,
      });
      if (!authorization.authorized) {
        batch.processed += 1;
        batch.skipped += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          charmVaultAddress: strategy.charmVaultAddress,
          oracleAddress: vault.oracleAddress,
          oracleTickNormalized: oracleContext.normalizedTick,
          charmCenterTickNormalized: rangeContext.centerTickNormalized,
          priceChangeBps,
          rebalanced: false,
          skippedReason: authorization.reason,
        });
        continue;
      }

      const write: WriteResult = await writeContract({
        address: strategy.charmVaultAddress,
        abi: CHARM_VAULT_ADMIN_ABI,
        functionName: 'rebalance',
      });

      batch.processed += 1;
      if (write.success) {
        batch.rebalanced += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          charmVaultAddress: strategy.charmVaultAddress,
          oracleAddress: vault.oracleAddress,
          oracleTickNormalized: oracleContext.normalizedTick,
          charmCenterTickNormalized: rangeContext.centerTickNormalized,
          priceChangeBps,
          rebalanced: true,
          txHash: write.txHash,
        });
      } else {
        batch.errors += 1;
        batch.results.push({
          vaultAddress: vault.vaultAddress,
          strategyAddress: strategy.strategyAddress,
          charmVaultAddress: strategy.charmVaultAddress,
          oracleAddress: vault.oracleAddress,
          oracleTickNormalized: oracleContext.normalizedTick,
          charmCenterTickNormalized: rangeContext.centerTickNormalized,
          priceChangeBps,
          rebalanced: false,
          error: write.error ?? 'unknown_error',
        });
      }
    }
  }

  if (batch.rebalanced > 0) {
    await alertInfo(WORKFLOW_NAME, 'Charm rebalance manager executed rebalances', {
      totalVaults: batch.totalVaults,
      totalStrategies: batch.totalStrategies,
      rebalanced: batch.rebalanced,
      skipped: batch.skipped,
      errors: batch.errors,
    });
  } else if (batch.errors > 0) {
    await alertWarning(WORKFLOW_NAME, 'Charm rebalance manager completed with errors', {
      totalVaults: batch.totalVaults,
      totalStrategies: batch.totalStrategies,
      rebalanced: batch.rebalanced,
      skipped: batch.skipped,
      errors: batch.errors,
    });
  }

  return batch;
}
