/**
 * Keepr Solana Winner Relay Action — Base event read + Solana write.
 *
 * Watches Base LotteryManager for LotteryWinnerNotification events,
 * filters for Solana-originated entries (creators with Solana mints),
 * and calls record_winner on the Solana hook program so the frontend
 * can show "You won!".
 *
 * Flow:
 *   1. Query Base LotteryManager for recent winner events
 *   2. Filter for winners whose creatorCoin maps to a Solana mint
 *   3. Reverse-map the Twin winner address to a Solana pubkey
 *   4. Call record_winner on Solana hook program
 *
 * Anchor accounts for record_winner:
 *   - keeper: Signer (SOLANA_KEEPER_KEYPAIR)
 *   - creator_config: PDA [b"creator_config", mint]
 *   - creator_mint: the Token-2022 mint pubkey
 *   - winner_record: PDA [b"winner_record", mint]
 */

import { readFile, stat } from 'node:fs/promises';
// FIX: MED-01 — Replace require('crypto') with ES module import
import * as crypto from 'node:crypto';

import { requireEnv, CHAINS } from '../config.js';
import { getPublicClient } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair, sendConfirmedSolanaTransaction } from '../utils/solana.js';
// FIX: HGH-03 — Import isAddress for log.args field validation
import { isAddress, type GetLogsReturnType } from 'viem';
import {
  compareWinnerRelayCheckpoint,
  getWinnerRelayCheckpoint,
  listWinnerRelayQuarantine,
  loadSolanaWinnerRelayState,
  quarantineWinnerRelayEvent,
  removeWinnerRelayQuarantineEntry,
  saveSolanaWinnerRelayState,
  setWinnerRelayCheckpoint,
  winnerRelayEventId,
  type WinnerRelayQuarantineEntry,
  type WinnerRelaySkipReason,
} from '../utils/solana-winner-relay-state.js';

const WORKFLOW_NAME = 'keepr-solana-winner-relay';
const INITIAL_LOOKBACK_BLOCKS = 100n;
const DEFAULT_MAX_GET_LOGS_BLOCK_RANGE = 99_999n;

function readMaxGetLogsBlockRange(): bigint {
  const parsed = Number.parseInt(String(process.env.KPR_GET_LOGS_MAX_BLOCK_RANGE ?? '99999'), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_GET_LOGS_BLOCK_RANGE;
  return BigInt(Math.min(parsed, 99999));
}

async function getWinnerNotificationLogs(params: {
  publicClient: ReturnType<typeof getPublicClient>;
  lotteryManager: `0x${string}`;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const maxRange = readMaxGetLogsBlockRange();
  // Typed via the event ABI so downstream consumers see decoded `args`.
  const logs: GetLogsReturnType<(typeof LOTTERY_WINNER_EVENT_ABI)[0]> = [];
  let cursor = params.fromBlock;
  while (cursor <= params.toBlock) {
    const rangeEnd = cursor + maxRange <= params.toBlock ? cursor + maxRange : params.toBlock;
    const chunk = await params.publicClient.getLogs({
      address: params.lotteryManager,
      event: LOTTERY_WINNER_EVENT_ABI[0],
      fromBlock: cursor,
      toBlock: rangeEnd,
    });
    logs.push(...chunk);
    if (rangeEnd >= params.toBlock) break;
    cursor = rangeEnd + 1n;
  }
  return logs;
}

export interface WinnerRelayResult {
  eventsProcessed: number;
  winnersRecorded: number;
  /** M2-11 — events held in quarantine (unmapped / invalid), eligible for retry. */
  eventsQuarantined: number;
  quarantineSize: number;
  quarantineRetried: number;
  quarantineRecovered: number;
}

// ---------------------------------------------------------------------------
// ABI fragment for LotteryManager winner event
// ---------------------------------------------------------------------------

const LOTTERY_WINNER_EVENT_ABI = [
  {
    type: 'event',
    name: 'LotteryWinnerNotification',
    inputs: [
      { name: 'winner', type: 'address', indexed: true },
      { name: 'creatorCoin', type: 'address', indexed: true },
      { name: 'sharesPaid', type: 'uint256', indexed: false },
      { name: 'originChain', type: 'uint16', indexed: false },
    ],
  },
] as const;

function normalizeLookupMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key.trim().toLowerCase(), typeof raw === 'string' ? raw.trim() : ''])
      .filter(([key, mapped]) => key.length > 0 && mapped.length > 0),
  );
}

