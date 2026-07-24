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
 * Optional env:
 *   POSITION_OWNER          - Position owner pubkey (default: keeper)
 *   FEE_OWNER               - Fee claim recipient (default: keeper; set to jackpot vault)
 *   LOCK_RELEASE_POINT      - Lock release timestamp/slot (default: 0 = unlocked)
 *   ROUNDING_UP             - "1" to round price up (default: off)
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

const positionOwner = new PublicKey(process.env.POSITION_OWNER?.trim() || keeper.publicKey.toBase58());
const feeOwner = new PublicKey(process.env.FEE_OWNER?.trim() || keeper.publicKey.toBase58());
const lockReleasePoint = new BN(process.env.LOCK_RELEASE_POINT ?? '0');
const roundingUp = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.ROUNDING_UP ?? '').trim().toLowerCase(),
);

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
