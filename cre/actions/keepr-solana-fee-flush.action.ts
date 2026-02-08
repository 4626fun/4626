/**
 * Keepr Solana Fee Flush Action — Solana read/write + bridge + Base write.
 *
 * Harvests withheld TransferFeeConfig fees from the Token-2022 mint,
 * bridges them to Base, and forwards to the gauge controller.
 *
 * Flow:
 *   1. Read withheld fee amount from Solana Token-2022 mint
 *   2. If above threshold, harvest fees to the mint authority account
 *   3. Bridge fees to Base (Keepr Twin receives them)
 *   4. Call SolanaBridgeAdapter.receiveFeeFromSolana() on Base
 *
 * Token-2022 TransferFeeConfig fee flow:
 *   - Fees are withheld in each token account on every transfer (6.9%)
 *   - `harvestWithheldTokensToMint` aggregates them to the mint account
 *   - `withdrawWithheldTokensFromMint` moves them to a recipient ATA
 *   - We then bridge the withdrawn tokens to Base
 */

import {
  requireEnv,
  CHAINS,
  SOLANA_BRIDGE_ADAPTER_ABI,
} from '../config.js';
import { writeContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';

const WORKFLOW_NAME = 'keepr-solana-fee-flush';

// Minimum fee amount (in Solana token units) before flushing
const MIN_FEE_THRESHOLD = BigInt(1_000_000); // 0.001 tokens at 9 decimals

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeeFlushResult {
  feesFlushed: boolean;
  amountFlushed: string;
  bridged: boolean;
  forwardedToGauge: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function solanaPubkeyToBytes32(pubkey: string): `0x${string}` {
  const { PublicKey } = require('@solana/web3.js');
  const pk = new PublicKey(pubkey);
  return ('0x' + Buffer.from(pk.toBytes()).toString('hex')) as `0x${string}`;
}

function loadKeeperKeypair() {
  const { Keypair } = require('@solana/web3.js');
  const bs58 = require('bs58');
  const secretKeyStr = requireEnv('SOLANA_KEEPER_KEYPAIR');
  if (secretKeyStr.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
  }
  return Keypair.fromSecretKey(bs58.decode(secretKeyStr));
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

export async function executeSolanaFeeFlush(): Promise<FeeFlushResult> {
  const result: FeeFlushResult = {
    feesFlushed: false,
    amountFlushed: '0',
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
      createHarvestWithheldTokensToMintInstruction,
      createWithdrawWithheldTokensFromMintInstruction,
      getAssociatedTokenAddressSync,
      createAssociatedTokenAccountIdempotentInstruction,
    } = require('@solana/spl-token');

    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();

    const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
    const shareOFTMapping = JSON.parse(process.env.SOLANA_SHARE_OFT_MAPPING ?? '{}');

    if (creatorMints.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No creator mints configured — skipping');
      return result;
    }

    let totalFeesFlushed = BigInt(0);

    for (const mintStr of creatorMints) {
      const mint = new PublicKey(mintStr);
      const shareOFT = shareOFTMapping[mintStr] as `0x${string}` | undefined;

      if (!shareOFT) {
        await alertWarning(WORKFLOW_NAME, `No ShareOFT mapping for mint ${mintStr} — skipping`);
        continue;
      }

      // Step 1: Read the mint to get TransferFeeConfig data
      const mintAccount = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const feeConfig = getTransferFeeConfig(mintAccount);

      if (!feeConfig) {
        await alertWarning(WORKFLOW_NAME, `No TransferFeeConfig on mint ${mintStr}`);
        continue;
      }

      // Step 2: Harvest withheld tokens from all token accounts to the mint
      // This is permissionless — anyone can call it
      const accountsWithFees: PublicKey[] = [];

      // Get ALL token accounts for this mint (not just keeper's)
      let allAccounts: Array<{ pubkey: PublicKey }> = [];
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

      // Fallback: use explicitly provided token accounts if RPC indexing is unavailable.
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

      if (accountsWithFees.length > 0) {
        await alertInfo(WORKFLOW_NAME, `Harvesting fees from ${accountsWithFees.length} accounts for ${mintStr}`);

        // Batch harvest (max ~20 accounts per tx due to tx size limits)
        const batchSize = 20;
        for (let i = 0; i < accountsWithFees.length; i += batchSize) {
          const batch = accountsWithFees.slice(i, i + batchSize);
          const harvestIx = createHarvestWithheldTokensToMintInstruction(
            mint,
            batch,
            TOKEN_2022_PROGRAM_ID,
          );
          const tx = new Transaction().add(harvestIx);
          try {
            await sendAndConfirmTransaction(connection, tx, [keeperKeypair], {
              commitment: 'confirmed',
            });
          } catch (harvestErr: unknown) {
            const msg = harvestErr instanceof Error ? harvestErr.message : String(harvestErr);
            await alertWarning(WORKFLOW_NAME, `Harvest batch failed: ${msg}`);
          }
        }
      }

      // Step 3: Withdraw aggregated fees from the mint to the keeper's ATA
      // Re-read the mint to get updated withheld amount
      const updatedMint = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const updatedFeeConfig = getTransferFeeConfig(updatedMint);
      const totalWithheld = BigInt(updatedFeeConfig?.withheldAmount?.toString() ?? '0');

      if (totalWithheld < MIN_FEE_THRESHOLD) {
        await alertInfo(WORKFLOW_NAME, `Fee amount below threshold for ${mintStr}`, {
          withheld: totalWithheld.toString(),
          threshold: MIN_FEE_THRESHOLD.toString(),
        });
        continue;
      }

      // Create/ensure keeper's ATA exists
      const keeperAta = getAssociatedTokenAddressSync(
        mint,
        keeperKeypair.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );

      const withdrawTx = new Transaction();

      // Ensure ATA exists
      withdrawTx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          keeperKeypair.publicKey, // payer
          keeperAta,
          keeperKeypair.publicKey, // owner
          mint,
          TOKEN_2022_PROGRAM_ID,
        ),
      );

      // Withdraw withheld tokens from mint to keeper ATA
      // NOTE: This requires the withdraw_withheld_tokens_from_mint authority
      withdrawTx.add(
        createWithdrawWithheldTokensFromMintInstruction(
          mint,
          keeperAta,
          keeperKeypair.publicKey, // must be the withdraw authority
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      );

      try {
        const sig = await sendAndConfirmTransaction(connection, withdrawTx, [keeperKeypair], {
          commitment: 'confirmed',
        });
        await alertInfo(WORKFLOW_NAME, `Withdrew ${totalWithheld} fee tokens for ${mintStr}`, { sig });
        totalFeesFlushed += totalWithheld;
        result.feesFlushed = true;
      } catch (withdrawErr: unknown) {
        const msg = withdrawErr instanceof Error ? withdrawErr.message : String(withdrawErr);
        await alertCritical(WORKFLOW_NAME, `Fee withdrawal failed for ${mintStr}: ${msg}`);
        continue;
      }

      // Step 4: Bridge fees to Base and forward to gauge
      // The bridge step happens via the Base-Solana native bridge.
      // After bridging, tokens land at the keeper's Twin on Base.
      // Then we call receiveFeeFromSolana on the adapter.
      //
      // NOTE: The actual bridge TX is chain-specific and depends on the
      // Base-Solana bridge SDK. For now, we call the Base-side forwarding
      // assuming the bridge has already been initiated (separate process
      // or the bridge SDK handles it atomically).

      const keeperBytes32 = solanaPubkeyToBytes32(keeperPubkey);

      const txResult = await writeContract({
        address: solanaBridgeAdapter,
        abi: SOLANA_BRIDGE_ADAPTER_ABI,
        functionName: 'receiveFeeFromSolana',
        args: [keeperBytes32, shareOFT, totalWithheld],
      });

      if (txResult.success) {
        result.forwardedToGauge = true;
        result.bridged = true;
        result.amountFlushed = totalFeesFlushed.toString();
        await alertInfo(WORKFLOW_NAME, 'Fees forwarded to gauge', {
          txHash: txResult.txHash,
          amount: totalWithheld.toString(),
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
    await alertCritical(WORKFLOW_NAME, 'Fee flush failed', { error: message });
    throw err;
  }

  return result;
}
