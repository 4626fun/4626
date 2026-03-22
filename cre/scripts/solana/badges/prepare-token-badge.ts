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
 *   TOKEN_MINT              - Token-2022 mint address
 *   TOKEN_NAME              - Display name
 *   TOKEN_SYMBOL            - Symbol (e.g., ■AKITA)
 *
 * Optional env:
 *   TOKEN_METADATA_URI      - Metadata URI (preferred)
 *   TOKEN_URI               - Metadata URI fallback (legacy key)
 *   TOKEN_IMAGE             - Image URL for the token
 *   TOKEN_IMAGE_URL         - Image URL fallback (legacy key)
 *   TOKEN_DECIMALS          - Decimals for token-list payload (default: 9)
 *   BADGE_CHAIN_ID          - Solana token-list chainId (default: 101)
 *   BADGE_TARGET            - Submission target label (default: "meteora")
 */

import { PublicKey } from '@solana/web3.js';
import { requireEnv } from '../../../config.js';

const tokenMint = new PublicKey(requireEnv('TOKEN_MINT'));
const tokenName = requireEnv('TOKEN_NAME');
const tokenSymbol = requireEnv('TOKEN_SYMBOL');
const tokenUri = (process.env.TOKEN_METADATA_URI ?? process.env.TOKEN_URI ?? '').trim();
const tokenImage = (process.env.TOKEN_IMAGE ?? process.env.TOKEN_IMAGE_URL ?? '').trim();
const badgeTarget = (process.env.BADGE_TARGET ?? 'meteora').trim().toLowerCase();
const tokenDecimalsRaw = (process.env.TOKEN_DECIMALS ?? '9').trim();
const tokenDecimalsParsed = Number.parseInt(tokenDecimalsRaw, 10);
const tokenDecimals = Number.isFinite(tokenDecimalsParsed) && tokenDecimalsParsed >= 0
  ? tokenDecimalsParsed
  : 9;
const chainIdRaw = (process.env.BADGE_CHAIN_ID ?? '101').trim();
const chainIdParsed = Number.parseInt(chainIdRaw, 10);
const chainId = Number.isFinite(chainIdParsed) && chainIdParsed > 0 ? chainIdParsed : 101;

console.log('=== Prepare Token Badge ===');
console.log('Mint:   ', tokenMint.toBase58());
console.log('Name:   ', tokenName);
console.log('Symbol: ', tokenSymbol);
console.log('Target: ', badgeTarget);
console.log('Chain:  ', chainId);
console.log('Decimals:', tokenDecimals);
console.log('URI:    ', tokenUri || '(none)');
console.log('Image:  ', tokenImage || '(none)');
if (!tokenUri) {
  console.warn('WARN: TOKEN_METADATA_URI/TOKEN_URI is missing. Wallet metadata indexing may fail.');
}
if (!tokenImage) {
  console.warn('WARN: TOKEN_IMAGE/TOKEN_IMAGE_URL is missing. Wallet icon rendering may fail.');
}
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

const tokenListEntry: Record<string, unknown> = {
  chainId,
  address: tokenMint.toBase58(),
  symbol: tokenSymbol,
  name: tokenName,
  decimals: tokenDecimals,
};
if (tokenImage) tokenListEntry.logoURI = tokenImage;
if (tokenUri) {
  tokenListEntry.extensions = {
    metadata: tokenUri,
    metadata_uri: tokenUri,
  };
}

console.log('Token badge metadata:');
console.log(JSON.stringify(metadata, null, 2));
console.log();
console.log('Ready-to-submit token-list entry payload:');
console.log(JSON.stringify(tokenListEntry, null, 2));
console.log();
console.log('Wallet visibility checklist:');
console.log('  1. Ensure TOKEN_METADATA_URI (or TOKEN_URI) resolves to valid JSON metadata');
console.log('  2. Ensure TOKEN_IMAGE/TOKEN_IMAGE_URL is a stable HTTPS image URL (PNG/SVG)');
console.log('  3. Submit token-list entry to target indexers (Jupiter/Meteora/Orca as applicable)');
console.log('  4. Keep metadata URI + logo URI stable after launch (avoid rotating URLs)');
console.log();
console.log('For Phantom/Backpack wallet display, the metadata will be read');
console.log('from on-chain metadata pointer extension or the token registry.');
