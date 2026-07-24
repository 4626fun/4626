/**
 * Keepr Solana DLMM fee forward — mirrors EVM `keepr-remote-fee-flush`.
 *
 * Flow (hub-orchestrated spoke push):
 *   1. claim_dlmm_fees → feeOwner WSOL ATA
 *   2. Best-path WSOL → ShareOFT (Jupiter default; DLMM fallback) + Jito/private submit
 *   3. LZ OFT send ■ to hubGaugeReceiver (helper-gated until in-repo SDK lands)
 *   4. Base gauge.receiveBridgedFees() after destination credit is observed
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
import { buyShareWithWsol } from '../utils/solanaJupiterSwap.js';
import { forwardSolanaShareOftToHub, hubGaugeToBytes32 } from '../utils/solanaOftForward.js';
import { resolveHubGaugeController } from '../utils/remoteFeeFlush.js';
import { isDryRun, readContract, writeContract } from '../utils/onchain.js';
import { GaugeReceiveBridgedFeesABI } from '../kpr-workflows/contracts/abi/ShareOftFeeFlush.js';

const WORKFLOW_NAME = 'keepr-solana-forward-dlmm-fees';
const Dlmm = loadDlmmClass();

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function readUnaccountedBridgedFees(hubGauge: Address): Promise<bigint> {
  const [shareOft, accounted] = await Promise.all([
    readContract<Address>({
      address: hubGauge,
      abi: GaugeReceiveBridgedFeesABI,
      functionName: 'shareOFT',
    }),
    readContract<bigint>({
      address: hubGauge,
      abi: GaugeReceiveBridgedFeesABI,
      functionName: 'accountedOFTBalance',
    }),
  ]);
  const balance = await readContract<bigint>({
    address: getAddress(shareOft),
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: [hubGauge],
  });
  return balance > accounted ? balance - accounted : 0n;
}

/**
 * Sweep Base gauge only after unaccounted ShareOFT credit is visible.
 * `waitForCredit=false` does a single check (independent sweep when no new Solana batch).
 */
