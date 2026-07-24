/**
 * Keepr Solana DLMM fee forward — mirrors EVM `keepr-remote-fee-flush`.
 *
 * Flow (hub-orchestrated spoke push):
 *   1. claim_dlmm_fees → feeOwner WSOL ATA
 *   2. DLMM swap WSOL → ShareOFT mint (same canonical pool)
 *   3. LZ OFT send ■ to hubGaugeReceiver (helper-gated until in-repo SDK lands)
 *   4. Base gauge.receiveBridgedFees() (same as remote EVM flush)
 *
 * All steps are opt-in via SOLANA_ORCHESTRATOR_FORWARD_DLMM_FEES_ENABLED=1.
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getAddress, isAddress, type Address } from 'viem';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';
import { loadKeeperKeypair } from '../utils/solana.js';
import { loadDlmmClass } from '../utils/dlmm.js';
import { executeSolanaDlmmFeeClaim } from './keepr-solana-claim-dlmm-fees.action.js';
import { swapWsolToShareOnDlmm } from '../utils/solanaDlmmSwap.js';
import { forwardSolanaShareOftToHub, hubGaugeToBytes32 } from '../utils/solanaOftForward.js';
import { resolveHubGaugeController } from '../utils/remoteFeeFlush.js';
import { isDryRun, writeContract } from '../utils/onchain.js';
import { GaugeReceiveBridgedFeesABI } from '../kpr-workflows/contracts/abi/ShareOftFeeFlush.js';

const WORKFLOW_NAME = 'keepr-solana-forward-dlmm-fees';
const Dlmm = loadDlmmClass();

export interface SolanaDlmmFeeForwardResult {
  claimedQuoteAmount: string;
  swappedInAmount: string;
  swappedOutQuoted: string;
  swapSignature?: string;
  oftSignature?: string;
  oftAmountLd?: string;
  receiveBridgedFeesCalled: boolean;
  receiveBridgedFeesTxHash?: string;
  skippedReason?: string;
}

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

async function readAtaAmount(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  programId: PublicKey,
): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, programId);
  try {
    const account = await getAccount(connection, ata, 'confirmed', programId);
    return BigInt(account.amount.toString());
  } catch {
    return 0n;
  }
}

async function resolveTokenProgram(connection: Connection, mint: PublicKey): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint, 'confirmed');
  if (!info) throw new Error(`missing_mint_account:${mint.toBase58()}`);
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

async function maybeReceiveBridgedFeesOnHub(): Promise<{ called: boolean; txHash?: string; error?: string }> {
  const hubGaugeRaw = resolveHubGaugeController();
  if (!hubGaugeRaw || !isAddress(hubGaugeRaw)) {
    return { called: false, error: 'hub_gauge_unset' };
  }
  const hubGauge = getAddress(hubGaugeRaw) as Address;
  try {
    const result = await writeContract({
      address: hubGauge,
      abi: GaugeReceiveBridgedFeesABI,
      functionName: 'receiveBridgedFees',
      args: [],
    });
    if (!result.success) {
      return { called: false, error: result.error ?? 'receiveBridgedFees_failed' };
    }
    return { called: true, txHash: result.txHash };
  } catch (error: unknown) {
    return {
      called: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function executeSolanaDlmmFeeForward(): Promise<SolanaDlmmFeeForwardResult> {
  const result: SolanaDlmmFeeForwardResult = {
    claimedQuoteAmount: '0',
    swappedInAmount: '0',
    swappedOutQuoted: '0',
    receiveBridgedFeesCalled: false,
  };

  try {
    const rpcUrl = String(process.env.SOLANA_RPC_URL ?? '').trim();
    if (!rpcUrl) throw new Error('Missing required env var: SOLANA_RPC_URL');

    const poolRaw =
      process.env.SOLANA_METEORA_POOL?.trim() || process.env.SOLANA_DLMM_POOLS?.split(',')[0]?.trim();
    if (!poolRaw) throw new Error('missing_solana_meteora_pool');

    const minForwardQuote = BigInt(process.env.SOLANA_DLMM_FORWARD_MIN_QUOTE ?? '1000000'); // 0.001 WSOL
    const slippageBps = Number(process.env.SOLANA_DLMM_FORWARD_SLIPPAGE_BPS ?? '100');
    const skipClaim = envFlag('SOLANA_DLMM_FORWARD_SKIP_CLAIM');
    const skipOft = envFlag('SOLANA_DLMM_FORWARD_SKIP_OFT');
    const skipBaseSweep = envFlag('SOLANA_DLMM_FORWARD_SKIP_BASE_SWEEP');
    const baseSweepDelayMs = Number(process.env.SOLANA_DLMM_FORWARD_BASE_SWEEP_DELAY_MS ?? '15000');

    const hubGauge = resolveHubGaugeController();
    const oftToBytes32 =
      (process.env.SOLANA_OFT_FORWARD_TO_BYTES32?.trim() as `0x${string}` | undefined) ||
      (hubGauge && isAddress(hubGauge) ? hubGaugeToBytes32(hubGauge) : undefined);

    if (!skipClaim) {
      const claim = await executeSolanaDlmmFeeClaim();
      result.claimedQuoteAmount = claim.quoteHarvestedAmount;
      await alertInfo(WORKFLOW_NAME, 'DLMM fee claim step complete', {
        quoteHarvestedAmount: claim.quoteHarvestedAmount,
        positionsClaimed: claim.positionsClaimed,
      });
    }

    const connection = new Connection(rpcUrl, 'confirmed');
    const keeper = loadKeeperKeypair();
    const feeOwner = new PublicKey(
      process.env.SOLANA_DLMM_FEE_OWNER?.trim() || keeper.publicKey.toBase58(),
    );
    const poolAddress = new PublicKey(poolRaw);
    const cluster = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';

    const wsolProgram = TOKEN_PROGRAM_ID;
    const quoteBeforeSwap = await readAtaAmount(connection, NATIVE_MINT, feeOwner, wsolProgram);
    if (quoteBeforeSwap < minForwardQuote) {
      result.skippedReason = `below_forward_threshold:balance=${quoteBeforeSwap},min=${minForwardQuote}`;
      await alertInfo(WORKFLOW_NAME, 'Skipping forward — quote balance below threshold', {
        balance: quoteBeforeSwap.toString(),
        min: minForwardQuote.toString(),
      });
      return result;
    }

    // Swap must be signed by feeOwner. Fail closed unless feeOwner == keeper.
    if (!feeOwner.equals(keeper.publicKey)) {
      throw new Error(
        `dlmm_forward_requires_fee_owner_signer:keeper=${keeper.publicKey.toBase58()},feeOwner=${feeOwner.toBase58()}`,
      );
    }

    if (isDryRun()) {
      result.skippedReason = 'dry_run';
      await alertInfo(WORKFLOW_NAME, 'Dry run — claim observed, swap/OFT/Base skipped');
      return result;
    }

    const swap = await swapWsolToShareOnDlmm({
      connection,
      poolAddress,
      payer: keeper,
      inAmount: quoteBeforeSwap,
      slippageBps,
      cluster,
    });
    result.swapSignature = swap.signature;
    result.swappedInAmount = swap.inAmount;
    result.swappedOutQuoted = swap.outAmountQuoted;

    const dlmmPool = await Dlmm.create(connection, poolAddress, { cluster });
    const shareMint: PublicKey = dlmmPool.tokenX.publicKey ?? dlmmPool.lbPair.tokenXMint;
    const shareProgram = await resolveTokenProgram(connection, shareMint);
    const shareBalance = await readAtaAmount(connection, shareMint, feeOwner, shareProgram);
    if (shareBalance <= 0n) {
      throw new Error('dlmm_forward_share_balance_zero_after_swap');
    }

    await alertInfo(WORKFLOW_NAME, 'DLMM WSOL→■ swap complete', {
      swapSignature: swap.signature,
      shareMint: shareMint.toBase58(),
      shareBalance: shareBalance.toString(),
    });

    if (skipOft) {
      result.skippedReason = 'skip_oft';
      await alertWarning(WORKFLOW_NAME, 'OFT forward skipped by SOLANA_DLMM_FORWARD_SKIP_OFT');
      return result;
    }

    const oft = await forwardSolanaShareOftToHub({
      mint: shareMint,
      amountLd: shareBalance,
      toBytes32: oftToBytes32,
    });
    result.oftSignature = oft.signature;
    result.oftAmountLd = oft.amountLd;

    await alertInfo(WORKFLOW_NAME, 'Solana→Base ShareOFT forward submitted', {
      oftSignature: oft.signature,
      amountLd: oft.amountLd,
      mode: oft.mode,
    });

    if (skipBaseSweep) {
      result.skippedReason = 'skip_base_sweep';
      return result;
    }

    if (baseSweepDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, baseSweepDelayMs));
    }

    const sweep = await maybeReceiveBridgedFeesOnHub();
    result.receiveBridgedFeesCalled = sweep.called;
    result.receiveBridgedFeesTxHash = sweep.txHash;
    if (!sweep.called) {
      await alertWarning(WORKFLOW_NAME, 'Base receiveBridgedFees not completed', {
        error: sweep.error,
      });
    } else {
      await alertInfo(WORKFLOW_NAME, 'Base receiveBridgedFees completed', {
        txHash: sweep.txHash,
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await alertCritical(WORKFLOW_NAME, 'Solana DLMM fee forward failed', { error: message });
    throw error;
  }
}
