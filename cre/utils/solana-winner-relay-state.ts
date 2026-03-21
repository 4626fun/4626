import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface SolanaWinnerRelayState {
  checkpointBlock: string;
  checkpointLogIndex: number;
  updatedAt?: number;
}

function baseState(): SolanaWinnerRelayState {
  return {
    checkpointBlock: '0',
    checkpointLogIndex: -1,
  };
}

function normalizeBlock(value: unknown): string {
  try {
    const raw = typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
      ? BigInt(value)
      : 0n;
    return String(raw >= 0n ? raw : 0n);
  } catch {
    return '0';
  }
}

function normalizeLogIndex(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return -1;
  return Math.max(-1, Math.floor(parsed));
}

function normalizeState(input: unknown): SolanaWinnerRelayState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return baseState();
  const raw = input as Partial<SolanaWinnerRelayState>;
  const normalized: SolanaWinnerRelayState = {
    checkpointBlock: normalizeBlock(raw.checkpointBlock),
    checkpointLogIndex: normalizeLogIndex(raw.checkpointLogIndex),
  };
  const updatedAt = Number(raw.updatedAt);
  if (Number.isFinite(updatedAt) && updatedAt > 0) {
    normalized.updatedAt = Math.floor(updatedAt);
  }
  return normalized;
}

export async function loadSolanaWinnerRelayState(filePath: string): Promise<SolanaWinnerRelayState> {
  try {
    const text = await readFile(filePath, 'utf8');
    if (!text.trim()) return baseState();
    return normalizeState(JSON.parse(text));
  } catch {
    return baseState();
  }
}

export async function saveSolanaWinnerRelayState(
  filePath: string,
  state: SolanaWinnerRelayState,
): Promise<void> {
  const normalized = normalizeState({
    ...state,
    updatedAt: Date.now(),
  });
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });

  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  await rename(tempPath, filePath);
}

export function getWinnerRelayCheckpoint(state: SolanaWinnerRelayState): {
  blockNumber: bigint;
  logIndex: number;
} {
  try {
    const blockNumber = BigInt(state.checkpointBlock);
    return {
      blockNumber: blockNumber >= 0n ? blockNumber : 0n,
      logIndex: normalizeLogIndex(state.checkpointLogIndex),
    };
  } catch {
    return {
      blockNumber: 0n,
      logIndex: -1,
    };
  }
}

export function setWinnerRelayCheckpoint(
  state: SolanaWinnerRelayState,
  blockNumber: bigint,
  logIndex: number,
): void {
  state.checkpointBlock = String(blockNumber >= 0n ? blockNumber : 0n);
  state.checkpointLogIndex = normalizeLogIndex(logIndex);
  state.updatedAt = Date.now();
}

export function compareWinnerRelayCheckpoint(
  leftBlock: bigint,
  leftLogIndex: number,
  rightBlock: bigint,
  rightLogIndex: number,
): number {
  if (leftBlock < rightBlock) return -1;
  if (leftBlock > rightBlock) return 1;
  const leftIdx = normalizeLogIndex(leftLogIndex);
  const rightIdx = normalizeLogIndex(rightLogIndex);
  if (leftIdx < rightIdx) return -1;
  if (leftIdx > rightIdx) return 1;
  return 0;
}
