/**
 * Keepr Solana Relay Entries Action — Solana read + relay + Base write.
 *
 * Relays PendingEntries from the Solana Transfer Hook program to Base via
 * SolanaBridgeAdapter.processLotteryEntryFromSolana().
 */

import * as crypto from 'node:crypto';
import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  requireEnv,
  CHAINS,
  SOLANA_BRIDGE_ADAPTER_ABI,
  parseDotenvJsonObject,
} from '../config.js';
import { writeContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair, solanaPubkeyToBytes32 } from '../utils/solana.js';
import { collectKeeperBaseWritePreflight, formatKeeperPreflightSummary } from '../utils/solanaKeeperPreflight.js';
import { relayEntriesInstructionDiscriminator } from '../utils/hookInstructionDiscriminators.js';
import { parsePendingEntriesBuffer } from '../utils/pendingEntriesBuffer.js';
import { isAddress } from 'viem';

const WORKFLOW_NAME = 'keepr-solana-relay-entries';

export interface EntryRelayResult {
  entriesQueued: number;
  entriesRelayed: number;
  overflowCount: number;
  emergencyRelay: boolean;
}

const RELAY_ENTRIES_DISCRIMINATOR = relayEntriesInstructionDiscriminator();

function deriveSolanaEntryDedupeId(params: {
  creatorMint: string;
  buyerBytes: Buffer;
  amount: bigint;
  slot: bigint;
}): `0x${string}` {
  const digest = crypto
    .createHash('sha256')
    .update('4626:solana-pending-entry:')
    .update(params.creatorMint)
    .update(params.buyerBytes)
    .update(Buffer.from(params.amount.toString()))
    .update(Buffer.from(params.slot.toString()))
    .digest();
  return (`0x${digest.toString('hex')}`) as `0x${string}`;
}

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
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(programId);

    const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
    // FIX: HGH-02 — Validate each address in shareOFTMapping before use
    const rawShareOFTMapping = parseDotenvJsonObject('SOLANA_SHARE_OFT_MAPPING');
    const shareOFTMapping: Record<string, `0x${string}`> = {};
    for (const [key, value] of Object.entries(rawShareOFTMapping)) {
      if (typeof value === 'string' && isAddress(value)) {
        shareOFTMapping[key] = value as `0x${string}`;
      } else {
        await alertWarning(WORKFLOW_NAME, `Invalid shareOFT address in SOLANA_SHARE_OFT_MAPPING for key ${key} — skipping`);
      }
    }

    if (creatorMints.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No creator mints configured — skipping');
      return result;
    }

    const allEntries: Array<{
      buyerSolanaPubkey: `0x${string}`;
      shareOFT: `0x${string}`;
      amountSolanaUnits: bigint;
      solanaTxSig: `0x${string}`;
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

      const parsed = parsePendingEntriesBuffer(accountInfo.data as Buffer);
      if (!parsed || parsed.count === 0) continue;

      if (parsed.overflowCount > 0) {
        result.overflowCount += parsed.overflowCount;
        await alertWarning(WORKFLOW_NAME, `Overflow detected for mint ${mintStr}`, {
          overflowCount: parsed.overflowCount,
        });
      }

      if (parsed.emergencyRelay) {
        result.emergencyRelay = true;
        await alertWarning(WORKFLOW_NAME, `Buffer near capacity for mint ${mintStr}`, {
          count: parsed.count,
        });
      }

      for (const entry of parsed.entries) {
        const buyerBytes = Buffer.from(entry.buyerSolanaPubkey.slice(2), 'hex');
        allEntries.push({
          buyerSolanaPubkey: entry.buyerSolanaPubkey,
          shareOFT,
          amountSolanaUnits: entry.amountSolanaUnits,
          solanaTxSig: deriveSolanaEntryDedupeId({
            creatorMint: mintStr,
            buyerBytes,
            amount: entry.amountSolanaUnits,
            slot: entry.slot,
          }),
        });
      }

      await alertInfo(WORKFLOW_NAME, `Relaying ${parsed.count} pending entries for mint ${mintStr}`);

      // Collect entries first; clear Solana buffer only after Base write confirms.
      result.entriesQueued += parsed.count;
    }

    if (allEntries.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No entries to relay');
      return result;
    }

    const preflight = await collectKeeperBaseWritePreflight();
    for (const warning of preflight.warnings) {
      await alertWarning(WORKFLOW_NAME, warning);
    }
    if (preflight.blockers.length > 0) {
      await alertWarning(WORKFLOW_NAME, 'Skipping Base relay — keeper preflight not ready', {
        blockers: preflight.blockers,
        summary: formatKeeperPreflightSummary(preflight),
        pendingEntries: allEntries.length,
      });
      return result;
    }

    const keeperBytes32 = solanaPubkeyToBytes32(keeperPubkey);

    // Submit Base write first; clear Solana PDA only after Base confirms.
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

      // Clear Solana PDA buffers only after Base write succeeded.
      for (const mintStr of creatorMints) {
        const mint = new PublicKey(mintStr);
        const [creatorConfigPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('creator_config'), mint.toBuffer()],
          programPubkey,
        );
        const [pendingEntriesPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('pending_entries'), mint.toBuffer()],
          programPubkey,
        );

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

          await alertInfo(WORKFLOW_NAME, `Flushed Solana PDA buffer for ${mintStr}`, { sig });
        } catch (relayErr: unknown) {
          const msg = relayErr instanceof Error ? relayErr.message : String(relayErr);
          await alertWarning(WORKFLOW_NAME, `relay_entries clear failed for ${mintStr}: ${msg}`);
        }
      }
    } else {
      // Base write failed; do not clear Solana buffers so entries are preserved for retry.
      await alertCritical(WORKFLOW_NAME, 'Failed to relay entries to Base — Solana buffers preserved for retry', {
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
