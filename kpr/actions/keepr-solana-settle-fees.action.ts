/**
 * Keepr Solana Fee Harvest Action — Solana harvest only.
 *
 * Harvests withheld TransferFeeConfig fees from the Token-2022 mint,
 * and leaves them in the keeper's Token-2022 ATA.
 *
 * Flow:
 *   1. Read withheld fee amount from Solana Token-2022 mint
 *   2. Harvest fees to the keeper ATA and evaluate the aggregate threshold
 *
 * There is intentionally no Base-forward or cross-chain claim path here.
 * Those writes require authenticated bridge evidence that this workflow does
 * not possess.
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getTransferFeeConfig,
  getMint,
  getAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import {
  requireEnv,
  CHAINS,
} from '../config.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair } from '../utils/solana.js';

const WORKFLOW_NAME = 'keepr-solana-settle-fees';

// Minimum aggregate harvested amount (in Solana token units) for harvest telemetry.
const MIN_FEE_THRESHOLD = BigInt(1_000_000); // 0.001 tokens at 9 decimals

import { settleFeesInstructionDiscriminator } from '../utils/hookInstructionDiscriminators.js';

const SETTLE_FEES_DISCRIMINATOR = settleFeesInstructionDiscriminator();

export interface FeeHarvestResult {
  harvestThresholdMet: boolean;
  /** Aggregate Solana ATA delta harvested this run. */
  solanaHarvestedAmount: string;
  /** Retained for response compatibility; harvest-only does not use Base mappings. */
  mappingIntegrityFailures: number;
}

export async function executeSolanaFeeSettlement(): Promise<FeeHarvestResult> {
  const result: FeeHarvestResult = {
    harvestThresholdMet: false,
    solanaHarvestedAmount: '0',
    mappingIntegrityFailures: 0,
  };

  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');

  try {
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(CHAINS.solana.programId);
    const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
    if (creatorMints.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No creator mints configured — skipping');
      return result;
    }

    let totalSolanaHarvested = BigInt(0);

    for (const mintStr of creatorMints) {
      const mint = new PublicKey(mintStr);

      const mintAccount = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const feeConfig = getTransferFeeConfig(mintAccount);

      if (!feeConfig) {
        await alertWarning(WORKFLOW_NAME, `No TransferFeeConfig on mint ${mintStr}`);
        continue;
      }

      const accountsWithFees: Array<InstanceType<typeof PublicKey>> = [];

      let allAccounts: ReadonlyArray<{ pubkey: InstanceType<typeof PublicKey> }> = [];
      try {
        allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
          filters: [
            { memcmp: { offset: 0, bytes: mintStr } },
          ],
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await alertWarning(WORKFLOW_NAME, 'Token-2022 account scan unavailable on RPC', {
          error: msg,
          mint: mintStr,
        });
      }

      if (allAccounts.length === 0 && process.env.SOLANA_FEE_ACCOUNTS) {
        // FIX: MED-08 — Validate SOLANA_FEE_ACCOUNTS as valid Solana public keys before use
        const manualAccounts = process.env.SOLANA_FEE_ACCOUNTS
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);

        const validatedAccounts: Array<{ pubkey: InstanceType<typeof PublicKey> }> = [];
        for (const a of manualAccounts) {
          try {
            const pk = new PublicKey(a);
            if (!PublicKey.isOnCurve(pk.toBytes())) {
              await alertWarning(WORKFLOW_NAME, `SOLANA_FEE_ACCOUNTS entry not on curve: ${a}`);
            }
            validatedAccounts.push({ pubkey: pk });
          } catch {
            await alertWarning(WORKFLOW_NAME, `Invalid pubkey in SOLANA_FEE_ACCOUNTS: ${a} — skipping`);
          }
        }
        allAccounts = validatedAccounts;

        await alertInfo(WORKFLOW_NAME, 'Using manually provided fee accounts', {
          count: allAccounts.length,
          mint: mintStr,
        });
      }

      if (allAccounts.length === 0) {
        await alertWarning(WORKFLOW_NAME, 'No token accounts available for fee harvesting', {
          mint: mintStr,
        });
        continue;
      }

      for (const acct of allAccounts) {
        accountsWithFees.push(acct.pubkey);
      }

      const [creatorConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_config'), mint.toBuffer()],
        programPubkey,
      );

      const keeperAta = getAssociatedTokenAddressSync(
        mint,
        keeperKeypair.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );
      const ensureAtaTx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          keeperKeypair.publicKey,
          keeperAta,
          keeperKeypair.publicKey,
          mint,
          TOKEN_2022_PROGRAM_ID,
        ),
      );

      try {
        await sendAndConfirmTransaction(connection, ensureAtaTx, [keeperKeypair], {
          commitment: 'confirmed',
        });
      } catch (ataErr: unknown) {
        const msg = ataErr instanceof Error ? ataErr.message : String(ataErr);
        await alertWarning(WORKFLOW_NAME, `Failed to ensure ATA for ${mintStr}: ${msg}`);
      }

      // FIX: CRT-02 — Record ATA balance before harvesting to compute delta
      let balanceBefore = BigInt(0);
      try {
        const beforeAccount = await getAccount(connection, keeperAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
        balanceBefore = BigInt(beforeAccount.amount.toString());
      } catch {
        // ATA may not exist yet; balance is 0
      }

      const batchSize = 20;
      const batches = accountsWithFees.length > 0
        ? Array.from({ length: Math.ceil(accountsWithFees.length / batchSize) }, (_, i) =>
            accountsWithFees.slice(i * batchSize, i * batchSize + batchSize),
          )
        : [[]];

      for (const batch of batches) {
        const settleIx = {
          programId: programPubkey,
          keys: [
            { pubkey: keeperKeypair.publicKey, isSigner: true, isWritable: false },
            { pubkey: creatorConfigPda, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: keeperAta, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
            ...batch.map((acct) => ({ pubkey: acct, isSigner: false, isWritable: true })),
          ],
          data: SETTLE_FEES_DISCRIMINATOR,
        };

        try {
          const tx = new Transaction().add(settleIx);
          const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], {
            commitment: 'confirmed',
          });
          await alertInfo(WORKFLOW_NAME, `fee harvest executed for ${mintStr}`, { sig });
        } catch (settleErr: unknown) {
          const msg = settleErr instanceof Error ? settleErr.message : String(settleErr);
          await alertWarning(WORKFLOW_NAME, `fee harvest failed for ${mintStr}: ${msg}`);
        }
      }

      const feeVaultAccount = await getAccount(connection, keeperAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const feeVaultBalanceAfter = BigInt(feeVaultAccount.amount.toString());
      // FIX: CRT-02 — Use only the harvested delta, not the entire ATA balance
      const feeVaultAmount = feeVaultBalanceAfter - balanceBefore;

      if (feeVaultAmount > 0n) {
        totalSolanaHarvested += feeVaultAmount;
        result.solanaHarvestedAmount = totalSolanaHarvested.toString();
      }
    }
    // Preserve the aggregate threshold: multiple small mint harvests count
    // together; harvested tokens remain in the keeper Token-2022 ATA.
    result.harvestThresholdMet = totalSolanaHarvested >= MIN_FEE_THRESHOLD;
    await alertInfo(WORKFLOW_NAME, 'Solana fee harvest completed', {
      solanaHarvestedAmount: result.solanaHarvestedAmount,
      aggregateThreshold: MIN_FEE_THRESHOLD.toString(),
      aggregateThresholdMet: result.harvestThresholdMet,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Fee harvest failed', { error: message });
    throw err;
  }

  return result;
}
