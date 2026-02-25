/**
 * Prepare Token-2022 badge metadata for the creator share token.
 *
 * Token badges are required for Solana ecosystem tools (e.g., Jupiter, Phantom)
 * to properly display Token-2022 tokens with extensions.
 *
 * Usage:
 *   pnpm solana:prepare-token-badge
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   TOKEN_MINT              - Token-2022 mint address
 *   TOKEN_NAME              - Display name
 *   TOKEN_SYMBOL            - Symbol (e.g., ■AKITA)
 *
 * Optional env:
 *   TOKEN_URI               - Metadata URI (Arweave/IPFS link)
 *   TOKEN_IMAGE             - Image URL for the token
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMetadataPointerInstruction,
} from '@solana/spl-token';
import { loadKeeperKeypair } from '../../utils/solana.js';
import { requireEnv } from '../../config.js';

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();

const tokenMint = new PublicKey(requireEnv('TOKEN_MINT'));
const tokenName = requireEnv('TOKEN_NAME');
const tokenSymbol = requireEnv('TOKEN_SYMBOL');
const tokenUri = process.env.TOKEN_URI ?? '';
const tokenImage = process.env.TOKEN_IMAGE ?? '';

console.log('=== Prepare Token Badge ===');
console.log('RPC:    ', rpcUrl);
console.log('Payer:  ', payer.publicKey.toBase58());
console.log('Mint:   ', tokenMint.toBase58());
console.log('Name:   ', tokenName);
console.log('Symbol: ', tokenSymbol);
console.log('URI:    ', tokenUri || '(none)');
console.log('Image:  ', tokenImage || '(none)');
console.log();

const metadata = {
  mint: tokenMint.toBase58(),
  name: tokenName,
  symbol: tokenSymbol,
  uri: tokenUri,
  image: tokenImage,
  extensions: {
    transferFee: true,
    transferHook: true,
  },
};

console.log('Token badge metadata:');
console.log(JSON.stringify(metadata, null, 2));
console.log();
console.log('To register this token with ecosystem tools:');
console.log('  1. Upload metadata JSON to Arweave or IPFS');
console.log('  2. Submit to Jupiter Token List: https://github.com/nicoshon/token-list');
console.log('  3. Submit to Solana Token Registry (if applicable)');
console.log();
console.log('For Phantom/Backpack wallet display, the metadata will be read');
console.log('from on-chain metadata pointer extension or the token registry.');
