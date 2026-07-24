/**
 * Solana tx submission with optional Jito / private path for fee buyback MEV hardening.
 */

import {
  Connection,
  type VersionedTransaction,
} from '@solana/web3.js';

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

async function sendViaJito(signedTx: VersionedTransaction): Promise<string> {
  const endpoint = String(
    process.env.JITO_BLOCK_ENGINE_URL ?? 'https://mainnet.block-engine.jito.wtf/api/v1/transactions',
  ).trim();
  const encoded = Buffer.from(signedTx.serialize()).toString('base64');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendTransaction',
      params: [encoded, { encoding: 'base64' }],
    }),
  });
  if (!res.ok) {
    throw new Error(`jito_submit_failed:status=${res.status}`);
  }
  const body = (await res.json()) as { result?: string; error?: { message?: string } };
  if (body.error?.message) {
    throw new Error(`jito_submit_error:${body.error.message}`);
  }
  if (!body.result) {
    throw new Error('jito_submit_missing_signature');
  }
  return body.result;
}

/**
 * Submit a signed versioned transaction.
 * When JITO_SUBMIT_ENABLED=1, uses Jito block engine; otherwise public RPC.
 * When requirePrivate=true and Jito is not enabled, fail closed.
 */
export async function sendSolanaTransactionPrivate(params: {
  connection: Connection;
  signedTransaction: VersionedTransaction;
  requirePrivate?: boolean;
}): Promise<string> {
  const jitoEnabled = envFlag('JITO_SUBMIT_ENABLED');
  const requirePrivate = params.requirePrivate === true || envFlag('SOLANA_FORWARD_REQUIRE_PRIVATE_SUBMIT');

  if (requirePrivate && !jitoEnabled) {
    throw new Error(
      'solana_private_submit_required: set JITO_SUBMIT_ENABLED=1 (or unset SOLANA_FORWARD_REQUIRE_PRIVATE_SUBMIT for non-prod)',
    );
  }

  if (jitoEnabled) {
    return sendViaJito(params.signedTransaction);
  }

  const sig = await params.connection.sendTransaction(params.signedTransaction, {
    skipPreflight: false,
    maxRetries: 3,
  });
  const latest = await params.connection.getLatestBlockhash('confirmed');
  await params.connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    'confirmed',
  );
  return sig;
}
