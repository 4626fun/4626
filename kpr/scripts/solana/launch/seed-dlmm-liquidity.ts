/**
 * Seed a single-bin Meteora DLMM position with an explicit feeOwner.
 *
 * Protocol jackpot capture requires feeOwner = the claim/keeper authority
 * (or a dedicated jackpot fee vault pubkey). Open third-party LPs keep their
 * own fee share.
 *
 * Usage:
 *   pnpm solana:seed-dlmm-liquidity
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer / operator keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   SOLANA_METEORA_POOL     - DLMM pool address
 *   SEED_AMOUNT             - Base token amount in raw units
 *   SEED_PRICE              - UI price for the single bin
 *
 * Required for mainnet (or when REQUIRE_FEE_OWNER=1):
 *   FEE_OWNER               - Jackpot / claim fee recipient pubkey
 *
 * Optional env:
 *   POSITION_OWNER          - Position owner pubkey (default: keeper)
 *   FEE_OWNER               - Fee claim recipient (devnet may default to keeper)
 *   LOCK_RELEASE_POINT      - Lock release timestamp/slot (default: 0 = unlocked)
 *   ROUNDING_UP             - "1" to round price up (default: off)
 *   ALLOW_DEFAULT_FEE_OWNER - "1" to allow FEE_OWNER defaulting to keeper on mainnet
 */

import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import { loadKeeperKeypair, sendConfirmedSolanaTransaction } from '../../../utils/solana.js';
import { requireEnv } from '../../../config.js';
import { loadBn, loadDlmmClass } from '../../../utils/dlmm.js';

const Dlmm = loadDlmmClass();
const BN = loadBn();

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const keeper = loadKeeperKeypair();
const poolAddress = new PublicKey(requireEnv('SOLANA_METEORA_POOL'));
const seedAmount = new BN(requireEnv('SEED_AMOUNT'));
const seedPrice = Number(requireEnv('SEED_PRICE'));
if (!Number.isFinite(seedPrice) || seedPrice <= 0) {
  throw new Error(`SEED_PRICE must be a positive number. Received: ${process.env.SEED_PRICE}`);
}

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

const positionOwner = new PublicKey(process.env.POSITION_OWNER?.trim() || keeper.publicKey.toBase58());
const feeOwnerRaw = String(process.env.FEE_OWNER ?? '').trim();
const isMainnet = !rpcUrl.includes('devnet') && !rpcUrl.includes('localhost') && !rpcUrl.includes('127.0.0.1');
const requireFeeOwner = isMainnet || envFlag('REQUIRE_FEE_OWNER');
if (!feeOwnerRaw) {
  if (requireFeeOwner && !envFlag('ALLOW_DEFAULT_FEE_OWNER')) {
    throw new Error(
      'FEE_OWNER is required for mainnet / REQUIRE_FEE_OWNER=1 (jackpot claim authority). Set ALLOW_DEFAULT_FEE_OWNER=1 only for intentional keeper-as-feeOwner tests.',
    );
  }
}
const feeOwner = new PublicKey(feeOwnerRaw || keeper.publicKey.toBase58());
const lockReleasePoint = new BN(process.env.LOCK_RELEASE_POINT ?? '0');
const roundingUp = envFlag('ROUNDING_UP');

function redactRpcUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return parsed.pathname === '/' && !parsed.search
      ? parsed.origin
      : `${parsed.origin}/<redacted>`;
  } catch {
    return '<redacted-rpc-url>';
  }
}

const cluster = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';
const dlmmPool = await Dlmm.create(connection, poolAddress, { cluster });
const base = Keypair.generate();

console.log('=== Seed Meteora DLMM Liquidity (single bin) ===');
console.log('RPC:           ', redactRpcUrl(rpcUrl));
console.log('Payer/Operator:', keeper.publicKey.toBase58());
console.log('Pool:          ', poolAddress.toBase58());
console.log('Position owner:', positionOwner.toBase58());
console.log('Fee owner:     ', feeOwner.toBase58());
console.log('Seed amount:   ', seedAmount.toString());
console.log('Seed price:    ', seedPrice);
console.log('Base (PDA):    ', base.publicKey.toBase58());
console.log();

const seeded = await dlmmPool.seedLiquiditySingleBin(
  keeper.publicKey,
  base.publicKey,
  seedAmount,
  seedPrice,
  roundingUp,
  positionOwner,
  feeOwner,
  keeper.publicKey,
  lockReleasePoint,
  false,
);

const instructions = Array.isArray(seeded?.instructions) ? seeded.instructions : [];
if (instructions.length === 0) {
  throw new Error('seed_liquidity_returned_no_instructions');
}

const tx = new Transaction().add(...instructions);
const sig = await sendConfirmedSolanaTransaction({
  connection,
  transaction: tx,
  signers: [keeper, base],
  commitment: 'confirmed',
});

console.log('Liquidity seeded.');
console.log('  Signature:', sig);
console.log('  Fee owner:', feeOwner.toBase58());
console.log();
console.log('Claim path: SOLANA_ORCHESTRATOR_CLAIM_DLMM_FEES_ENABLED=1');
console.log('  action=claim_dlmm_fees (not settle_fees)');
