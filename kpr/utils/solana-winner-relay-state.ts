import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type WinnerRelaySkipReason =
  | 'invalid_args'
  | 'invalid_shares_paid'
  | 'unmapped_creator_mint'
  | 'unmapped_twin_pubkey';

export interface WinnerRelayQuarantineEntry {
  /** Stable id: `${blockNumber}:${logIndex}` */
  id: string;
  blockNumber: string;
  logIndex: number;
  winner: string;
  creatorCoin: string;
  sharesPaid: string;
  reason: WinnerRelaySkipReason;
  firstSeenAt: number;
  lastAttemptAt: number;
  attempts: number;
}

export interface SolanaWinnerRelayState {
  checkpointBlock: string;
  checkpointLogIndex: number;
  updatedAt?: number;
  /** M2-11 — events skipped for mapping/args; re-attempted without blocking scan progress. */
  quarantine?: WinnerRelayQuarantineEntry[];
}

function baseState(): SolanaWinnerRelayState {
  return {
    checkpointBlock: '0',
    checkpointLogIndex: -1,
    quarantine: [],
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

function normalizeQuarantineEntry(raw: unknown): WinnerRelayQuarantineEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const e = raw as Partial<WinnerRelayQuarantineEntry>;
  const blockNumber = normalizeBlock(e.blockNumber);
  const logIndex = normalizeLogIndex(e.logIndex);
  const id =
    typeof e.id === 'string' && e.id.trim()
      ? e.id.trim()
      : `${blockNumber}:${logIndex}`;
  const reason = e.reason;
  if (
    reason !== 'invalid_args' &&
    reason !== 'invalid_shares_paid' &&
    reason !== 'unmapped_creator_mint' &&
    reason !== 'unmapped_twin_pubkey'
  ) {
    return null;
  }
  return {
    id,
    blockNumber,
    logIndex,
    winner: typeof e.winner === 'string' ? e.winner : '',
    creatorCoin: typeof e.creatorCoin === 'string' ? e.creatorCoin : '',
    sharesPaid: typeof e.sharesPaid === 'string' ? e.sharesPaid : '0',
    reason,
    firstSeenAt: Number.isFinite(Number(e.firstSeenAt)) ? Math.floor(Number(e.firstSeenAt)) : Date.now(),
    lastAttemptAt: Number.isFinite(Number(e.lastAttemptAt)) ? Math.floor(Number(e.lastAttemptAt)) : Date.now(),
    attempts: Number.isFinite(Number(e.attempts)) ? Math.max(1, Math.floor(Number(e.attempts))) : 1,
  };
}

function normalizeState(input: unknown): SolanaWinnerRelayState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return baseState();
  const raw = input as Partial<SolanaWinnerRelayState>;
  const quarantineRaw = Array.isArray(raw.quarantine) ? raw.quarantine : [];
  const quarantine = quarantineRaw
    .map((entry) => normalizeQuarantineEntry(entry))
    .filter((entry): entry is WinnerRelayQuarantineEntry => entry !== null);
  const normalized: SolanaWinnerRelayState = {
    checkpointBlock: normalizeBlock(raw.checkpointBlock),
    checkpointLogIndex: normalizeLogIndex(raw.checkpointLogIndex),
    quarantine,
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

export function winnerRelayEventId(blockNumber: bigint, logIndex: number): string {
  return `${String(blockNumber >= 0n ? blockNumber : 0n)}:${normalizeLogIndex(logIndex)}`;
}

/** Upsert an unmapped/invalid event into quarantine (does not advance processed checkpoint). */
export function quarantineWinnerRelayEvent(
  state: SolanaWinnerRelayState,
  entry: {
    blockNumber: bigint;
    logIndex: number;
    winner: string;
    creatorCoin: string;
    sharesPaid: string;
    reason: WinnerRelaySkipReason;
  },
): WinnerRelayQuarantineEntry {
  if (!state.quarantine) state.quarantine = [];
  const id = winnerRelayEventId(entry.blockNumber, entry.logIndex);
  const now = Date.now();
  const existing = state.quarantine.find((q) => q.id === id);
  if (existing) {
    existing.lastAttemptAt = now;
    existing.attempts += 1;
    existing.reason = entry.reason;
    existing.winner = entry.winner;
    existing.creatorCoin = entry.creatorCoin;
    existing.sharesPaid = entry.sharesPaid;
    return existing;
  }
  const created: WinnerRelayQuarantineEntry = {
    id,
    blockNumber: String(entry.blockNumber >= 0n ? entry.blockNumber : 0n),
    logIndex: normalizeLogIndex(entry.logIndex),
    winner: entry.winner,
    creatorCoin: entry.creatorCoin,
    sharesPaid: entry.sharesPaid,
    reason: entry.reason,
    firstSeenAt: now,
    lastAttemptAt: now,
    attempts: 1,
  };
  state.quarantine.push(created);
  return created;
}

export function removeWinnerRelayQuarantineEntry(
  state: SolanaWinnerRelayState,
  id: string,
): boolean {
  if (!state.quarantine || state.quarantine.length === 0) return false;
  const before = state.quarantine.length;
  state.quarantine = state.quarantine.filter((q) => q.id !== id);
  return state.quarantine.length < before;
}

export function listWinnerRelayQuarantine(state: SolanaWinnerRelayState): WinnerRelayQuarantineEntry[] {
  return [...(state.quarantine ?? [])];
}
