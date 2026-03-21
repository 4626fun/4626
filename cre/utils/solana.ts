import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
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
  const selected = entries[Math.min(safeIndex, entries.length - 1)];

  return parseKeypair(selected);
}

export function parseKeypair(secretKeyStr: string): Keypair {
  if (secretKeyStr.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKeyStr)));
  }
  return Keypair.fromSecretKey(bs58.decode(secretKeyStr));
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
  return sendAndConfirmTransaction(params.connection, params.transaction, params.signers, {
    commitment: params.commitment ?? 'confirmed',
  });
}
