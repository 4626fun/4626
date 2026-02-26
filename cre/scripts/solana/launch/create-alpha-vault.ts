/**
 * Create a Meteora Alpha Vault for auto-deposit during vault deploys.
 *
 * Usage:
 *   pnpm solana:create-alpha-vault
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   DLMM_POOL               - Meteora DLMM pool address
 *   TOKEN_MINT               - Token mint for deposits
 *
 * Optional env:
 *   MAX_DEPOSIT_CAP          - Maximum deposit cap (default: u64 max)
 *   DEPOSIT_START_OFFSET     - Deposit start offset in seconds (default: 0)
 *   DEPOSIT_DURATION         - Deposit window in seconds (default: 86400)
 *   VESTING_DURATION         - Vesting period in seconds (default: 0)
 */

import { Connection, PublicKey, Keypair, sendAndConfirmTransaction } from '@solana/web3.js';
import AlphaVault from '@meteora-ag/alpha-vault';
import { BN } from '@coral-xyz/anchor';
import { loadKeeperKeypair } from '../../utils/solana.js';
import { requireEnv } from '../../config.js';

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();

const dlmmPool = new PublicKey(requireEnv('DLMM_POOL'));
const tokenMint = new PublicKey(requireEnv('TOKEN_MINT'));
const maxDepositCap = new BN(process.env.MAX_DEPOSIT_CAP ?? String(2n ** 64n - 1n));
const depositStartOffset = Number(process.env.DEPOSIT_START_OFFSET ?? '0');
const depositDuration = Number(process.env.DEPOSIT_DURATION ?? '86400');
const vestingDuration = Number(process.env.VESTING_DURATION ?? '0');

console.log('=== Create Meteora Alpha Vault ===');
console.log('RPC:               ', rpcUrl);
console.log('Payer:             ', payer.publicKey.toBase58());
console.log('DLMM Pool:         ', dlmmPool.toBase58());
console.log('Token Mint:        ', tokenMint.toBase58());
console.log('Max Deposit Cap:   ', maxDepositCap.toString());
console.log('Deposit Duration:  ', depositDuration, 'seconds');
console.log('Vesting Duration:  ', vestingDuration, 'seconds');
console.log();

const alphaVaultKeypair = Keypair.generate();

const initTx = await AlphaVault.createPermissionlessAlphaVault(connection, {
  baseMint: tokenMint,
  quoteMint: tokenMint,
  poolAddress: dlmmPool,
  poolType: 0,
  depositingPoint: new BN(Math.floor(Date.now() / 1000) + depositStartOffset),
  startVestingPoint: new BN(Math.floor(Date.now() / 1000) + depositStartOffset + depositDuration),
  endVestingPoint: new BN(Math.floor(Date.now() / 1000) + depositStartOffset + depositDuration + vestingDuration),
  maxDepositingCap: maxDepositCap,
  individualDepositingCap: new BN(0),
  escrowFee: new BN(0),
  whitelistMode: 0,
  payer: payer.publicKey,
});

const sig = await sendAndConfirmTransaction(connection, initTx, [payer, alphaVaultKeypair], {
  commitment: 'confirmed',
});

console.log('Alpha Vault created!');
console.log('  Vault:     ', alphaVaultKeypair.publicKey.toBase58());
console.log('  Signature: ', sig);
console.log();
console.log('Save this Alpha Vault address for METEORA_CREATOR_ALPHA_VAULT_MAP_JSON:');
console.log(JSON.stringify({
  meteoraAlphaVault: alphaVaultKeypair.publicKey.toBase58(),
  alphaVaultProgramId: AlphaVault.default?.toBase58() ?? 'ALPHA_VAULT_PROGRAM_ID',
  depositAccounts: [],
}, null, 2));
console.log();
console.log('Next steps:');
console.log('  1. Add deposit accounts to the config above');
console.log('  2. Set METEORA_CREATOR_ALPHA_VAULT_MAP_JSON in your env');
console.log('  3. Configure SOLANA_DYNAMIC_ROUTE_PROVISIONER_URL');
