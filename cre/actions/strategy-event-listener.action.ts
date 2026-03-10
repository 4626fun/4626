/**
 * Strategy Event Listener — always-on, event-driven trigger evaluation.
 *
 * Watches Uniswap V3 Swap events for each vault oracle's configured v3Pool,
 * reuses Ajna/Charm trigger logic, and enqueues deduplicated actions into the
 * keepr action queue API.
 *
 * Cron workflows remain as fallback heartbeat.
 */

import { createPublicClient, getAddress, isAddress, webSocket, type Address } from 'viem';
import { base } from 'viem/chains';
import {
  AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS,
  AJNA_BUCKET_MAX_STEP,
  AJNA_BUCKET_MOVE_COOLDOWN_SECONDS,
  AJNA_BUCKET_MOVE_THRESHOLD,
  AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS,
  AJNA_BUCKET_TARGET_LTV_BPS,
  AJNA_BUCKET_TWAP_DURATION,
  CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS,
  CHARM_REBALANCE_TWAP_DURATION,
  CHAINS,
  ORACLE_ABI,
  requireEnv,
} from '../config.js';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';
import { fetchActiveVaults } from '../utils/registry.js';
import { getBlockTimestamp, getKeeperAddress, getPublicClient, readContract } from '../utils/onchain.js';
import {
  bucketPriceChangeBps,
  computeSteppedBucket,
  pickLiquidityAwareTarget,
  readAjnaStrategiesForVault,
  readOracleSuggestedBucket,
} from './ajna-bucket-manager.action.js';
import {
  readCharmRangeContext,
  readCharmStrategiesForVault,
  readOraclePriceContext,
  tickPriceChangeBps,
} from './charm-rebalance-manager.action.js';
import {
  consumeVaultHourlyBudget,
  getPoolLastProcessedBlock,
  isCooldownActive,
  loadStrategyEventState,
  recordCooldown,
  saveStrategyEventState,
  setPoolLastProcessedBlock,
  type StrategyEventState,
} from '../utils/strategy-event-state.js';

const WORKFLOW_NAME = 'strategy-event-listener';

const UNISWAP_V3_POOL_SWAP_EVENT_ABI = [
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount0', type: 'int256', indexed: false },
      { name: 'amount1', type: 'int256', indexed: false },
      { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
      { name: 'liquidity', type: 'uint128', indexed: false },
      { name: 'tick', type: 'int24', indexed: false },
    ],
  },
] as const;

