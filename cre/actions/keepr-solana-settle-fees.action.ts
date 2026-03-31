/**
 * Keepr Solana Fee Settlement Action — Solana read/write + bridge + Base write.
 *
 * Harvests withheld TransferFeeConfig fees from the Token-2022 mint,
 * bridges them to Base, and forwards to the gauge controller.
 *
 * Flow:
 *   1. Read withheld fee amount from Solana Token-2022 mint
 *   2. If above threshold, harvest fees to the mint authority account
 *   3. Bridge fees to Base (Keepr Twin receives them)
 *   4. Call SolanaBridgeAdapter.receiveFeeFromSolana() on Base
 */

import {
  requireEnv,
  CHAINS,
  SOLANA_BRIDGE_ADAPTER_ABI,
} from '../config.js';
import { writeContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair, solanaPubkeyToBytes32 } from '../utils/solana.js';

const WORKFLOW_NAME = 'keepr-solana-settle-fees';

// Minimum fee amount (in Solana token units) before settlement.
const MIN_FEE_THRESHOLD = BigInt(1_000_000); // 0.001 tokens at 9 decimals

const SETTLE_FEES_DISCRIMINATOR = require('crypto')
  .createHash('sha256')
  .update('global:settle_fees')
  .digest()
  .subarray(0, 8);

export interface FeeSettlementResult {
  feesSettled: boolean;
  amountSettled: string;
  bridged: boolean;
  forwardedToGauge: boolean;
}

export async function executeSolanaFeeSettlement(): Promise<FeeSettlementResult> {
  const result: FeeSettlementResult = {
    feesSettled: false,
    amountSettled: '0',
    bridged: false,
    forwardedToGauge: false,
  };

  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
  const solanaBridgeAdapter = requireEnv('SOLANA_BRIDGE_ADAPTER') as `0x${string}`;
  const keeperPubkey = requireEnv('SOLANA_KEEPER_PUBKEY');

  try {
    const { Connection, PublicKey, Transaction, sendAndConfirmTransaction } = require('@solana/web3.js');
    const {
      TOKEN_2022_PROGRAM_ID,
      getTransferFeeConfig,
      getMint,
      getAccount,
      getAssociatedTokenAddressSync,
      createAssociatedTokenAccountIdempotentInstruction,
    } = require('@solana/spl-token');

    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(CHAINS.solana.programId);
    const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
    const shareOFTMapping = JSON.parse(process.env.SOLANA_SHARE_OFT_MAPPING ?? '{}');

    if (creatorMints.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No creator mints configured — skipping');
      return result;
    }

    let totalFeesSettled = BigInt(0);

    for (const mintStr of creatorMints) {
      const mint = new PublicKey(mintStr);
      const shareOFT = shareOFTMapping[mintStr] as `0x${string}` | undefined;

      if (!shareOFT) {
        await alertWarning(WORKFLOW_NAME, `No ShareOFT mapping for mint ${mintStr} — skipping`);
        continue;
      }

      const mintAccount = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const feeConfig = getTransferFeeConfig(mintAccount);

      if (!feeConfig) {
        await alertWarning(WORKFLOW_NAME, `No TransferFeeConfig on mint ${mintStr}`);
        continue;
      }

      const accountsWithFees: Array<InstanceType<typeof PublicKey>> = [];

      let allAccounts: Array<{ pubkey: InstanceType<typeof PublicKey> }> = [];
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
        const manualAccounts = process.env.SOLANA_FEE_ACCOUNTS
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);

        allAccounts = manualAccounts.map((a) => ({ pubkey: new PublicKey(a) }));

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
          await alertInfo(WORKFLOW_NAME, `settle_fees executed for ${mintStr}`, { sig });
        } catch (settleErr: unknown) {
          const msg = settleErr instanceof Error ? settleErr.message : String(settleErr);
          await alertWarning(WORKFLOW_NAME, `settle_fees failed for ${mintStr}: ${msg}`);
        }
      }

      const feeVaultAccount = await getAccount(connection, keeperAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const feeVaultAmount = BigInt(feeVaultAccount.amount.toString());

      if (feeVaultAmount < MIN_FEE_THRESHOLD) {
        await alertInfo(WORKFLOW_NAME, `Fee amount below threshold for ${mintStr}`, {
          withheld: feeVaultAmount.toString(),
          threshold: MIN_FEE_THRESHOLD.toString(),
        });
        continue;
      }

      totalFeesSettled += feeVaultAmount;
      result.feesSettled = true;

      const keeperBytes32 = solanaPubkeyToBytes32(keeperPubkey);

      const txResult = await writeContract({
        address: solanaBridgeAdapter,
        abi: SOLANA_BRIDGE_ADAPTER_ABI,
        functionName: 'receiveFeeFromSolana',
        args: [keeperBytes32, shareOFT, feeVaultAmount],
      });

      if (txResult.success) {
        result.forwardedToGauge = true;
        result.bridged = true;
        result.amountSettled = totalFeesSettled.toString();
        await alertInfo(WORKFLOW_NAME, 'Fees forwarded to gauge', {
          txHash: txResult.txHash,
          amount: feeVaultAmount.toString(),
          mint: mintStr,
        });
      } else {
        await alertCritical(WORKFLOW_NAME, 'Failed to forward fees to gauge', {
          error: txResult.error,
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Fee settlement failed', { error: message });
    throw err;
  }

  return result;
}
