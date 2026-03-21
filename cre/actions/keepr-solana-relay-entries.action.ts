/**
 * Keepr Solana Relay Entries Action — Solana read + relay + Base write.
 *
 * Relays PendingEntries from the Solana Transfer Hook program to Base via
 * SolanaBridgeAdapter.processLotteryEntryFromSolana().
 */

import {
  requireEnv,
  CHAINS,
  SOLANA_BRIDGE_ADAPTER_ABI,
} from '../config.js';
import { writeContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair, solanaPubkeyToBytes32 } from '../utils/solana.js';

const WORKFLOW_NAME = 'keepr-solana-relay-entries';

export interface EntryRelayResult {
  entriesQueued: number;
  entriesRelayed: number;
  overflowCount: number;
  emergencyRelay: boolean;
}

const PDA_HEADER_SIZE = 8 + 32 + 4 + 4 + 8 + 1;
const ENTRY_SIZE = 48;
const MAX_PENDING_ENTRIES = 256;
const EMERGENCY_RELAY_THRESHOLD = Math.floor(MAX_PENDING_ENTRIES * 0.8);

const RELAY_ENTRIES_DISCRIMINATOR = require('crypto')
  .createHash('sha256')
  .update('global:relay_entries')
  .digest()
  .subarray(0, 8);

export async function executeSolanaRelayEntries(): Promise<EntryRelayResult> {
  const result: EntryRelayResult = {
    entriesQueued: 0,
    entriesRelayed: 0,
    overflowCount: 0,
    emergencyRelay: false,
  };

  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
  const programId = CHAINS.solana.programId;
  const solanaBridgeAdapter = requireEnv('SOLANA_BRIDGE_ADAPTER') as `0x${string}`;
  const keeperPubkey = requireEnv('SOLANA_KEEPER_PUBKEY');

  try {
    const { Connection, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');

    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(programId);

    const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
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

      const [creatorConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_config'), mint.toBuffer()],
        programPubkey,
      );
      const [pendingEntriesPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('pending_entries'), mint.toBuffer()],
        programPubkey,
      );

      const accountInfo = await connection.getAccountInfo(pendingEntriesPda);
      if (!accountInfo?.data) continue;

      const data = accountInfo.data as Buffer;
      const head = data.readUInt32LE(40);
      const count = data.readUInt32LE(44);
      const overflowCount = Number(data.readBigUInt64LE(48));

      if (overflowCount > 0) {
        result.overflowCount += overflowCount;
        await alertWarning(WORKFLOW_NAME, `Overflow detected for mint ${mintStr}`, { overflowCount });
      }

      if (count >= EMERGENCY_RELAY_THRESHOLD) {
        result.emergencyRelay = true;
        await alertWarning(WORKFLOW_NAME, `Buffer near capacity for mint ${mintStr}`, { count });
      }

      if (count === 0) continue;

      const startIdx = (count as number) < MAX_PENDING_ENTRIES ? 0 : head;
      for (let i = 0; i < count; i++) {
        const idx = (startIdx + i) % MAX_PENDING_ENTRIES;
        const offset = PDA_HEADER_SIZE + idx * ENTRY_SIZE;
        if (offset + ENTRY_SIZE > data.length) break;

        const buyerBytes = data.subarray(offset, offset + 32);
        const amount = data.readBigUInt64LE(offset + 32);

        if (buyerBytes.every((b: number) => b === 0)) continue;

        allEntries.push({
          buyerSolanaPubkey: ('0x' + Buffer.from(buyerBytes).toString('hex')) as `0x${string}`,
          shareOFT,
          amountSolanaUnits: amount,
        });
      }

      await alertInfo(WORKFLOW_NAME, `Relaying ${count} pending entries for mint ${mintStr}`);

      try {
        const relayIx = {
          programId: programPubkey,
          keys: [
            { pubkey: keeperKeypair.publicKey, isSigner: true, isWritable: false },
            { pubkey: creatorConfigPda, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: false },
            { pubkey: pendingEntriesPda, isSigner: false, isWritable: true },
          ],
          data: Buffer.from(RELAY_ENTRIES_DISCRIMINATOR),
        };

        const tx = new Transaction().add(relayIx);
        const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], {
          commitment: 'confirmed',
        });

        await alertInfo(WORKFLOW_NAME, `Relayed pending entries for ${mintStr}`, { sig });
      } catch (relayErr: unknown) {
        const msg = relayErr instanceof Error ? relayErr.message : String(relayErr);
        await alertWarning(WORKFLOW_NAME, `relay_entries failed for ${mintStr}: ${msg}`);
      }

      result.entriesQueued += count;
    }

    if (allEntries.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No entries to relay');
      return result;
    }

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
