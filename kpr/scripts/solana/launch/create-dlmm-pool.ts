/**
 * Create a Meteora DLMM pool for the creator's share token on Solana.
 *
 * Usage:
 *   pnpm solana:create-dlmm-pool
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   TOKEN_MINT_X            - First token mint (e.g., creator share token)
 *   TOKEN_MINT_Y            - Second token mint (e.g., USDC or SOL)
 *   BIN_STEP                - DLMM bin step (e.g., 25 for 0.25% bins)
 *   ACTIVE_ID               - Initial active bin ID
 *
 * Optional env:
 *   BASE_FACTOR             - Base factor for the pool (default: 10000)
 *   ACTIVATION_TYPE         - "timestamp" (default) or "slot"
 *   ACTIVATION_POINT        - Unix timestamp (timestamp mode) or slot (slot mode)
 *   ACTIVATION_DELAY_SECONDS - Delay after now before trading starts (default: 0 = Meteora UI live)
 *   ACTIVATION_SLOT_OFFSET  - Slot offset when ACTIVATION_TYPE=slot (default: 200)
 *   METEORA_HAS_ALPHA_VAULT - "1" when pairing with Alpha Vault launch (default: off)
 *   HAS_ALPHA_VAULT         - Alias for METEORA_HAS_ALPHA_VAULT
 */

import { Connection, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { createRequire } from 'node:module';
import { loadKeeperKeypair } from '../../../utils/solana.js';
import { requireEnv } from '../../../config.js';

const require = createRequire(import.meta.url);
// Meteora SDK currently exposes CJS entrypoints that depend on Anchor's CJS BN export.
// Using require() here avoids ESM named-export mismatches on newer Node/Anchor combos.
const DLMM = require('@meteora-ag/dlmm');
const { BN } = require('@coral-xyz/anchor');

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();

const tokenMintX = new PublicKey(requireEnv('TOKEN_MINT_X'));
const tokenMintY = new PublicKey(requireEnv('TOKEN_MINT_Y'));
const binStep = new BN(requireEnv('BIN_STEP'));
const activeId = new BN(requireEnv('ACTIVE_ID'));
const baseFactor = new BN(process.env.BASE_FACTOR ?? '10000');
const feeBps = new BN(process.env.FEE_BPS ?? '100');
const cluster = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

const hasAlphaVault = envFlag('METEORA_HAS_ALPHA_VAULT') || envFlag('HAS_ALPHA_VAULT');

function resolveActivationDelaySeconds(): number {
  const raw = String(process.env.ACTIVATION_DELAY_SECONDS ?? '0').trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`ACTIVATION_DELAY_SECONDS must be a non-negative integer. Received: ${raw}`);
  }
  return parsed;
}

const programId = new PublicKey(DLMM.LBCLMM_PROGRAM_IDS[cluster]);
const [poolAddress] = DLMM.deriveCustomizablePermissionlessLbPair(tokenMintX, tokenMintY, programId);

console.log('=== Create Meteora DLMM Pool ===');
console.log('RPC:        ', rpcUrl);
console.log('Payer:      ', payer.publicKey.toBase58());
console.log('Token X:    ', tokenMintX.toBase58());
console.log('Token Y:    ', tokenMintY.toBase58());
console.log('Bin Step:   ', binStep.toString());
console.log('Active ID:  ', activeId.toString());
console.log('Base Factor:', baseFactor.toString());
console.log('Fee (BPS):  ', feeBps.toString());
console.log('Program:    ', programId.toBase58());
console.log('Pool (PDA): ', poolAddress.toBase58());
console.log();

const existingPool = await connection.getAccountInfo(poolAddress);
if (existingPool) {
  console.log('DLMM Pool already exists.');
  console.log('  Pool:      ', poolAddress.toBase58());
  console.log('  Signature: existing');
  process.exit(0);
}

const activationKindRaw = String(process.env.ACTIVATION_TYPE ?? 'timestamp').trim().toLowerCase();
const activationType =
  activationKindRaw === 'timestamp' ? DLMM.ActivationType.Timestamp : DLMM.ActivationType.Slot;
const activationPointExplicit = String(process.env.ACTIVATION_POINT ?? '').trim();
const activationPoint =
  activationType === DLMM.ActivationType.Timestamp
    ? activationPointExplicit
      ? new BN(activationPointExplicit)
      : new BN(Math.floor(Date.now() / 1000) + resolveActivationDelaySeconds())
    : new BN(
        String(
          (await connection.getSlot('confirmed')) +
            Number.parseInt(process.env.ACTIVATION_SLOT_OFFSET ?? '200', 10),
        ),
      );
console.log('AlphaVault:', hasAlphaVault ? 'yes (launch lane)' : 'no (default share-mesh pool)');
console.log(
  'Activation: ',
  activationPoint.toString(),
  activationType === DLMM.ActivationType.Timestamp ? '(timestamp)' : '(slot)',
);
console.log();

const createPoolTx = await DLMM.createCustomizablePermissionlessLbPair2(
  connection,
  binStep,
  tokenMintX,
  tokenMintY,
  activeId,
  feeBps,
  activationType,
  hasAlphaVault,
  payer.publicKey,
  activationPoint,
  false,
  { cluster },
);

const sig = await sendAndConfirmTransaction(connection, createPoolTx, [payer], {
  commitment: 'confirmed',
});

console.log('DLMM Pool created!');
console.log('  Signature:', sig);
console.log('  Pool:     ', poolAddress.toBase58());
console.log();
console.log('Next steps (Meteora UI visibility):');
console.log('  1. Seed initial DLMM liquidity — empty pools do not swap and rarely appear in browse');
console.log('  2. Confirm activation time has passed (default: start now; delay via ACTIVATION_DELAY_SECONDS)');
console.log('  3. Verify on https://app.meteora.ag/pools by pasting mint or pool address');
console.log(
  '  4. Optional display metadata: BADGE_TARGET=meteora pnpm -C kpr solana:prepare-token-badge',
);
console.log(
  '     (generates wallet/token-list JSON — not the same as Meteora admin token_badge for Token-2022)',
);
if (hasAlphaVault) {
  console.log('  5. Create Alpha Vault: pnpm -C kpr solana:create-alpha-vault');
}
