/**
 * Prepare token display metadata for Solana ecosystem indexers (wallets, Jupiter, etc.).
 *
 * This is NOT Meteora's on-chain admin `token_badge` (required for permissioned Token-2022
 * extensions before DLMM pool create). See docs/operations/solana-share-mesh-lottery-policy.md.
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
 *   TOKEN_IMAGE             - Explicit image URL override for logoURI
 *   TOKEN_IMAGE_URL         - Explicit image URL fallback (legacy key)
 *   CREATOR_TOKEN           - Base creator token address (0x...) used for proxy fallback
 *   CREATOR_TOKEN_CHAIN_ID  - Chain for creator token lookup (default: 8453)
 *   API_ORIGIN / API_HOST   - API origin/host for proxy fallback (default: https://api.4626.fun)
 *   TOKEN_IMAGE_EXPLICIT_OVERRIDE - "1" to force explicit TOKEN_IMAGE over proxy fallback
 *   TOKEN_DECIMALS          - Decimals for token-list payload (default: 9)
 *   BADGE_CHAIN_ID          - Solana token-list chainId (default: 101)
 *   BADGE_TARGET            - Submission target label (default: "meteora")
 */

import { PublicKey } from '@solana/web3.js';
import { requireEnv } from '../../../config.js';

function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function normalizeApiOrigin(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'https://api.4626.fun';
  const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    return parsed.origin;
  } catch {
    return 'https://api.4626.fun';
  }
}

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function normalizeExternalUri(raw: string, keyLabel: string): string {
  const value = raw.trim();
  if (!value) return '';
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${keyLabel} must be an absolute URI. Received: ${value}`);
  }
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:' && protocol !== 'ipfs:' && protocol !== 'ar:') {
    throw new Error(
      `${keyLabel} must use https/http/ipfs/ar. Received protocol: ${protocol}`,
    );
  }
  return parsed.toString();
}

const tokenMint = new PublicKey(requireEnv('TOKEN_MINT'));
const tokenName = requireEnv('TOKEN_NAME');
const tokenSymbol = requireEnv('TOKEN_SYMBOL');
const tokenUri = normalizeExternalUri(
  String(process.env.TOKEN_METADATA_URI ?? process.env.TOKEN_URI ?? ''),
  'TOKEN_METADATA_URI/TOKEN_URI',
);
const creatorTokenRaw = (process.env.CREATOR_TOKEN ?? '').trim();
const creatorToken = isEvmAddress(creatorTokenRaw) ? creatorTokenRaw.toLowerCase() : '';
const creatorTokenChainIdRaw = (process.env.CREATOR_TOKEN_CHAIN_ID ?? '8453').trim();
const creatorTokenChainIdParsed = Number.parseInt(creatorTokenChainIdRaw, 10);
const creatorTokenChainId = Number.isFinite(creatorTokenChainIdParsed) && creatorTokenChainIdParsed > 0
  ? creatorTokenChainIdParsed
  : 8453;
const apiOrigin = normalizeApiOrigin((process.env.API_ORIGIN ?? process.env.API_HOST ?? '').trim());
const proxyImageFallbackUrl = creatorToken
  ? `${apiOrigin}/v1/token/${creatorToken}/image?chain=${creatorTokenChainId}&style=raw&format=png`
  : '';
const tokenImageExplicit = normalizeExternalUri(
  String(process.env.TOKEN_IMAGE ?? process.env.TOKEN_IMAGE_URL ?? ''),
  'TOKEN_IMAGE/TOKEN_IMAGE_URL',
);
const tokenImageExplicitOverride = envFlag('TOKEN_IMAGE_EXPLICIT_OVERRIDE');
const tokenImage = (() => {
  if (creatorToken) {
    if (tokenImageExplicit && tokenImageExplicitOverride) return tokenImageExplicit;
    return proxyImageFallbackUrl;
  }
  return tokenImageExplicit;
})();
const tokenImageSource = (() => {
  if (creatorToken) {
    if (tokenImageExplicit && tokenImageExplicitOverride) return 'explicit-env';
    return proxyImageFallbackUrl ? 'proxy-raw-fallback' : 'unset';
  }
  return tokenImageExplicit ? 'explicit-env' : 'unset';
})();
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
console.log('Image source:', tokenImageSource);
console.log('URI:    ', tokenUri || '(none)');
console.log('Image:  ', tokenImage || '(none)');
if (creatorToken) {
  console.log('Creator token:', creatorToken, `(chain ${creatorTokenChainId})`);
}
if (creatorTokenRaw && !creatorToken) {
  console.warn('WARN: CREATOR_TOKEN is set but not a valid 0x EVM address; proxy fallback is disabled.');
}
if (creatorToken && tokenImageExplicit && !tokenImageExplicitOverride) {
  console.warn(
    'WARN: TOKEN_IMAGE is ignored because CREATOR_TOKEN proxy fallback is active. ' +
      'Set TOKEN_IMAGE_EXPLICIT_OVERRIDE=1 to force explicit TOKEN_IMAGE.',
  );
}
if (!tokenUri) {
  console.warn('WARN: TOKEN_METADATA_URI/TOKEN_URI is missing. Wallet metadata indexing may fail.');
}
if (!tokenImage) {
  console.warn('WARN: No logoURI source resolved. Set TOKEN_IMAGE/TOKEN_IMAGE_URL or CREATOR_TOKEN.');
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
console.log('  2. Prefer CREATOR_TOKEN proxy fallback; use TOKEN_IMAGE override only when intentional');
console.log('  3. Submit token-list entry to target indexers where applicable (e.g. Jupiter strict list process)');
console.log('  4. Keep metadata URI + logo URI stable after launch (avoid rotating URLs)');
console.log('  5. For Token-2022 DLMM pools: Meteora admin token_badge is a separate on-chain step (see policy doc)');
console.log();
console.log('For Phantom/Backpack wallet display, the metadata will be read');
console.log('from on-chain metadata pointer extension or the token registry.');
