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

import { readFile } from 'node:fs/promises';

import { requireEnv, CHAINS } from '../config.js';
import { getPublicClient } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair, sendConfirmedSolanaTransaction } from '../utils/solana.js';
import {
  compareWinnerRelayCheckpoint,
  getWinnerRelayCheckpoint,
  loadSolanaWinnerRelayState,
  saveSolanaWinnerRelayState,
  setWinnerRelayCheckpoint,
} from '../utils/solana-winner-relay-state.js';

const WORKFLOW_NAME = 'keepr-solana-winner-relay';
const INITIAL_LOOKBACK_BLOCKS = 100n;

export interface WinnerRelayResult {
  eventsProcessed: number;
  winnersRecorded: number;
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

async function loadJsonLookupMap(params: {
  inlineEnvKey: string;
  fileEnvKey: string;
}): Promise<Record<string, string>> {
  const filePath = String(process.env[params.fileEnvKey] ?? '').trim();
  if (filePath) {
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

export async function executeSolanaWinnerRelay(): Promise<WinnerRelayResult> {
  const result: WinnerRelayResult = {
    eventsProcessed: 0,
    winnersRecorded: 0,
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

    // Query for winner events.
    const logs = await publicClient.getLogs({
      address: lotteryManager,
      event: LOTTERY_WINNER_EVENT_ABI[0],
      fromBlock: checkpointBlock,
      toBlock: currentBlock,
    });

    if (logs.length === 0) {
      setWinnerRelayCheckpoint(state, currentBlock, -1);
      await saveSolanaWinnerRelayState(stateFile, state);
      return result;
    }

    const orderedLogs = [...logs].sort((left, right) => {
      const a = parseLogPosition(left);
      const b = parseLogPosition(right);
      return compareWinnerRelayCheckpoint(a.blockNumber, a.logIndex, b.blockNumber, b.logIndex);
    });

    const {
      Connection,
      PublicKey,
      Transaction,
    } = require('@solana/web3.js');
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(programId);

    // Mapping: Base creatorCoin address (lowercase) → Solana mint (base58)
    const creatorCoinToMint = await loadJsonLookupMap({
      inlineEnvKey: 'SOLANA_CREATOR_COIN_TO_MINT_MAPPING',
      fileEnvKey: 'SOLANA_CREATOR_COIN_TO_MINT_MAPPING_FILE',
    });

    // Mapping: Base Twin address (lowercase) → Solana pubkey (base58)
    const twinToSolanaPubkey = await loadJsonLookupMap({
      inlineEnvKey: 'SOLANA_TWIN_TO_PUBKEY_MAPPING',
      fileEnvKey: 'SOLANA_TWIN_TO_PUBKEY_MAPPING_FILE',
    });

    for (const log of orderedLogs) {
      const { blockNumber, logIndex } = parseLogPosition(log);
      if (compareWinnerRelayCheckpoint(blockNumber, logIndex, checkpointBlock, checkpointLogIndex) <= 0) {
        continue;
      }

      result.eventsProcessed++;
      const { winner, creatorCoin, sharesPaid } = log.args as any;

      // Resolve Solana mint from Base creatorCoin address
      const solanaMint = creatorCoinToMint[creatorCoin.toLowerCase()];
      if (!solanaMint) {
        setWinnerRelayCheckpoint(state, blockNumber, logIndex);
        await saveSolanaWinnerRelayState(stateFile, state);
        checkpointBlock = blockNumber;
        checkpointLogIndex = logIndex;
        continue;
      }

      // Resolve the winner's Solana pubkey from their Twin address
      const winnerSolanaPubkey = twinToSolanaPubkey[winner.toLowerCase()];
      if (!winnerSolanaPubkey) {
        await alertWarning(WORKFLOW_NAME, `No Solana pubkey mapping for Twin ${winner}`, {
          creatorCoin,
          solanaMint,
        });
        setWinnerRelayCheckpoint(state, blockNumber, logIndex);
        await saveSolanaWinnerRelayState(stateFile, state);
        checkpointBlock = blockNumber;
        checkpointLogIndex = logIndex;
        continue;
      }

      const mint = new PublicKey(solanaMint);
      const winnerPubkey = new PublicKey(winnerSolanaPubkey);

      // Derive PDAs
      const [creatorConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_config'), mint.toBuffer()],
        programPubkey,
      );
      const [winnerRecordPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('winner_record'), mint.toBuffer()],
        programPubkey,
      );

      // Build record_winner instruction
      // Discriminator: sha256("global:record_winner")[0..8]
      const crypto = require('crypto');
      const discriminator = crypto
        .createHash('sha256')
        .update('global:record_winner')
        .digest()
        .subarray(0, 8);

      // Encode args: winner (Pubkey = 32 bytes) + shares_paid (u64 = 8 bytes LE)
      const argsBuffer = Buffer.alloc(40);
      winnerPubkey.toBuffer().copy(argsBuffer, 0);

      const maxU64 = (1n << 64n) - 1n;
      let sharesPaidU64 = BigInt(sharesPaid?.toString() ?? '0');
      if (sharesPaidU64 > maxU64) {
        await alertWarning(WORKFLOW_NAME, 'sharesPaid exceeds u64, truncating for Solana record', {
          creatorCoin,
          solanaMint,
          sharesPaid: sharesPaid?.toString(),
        });
        sharesPaidU64 = maxU64;
      }
      argsBuffer.writeBigUInt64LE(sharesPaidU64, 32);

      const instructionData = Buffer.concat([discriminator, argsBuffer]);

      const recordWinnerIx = {
        programId: programPubkey,
        keys: [
          { pubkey: keeperKeypair.publicKey, isSigner: true, isWritable: false },
          { pubkey: creatorConfigPda, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: winnerRecordPda, isSigner: false, isWritable: true },
        ],
        data: instructionData,
      };

      try {
        const tx = new Transaction().add(recordWinnerIx);
        const sig = await sendConfirmedSolanaTransaction({
          connection,
          transaction: tx,
          signers: [keeperKeypair],
          commitment: 'confirmed',
        });

        result.winnersRecorded++;
        await alertInfo(WORKFLOW_NAME, 'Recorded winner on Solana', {
          winner: winnerSolanaPubkey,
          creatorCoin,
          solanaMint,
          sharesPaid: sharesPaid?.toString(),
          sig,
        });
        setWinnerRelayCheckpoint(state, blockNumber, logIndex);
        await saveSolanaWinnerRelayState(stateFile, state);
        checkpointBlock = blockNumber;
        checkpointLogIndex = logIndex;
      } catch (txErr: unknown) {
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        await alertWarning(WORKFLOW_NAME, `record_winner tx failed: ${msg}`, {
          winner: winnerSolanaPubkey,
          solanaMint,
        });
        throw txErr;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Winner relay failed', { error: message });
    throw err;
  }

  return result;
}
