import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface StrategyEventState {
  pools: Record<string, { lastProcessedBlock: string }>;
  cooldowns: Record<string, number>;
  vaultHourly: Record<string, number[]>;
  lastReconnectAt?: number;
  lastBackfillRange?: {
    pool: string;
    fromBlock: string;
    toBlock: string;
    at: number;
  };
}

function normalizeAddressKey(value: string): string {
  return value.trim().toLowerCase();
}

function baseState(): StrategyEventState {
  return {
    pools: {},
    cooldowns: {},
    vaultHourly: {},
  };
}

function normalizeState(input: unknown): StrategyEventState {
  if (!input || typeof input !== 'object') return baseState();
  const src = input as Partial<StrategyEventState>;

  const pools: StrategyEventState['pools'] = {};
  for (const [rawPool, entry] of Object.entries(src.pools ?? {})) {
    const pool = normalizeAddressKey(rawPool);
    const lastProcessedBlock = String((entry as { lastProcessedBlock?: unknown })?.lastProcessedBlock ?? '0');
    if (!pool || !lastProcessedBlock) continue;
    pools[pool] = { lastProcessedBlock };
  }

  const cooldowns: StrategyEventState['cooldowns'] = {};
  for (const [rawKey, rawTs] of Object.entries(src.cooldowns ?? {})) {
    const key = String(rawKey);
    const ts = Number(rawTs);
    if (!key || !Number.isFinite(ts) || ts <= 0) continue;
    cooldowns[key] = Math.floor(ts);
  }

  const vaultHourly: StrategyEventState['vaultHourly'] = {};
  for (const [rawVault, rawList] of Object.entries(src.vaultHourly ?? {})) {
    const vault = normalizeAddressKey(rawVault);
    if (!vault || !Array.isArray(rawList)) continue;
    const points = rawList
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.floor(n));
    if (points.length > 0) vaultHourly[vault] = points;
  }

  const out: StrategyEventState = {
    pools,
    cooldowns,
    vaultHourly,
  };

  const lastReconnectAt = Number(src.lastReconnectAt);
  if (Number.isFinite(lastReconnectAt) && lastReconnectAt > 0) {
    out.lastReconnectAt = Math.floor(lastReconnectAt);
  }

  const backfill = src.lastBackfillRange as StrategyEventState['lastBackfillRange'] | undefined;
  if (
    backfill &&
    typeof backfill.pool === 'string' &&
    typeof backfill.fromBlock === 'string' &&
    typeof backfill.toBlock === 'string' &&
    Number.isFinite(Number(backfill.at))
  ) {
    out.lastBackfillRange = {
      pool: normalizeAddressKey(backfill.pool),
      fromBlock: backfill.fromBlock,
      toBlock: backfill.toBlock,
      at: Math.floor(Number(backfill.at)),
    };
  }

  return out;
}

export async function loadStrategyEventState(filePath: string): Promise<StrategyEventState> {
  try {
    const text = await readFile(filePath, 'utf8');
    if (!text.trim()) return baseState();
    return normalizeState(JSON.parse(text));
  } catch {
    return baseState();
  }
}

export async function saveStrategyEventState(filePath: string, state: StrategyEventState): Promise<void> {
  const normalized = normalizeState(state);
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });

  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

export function getPoolLastProcessedBlock(
  state: StrategyEventState,
  poolAddress: `0x${string}`,
): bigint {
  const key = normalizeAddressKey(poolAddress);
  const raw = state.pools[key]?.lastProcessedBlock ?? '0';
  try {
    const parsed = BigInt(raw);
    return parsed >= 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}

export function setPoolLastProcessedBlock(
  state: StrategyEventState,
  poolAddress: `0x${string}`,
  blockNumber: bigint,
): void {
  const key = normalizeAddressKey(poolAddress);
  if (!state.pools[key]) state.pools[key] = { lastProcessedBlock: '0' };
  state.pools[key].lastProcessedBlock = String(blockNumber >= 0n ? blockNumber : 0n);
}

export function isCooldownActive(params: {
  state: StrategyEventState;
  key: string;
  nowSeconds: number;
  cooldownSeconds: number;
}): boolean {
  const last = Number(params.state.cooldowns[params.key] ?? 0);
  if (!Number.isFinite(last) || last <= 0) return false;
  return params.nowSeconds - last < Math.max(0, params.cooldownSeconds);
}

export function recordCooldown(params: {
  state: StrategyEventState;
  key: string;
  nowSeconds: number;
}): void {
  params.state.cooldowns[params.key] = Math.floor(params.nowSeconds);
}

export function consumeVaultHourlyBudget(params: {
  state: StrategyEventState;
  vaultAddress: `0x${string}`;
  nowSeconds: number;
  maxPerHour: number;
}): { allowed: boolean; count: number } {
  const key = normalizeAddressKey(params.vaultAddress);
  const windowStart = params.nowSeconds - 3600;
  const existing = params.state.vaultHourly[key] ?? [];
  const kept = existing.filter((ts) => Number.isFinite(ts) && ts > windowStart);

  if (kept.length >= Math.max(1, Math.floor(params.maxPerHour))) {
    params.state.vaultHourly[key] = kept;
    return { allowed: false, count: kept.length };
  }

  kept.push(Math.floor(params.nowSeconds));
  params.state.vaultHourly[key] = kept;
  return { allowed: true, count: kept.length };
}

