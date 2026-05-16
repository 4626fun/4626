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
 *   INDIVIDUAL_DEPOSIT_CAP   - Per-wallet cap (default: MAX_DEPOSIT_CAP)
 *   DEPOSIT_START_OFFSET     - Deposit start offset in seconds (default: 0)
 *   DEPOSIT_DURATION         - Deposit window in seconds (default: 86400)
 *   VESTING_DURATION         - Vesting period in seconds (default: 0)
 */

import { createHash } from 'node:crypto';
import { Connection, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import { createRequire } from 'node:module';
import { loadKeeperKeypair } from '../../../utils/solana.js';
import { requireEnv } from '../../../config.js';

const require = createRequire(import.meta.url);
// Meteora SDK currently exposes CJS entrypoints that depend on Anchor's CJS BN export.
// Using require() here avoids ESM named-export mismatches on newer Node/Anchor combos.
const AlphaVaultSdk = require('@meteora-ag/alpha-vault');
const AlphaVault = AlphaVaultSdk.default;
const DLMM = require('@meteora-ag/dlmm');
const { BN } = require('@coral-xyz/anchor');

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();
const cluster = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';

const tokenMint = new PublicKey(requireEnv('TOKEN_MINT'));
const quoteMint = new PublicKey(process.env.TOKEN_MINT_Y ?? 'So11111111111111111111111111111111111111112');
const configuredPoolRaw = String(process.env.DLMM_POOL ?? '').trim();
const dlmmProgramId = new PublicKey(DLMM.LBCLMM_PROGRAM_IDS[cluster]);
const alphaVaultProgramId = new PublicKey(AlphaVaultSdk.PROGRAM_ID[cluster]);
const dlmmPool = configuredPoolRaw
  ? new PublicKey(configuredPoolRaw)
  : DLMM.deriveCustomizablePermissionlessLbPair(tokenMint, quoteMint, dlmmProgramId)[0];
const maxDepositCap = new BN(process.env.MAX_DEPOSIT_CAP ?? String(2n ** 64n - 1n));
const individualDepositCap = new BN(process.env.INDIVIDUAL_DEPOSIT_CAP ?? maxDepositCap.toString());
const depositStartOffset = Number(process.env.DEPOSIT_START_OFFSET ?? '0');
const depositDuration = Number(process.env.DEPOSIT_DURATION ?? String(7 * 24 * 60 * 60));
const vestingDuration = Number(process.env.VESTING_DURATION ?? '0');

if (individualDepositCap.lte(new BN(0))) {
  throw new Error('INDIVIDUAL_DEPOSIT_CAP must be > 0 for FCFS vault creation.');
}
if (individualDepositCap.gt(maxDepositCap)) {
  throw new Error('INDIVIDUAL_DEPOSIT_CAP cannot exceed MAX_DEPOSIT_CAP.');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForAccount(address: PublicKey, attempts = 20, delayMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    const account = await connection.getAccountInfo(address);
    if (account) return account;
    await sleep(delayMs);
  }
  return null;
}

const [alphaVaultPubkey] = AlphaVaultSdk.deriveAlphaVault(
  payer.publicKey,
  dlmmPool,
  alphaVaultProgramId,
);
let vaultAccountInfo = await connection.getAccountInfo(alphaVaultPubkey);

console.log('=== Create Meteora Alpha Vault ===');
console.log('RPC:               ', rpcUrl);
console.log('Payer:             ', payer.publicKey.toBase58());
console.log('DLMM Pool:         ', dlmmPool.toBase58());
console.log('Token Mint:        ', tokenMint.toBase58());
console.log('Quote Mint:        ', quoteMint.toBase58());
console.log('DLMM Program:      ', dlmmProgramId.toBase58());
console.log('AlphaVault Program:', alphaVaultProgramId.toBase58());
console.log('Vault Program:     ', AlphaVaultSdk.VAULT_PROGRAM_ID.toBase58());
console.log('Vault (PDA):       ', alphaVaultPubkey.toBase58());
console.log('Max Deposit Cap:   ', maxDepositCap.toString());
console.log('Individual Cap:    ', individualDepositCap.toString());
console.log('Deposit Duration:  ', depositDuration, 'seconds');
console.log('Vesting Duration:  ', vestingDuration, 'seconds');
console.log();

let sig = 'existing';
if (!vaultAccountInfo) {
  const createTx = await AlphaVault.createCustomizableFcfsVault(
    connection,
    {
      baseMint: tokenMint,
      quoteMint,
      poolAddress: dlmmPool,
      poolType: AlphaVaultSdk.PoolType.DLMM,
      depositingPoint: new BN(Math.floor(Date.now() / 1000) + depositStartOffset),
      startVestingPoint: new BN(Math.floor(Date.now() / 1000) + depositStartOffset + depositDuration),
      endVestingPoint: new BN(Math.floor(Date.now() / 1000) + depositStartOffset + depositDuration + vestingDuration),
      maxDepositingCap: maxDepositCap,
      individualDepositingCap: individualDepositCap,
      escrowFee: new BN(0),
      whitelistMode: 0,
    },
    payer.publicKey,
    { cluster },
  );
  sig = await sendAndConfirmTransaction(connection, createTx, [payer], {
    commitment: 'confirmed',
  });
  vaultAccountInfo = await waitForAccount(alphaVaultPubkey);
}

if (!vaultAccountInfo) {
  throw new Error(
    `Alpha vault account ${alphaVaultPubkey.toBase58()} was not found after create tx ${sig}.`,
  );
}

const vault = await AlphaVault.create(connection, alphaVaultPubkey, { cluster });
const expectedRemoteAmount = new BN(process.env.EXPECTED_REMOTE_AMOUNT ?? '1000000000');
const depositTx = await vault.deposit(expectedRemoteAmount, payer.publicKey);
const depositDiscriminator = createHash('sha256').update('global:deposit').digest().subarray(0, 8);
const depositIx =
  depositTx.instructions.find(
    (ix: any) =>
      ix.programId.equals(alphaVaultProgramId) &&
      Buffer.from(ix.data ?? []).subarray(0, 8).equals(depositDiscriminator),
  ) ??
  depositTx.instructions.find((ix: any) => ix.programId.equals(alphaVaultProgramId));
if (!depositIx) {
  throw new Error('Could not derive deposit account metas from Alpha Vault deposit transaction.');
}
const depositAccounts = depositIx.keys.map((key: any) => ({
  pubkey: key.pubkey.toBase58(),
  isSigner: key.isSigner,
  isWritable: key.isWritable,
}));

console.log('Alpha Vault created!');
console.log('  Vault:     ', alphaVaultPubkey.toBase58());
console.log('  Signature: ', sig);
console.log();
console.log('Save this for register-meteora-vault:');
console.log(JSON.stringify({
  meteoraAlphaVault: alphaVaultPubkey.toBase58(),
  alphaVaultProgramId: alphaVaultProgramId.toBase58(),
  depositAccounts,
  metadata: {
    pool: dlmmPool.toBase58(),
    base_mint: tokenMint.toBase58(),
    quote_mint: quoteMint.toBase58(),
    source: 'programmatic-7day-sol',
  },
}, null, 2));
console.log();
console.log(`DEPOSIT_ACCOUNTS_JSON='${JSON.stringify(depositAccounts)}'`);
console.log();
console.log('Next steps:');
console.log('  1. Upsert with: pnpm -C kpr exec tsx scripts/solana/launch/register-meteora-vault.ts');
console.log('  2. Retry deploy dry-run and verify Phase-2 inline Meteora payload is present.');
