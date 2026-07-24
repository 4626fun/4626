/**
 * Swap helper for Solana DLMM fee repatriation (WSOL → ShareOFT mint).
 */

import {
  Connection,
  PublicKey,
  sendAndConfirmTransaction,
  type Keypair,
  type Transaction,
} from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import { loadBn, loadDlmmClass } from './dlmm.js';

const Dlmm = loadDlmmClass();
const BN = loadBn();

export type DlmmSwapResult = {
  signature: string;
  inAmount: string;
  minOutAmount: string;
  outAmountQuoted: string;
};

/**
 * Swap `inAmount` of Token Y (WSOL) into Token X (share) on the canonical DLMM pool.
 * `swapForY=false` means X←Y (buy share with quote).
 */
export async function swapWsolToShareOnDlmm(params: {
  connection: Connection;
  poolAddress: PublicKey;
  payer: Keypair;
  inAmount: bigint;
  slippageBps?: number;
  cluster?: 'devnet' | 'mainnet-beta';
}): Promise<DlmmSwapResult> {
  if (params.inAmount <= 0n) {
    throw new Error('dlmm_swap_in_amount_zero');
  }

  const cluster = params.cluster ?? 'mainnet-beta';
  const slippageBps = params.slippageBps ?? 100;
  const dlmmPool = await Dlmm.create(params.connection, params.poolAddress, { cluster });

  const tokenX: PublicKey = dlmmPool.tokenX.publicKey ?? dlmmPool.lbPair.tokenXMint;
  const tokenY: PublicKey = dlmmPool.tokenY.publicKey ?? dlmmPool.lbPair.tokenYMint;
  if (!tokenY.equals(NATIVE_MINT) && !tokenY.equals(new PublicKey(NATIVE_MINT.toBase58()))) {
    // Allow non-WSOL quote only when explicitly opted in.
    const allow = ['1', 'true', 'yes', 'on'].includes(
      String(process.env.SOLANA_DLMM_ALLOW_NON_WSOL_QUOTE ?? '').trim().toLowerCase(),
    );
    if (!allow) {
      throw new Error(`dlmm_quote_not_wsol:token_y=${tokenY.toBase58()}`);
    }
  }

  const inAmountBn = new BN(params.inAmount.toString());
  // Buying Token X with Token Y ⇒ swapForY = false
  const swapForY = false;
  const binArrays =
    typeof dlmmPool.getBinArrayForSwap === 'function'
      ? await dlmmPool.getBinArrayForSwap(swapForY)
      : [];
  const quote = dlmmPool.swapQuote(inAmountBn, swapForY, new BN(slippageBps), binArrays);
  const minOutAmount = quote.minOutAmount ?? quote.outAmount;
  if (!minOutAmount || minOutAmount.isZero?.() || Number(minOutAmount.toString()) <= 0) {
    throw new Error('dlmm_swap_quote_empty');
  }

  const swapTx: Transaction = await dlmmPool.swap({
    inToken: tokenY,
    outToken: tokenX,
    inAmount: inAmountBn,
    minOutAmount,
    lbPair: params.poolAddress,
    user: params.payer.publicKey,
    binArraysPubkey: quote.binArraysPubkey ?? [],
  });

  const signature = await sendAndConfirmTransaction(params.connection, swapTx, [params.payer], {
    commitment: 'confirmed',
  });

  return {
    signature,
    inAmount: params.inAmount.toString(),
    minOutAmount: minOutAmount.toString(),
    outAmountQuoted: (quote.outAmount ?? minOutAmount).toString(),
  };
}
