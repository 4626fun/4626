/**
 * Keepr Solana Entry Relay Action — Solana read + drain + Base write.
 *
 * Drains PendingEntries from the Solana Transfer Hook program and relays
 * them to Base via SolanaBridgeAdapter.processLotteryEntryFromSolana().
 *
 * Flow:
 *   1. Connect to Solana and read PendingEntries PDA for each creator mint
 *   2. If entries exist (count > 0), call drain_entries on Solana program
 *   3. Parse drained entries from the PDA state (pre-drain snapshot)
 *   4. Batch relay entries to Base adapter via keeper Twin
 *   5. Alert if overflow_count increased since last poll
 *
 * Anchor accounts for drain_entries:
 *   - keeper: Signer (SOLANA_KEEPER_KEYPAIR)
 *   - creator_config: PDA [b"creator_config", mint]
 *   - creator_mint: the Token-2022 mint pubkey
 *   - pending_entries: PDA [b"pending_entries", mint]
 */

import {
  requireEnv,
  CHAINS,
  SOLANA_BRIDGE_ADAPTER_ABI,
} from '../config.js';
import { writeContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair, solanaPubkeyToBytes32 } from '../utils/solana.js';

const WORKFLOW_NAME = 'keepr-solana-entry-relay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntryRelayResult {
  entriesDrained: number;
  entriesRelayed: number;
  overflowCount: number;
  emergencyDrain: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// PDA layout offsets for PendingEntries (Anchor account)
// 8 (discriminator) + 32 (creator_mint) + 4 (head) + 4 (count) + 8 (overflow_count) + 1 (bump)
const PDA_HEADER_SIZE = 8 + 32 + 4 + 4 + 8 + 1; // = 57
const ENTRY_SIZE = 48; // 32 (buyer) + 8 (amount) + 8 (slot)
const MAX_PENDING_ENTRIES = 256;
const EMERGENCY_DRAIN_THRESHOLD = Math.floor(MAX_PENDING_ENTRIES * 0.8);

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

