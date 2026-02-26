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
 */

import { Connection, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import DLMM from '@meteora-ag/dlmm';
import { BN } from '@coral-xyz/anchor';
import { loadKeeperKeypair } from '../../../utils/solana.js';
import { requireEnv } from '../../../config.js';

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();

const tokenMintX = new PublicKey(requireEnv('TOKEN_MINT_X'));
const tokenMintY = new PublicKey(requireEnv('TOKEN_MINT_Y'));
const binStep = new BN(requireEnv('BIN_STEP'));
const activeId = new BN(requireEnv('ACTIVE_ID'));
const baseFactor = new BN(process.env.BASE_FACTOR ?? '10000');

console.log('=== Create Meteora DLMM Pool ===');
console.log('RPC:        ', rpcUrl);
console.log('Payer:      ', payer.publicKey.toBase58());
console.log('Token X:    ', tokenMintX.toBase58());
console.log('Token Y:    ', tokenMintY.toBase58());
console.log('Bin Step:   ', binStep.toString());
console.log('Active ID:  ', activeId.toString());
console.log('Base Factor:', baseFactor.toString());
console.log();

const createPoolTx = await DLMM.createPermissionlessLbPair(
  connection,
  binStep,
  tokenMintX,
  tokenMintY,
  activeId,
  payer.publicKey,
  {
    cluster: rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta',
  },
);

const sig = await sendAndConfirmTransaction(connection, createPoolTx, [payer], {
  commitment: 'confirmed',
});

console.log('DLMM Pool created!');
console.log('  Signature:', sig);
console.log();

const [poolAddress] = PublicKey.findProgramAddressSync(
  [tokenMintX.toBuffer(), tokenMintY.toBuffer(), binStep.toArrayLike(Buffer, 'le', 2)],
  DLMM.default ? new PublicKey(DLMM.default) : tokenMintX,
);
console.log('  Pool address (derived):', poolAddress.toBase58());
console.log();
console.log('Next steps:');
console.log('  1. Add initial liquidity to the pool');
console.log('  2. Create Alpha Vault: pnpm solana:create-alpha-vault');