// FIX: LOW-05 — Maximum file size for lookup map reads (1 MB)
const MAX_LOOKUP_MAP_FILE_SIZE = 1_048_576;

async function loadJsonLookupMap(params: {
  inlineEnvKey: string;
  fileEnvKey: string;
}): Promise<Record<string, string>> {
  const filePath = String(process.env[params.fileEnvKey] ?? '').trim();
  if (filePath) {
    // FIX: LOW-05 — Check file size before reading to prevent memory exhaustion
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_LOOKUP_MAP_FILE_SIZE) {
      throw new Error(`Lookup map file ${filePath} exceeds max size (${fileStat.size} > ${MAX_LOOKUP_MAP_FILE_SIZE})`);
    }
    const text = await readFile(filePath, 'utf8');
    return normalizeLookupMap(JSON.parse(text));
  }
  const inline = String(process.env[params.inlineEnvKey] ?? '').trim();
  if (!inline) return {};
  return normalizeLookupMap(JSON.parse(inline));
}

function parseLogPosition(log: { blockNumber?: unknown; logIndex?: unknown }): {
  blockNumber: bigint;
  logIndex: number;
} {
  let blockNumber = 0n;
  try {
    blockNumber = BigInt(log.blockNumber as bigint | number | string);
  } catch {
    blockNumber = 0n;
  }

  const rawLogIndex = Number(log.logIndex ?? -1);
  return {
    blockNumber: blockNumber >= 0n ? blockNumber : 0n,
    logIndex: Number.isFinite(rawLogIndex) ? Math.max(-1, Math.floor(rawLogIndex)) : -1,
  };
}