const CHARM_VAULT_VIEW_ABI = [
  { type: 'function', name: 'keeper', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

interface ListenerConfig {
  wsRpcUrl: string;
  apiBaseUrl: string;
  apiKey: string;
  debounceMs: number;
  cooldownSeconds: number;
  maxActionsPerHour: number;
  backfillChunkBlocks: bigint;
  startLookbackBlocks: bigint;
  backlogAlertBlocks: bigint;
  stateFile: string;
  reconnectDelayMs: number;
  reconnectDelayMaxMs: number;
  reconnectBackoffMultiplier: number;
  ajna: {
    twapDuration: number;
    targetLtvBps: number;
    priceChangeTriggerBps: number;
    moveThreshold: number;
    maxStep: number;
    cooldownSeconds: number;
    searchRadius: number;
  };
  charm: {
    twapDuration: number;
    priceChangeTriggerBps: number;
  };
}

interface PoolWatchContext {
  poolAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  groupId: string;
}

interface EnqueueResult {
  id: number;
}

function parsePositiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseBpsEnv(key: string, fallback: number): number {
  const n = parsePositiveIntEnv(key, fallback);
  if (n > 10_000) return fallback;
  return n;
}

function asAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string' || !isAddress(value)) return null;
  return getAddress(value) as `0x${string}`;
}

function buildConfig(): ListenerConfig {
  const wsRpcUrl = requireEnv('BASE_WS_RPC_URL');
  const apiBaseUrl = requireEnv('KEEPR_API_BASE_URL').replace(/\/$/, '');
  const apiKey = requireEnv('KEEPR_API_KEY');

  return {
    wsRpcUrl,
    apiBaseUrl,
    apiKey,
    debounceMs: parsePositiveIntEnv('STRATEGY_EVENT_DEBOUNCE_MS', 5000),
    cooldownSeconds: parsePositiveIntEnv('STRATEGY_EVENT_COOLDOWN_SECONDS', 1800),
    maxActionsPerHour: parsePositiveIntEnv('STRATEGY_EVENT_MAX_ACTIONS_PER_HOUR', 4),
    backfillChunkBlocks: BigInt(parsePositiveIntEnv('STRATEGY_EVENT_BACKFILL_CHUNK_BLOCKS', 5000)),
    startLookbackBlocks: BigInt(parsePositiveIntEnv('STRATEGY_EVENT_START_LOOKBACK_BLOCKS', 500)),
    backlogAlertBlocks: BigInt(parsePositiveIntEnv('STRATEGY_EVENT_BACKLOG_ALERT_BLOCKS', 25000)),
    stateFile: process.env.STRATEGY_EVENT_STATE_FILE || `${process.cwd()}/.state/strategy-event-listener.json`,
    reconnectDelayMs: parsePositiveIntEnv('STRATEGY_EVENT_RECONNECT_DELAY_MS', 2000),
    reconnectDelayMaxMs: parsePositiveIntEnv('STRATEGY_EVENT_RECONNECT_DELAY_MAX_MS', 30000),
    reconnectBackoffMultiplier: parsePositiveIntEnv('STRATEGY_EVENT_RECONNECT_BACKOFF_MULTIPLIER', 2),
    ajna: {
      twapDuration: parsePositiveIntEnv('AJNA_BUCKET_TWAP_DURATION', AJNA_BUCKET_TWAP_DURATION),
      targetLtvBps: parseBpsEnv('AJNA_BUCKET_TARGET_LTV_BPS', AJNA_BUCKET_TARGET_LTV_BPS),
      priceChangeTriggerBps: parseBpsEnv(
        'AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS',
        AJNA_BUCKET_PRICE_CHANGE_TRIGGER_BPS,
      ),
      moveThreshold: parsePositiveIntEnv('AJNA_BUCKET_MOVE_THRESHOLD', AJNA_BUCKET_MOVE_THRESHOLD),
      maxStep: parsePositiveIntEnv('AJNA_BUCKET_MAX_STEP', AJNA_BUCKET_MAX_STEP),
      cooldownSeconds: parsePositiveIntEnv(
        'AJNA_BUCKET_MOVE_COOLDOWN_SECONDS',
        AJNA_BUCKET_MOVE_COOLDOWN_SECONDS,
      ),
      searchRadius: parsePositiveIntEnv(
        'AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS',
        AJNA_BUCKET_LIQUIDITY_SEARCH_RADIUS,
      ),
    },
    charm: {
      twapDuration: parsePositiveIntEnv('CHARM_REBALANCE_TWAP_DURATION', CHARM_REBALANCE_TWAP_DURATION),
      priceChangeTriggerBps: parseBpsEnv(
        'CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS',
        CHARM_REBALANCE_PRICE_CHANGE_TRIGGER_BPS,
      ),
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeCooldownKey(params: {
  vaultAddress: `0x${string}`;
  strategyAddressOrPool: `0x${string}`;
  actionType: string;
}): string {
  return `${params.vaultAddress.toLowerCase()}:${params.strategyAddressOrPool.toLowerCase()}:${params.actionType}`;
}

export function makeDedupeKey(params: {
  vaultAddress: `0x${string}`;
  strategyAddressOrPool: `0x${string}`;
  actionType: string;
  band: string;
}): string {
  return `vault:${params.vaultAddress.toLowerCase()}:strategy:${params.strategyAddressOrPool.toLowerCase()}:action:${params.actionType}:band:${params.band}`;
}

async function enqueueAction(params: {
  cfg: ListenerConfig;
  vaultAddress: `0x${string}`;
  groupId: string;
  actionType: string;
  dedupeKey: string;
  action: Record<string, unknown>;
}): Promise<EnqueueResult> {
  const response = await fetch(`${params.cfg.apiBaseUrl}/keepr/actions/enqueue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vaultAddress: params.vaultAddress,
      groupId: params.groupId,
      actionType: params.actionType,
      dedupeKey: params.dedupeKey,
      action: params.action,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: { id?: number }; error?: string }
    | null;

  if (!response.ok || !body?.success || !body.data?.id) {
    throw new Error(
      body?.error ??
        `enqueue_failed_${response.status}_${response.statusText || 'unknown_status'}`,
    );
  }

  return { id: Number(body.data.id) };
}

async function resolvePoolContexts(): Promise<Map<`0x${string}`, PoolWatchContext[]>> {
  const candidates = await fetchActiveVaults(CHAINS.base.id);
  const out = new Map<`0x${string}`, PoolWatchContext[]>();

  for (const v of candidates) {
    const vaultAddress = asAddress(v.vaultAddress);
    const oracleAddress = asAddress(v.oracleAddress);
    if (!vaultAddress || !oracleAddress || !v.groupId) continue;

    const [poolConfiguredRaw, poolRaw] = await Promise.all([
      readContract<boolean>({
        address: oracleAddress,
        abi: ORACLE_ABI,
        functionName: 'v3PoolConfigured',
      }).catch(() => false),
      readContract<unknown>({
        address: oracleAddress,
        abi: ORACLE_ABI,
        functionName: 'v3Pool',
      }).catch(() => null),
    ]);
    if (!poolConfiguredRaw) continue;

    const poolAddress = asAddress(poolRaw);
    if (!poolAddress) continue;

    const existing = out.get(poolAddress) ?? [];
    existing.push({
      poolAddress,
      vaultAddress,
      oracleAddress,
      groupId: v.groupId,
    });
    out.set(poolAddress, existing);
  }

  return out;
}

function logDecision(payload: Record<string, unknown>): void {
  console.log(`[${WORKFLOW_NAME}] ${JSON.stringify(payload)}`);
}

async function evaluateAjnaForVault(params: {
  cfg: ListenerConfig;
  state: StrategyEventState;
  watched: PoolWatchContext;
  nowSeconds: number;
  keeperAddress: Address;
  scheduleStateSave: () => void;
}): Promise<number> {
  const { cfg, state, watched, nowSeconds, keeperAddress, scheduleStateSave } = params;
  const suggestedBucket = await readOracleSuggestedBucket({
    oracleAddress: watched.oracleAddress,
    twapDuration: cfg.ajna.twapDuration,
    targetLtvBps: cfg.ajna.targetLtvBps,
  });
  if (suggestedBucket === null) return 0;

  const strategies = await readAjnaStrategiesForVault(watched.vaultAddress).catch(() => []);
  if (strategies.length === 0) return 0;

  const blockNow = await getBlockTimestamp().catch(() => 0n);
  let enqueued = 0;

  for (const strategy of strategies) {
    const deviationBps = bucketPriceChangeBps({
      currentBucket: strategy.currentBucket,
      suggestedBucket,
    });
    if (deviationBps < cfg.ajna.priceChangeTriggerBps) {
      logDecision({
        event: 'ajna.skip',
        reason: 'price_change_below_trigger',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }

    const step = computeSteppedBucket({
      currentBucket: strategy.currentBucket,
      suggestedBucket,
      moveThreshold: cfg.ajna.moveThreshold,
      maxStep: cfg.ajna.maxStep,
    });
    if (!step.shouldMove) {
      logDecision({
        event: 'ajna.skip',
        reason: 'within_threshold',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }

    const targetBucket = await pickLiquidityAwareTarget({
      ajnaPool: strategy.ajnaPool,
      steppedBucket: step.steppedBucket,
      searchRadius: cfg.ajna.searchRadius,
    }).catch(() => step.steppedBucket);

    if (targetBucket === strategy.currentBucket) {
      logDecision({
        event: 'ajna.skip',
        reason: 'already_at_target',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }

    if (strategy.authAdmin.toLowerCase() !== keeperAddress.toLowerCase()) {
      logDecision({
        event: 'ajna.skip',
        reason: 'keeper_not_auth_admin',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }

    const actionType = 'strategy.ajna.rebucket';
    const cooldownKey = makeCooldownKey({
      vaultAddress: watched.vaultAddress,
      strategyAddressOrPool: strategy.authAddress,
      actionType,
    });
    if (
      isCooldownActive({
        state,
        key: cooldownKey,
        nowSeconds,
        cooldownSeconds: cfg.cooldownSeconds,
      })
    ) {
      logDecision({
        event: 'ajna.skip',
        reason: 'listener_cooldown_active',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }

    const rate = consumeVaultHourlyBudget({
      state,
      vaultAddress: watched.vaultAddress,
      nowSeconds,
      maxPerHour: cfg.maxActionsPerHour,
    });
    if (!rate.allowed) {
      await alertWarning(WORKFLOW_NAME, 'Vault action budget exceeded (Ajna)', {
        vaultAddress: watched.vaultAddress,
        pool: watched.poolAddress,
        strategyAddress: strategy.strategyAddress,
        maxActionsPerHour: cfg.maxActionsPerHour,
      });
      continue;
    }

    const method = 'setMinBucketIndex';
    const dedupeKey = makeDedupeKey({
      vaultAddress: watched.vaultAddress,
      strategyAddressOrPool: strategy.authAddress,
      actionType,
      band: String(targetBucket),
    });
    const action = {
      action: actionType,
      actionType,
      vaultAddress: watched.vaultAddress,
      strategyAddress: strategy.strategyAddress,
      authAddress: strategy.authAddress,
      oracleAddress: watched.oracleAddress,
      v3Pool: watched.poolAddress,
      triggerTick: null,
      referenceTick: null,
      currentBucket: strategy.currentBucket,
      suggestedBucket,
      steppedBucket: step.steppedBucket,
      targetBucket,
      method,
      computedDeviationBps: deviationBps,
      timestamp: new Date(nowSeconds * 1000).toISOString(),
    } satisfies Record<string, unknown>;

    const enqueuedResult = await enqueueAction({
      cfg,
      vaultAddress: watched.vaultAddress,
      groupId: watched.groupId,
      actionType,
      dedupeKey,
      action,
    });

    recordCooldown({ state, key: cooldownKey, nowSeconds });
    scheduleStateSave();
    enqueued += 1;

    logDecision({
      event: 'ajna.enqueue',
      pool: watched.poolAddress,
      vault: watched.vaultAddress,
      strategy: strategy.strategyAddress,
      computedDeviationBps: deviationBps,
      dedupeKey,
      actionId: enqueuedResult.id,
    });
  }

  return enqueued;
}

async function evaluateCharmForVault(params: {
  cfg: ListenerConfig;
  state: StrategyEventState;
  watched: PoolWatchContext;
  nowSeconds: number;
  keeperAddress: Address;
  scheduleStateSave: () => void;
}): Promise<number> {
  const { cfg, state, watched, nowSeconds, keeperAddress, scheduleStateSave } = params;
  const oracleContext = await readOraclePriceContext(watched.oracleAddress, cfg.charm.twapDuration);
  if (!oracleContext) return 0;

  const strategies = await readCharmStrategiesForVault(watched.vaultAddress).catch(() => []);
  if (strategies.length === 0) return 0;

  let enqueued = 0;
  for (const strategy of strategies) {
    const rangeContext = await readCharmRangeContext(strategy.charmVaultAddress, oracleContext);
    if (!rangeContext) continue;

    const deviationBps = tickPriceChangeBps({
      currentTick: oracleContext.normalizedTick,
      referenceTick: rangeContext.centerTickNormalized,
    });
    if (deviationBps < cfg.charm.priceChangeTriggerBps) {
      logDecision({
        event: 'charm.skip',
        reason: 'price_change_below_trigger',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
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

    const charmKeeper = asAddress(charmKeeperRaw);
    const charmOwner = asAddress(charmOwnerRaw);
    if (charmKeeper && charmKeeper.toLowerCase() !== keeperAddress.toLowerCase()) {
      logDecision({
        event: 'charm.skip',
        reason: 'keeper_not_charm_keeper',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }
    if (!charmKeeper && charmOwner && charmOwner.toLowerCase() !== keeperAddress.toLowerCase()) {
      logDecision({
        event: 'charm.skip',
        reason: 'keeper_not_charm_owner',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }

    const actionType = 'strategy.charm.rebalance';
    const cooldownKey = makeCooldownKey({
      vaultAddress: watched.vaultAddress,
      strategyAddressOrPool: strategy.strategyAddress,
      actionType,
    });
    if (
      isCooldownActive({
        state,
        key: cooldownKey,
        nowSeconds,
        cooldownSeconds: cfg.cooldownSeconds,
      })
    ) {
      logDecision({
        event: 'charm.skip',
        reason: 'listener_cooldown_active',
        pool: watched.poolAddress,
        vault: watched.vaultAddress,
        strategy: strategy.strategyAddress,
        computedDeviationBps: deviationBps,
      });
      continue;
    }

    const rate = consumeVaultHourlyBudget({
      state,
      vaultAddress: watched.vaultAddress,
      nowSeconds,
      maxPerHour: cfg.maxActionsPerHour,
    });
    if (!rate.allowed) {
      await alertWarning(WORKFLOW_NAME, 'Vault action budget exceeded (Charm)', {
        vaultAddress: watched.vaultAddress,
        pool: watched.poolAddress,
        strategyAddress: strategy.strategyAddress,
        maxActionsPerHour: cfg.maxActionsPerHour,
      });
      continue;
    }

    const tickBand = Math.floor(rangeContext.centerTickNormalized / 100);
    const dedupeKey = makeDedupeKey({
      vaultAddress: watched.vaultAddress,
      strategyAddressOrPool: strategy.strategyAddress,
      actionType,
      band: String(tickBand),
    });
    const action = {
      action: actionType,
      actionType,
      vaultAddress: watched.vaultAddress,
      strategyAddress: strategy.strategyAddress,
      charmVaultAddress: strategy.charmVaultAddress,
      oracleAddress: watched.oracleAddress,
      v3Pool: watched.poolAddress,
      triggerTick: oracleContext.normalizedTick,
      referenceTick: rangeContext.centerTickNormalized,
      computedDeviationBps: deviationBps,
      timestamp: new Date(nowSeconds * 1000).toISOString(),
    } satisfies Record<string, unknown>;

    const enqueuedResult = await enqueueAction({
      cfg,
      vaultAddress: watched.vaultAddress,
      groupId: watched.groupId,
      actionType,
      dedupeKey,
      action,
    });

    recordCooldown({ state, key: cooldownKey, nowSeconds });
    scheduleStateSave();
    enqueued += 1;

    logDecision({
      event: 'charm.enqueue',
      pool: watched.poolAddress,
      vault: watched.vaultAddress,
      strategy: strategy.strategyAddress,
      computedDeviationBps: deviationBps,
      dedupeKey,
      actionId: enqueuedResult.id,
    });
  }

  return enqueued;
}

async function evaluatePool(params: {
  cfg: ListenerConfig;
  state: StrategyEventState;
  poolAddress: `0x${string}`;
  watchedVaults: PoolWatchContext[];
  observedBlock: bigint;
  keeperAddress: Address;
  scheduleStateSave: () => void;
}): Promise<void> {
  const { cfg, state, poolAddress, watchedVaults, observedBlock, keeperAddress, scheduleStateSave } =
    params;
  setPoolLastProcessedBlock(state, poolAddress, observedBlock);
  scheduleStateSave();

  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const watched of watchedVaults) {
    const ajnaEnqueued = await evaluateAjnaForVault({
      cfg,
      state,
      watched,
      nowSeconds,
      keeperAddress,
      scheduleStateSave,
    }).catch((err) => {
      logDecision({
        event: 'ajna.error',
        pool: poolAddress,
        vault: watched.vaultAddress,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    });
    const charmEnqueued = await evaluateCharmForVault({
      cfg,
      state,
      watched,
      nowSeconds,
      keeperAddress,
      scheduleStateSave,
    }).catch((err) => {
      logDecision({
        event: 'charm.error',
        pool: poolAddress,
        vault: watched.vaultAddress,
        error: err instanceof Error ? err.message : String(err),
      });
      return 0;
    });

    if (ajnaEnqueued + charmEnqueued > 0) {
      await alertInfo(WORKFLOW_NAME, 'Strategy actions enqueued from pool event', {
        poolAddress,
        vaultAddress: watched.vaultAddress,
        ajnaEnqueued,
        charmEnqueued,
      });
    }
  }
}

async function backfillPool(params: {
  cfg: ListenerConfig;
  state: StrategyEventState;
  poolAddress: `0x${string}`;
  watchedVaults: PoolWatchContext[];
  keeperAddress: Address;
  scheduleStateSave: () => void;
}): Promise<void> {
  const { cfg, state, poolAddress, watchedVaults, keeperAddress, scheduleStateSave } = params;
  const client = getPublicClient();
  const latest = await client.getBlockNumber();
  const lastProcessed = getPoolLastProcessedBlock(state, poolAddress);
  const startFrom =
    lastProcessed > 0n
      ? lastProcessed + 1n
      : latest > cfg.startLookbackBlocks
        ? latest - cfg.startLookbackBlocks
        : 0n;

  const backlog = latest >= startFrom ? latest - startFrom : 0n;
  if (backlog > cfg.backlogAlertBlocks) {
    await alertWarning(WORKFLOW_NAME, 'Large backfill backlog detected', {
      poolAddress,
      backlogBlocks: Number(backlog > BigInt(Number.MAX_SAFE_INTEGER) ? BigInt(Number.MAX_SAFE_INTEGER) : backlog),
      startFrom: String(startFrom),
      latest: String(latest),
    });
  }

  if (startFrom > latest) {
    setPoolLastProcessedBlock(state, poolAddress, latest);
    scheduleStateSave();
    return;
  }

  let sawLogs = false;
  for (let from = startFrom; from <= latest; from += cfg.backfillChunkBlocks) {
    const to =
      from + cfg.backfillChunkBlocks - 1n > latest
        ? latest
        : from + cfg.backfillChunkBlocks - 1n;
    const logs = await client.getLogs({
      address: poolAddress,
      event: UNISWAP_V3_POOL_SWAP_EVENT_ABI[0],
      fromBlock: from,
      toBlock: to,
    });
    if (logs.length > 0) sawLogs = true;

    state.lastBackfillRange = {
      pool: poolAddress.toLowerCase(),
      fromBlock: String(from),
      toBlock: String(to),
      at: Math.floor(Date.now() / 1000),
    };
    setPoolLastProcessedBlock(state, poolAddress, to);
    scheduleStateSave();
  }

  if (sawLogs) {
    await evaluatePool({
      cfg,
      state,
      poolAddress,
      watchedVaults,
      observedBlock: latest,
      keeperAddress,
      scheduleStateSave,
    });
  }
}

async function runListenerSession(cfg: ListenerConfig, state: StrategyEventState): Promise<void> {
  const keeperAddress = getKeeperAddress();
  const poolContexts = await resolvePoolContexts();
  if (poolContexts.size === 0) {
    await alertWarning(WORKFLOW_NAME, 'No Base v3 pools discovered for strategy listener');
    await sleep(15_000);
    return;
  }

  await alertInfo(WORKFLOW_NAME, 'Strategy listener booting', {
    pools: poolContexts.size,
    wsRpc: cfg.wsRpcUrl,
  });

  let stateSaveTimer: NodeJS.Timeout | null = null;
  const scheduleStateSave = () => {
    if (stateSaveTimer) return;
    stateSaveTimer = setTimeout(() => {
      stateSaveTimer = null;
      saveStrategyEventState(cfg.stateFile, state).catch((err) => {
        console.error(`[${WORKFLOW_NAME}] failed to persist state:`, err);
      });
    }, 400);
  };

  // Backfill before live subscription so restart gaps are covered.
  for (const [poolAddress, watchedVaults] of poolContexts.entries()) {
    await backfillPool({
      cfg,
      state,
      poolAddress,
      watchedVaults,
      keeperAddress,
      scheduleStateSave,
    }).catch(async (err) => {
      await alertWarning(WORKFLOW_NAME, 'Backfill failed for pool', {
        poolAddress,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  const wsClient = createPublicClient({
    chain: base,
    transport: webSocket(cfg.wsRpcUrl),
  });
  const unwatchers: Array<() => void> = [];
  const pendingBlocks = new Map<`0x${string}`, bigint>();
  const pendingTimers = new Map<`0x${string}`, NodeJS.Timeout>();
  const evaluating = new Set<string>();

  let rejectSession: ((reason?: unknown) => void) | null = null;
  let sessionFailed = false;
  const sessionPromise = new Promise<void>((_resolve, reject) => {
    rejectSession = reject;
  });

  const failSession = async (reason: unknown) => {
    if (sessionFailed) return;
    sessionFailed = true;
    const message = reason instanceof Error ? reason.message : String(reason);
    await alertWarning(WORKFLOW_NAME, 'WebSocket listener disconnected', { error: message });
    if (rejectSession) rejectSession(new Error(message));
  };

  const schedulePoolEvaluation = (poolAddress: `0x${string}`, observedBlock: bigint) => {
    const current = pendingBlocks.get(poolAddress) ?? 0n;
    if (observedBlock > current) {
      pendingBlocks.set(poolAddress, observedBlock);
    }

    if (pendingTimers.has(poolAddress)) return;
    const timer = setTimeout(async () => {
      pendingTimers.delete(poolAddress);
      const targetBlock = pendingBlocks.get(poolAddress);
      if (!targetBlock) return;
      pendingBlocks.delete(poolAddress);

      const evalKey = poolAddress.toLowerCase();
      if (evaluating.has(evalKey)) {
        pendingBlocks.set(poolAddress, targetBlock);
        schedulePoolEvaluation(poolAddress, targetBlock);
        return;
      }

      const watchedVaults = poolContexts.get(poolAddress) ?? [];
      if (watchedVaults.length === 0) return;

      evaluating.add(evalKey);
      try {
        await evaluatePool({
          cfg,
          state,
          poolAddress,
          watchedVaults,
          observedBlock: targetBlock,
          keeperAddress,
          scheduleStateSave,
        });
      } catch (err) {
        console.error(`[${WORKFLOW_NAME}] evaluation failed`, {
          poolAddress,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        evaluating.delete(evalKey);
      }
    }, cfg.debounceMs);

    pendingTimers.set(poolAddress, timer);
  };

  for (const [poolAddress] of poolContexts.entries()) {
    const unwatch = wsClient.watchContractEvent({
      address: poolAddress,
      abi: UNISWAP_V3_POOL_SWAP_EVENT_ABI,
      eventName: 'Swap',
      onLogs: (logs) => {
        if (logs.length === 0) return;
        const maxBlock = logs.reduce<bigint>((max, log) => {
          const b = log.blockNumber ?? 0n;
          return b > max ? b : max;
        }, 0n);

        logDecision({
          event: 'swap.received',
          pool: poolAddress,
          count: logs.length,
          block: String(maxBlock),
        });
        if (maxBlock > 0n) {
          schedulePoolEvaluation(poolAddress, maxBlock);
        }
      },
      onError: (err) => {
        void failSession(err);
      },
      poll: false,
    });
    unwatchers.push(unwatch);
  }

  try {
    await sessionPromise;
  } finally {
    for (const timer of pendingTimers.values()) clearTimeout(timer);
    pendingTimers.clear();
    for (const unwatch of unwatchers) {
      try {
        unwatch();
      } catch {
        // ignore unsubscribe errors
      }
    }
    if (stateSaveTimer) {
      clearTimeout(stateSaveTimer);
      stateSaveTimer = null;
    }
    await saveStrategyEventState(cfg.stateFile, state).catch(() => undefined);
  }
}

export async function startStrategyEventListener(): Promise<void> {
  const cfg = buildConfig();
  const state = await loadStrategyEventState(cfg.stateFile);
  let reconnectDelay = cfg.reconnectDelayMs;

  for (;;) {
    try {
      await runListenerSession(cfg, state);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      state.lastReconnectAt = Math.floor(Date.now() / 1000);
      await saveStrategyEventState(cfg.stateFile, state).catch(() => undefined);
      await alertCritical(WORKFLOW_NAME, 'Strategy listener session failed', {
        error: message,
        retryInMs: reconnectDelay,
      });
      await sleep(reconnectDelay);
      reconnectDelay = Math.min(
        cfg.reconnectDelayMaxMs,
        reconnectDelay * Math.max(1, cfg.reconnectBackoffMultiplier),
      );
      continue;
    }

    // Defensive: if session exits cleanly (unexpected for always-on), restart shortly.
    await sleep(reconnectDelay);
    reconnectDelay = Math.min(
      cfg.reconnectDelayMaxMs,
      reconnectDelay * Math.max(1, cfg.reconnectBackoffMultiplier),
    );
  }
}

