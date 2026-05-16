/**
 * Keepr Solana Graduation Sync Action — Base read + Solana write.
 *
 * Watches Base CCA for graduation event and triggers Alpha Vault close
 * on Solana. Includes a hard UTC deadline backstop.
 *
 * Flow:
 *   1. Check if Base CCA auction has graduated (isGraduated)
 *   2. If graduated, trigger Alpha Vault close on Solana via Meteora SDK
 *   3. If not graduated but past hard deadline, trigger close anyway
 *
 * Alpha Vault lifecycle:
 *   - During launch: vault accepts SOL deposits (pro-rata mode)
 *   - On graduation: vault closes, depositors can claim tokens at vesting rate
 *   - The Keepr cranks the close instruction when Base signals graduation
 */

import { requireEnv, CHAINS, CCA_AUCTION_ABI, CCA_STRATEGY_ABI } from '../config.js';
import { readContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair } from '../utils/solana.js';

const WORKFLOW_NAME = 'keepr-solana-graduation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraduationResult {
  baseCCAGraduated: boolean;
  alphaVaultClosed: boolean;
  deadlineTriggered: boolean;
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

export async function executeSolanaGraduation(): Promise<GraduationResult> {
  const result: GraduationResult = {
    baseCCAGraduated: false,
    alphaVaultClosed: false,
    deadlineTriggered: false,
  };

  const ccaStrategy = process.env.CCA_STRATEGY as `0x${string}` | undefined;
  const alphaVaultAddress = process.env.ALPHA_VAULT_ADDRESS;
  const graduationDeadline = process.env.GRADUATION_DEADLINE_UTC;

  // Only active during launch window — if no CCA or vault configured, skip.
  if (!ccaStrategy || !alphaVaultAddress) {
    return result;
  }

  try {
    // Step 1: Check CCA graduation status on Base.
    const auctionAddress = await readContract<`0x${string}`>({
      address: ccaStrategy,
      abi: CCA_STRATEGY_ABI,
      functionName: 'currentAuction',
    });

    if (!auctionAddress || auctionAddress === '0x0000000000000000000000000000000000000000') {
      await alertInfo(WORKFLOW_NAME, 'No active CCA auction — skipping');
      return result;
    }

    const isGraduated = await readContract<boolean>({
      address: auctionAddress,
      abi: CCA_AUCTION_ABI,
      functionName: 'isGraduated',
    });

    result.baseCCAGraduated = isGraduated;

    // Step 2: Check hard deadline.
    const now = Date.now();
    const deadline = graduationDeadline ? new Date(graduationDeadline).getTime() : Infinity;
    const pastDeadline = now >= deadline;

    if (!isGraduated && !pastDeadline) {
      await alertInfo(WORKFLOW_NAME, 'CCA not yet graduated — waiting', {
        auction: auctionAddress,
      });
      return result;
    }

    if (pastDeadline && !isGraduated) {
      result.deadlineTriggered = true;
      await alertWarning(WORKFLOW_NAME, 'Hard deadline triggered — closing Alpha Vault', {
        deadline: graduationDeadline,
      });
    }

    // Step 3: Close the Alpha Vault on Solana via Meteora SDK.
    const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
    const { Connection, PublicKey } = require('@solana/web3.js');
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();

    await alertInfo(WORKFLOW_NAME, 'Triggering Alpha Vault close on Solana', {
      vault: alphaVaultAddress,
      reason: isGraduated ? 'CCA graduated' : 'Hard deadline',
    });

    try {
      const { AlphaVault } = require('@meteora-ag/alpha-vault');

      const alphaVault = await AlphaVault.create(
        connection,
        new PublicKey(alphaVaultAddress),
      );

      // fillVault completes the vault lifecycle — distributes tokens to depositors
      // based on their pro-rata share. After this, the vault is "closed" and
      // the DLMM pool transitions to open trading.
      const fillTx = await alphaVault.fillVault(keeperKeypair.publicKey);

      if (fillTx) {
        const sig = await connection.sendTransaction(fillTx, [keeperKeypair], {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
        });
        await connection.confirmTransaction(sig, 'confirmed');

        await alertInfo(WORKFLOW_NAME, 'Alpha Vault filled/closed successfully', {
          vault: alphaVaultAddress,
          sig,
        });
      } else {
        await alertInfo(WORKFLOW_NAME, 'Alpha Vault already filled or no fill needed', {
          vault: alphaVaultAddress,
        });
      }

      result.alphaVaultClosed = true;
    } catch (meteoraErr: unknown) {
      const msg = meteoraErr instanceof Error ? meteoraErr.message : String(meteoraErr);

      // If the vault is already closed, treat as success
      if (msg.includes('already') || msg.includes('filled') || msg.includes('closed')) {
        result.alphaVaultClosed = true;
        await alertInfo(WORKFLOW_NAME, 'Alpha Vault was already closed', {
          vault: alphaVaultAddress,
        });
      } else {
        await alertCritical(WORKFLOW_NAME, `Alpha Vault close failed: ${msg}`, {
          vault: alphaVaultAddress,
        });
        // Don't throw — the graduation check itself was successful
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Graduation sync failed', { error: message });
    throw err;
  }

  return result;
}
