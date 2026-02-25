/**
 * Set or transfer Token-2022 mint authority.
 *
 * Usage:
 *   pnpm solana:set-token-authority
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Current authority keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   TOKEN_MINT              - Token-2022 mint address
 *   NEW_AUTHORITY           - New authority pubkey (or "none" to revoke)
 *   AUTHORITY_TYPE          - One of: mint, freeze, transfer-fee-config, withheld-withdraw
 */

import { Connection, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  AuthorityType,
  TOKEN_2022_PROGRAM_ID,
  createSetAuthorityInstruction,
} from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';
import { loadKeeperKeypair } from '../../utils/solana.js';
import { requireEnv } from '../../config.js';

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();

const tokenMint = new PublicKey(requireEnv('TOKEN_MINT'));
const newAuthorityRaw = requireEnv('NEW_AUTHORITY');
const newAuthority = newAuthorityRaw.toLowerCase() === 'none' ? null : new PublicKey(newAuthorityRaw);
const authorityTypeRaw = requireEnv('AUTHORITY_TYPE');

const authorityTypeMap: Record<string, AuthorityType> = {
  'mint': AuthorityType.MintTokens,
  'freeze': AuthorityType.FreezeAccount,
  'transfer-fee-config': AuthorityType.TransferFeeConfig,
  'withheld-withdraw': AuthorityType.WithheldWithdraw,
};

const authorityType = authorityTypeMap[authorityTypeRaw.toLowerCase()];
if (authorityType === undefined) {
  console.error(`Invalid AUTHORITY_TYPE: ${authorityTypeRaw}`);
  console.error('Valid types: mint, freeze, transfer-fee-config, withheld-withdraw');
  process.exit(1);
}

console.log('=== Set Token Authority ===');
console.log('RPC:           ', rpcUrl);
console.log('Current Auth:  ', payer.publicKey.toBase58());
console.log('Token Mint:    ', tokenMint.toBase58());
console.log('Authority Type:', authorityTypeRaw);
console.log('New Authority: ', newAuthority?.toBase58() ?? '(revoked)');
console.log();

const tx = new Transaction().add(
  createSetAuthorityInstruction(
    tokenMint,
    payer.publicKey,
    authorityType,
    newAuthority,
    [],
    TOKEN_2022_PROGRAM_ID,
  ),
);

const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
  commitment: 'confirmed',
});

console.log('Authority updated!');
console.log('  Signature:', sig);