async function maybeReceiveBridgedFeesOnHub(params?: {
  waitForCredit?: boolean;
}): Promise<{ called: boolean; txHash?: string; error?: string; unaccounted?: string }> {
  const hubGaugeRaw = resolveHubGaugeController();
  if (!hubGaugeRaw || !isAddress(hubGaugeRaw)) {
    return { called: false, error: 'hub_gauge_unset' };
  }
  const hubGauge = getAddress(hubGaugeRaw) as Address;
  const waitForCredit = params?.waitForCredit !== false;
  const timeoutMs = Number(process.env.SOLANA_DLMM_FORWARD_BASE_SWEEP_TIMEOUT_MS ?? '120000');
  const pollMs = Number(process.env.SOLANA_DLMM_FORWARD_BASE_SWEEP_POLL_MS ?? '5000');
  const deadline = Date.now() + Math.max(0, timeoutMs);

  try {
    while (true) {
      const unaccounted = await readUnaccountedBridgedFees(hubGauge);
      if (unaccounted > 0n) {
        const result = await writeContract({
          address: hubGauge,
          abi: GaugeReceiveBridgedFeesABI,
          functionName: 'receiveBridgedFees',
          args: [],
        });
        if (!result.success) {
          return {
            called: false,
            error: result.error ?? 'receiveBridgedFees_failed',
            unaccounted: unaccounted.toString(),
          };
        }
        return { called: true, txHash: result.txHash, unaccounted: unaccounted.toString() };
      }

      if (!waitForCredit || Date.now() >= deadline) {
        return {
          called: false,
          error: waitForCredit ? 'bridged_credit_timeout' : 'bridged_credit_not_ready',
          unaccounted: '0',
        };
      }
      await sleep(Math.max(250, pollMs));
    }
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
    if (isDryRun()) {
      result.skippedReason = 'dry_run';
      await alertInfo(WORKFLOW_NAME, 'Dry run — claim/swap/OFT/Base skipped (no on-chain mutations)');
      return result;
    }

    const rpcUrl = String(process.env.SOLANA_RPC_URL ?? '').trim();
    if (!rpcUrl) throw new Error('Missing required env var: SOLANA_RPC_URL');

    const poolRaw =
      process.env.SOLANA_METEORA_POOL?.trim() || process.env.SOLANA_DLMM_POOLS?.split(',')[0]?.trim();
    if (!poolRaw) throw new Error('missing_solana_meteora_pool');

    const minForwardQuote = BigInt(process.env.SOLANA_DLMM_FORWARD_MIN_QUOTE ?? '1000000'); // 0.001 WSOL
    const maxForwardQuote = BigInt(process.env.SOLANA_DLMM_FORWARD_MAX_QUOTE ?? '0'); // 0 = uncapped
    const slippageBps = Number(process.env.SOLANA_DLMM_FORWARD_SLIPPAGE_BPS ?? '100');
    const skipClaim = envFlag('SOLANA_DLMM_FORWARD_SKIP_CLAIM');
    const skipOft = envFlag('SOLANA_DLMM_FORWARD_SKIP_OFT');
    const skipBaseSweep = envFlag('SOLANA_DLMM_FORWARD_SKIP_BASE_SWEEP');

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
      await alertInfo(WORKFLOW_NAME, 'Skipping Solana forward — quote below threshold; attempting Base credit sweep', {
        balance: quoteBeforeSwap.toString(),
        min: minForwardQuote.toString(),
      });
      // Prior OFT deliveries can credit later; sweep independently of a new batch.
      if (!skipBaseSweep) {
        const sweep = await maybeReceiveBridgedFeesOnHub({ waitForCredit: false });
        result.receiveBridgedFeesCalled = sweep.called;
        result.receiveBridgedFeesTxHash = sweep.txHash;
        if (sweep.called) {
          await alertInfo(WORKFLOW_NAME, 'Base receiveBridgedFees completed (independent sweep)', {
            txHash: sweep.txHash,
            unaccounted: sweep.unaccounted,
          });
        }
      }
      return result;
    }

    // Swap must be signed by feeOwner. Fail closed unless feeOwner == keeper.
    if (!feeOwner.equals(keeper.publicKey)) {
      throw new Error(
        `dlmm_forward_requires_fee_owner_signer:keeper=${keeper.publicKey.toBase58()},feeOwner=${feeOwner.toBase58()}`,
      );
    }

    const swapInAmount =
      maxForwardQuote > 0n && quoteBeforeSwap > maxForwardQuote ? maxForwardQuote : quoteBeforeSwap;

    const dlmmPool = await Dlmm.create(connection, poolAddress, { cluster });
    const shareMint: PublicKey = dlmmPool.tokenX.publicKey ?? dlmmPool.lbPair.tokenXMint;
    const shareProgram = await resolveTokenProgram(connection, shareMint);
    const shareBefore = await readAtaAmount(connection, shareMint, feeOwner, shareProgram);

    const swap = await buyShareWithWsol({
      connection,
      poolAddress,
      shareMint,
      payer: keeper,
      inAmount: swapInAmount,
      slippageBps,
      cluster,
    });
    result.swapSignature = swap.signature;
    result.swappedInAmount = swap.inAmount;
    result.swappedOutQuoted = swap.outAmountQuoted;

    const shareAfter = await readAtaAmount(connection, shareMint, feeOwner, shareProgram);
    const shareDelta = shareAfter > shareBefore ? shareAfter - shareBefore : 0n;
    if (shareDelta <= 0n) {
      throw new Error('dlmm_forward_share_balance_zero_after_swap');
    }

    await alertInfo(WORKFLOW_NAME, 'WSOL→■ buyback complete', {
      swapSignature: swap.signature,
      mode: swap.mode,
      shareMint: shareMint.toBase58(),
      shareDelta: shareDelta.toString(),
      shareBalance: shareAfter.toString(),
    });

    if (skipOft) {
      result.skippedReason = 'skip_oft';
      await alertWarning(WORKFLOW_NAME, 'OFT forward skipped by SOLANA_DLMM_FORWARD_SKIP_OFT');
      return result;
    }

    // Forward only the buyback proceeds — do not drain pre-existing ■ on feeOwner.
    const oft = await forwardSolanaShareOftToHub({
      mint: shareMint,
      amountLd: shareDelta,
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

    const sweep = await maybeReceiveBridgedFeesOnHub({ waitForCredit: true });
    result.receiveBridgedFeesCalled = sweep.called;
    result.receiveBridgedFeesTxHash = sweep.txHash;
    if (!sweep.called) {
      await alertWarning(WORKFLOW_NAME, 'Base receiveBridgedFees not completed', {
        error: sweep.error,
        unaccounted: sweep.unaccounted,
      });
    } else {
      await alertInfo(WORKFLOW_NAME, 'Base receiveBridgedFees completed', {
        txHash: sweep.txHash,
        unaccounted: sweep.unaccounted,
      });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await alertCritical(WORKFLOW_NAME, 'Solana DLMM fee forward failed', { error: message });
    throw error;
  }
}