function getWinnerRelayStateFile(): string {
  return String(process.env.SOLANA_WINNER_RELAY_STATE_FILE ?? '').trim() ||
    `${process.cwd()}/.state/keepr-solana-winner-relay.json`;
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

type RecordWinnerContext = {
  connection: any;
  PublicKey: typeof import('@solana/web3.js').PublicKey;
  Transaction: typeof import('@solana/web3.js').Transaction;
  SystemProgram: typeof import('@solana/web3.js').SystemProgram;
  keeperKeypair: any;
  programPubkey: any;
  creatorCoinToMint: Record<string, string>;
  twinToSolanaPubkey: Record<string, string>;
};

/**
 * M2-12 — Base win digest: sha256(blockBe64 ‖ logIndexBe32 ‖ creatorCoin20 ‖ winner20).
 * Must stay stable across retries so the on-chain win_id PDA is deterministic.
 */
export function buildWinnerRelayWinId(params: {
  blockNumber: bigint;
  logIndex: number;
  creatorCoin: string;
  winner: string;
}): Buffer {
  const hash = crypto.createHash('sha256');
  const blockBuf = Buffer.alloc(8);
  blockBuf.writeBigUInt64BE(params.blockNumber >= 0n ? params.blockNumber : 0n);
  hash.update(blockBuf);
  const logBuf = Buffer.alloc(4);
  logBuf.writeUInt32BE(Math.max(0, Math.floor(params.logIndex)) >>> 0);
  hash.update(logBuf);
  const creatorHex = params.creatorCoin.replace(/^0x/i, '').toLowerCase().padStart(40, '0').slice(0, 40);
  const winnerHex = params.winner.replace(/^0x/i, '').toLowerCase().padStart(40, '0').slice(0, 40);
  hash.update(Buffer.from(creatorHex, 'hex'));
  hash.update(Buffer.from(winnerHex, 'hex'));
  return hash.digest();
}

function isAlreadyRecordedError(message: string): boolean {
  const m = message.toLowerCase();
  // Account init failure (PDA exists) or explicit DuplicateWinId program error.
  return (
    m.includes('already in use') ||
    m.includes('already_initialized') ||
    m.includes('account already exists') ||
    m.includes('duplicatewinid') ||
    m.includes('duplicate win_id')
  );
}

async function tryRecordWinnerOnSolana(params: {
  ctx: RecordWinnerContext;
  winner: string;
  creatorCoin: string;
  sharesPaid: unknown;
  blockNumber: bigint;
  logIndex: number;
}): Promise<
  | { ok: true; solanaMint: string; winnerSolanaPubkey: string; sig: string; winId: string }
  | { ok: false; reason: WinnerRelaySkipReason }
> {
  const { ctx } = params;
  if (!isAddress(params.winner) || !isAddress(params.creatorCoin)) {
    return { ok: false, reason: 'invalid_args' };
  }

  const solanaMint = ctx.creatorCoinToMint[params.creatorCoin.toLowerCase()];
  if (!solanaMint) {
    return { ok: false, reason: 'unmapped_creator_mint' };
  }

  const winnerSolanaPubkey = ctx.twinToSolanaPubkey[params.winner.toLowerCase()];
  if (!winnerSolanaPubkey) {
    return { ok: false, reason: 'unmapped_twin_pubkey' };
  }

  const mint = new ctx.PublicKey(solanaMint);
  const winnerPubkey = new ctx.PublicKey(winnerSolanaPubkey);
  const winId = buildWinnerRelayWinId({
    blockNumber: params.blockNumber,
    logIndex: params.logIndex,
    creatorCoin: params.creatorCoin,
    winner: params.winner,
  });

  const [creatorConfigPda] = ctx.PublicKey.findProgramAddressSync(
    [Buffer.from('creator_config'), mint.toBuffer()],
    ctx.programPubkey,
  );
  const [winnerRecordPda] = ctx.PublicKey.findProgramAddressSync(
    [Buffer.from('winner_record'), mint.toBuffer()],
    ctx.programPubkey,
  );
  // M2-12 — one-shot PDA seeds: ["win_id", mint, win_id]
  const [winIdRecordPda] = ctx.PublicKey.findProgramAddressSync(
    [Buffer.from('win_id'), mint.toBuffer(), winId],
    ctx.programPubkey,
  );

  const discriminator = crypto
    .createHash('sha256')
    .update('global:record_winner')
    .digest()
    .subarray(0, 8);

  // Encode: winner (32) + shares_paid (u64 LE) + win_id (32) = 72
  const argsBuffer = Buffer.alloc(72);
  winnerPubkey.toBuffer().copy(argsBuffer, 0);

  const maxU64 = (1n << 64n) - 1n;
  let sharesPaidU64 = BigInt(params.sharesPaid?.toString() ?? '0');
  if (sharesPaidU64 > maxU64) {
    await alertWarning(WORKFLOW_NAME, 'sharesPaid exceeds u64, truncating for Solana record', {
      creatorCoin: params.creatorCoin,
      solanaMint,
      sharesPaid: params.sharesPaid?.toString(),
    });
    sharesPaidU64 = maxU64;
  }
  argsBuffer.writeBigUInt64LE(sharesPaidU64, 32);
  winId.copy(argsBuffer, 40);

  const instructionData = Buffer.concat([discriminator, argsBuffer]);
  const recordWinnerIx = {
    programId: ctx.programPubkey,
    keys: [
      { pubkey: ctx.keeperKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: creatorConfigPda, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: winnerRecordPda, isSigner: false, isWritable: true },
      { pubkey: winIdRecordPda, isSigner: false, isWritable: true },
      { pubkey: ctx.SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  };

  try {
    const tx = new ctx.Transaction().add(recordWinnerIx);
    const sig = await sendConfirmedSolanaTransaction({
      connection: ctx.connection,
      transaction: tx,
      signers: [ctx.keeperKeypair],
      commitment: 'confirmed',
    });
    return {
      ok: true,
      solanaMint,
      winnerSolanaPubkey,
      sig,
      winId: `0x${winId.toString('hex')}`,
    };
  } catch (txErr: unknown) {
    const msg = txErr instanceof Error ? txErr.message : String(txErr);
    // Idempotent success if the win_id PDA already exists (replay of same Base win).
    if (isAlreadyRecordedError(msg)) {
      await alertInfo(WORKFLOW_NAME, 'Win already recorded on Solana (duplicate win_id)', {
        creatorCoin: params.creatorCoin,
        solanaMint,
        winId: `0x${winId.toString('hex')}`,
      });
      return {
        ok: true,
        solanaMint,
        winnerSolanaPubkey,
        sig: 'already_recorded',
        winId: `0x${winId.toString('hex')}`,
      };
    }
    throw txErr;
  }
}

export async function executeSolanaWinnerRelay(): Promise<WinnerRelayResult> {
  const result: WinnerRelayResult = {
    eventsProcessed: 0,
    winnersRecorded: 0,
    eventsQuarantined: 0,
    quarantineSize: 0,
    quarantineRetried: 0,
    quarantineRecovered: 0,
  };

  const lotteryManager = requireEnv('LOTTERY_MANAGER') as `0x${string}`;
  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
  const programId = CHAINS.solana.programId;

  try {
    const publicClient = getPublicClient();
    const currentBlock = await publicClient.getBlockNumber();
    const stateFile = getWinnerRelayStateFile();
    const state = await loadSolanaWinnerRelayState(stateFile);
    let { blockNumber: checkpointBlock, logIndex: checkpointLogIndex } = getWinnerRelayCheckpoint(state);

    if (checkpointBlock === 0n && checkpointLogIndex < 0) {
      checkpointBlock = currentBlock > INITIAL_LOOKBACK_BLOCKS ? currentBlock - INITIAL_LOOKBACK_BLOCKS : 0n;
    } else if (checkpointBlock > currentBlock) {
      checkpointBlock = currentBlock;
      checkpointLogIndex = -1;
    }

    const {
      Connection,
      PublicKey,
      Transaction,
      SystemProgram,
    } = require('@solana/web3.js');
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(programId);

    const creatorCoinToMint = await loadJsonLookupMap({
      inlineEnvKey: 'SOLANA_CREATOR_COIN_TO_MINT_MAPPING',
      fileEnvKey: 'SOLANA_CREATOR_COIN_TO_MINT_MAPPING_FILE',
    });

    const twinToSolanaPubkey = await loadJsonLookupMap({
      inlineEnvKey: 'SOLANA_TWIN_TO_PUBKEY_MAPPING',
      fileEnvKey: 'SOLANA_TWIN_TO_PUBKEY_MAPPING_FILE',
    });

    const ctx: RecordWinnerContext = {
      connection,
      PublicKey,
      Transaction,
      SystemProgram,
      keeperKeypair,
      programPubkey,
      creatorCoinToMint,
      twinToSolanaPubkey,
    };

    // M2-11: re-attempt quarantined events first (mapping may have been fixed).
    const quarantine = listWinnerRelayQuarantine(state);
    for (const entry of quarantine) {
      result.quarantineRetried++;
      try {
        const recorded = await tryRecordWinnerOnSolana({
          ctx,
          winner: entry.winner,
          creatorCoin: entry.creatorCoin,
          sharesPaid: entry.sharesPaid,
          blockNumber: BigInt(entry.blockNumber),
          logIndex: entry.logIndex,
        });
        if (recorded.ok) {
          removeWinnerRelayQuarantineEntry(state, entry.id);
          result.winnersRecorded++;
          result.quarantineRecovered++;
          await alertInfo(WORKFLOW_NAME, 'Recovered quarantined winner on Solana', {
            id: entry.id,
            winner: recorded.winnerSolanaPubkey,
            creatorCoin: entry.creatorCoin,
            solanaMint: recorded.solanaMint,
            sharesPaid: entry.sharesPaid,
            winId: recorded.winId,
            sig: recorded.sig,
          });
          await saveSolanaWinnerRelayState(stateFile, state);
        } else {
          quarantineWinnerRelayEvent(state, {
            blockNumber: BigInt(entry.blockNumber),
            logIndex: entry.logIndex,
            winner: entry.winner,
            creatorCoin: entry.creatorCoin,
            sharesPaid: entry.sharesPaid,
            reason: recorded.reason,
          });
          await saveSolanaWinnerRelayState(stateFile, state);
        }
      } catch (txErr: unknown) {
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        await alertWarning(WORKFLOW_NAME, `quarantine record_winner tx failed: ${msg}`, {
          id: entry.id,
        });
        // Leave in quarantine; do not block new event processing.
      }
    }

    // Query for winner events (chunked to respect RPC max block range, e.g. Matrixed 100k).
    const logs = await getWinnerNotificationLogs({
      publicClient,
      lotteryManager,
      fromBlock: checkpointBlock,
      toBlock: currentBlock,
    });

    if (logs.length === 0) {
      setWinnerRelayCheckpoint(state, currentBlock, -1);
      await saveSolanaWinnerRelayState(stateFile, state);
      result.quarantineSize = listWinnerRelayQuarantine(state).length;
      if (result.quarantineSize > 0) {
        await alertWarning(WORKFLOW_NAME, 'Winner relay quarantine non-empty', {
          quarantineSize: result.quarantineSize,
          reasons: summarizeQuarantineReasons(listWinnerRelayQuarantine(state)),
        });
      }
      return result;
    }

    const orderedLogs = [...logs].sort((left, right) => {
      const a = parseLogPosition(left);
      const b = parseLogPosition(right);
      return compareWinnerRelayCheckpoint(a.blockNumber, a.logIndex, b.blockNumber, b.logIndex);
    });

    for (const log of orderedLogs) {
      const { blockNumber, logIndex } = parseLogPosition(log);
      if (compareWinnerRelayCheckpoint(blockNumber, logIndex, checkpointBlock, checkpointLogIndex) <= 0) {
        continue;
      }

      // Skip logs already in quarantine (will be retried above on subsequent runs).
      const eventId = winnerRelayEventId(blockNumber, logIndex);
      if (listWinnerRelayQuarantine(state).some((q) => q.id === eventId)) {
        setWinnerRelayCheckpoint(state, blockNumber, logIndex);
        await saveSolanaWinnerRelayState(stateFile, state);
        checkpointBlock = blockNumber;
        checkpointLogIndex = logIndex;
        continue;
      }

      result.eventsProcessed++;
      const args = log.args as Record<string, unknown> | undefined;
      const winner = String(args?.winner ?? '');
      const creatorCoin = String(args?.creatorCoin ?? '');
      const sharesPaid = args?.sharesPaid;

      let recorded;
      try {
        recorded = await tryRecordWinnerOnSolana({
          ctx,
          winner,
          creatorCoin,
          sharesPaid,
          blockNumber,
          logIndex,
        });
      } catch (txErr: unknown) {
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        await alertWarning(WORKFLOW_NAME, `record_winner tx failed: ${msg}`, {
          winner,
          creatorCoin,
        });
        throw txErr;
      }

      if (!recorded.ok) {
        if (recorded.reason === 'invalid_args') {
          await alertWarning(WORKFLOW_NAME, 'Invalid event args — winner or creatorCoin not valid addresses', {
            winner,
            creatorCoin,
          });
        } else if (recorded.reason === 'unmapped_creator_mint') {
          await alertWarning(WORKFLOW_NAME, `No Solana mint mapping for creatorCoin ${creatorCoin}`, {
            winner,
            creatorCoin,
          });
        } else {
          await alertWarning(WORKFLOW_NAME, `No Solana pubkey mapping for Twin ${winner}`, {
            creatorCoin,
          });
        }

        // M2-11: quarantine instead of permanent silent skip; still advance scan cursor.
        quarantineWinnerRelayEvent(state, {
          blockNumber,
          logIndex,
          winner,
          creatorCoin,
          sharesPaid: sharesPaid?.toString() ?? '0',
          reason: recorded.reason,
        });
        result.eventsQuarantined++;
        setWinnerRelayCheckpoint(state, blockNumber, logIndex);
        await saveSolanaWinnerRelayState(stateFile, state);
        checkpointBlock = blockNumber;
        checkpointLogIndex = logIndex;
        continue;
      }

      result.winnersRecorded++;
      await alertInfo(WORKFLOW_NAME, 'Recorded winner on Solana', {
        winner: recorded.winnerSolanaPubkey,
        creatorCoin,
        solanaMint: recorded.solanaMint,
        sharesPaid: sharesPaid?.toString(),
        winId: recorded.winId,
        sig: recorded.sig,
      });
      // Successful record: drop any prior quarantine for this event id.
      removeWinnerRelayQuarantineEntry(state, eventId);
      setWinnerRelayCheckpoint(state, blockNumber, logIndex);
      await saveSolanaWinnerRelayState(stateFile, state);
      checkpointBlock = blockNumber;
      checkpointLogIndex = logIndex;
    }

    result.quarantineSize = listWinnerRelayQuarantine(state).length;
    if (result.quarantineSize > 0) {
      await alertWarning(WORKFLOW_NAME, 'Winner relay quarantine non-empty', {
        quarantineSize: result.quarantineSize,
        eventsQuarantinedThisRun: result.eventsQuarantined,
        reasons: summarizeQuarantineReasons(listWinnerRelayQuarantine(state)),
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Winner relay failed', { error: message });
    throw err;
  }

  return result;
}

function summarizeQuarantineReasons(entries: WinnerRelayQuarantineEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of entries) {
    out[entry.reason] = (out[entry.reason] ?? 0) + 1;
  }
  return out;
}
