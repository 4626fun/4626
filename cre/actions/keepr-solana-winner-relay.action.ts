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

import { requireEnv, CHAINS } from '../config.js';
import { getPublicClient } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-winner-relay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WinnerRelayResult {
  eventsProcessed: number;
  winnersRecorded: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadKeeperKeypair() {
  const { Keypair } = require('@solana/web3.js');
  const bs58 = require('bs58');
  const secretKeyStr = requireEnv('SOLANA_KEEPER_KEYPAIR');
  if (secretKeyStr.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
  }
  return Keypair.fromSecretKey(bs58.decode(secretKeyStr));
}

// Last processed block — persisted in memory between invocations.
// In production, use a persistent store (Redis, DB, or file).
let lastProcessedBlock = BigInt(0);

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

    // On first run, start from 100 blocks ago.
    if (lastProcessedBlock === BigInt(0)) {
      lastProcessedBlock = currentBlock - BigInt(100);
    }

    // Don't process if no new blocks.
    if (currentBlock <= lastProcessedBlock) {
      return result;
    }

    // Query for winner events.
    const logs = await publicClient.getLogs({
      address: lotteryManager,
      event: LOTTERY_WINNER_EVENT_ABI[0],
      fromBlock: lastProcessedBlock + BigInt(1),
      toBlock: currentBlock,
    });

    lastProcessedBlock = currentBlock;

    if (logs.length === 0) {
      return result;
    }

    result.eventsProcessed = logs.length;

    const {
      Connection,
      PublicKey,
      Transaction,
      sendAndConfirmTransaction,
    } = require('@solana/web3.js');
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(programId);

    // Mapping: Base creatorCoin address (lowercase) → Solana mint (base58)
    const creatorCoinToMint = JSON.parse(
      process.env.SOLANA_CREATOR_COIN_TO_MINT_MAPPING ?? '{}',
    );

    // Mapping: Base Twin address (lowercase) → Solana pubkey (base58)
    // The Keepr maintains this cache from the entry relay logs.
    const twinToSolanaPubkey = JSON.parse(
      process.env.SOLANA_TWIN_TO_PUBKEY_MAPPING ?? '{}',
    );

    for (const log of logs) {
      const { winner, creatorCoin, sharesPaid } = log.args as any;

      // Resolve Solana mint from Base creatorCoin address
      const solanaMint = creatorCoinToMint[creatorCoin.toLowerCase()];
      if (!solanaMint) {
        // Not a Solana creator — skip
        continue;
      }

      // Resolve the winner's Solana pubkey from their Twin address
      const winnerSolanaPubkey = twinToSolanaPubkey[winner.toLowerCase()];
      if (!winnerSolanaPubkey) {
        await alertWarning(WORKFLOW_NAME, `No Solana pubkey mapping for Twin ${winner}`, {
          creatorCoin,
          solanaMint,
        });
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
        const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], {
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
      } catch (txErr: unknown) {
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        await alertWarning(WORKFLOW_NAME, `record_winner tx failed: ${msg}`, {
          winner: winnerSolanaPubkey,
          solanaMint,
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Winner relay failed', { error: message });
    throw err;
  }

  return result;
}