export async function executeSolanaEntryRelay(): Promise<EntryRelayResult> {
  const result: EntryRelayResult = {
    entriesDrained: 0,
    entriesRelayed: 0,
    overflowCount: 0,
    emergencyDrain: false,
  };

  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
  const programId = CHAINS.solana.programId;
  const solanaBridgeAdapter = requireEnv('SOLANA_BRIDGE_ADAPTER') as `0x${string}`;
  const keeperPubkey = requireEnv('SOLANA_KEEPER_PUBKEY');

  try {
    const { Connection, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
    const { Program, AnchorProvider, Wallet } = require('@coral-xyz/anchor');

    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(programId);

    // Load the IDL from the on-chain program (or bundled JSON).
    // For production, the IDL should be bundled at build time.
    const provider = new AnchorProvider(
      connection,
      new Wallet(keeperKeypair),
      { commitment: 'confirmed' },
    );

    // Creator mints configured via env (comma-separated base58 pubkeys)
    const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
    // Mapping: Solana mint base58 → Base ShareOFT 0x address
    const shareOFTMapping = JSON.parse(process.env.SOLANA_SHARE_OFT_MAPPING ?? '{}');

    if (creatorMints.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No creator mints configured — skipping');
      return result;
    }

    const allEntries: Array<{
      buyerSolanaPubkey: `0x${string}`;
      shareOFT: `0x${string}`;
      amountSolanaUnits: bigint;
    }> = [];

    for (const mintStr of creatorMints) {
      const mint = new PublicKey(mintStr);
      const shareOFT = shareOFTMapping[mintStr] as `0x${string}` | undefined;

      if (!shareOFT) {
        await alertWarning(WORKFLOW_NAME, `No ShareOFT mapping for mint ${mintStr} — skipping`);
        continue;
      }

      // Derive PDAs
      const [creatorConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_config'), mint.toBuffer()],
        programPubkey,
      );
      const [pendingEntriesPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pending_entries'), mint.toBuffer()],
        programPubkey,
      );

      // Read PendingEntries PDA to check count
      const accountInfo = await connection.getAccountInfo(pendingEntriesPda);
      if (!accountInfo?.data) continue;

      const data = accountInfo.data as Buffer;
      // Layout: 8 (disc) + 32 (mint) = 40, then head(4), count(4), overflow(8), bump(1)
      const head = data.readUInt32LE(40);
      const count = data.readUInt32LE(44);
      const overflowCount = Number(data.readBigUInt64LE(48));

      if (overflowCount > 0) {
        result.overflowCount += overflowCount;
        await alertWarning(WORKFLOW_NAME, `Overflow detected for mint ${mintStr}`, { overflowCount });
      }

      if (count >= EMERGENCY_DRAIN_THRESHOLD) {
        result.emergencyDrain = true;
        await alertWarning(
          WORKFLOW_NAME,
          `Buffer near capacity for mint ${mintStr}`,
          { count },
        );
      }

      if (count === 0) continue;

      // Snapshot entries from the PDA BEFORE draining (drain resets head/count)
      const startIdx = (count as number) < MAX_PENDING_ENTRIES ? 0 : head;
      for (let i = 0; i < count; i++) {
        const idx = (startIdx + i) % MAX_PENDING_ENTRIES;
        const offset = PDA_HEADER_SIZE + idx * ENTRY_SIZE;
        if (offset + ENTRY_SIZE > data.length) break;

        const buyerBytes = data.subarray(offset, offset + 32);
        const amount = data.readBigUInt64LE(offset + 32);
        // slot at offset+40, not needed for relay

        // Skip zero entries (empty slots)
        if (buyerBytes.every((b: number) => b === 0)) continue;

        allEntries.push({
          buyerSolanaPubkey: ('0x' + Buffer.from(buyerBytes).toString('hex')) as `0x${string}`,
          shareOFT,
          amountSolanaUnits: amount,
        });
      }

      // Call drain_entries on the Solana program to clear the buffer
      await alertInfo(WORKFLOW_NAME, `Draining ${count} entries for mint ${mintStr}`);

      try {
        // Build drain_entries instruction via Anchor
        // Method discriminator for drain_entries = sha256("global:drain_entries")[0..8]
        const { BorshCoder } = require('@coral-xyz/anchor');
        const drainIx = {
          programId: programPubkey,
          keys: [
            { pubkey: keeperKeypair.publicKey, isSigner: true, isWritable: false },
            { pubkey: creatorConfigPda, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: pendingEntriesPda, isSigner: false, isWritable: true },
          ],
          data: Buffer.from(
            BorshCoder.prototype
              ? require('crypto').createHash('sha256').update('global:drain_entries').digest().subarray(0, 8)
              : Buffer.from([166, 171, 95, 163, 80, 33, 226, 64]), // precomputed discriminator
          ),
        };

        const tx = new Transaction().add(drainIx);
        const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], {
          commitment: 'confirmed',
        });

        await alertInfo(WORKFLOW_NAME, `Drained entries for ${mintStr}`, { sig });
      } catch (drainErr: unknown) {
        const msg = drainErr instanceof Error ? drainErr.message : String(drainErr);
        await alertWarning(WORKFLOW_NAME, `drain_entries failed for ${mintStr}: ${msg}`);
        // Continue — we still have the snapshot from PDA read
      }

      result.entriesDrained += count;
    }

    if (allEntries.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No entries to relay');
      return result;
    }

    // Relay entries to Base via SolanaBridgeAdapter.processLotteryEntryFromSolana()
    const keeperBytes32 = solanaPubkeyToBytes32(keeperPubkey);

    const txResult = await writeContract({
      address: solanaBridgeAdapter,
      abi: SOLANA_BRIDGE_ADAPTER_ABI,
      functionName: 'processLotteryEntryFromSolana',
      args: [keeperBytes32, allEntries],
    });

    if (txResult.success) {
      result.entriesRelayed = allEntries.length;
      await alertInfo(WORKFLOW_NAME, `Relayed ${allEntries.length} entries to Base`, {
        txHash: txResult.txHash,
      });
    } else {
      await alertCritical(WORKFLOW_NAME, 'Failed to relay entries to Base', {
        error: txResult.error,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Entry relay failed', { error: message });
    throw err;
  }

  return result;
}
