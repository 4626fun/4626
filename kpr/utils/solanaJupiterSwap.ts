/**
 * Jupiter best-path WSOL → ShareOFT buyback for Solana fee forward.
 * Falls back to canonical DLMM when SOLANA_FORWARD_SWAP_MODE=dlmm.
 */

import {
  Connection,
  PublicKey,
  VersionedTransaction,
  type Keypair,
} from '@solana/web3.js';
import { NATIVE_MINT } from '@solana/spl-token';
import { swapWsolToShareOnDlmm } from './solanaDlmmSwap.js';
import { sendSolanaTransactionPrivate } from './solanaPrivateSubmit.js';

export type ShareBuybackResult = {
  signature: string;
  inAmount: string;
  outAmountQuoted: string;
  minOutAmount: string;
  mode: 'jupiter' | 'dlmm';
};

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function swapMode(): 'jupiter' | 'dlmm' {
  const raw = String(process.env.SOLANA_FORWARD_SWAP_MODE ?? 'jupiter').trim().toLowerCase();
  return raw === 'dlmm' ? 'dlmm' : 'jupiter';
}

async function jupiterQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps: number;
}): Promise<{ outAmount: string; otherAmountThreshold: string; routePlan: unknown }> {
  const base = String(process.env.JUPITER_QUOTE_API_URL ?? 'https://quote-api.jup.ag/v6').replace(/\/$/, '');
  const url = new URL(`${base}/quote`);
  url.searchParams.set('inputMint', params.inputMint);
  url.searchParams.set('outputMint', params.outputMint);
  url.searchParams.set('amount', params.amount.toString());
  url.searchParams.set('slippageBps', String(params.slippageBps));
  url.searchParams.set('onlyDirectRoutes', 'false');

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`jupiter_quote_failed:status=${res.status}`);
  }
  const body = (await res.json()) as {
    outAmount?: string;
    otherAmountThreshold?: string;
    routePlan?: unknown;
  };
  if (!body.outAmount || !body.otherAmountThreshold) {
    throw new Error('jupiter_quote_invalid');
  }
  return {
    outAmount: body.outAmount,
    otherAmountThreshold: body.otherAmountThreshold,
    routePlan: body.routePlan,
  };
}

async function jupiterSwapTx(params: {
  quoteResponse: unknown;
  userPublicKey: string;
}): Promise<string> {
  const base = String(process.env.JUPITER_QUOTE_API_URL ?? 'https://quote-api.jup.ag/v6').replace(/\/$/, '');
  const res = await fetch(`${base}/swap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: params.quoteResponse,
      userPublicKey: params.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`jupiter_swap_failed:status=${res.status}`);
  }
  const body = (await res.json()) as { swapTransaction?: string };
  if (!body.swapTransaction) {
    throw new Error('jupiter_swap_missing_tx');
  }
  return body.swapTransaction;
}

/**
 * Buy ShareOFT with WSOL using Jupiter (default) or DLMM fallback.
 */
export async function buyShareWithWsol(params: {
  connection: Connection;
  poolAddress: PublicKey;
  shareMint: PublicKey;
  payer: Keypair;
  inAmount: bigint;
  slippageBps?: number;
  cluster?: 'devnet' | 'mainnet-beta';
}): Promise<ShareBuybackResult> {
  if (params.inAmount <= 0n) {
    throw new Error('share_buyback_in_amount_zero');
  }

  const slippageBps = params.slippageBps ?? Number(process.env.SOLANA_DLMM_FORWARD_SLIPPAGE_BPS ?? '100');
  const mode = swapMode();

  if (mode === 'dlmm') {
    const dlmm = await swapWsolToShareOnDlmm({
      connection: params.connection,
      poolAddress: params.poolAddress,
      payer: params.payer,
      inAmount: params.inAmount,
      slippageBps,
      cluster: params.cluster,
    });
    return {
      signature: dlmm.signature,
      inAmount: dlmm.inAmount,
      outAmountQuoted: dlmm.outAmountQuoted,
      minOutAmount: dlmm.minOutAmount,
      mode: 'dlmm',
    };
  }

  const quote = await jupiterQuote({
    inputMint: NATIVE_MINT.toBase58(),
    outputMint: params.shareMint.toBase58(),
    amount: params.inAmount,
    slippageBps,
  });

  // Re-fetch full quote object for /swap (API expects the quote response).
  const base = String(process.env.JUPITER_QUOTE_API_URL ?? 'https://quote-api.jup.ag/v6').replace(/\/$/, '');
  const quoteUrl = new URL(`${base}/quote`);
  quoteUrl.searchParams.set('inputMint', NATIVE_MINT.toBase58());
  quoteUrl.searchParams.set('outputMint', params.shareMint.toBase58());
  quoteUrl.searchParams.set('amount', params.inAmount.toString());
  quoteUrl.searchParams.set('slippageBps', String(slippageBps));
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) throw new Error(`jupiter_quote_refetch_failed:status=${quoteRes.status}`);
  const quoteResponse = await quoteRes.json();

  const swapTxB64 = await jupiterSwapTx({
    quoteResponse,
    userPublicKey: params.payer.publicKey.toBase58(),
  });

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTxB64, 'base64'));
  tx.sign([params.payer]);

  const signature = await sendSolanaTransactionPrivate({
    connection: params.connection,
    signedTransaction: tx,
    requirePrivate: envFlag('SOLANA_FORWARD_REQUIRE_PRIVATE_SUBMIT'),
  });

  return {
    signature,
    inAmount: params.inAmount.toString(),
    outAmountQuoted: quote.outAmount,
    minOutAmount: quote.otherAmountThreshold,
    mode: 'jupiter',
  };
}
