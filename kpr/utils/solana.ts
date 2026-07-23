import {
  Keypair,
  PublicKey,
  type Commitment,
  type Connection,
  type Transaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Load the keeper Keypair from env.
 *
 * Supported env vars:
 * - SOLANA_KEEPER_KEYPAIRS (comma-separated base58 or JSON array secret keys)
 * - SOLANA_KEEPER_KEYPAIR (single base58 or JSON array secret key)
 * - SOLANA_KEEPER_KEYPAIR_INDEX (optional index into the list, default 0)
 */
export function loadKeeperKeypair(): Keypair {
  const raw =
    process.env.SOLANA_KEEPER_KEYPAIRS ??
    process.env.SOLANA_KEEPER_KEYPAIR ??
    '';

  const entries = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error('Missing required env var: SOLANA_KEEPER_KEYPAIR(S)');
  }

  const index = Number(process.env.SOLANA_KEEPER_KEYPAIR_INDEX ?? '0');
  const safeIndex = Number.isFinite(index) && index >= 0 ? index : 0;
  // FIX: INF-06 — Throw an error if index is out of bounds instead of silently clamping
  if (safeIndex >= entries.length) {
    throw new Error(
      `SOLANA_KEEPER_KEYPAIR_INDEX=${safeIndex} exceeds available keypairs count (${entries.length})`
    );
  }
  const selected = entries[safeIndex];

  return parseKeypair(selected);
}

// FIX: HGH-01 — Wrap parseKeypair in try-catch to prevent key material leaking in error messages
export function parseKeypair(secretKeyStr: string): Keypair {
  try {
    if (secretKeyStr.startsWith('[')) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
    }
    return Keypair.fromSecretKey(bs58.decode(secretKeyStr));
  } catch {
    throw new Error('Failed to parse Solana keypair: invalid key format (key material redacted)');
  }
}

export function loadKeypairsFromEnv(envVar: string): Keypair[] {
  const raw = process.env[envVar] ?? '';
  const entries = raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return entries.map(parseKeypair);
}

/**
 * Convert a base58 Solana pubkey to a 0x-prefixed bytes32 hex string.
 */
export function solanaPubkeyToBytes32(pubkey: string): `0x${string}` {
  const pk = new PublicKey(pubkey);
  return ('0x' + Buffer.from(pk.toBytes()).toString('hex')) as `0x${string}`;
}

export async function sendConfirmedSolanaTransaction(params: {
  connection: Connection;
  transaction: Transaction;
  signers: Keypair[];
  commitment?: Commitment;
}): Promise<string> {
  const payer = params.signers[0];
  if (!payer) throw new Error('solana_transaction_payer_missing');
  const latestBlockhash = await params.connection.getLatestBlockhash(params.commitment ?? 'confirmed');
  params.transaction.feePayer = payer.publicKey;
  params.transaction.recentBlockhash = latestBlockhash.blockhash;
  params.transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
  params.transaction.sign(...params.signers);
  const signature = await params.connection.sendRawTransaction(params.transaction.serialize(), {
    preflightCommitment: params.commitment ?? 'confirmed',
  });
  const deadline = Date.now() + 90_000;
  for (;;) {
    const status = (await params.connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) {
      throw new Error(`solana_transaction_failed:${signature}:${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === 'finalized') return signature;
    if (Date.now() >= deadline) {
      throw new Error(`solana_transaction_confirmation_timeout:${signature}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
}
