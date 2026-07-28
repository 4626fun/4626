/**
 * One-shot: create Metaplex metadata for the Akita share-mesh mint.
 *
 * Prerequisites:
 *   - OFT program upgraded with `admin_set_token_mint_authority`
 *   - Keeper is OFT Store admin + program upgrade authority
 *   - Mint authority currently = OFT Store PDA
 *
 * Flow:
 *   1) OFT admin CPI: mint authority Store → keeper
 *   2) Metaplex createV1 (keeper as mint + update authority)
 *   3) SPL setAuthority: mint authority keeper → Store
 *
 * Usage:
 *   pnpm solana:create-share-mesh-metadata
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR
 *   SOLANA_RPC_URL
 *   TOKEN_MINT / SOLANA_B2_MINT / AKITA_B2_SHARE_MESH_MINT
 *   SOLANA_B2_OFT_STORE / AKITA_B2_OFT_STORE
 *   TOKEN_NAME, TOKEN_SYMBOL
 *
 * Optional:
 *   TOKEN_METADATA_URI / TOKEN_URI
 *   SOLANA_OFT_PROGRAM_ID (default 6ste36…)
 *   DRY_RUN=1
 */

import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  AuthorityType,
  TOKEN_2022_PROGRAM_ID,
  createSetAuthorityInstruction,
  getMint,
} from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  keypairIdentity,
  percentAmount,
  publicKey as umiPublicKey,
} from '@metaplex-foundation/umi';
import {
  fromWeb3JsKeypair,
  toWeb3JsInstruction,
} from '@metaplex-foundation/umi-web3js-adapters';
import {
  createV1,
  findMetadataPda,
  mplTokenMetadata,
  TokenStandard,
} from '@metaplex-foundation/mpl-token-metadata';
import { loadKeeperKeypair } from '../../../utils/solana.js';
import { requireEnv } from '../../../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_OFT_PROGRAM = '6ste36Y7fcbzJXkVQj3ApEqYb3wFZsZX63gT6wymhy3s';
// Static curated metadata (avoids broken api.4626.fun DNS + broken premium compositor glyphs).
const DEFAULT_METADATA_URI = 'https://4626.fun/tokens/akita-share-token.json'

function anchorDisc(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = String(process.env[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

const dryRun = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.DRY_RUN ?? '').trim().toLowerCase(),
);
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const oftProgramId = new PublicKey(firstEnv('SOLANA_OFT_PROGRAM_ID') || DEFAULT_OFT_PROGRAM);
function requirePubkeyEnv(...keys: string[]): PublicKey {
  for (const key of keys) {
    const raw = String(process.env[key] ?? '').trim();
    if (!raw) continue;
    try {
      return new PublicKey(raw);
    } catch {
      // Ignore placeholders like TOKEN_MINT=Token2022Mint in local .env
    }
  }
  throw new Error(`Missing valid pubkey env among: ${keys.join(', ')}`);
}

const tokenMint = requirePubkeyEnv(
  'AKITA_B2_SHARE_MESH_MINT',
  'SOLANA_B2_MINT',
  'TOKEN_MINT',
);
const oftStore = new PublicKey(
  firstEnv('SOLANA_B2_OFT_STORE', 'AKITA_B2_OFT_STORE') || requireEnv('SOLANA_B2_OFT_STORE'),
);
const tokenName = requireEnv('TOKEN_NAME');
const tokenSymbol = requireEnv('TOKEN_SYMBOL');
const tokenUri = (
  firstEnv('TOKEN_METADATA_URI', 'TOKEN_URI') || DEFAULT_METADATA_URI
).trim();

const connection = new Connection(rpcUrl, 'confirmed');
const keeper = loadKeeperKeypair();

function buildAdminSetMintAuthorityIx(newAuthority: PublicKey): TransactionInstruction {
  const data = Buffer.concat([
    anchorDisc('admin_set_token_mint_authority'),
    newAuthority.toBuffer(),
  ]);
  return new TransactionInstruction({
    programId: oftProgramId,
    keys: [
      { pubkey: keeper.publicKey, isSigner: true, isWritable: false },
      { pubkey: oftStore, isSigner: false, isWritable: false },
      { pubkey: tokenMint, isSigner: false, isWritable: true },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

console.log('=== Create share-mesh Metaplex metadata ===');
console.log('RPC:          ', rpcUrl);
console.log('Keeper:       ', keeper.publicKey.toBase58());
console.log('OFT program:  ', oftProgramId.toBase58());
console.log('OFT store:    ', oftStore.toBase58());
console.log('Mint:         ', tokenMint.toBase58());
console.log('Name/Symbol:  ', `${tokenName} / ${tokenSymbol}`);
console.log('URI:          ', tokenUri);
console.log('DRY_RUN:      ', dryRun);
console.log();

const mintBefore = await getMint(connection, tokenMint, 'confirmed', TOKEN_2022_PROGRAM_ID);
const mintAuthBefore = mintBefore.mintAuthority?.toBase58() ?? null;
console.log('Mint authority (before):', mintAuthBefore);

if (!mintBefore.mintAuthority) {
  throw new Error('Mint has no mint authority; cannot create metadata via mint-authority path');
}

const umi = createUmi(rpcUrl).use(mplTokenMetadata());
umi.use(keypairIdentity(fromWeb3JsKeypair(keeper)));
const [metadataPda] = findMetadataPda(umi, { mint: umiPublicKey(tokenMint.toBase58()) });
const metadataPk = new PublicKey(metadataPda);
const metadataInfo = await connection.getAccountInfo(metadataPk, 'confirmed');
if (metadataInfo) {
  console.log('Metadata already exists at', metadataPk.toBase58());
  console.log('Nothing to create. If name is wrong, use LZ/Metaplex update-metadata instead.');
  process.exit(0);
}

const needsHandoff = mintBefore.mintAuthority.equals(oftStore);
if (!needsHandoff && !mintBefore.mintAuthority.equals(keeper.publicKey)) {
  throw new Error(
    `Unexpected mint authority ${mintAuthBefore}; expected OFT store or keeper`,
  );
}

if (needsHandoff) {
  console.log('Step 1: hand mint authority Store → keeper via OFT admin ix');
  const ix = buildAdminSetMintAuthorityIx(keeper.publicKey);
  if (dryRun) {
    const sim = await connection.simulateTransaction(
      new Transaction().add(ix),
      [keeper],
    );
    console.log('DRY_RUN simulate admin_set_token_mint_authority:', sim.value.err ?? 'ok');
    if (sim.value.logs) console.log(sim.value.logs.slice(-12).join('\n'));
    if (sim.value.err) process.exit(1);
  } else {
    const sig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(ix),
      [keeper],
      { commitment: 'confirmed' },
    );
    console.log('  mint authority → keeper:', sig);

    // Wait until RPC observes keeper as mint authority — umi createV1 can race.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const mid = await getMint(connection, tokenMint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      if (mid.mintAuthority?.equals(keeper.publicKey)) break;
      await new Promise((r) => setTimeout(r, 500));
      if (attempt === 19) {
        throw new Error('Timed out waiting for mint authority handoff to keeper');
      }
    }
  }
} else {
  console.log('Step 1: skipped (keeper already mint authority)');
}

console.log('Step 2: Metaplex createV1');
const createBuilder = createV1(umi, {
  mint: umiPublicKey(tokenMint.toBase58()),
  authority: umi.identity,
  payer: umi.identity,
  updateAuthority: umi.identity,
  name: tokenName,
  symbol: tokenSymbol,
  uri: tokenUri,
  sellerFeeBasisPoints: percentAmount(0),
  tokenStandard: TokenStandard.Fungible,
  splTokenProgram: umiPublicKey(TOKEN_2022_PROGRAM_ID.toBase58()),
});

if (dryRun) {
  console.log('DRY_RUN: would create metadata PDA', metadataPk.toBase58());
} else {
  // Prefer web3 send path — more reliable confirmation than umi alone on Token-2022.
  const createTx = new Transaction().add(
    ...createBuilder.getInstructions().map((ix) => toWeb3JsInstruction(ix)),
  );
  const createSig = await sendAndConfirmTransaction(connection, createTx, [keeper], {
    commitment: 'confirmed',
  });
  console.log('  metadata created:', createSig);
  console.log('  metadata PDA:   ', metadataPk.toBase58());
}

console.log('Step 3: restore mint authority keeper → Store');
const restoreIx = createSetAuthorityInstruction(
  tokenMint,
  keeper.publicKey,
  AuthorityType.MintTokens,
  oftStore,
  [],
  TOKEN_2022_PROGRAM_ID,
);
if (dryRun) {
  console.log('DRY_RUN: would restore mint authority to', oftStore.toBase58());
} else {
  // If step 1 was dry-run only, skip restore when authority never moved.
  const mintMid = await getMint(connection, tokenMint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  if (mintMid.mintAuthority?.equals(keeper.publicKey)) {
    const sig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(restoreIx),
      [keeper],
      { commitment: 'confirmed' },
    );
    console.log('  mint authority → store:', sig);
  } else {
    console.log('  restore skipped; current authority:', mintMid.mintAuthority?.toBase58());
  }
}

if (!dryRun) {
  const mintAfter = await getMint(connection, tokenMint, 'confirmed', TOKEN_2022_PROGRAM_ID);
  const metaAfter = await connection.getAccountInfo(metadataPk, 'confirmed');
  console.log();
  console.log('Done.');
  console.log('  mint authority:', mintAfter.mintAuthority?.toBase58() ?? null);
  console.log('  metadata exists:', Boolean(metaAfter));
  console.log('  metadata PDA:  ', metadataPk.toBase58());
  if (!mintAfter.mintAuthority?.equals(oftStore)) {
    console.error('WARNING: mint authority is not the OFT store — fix immediately');
    process.exit(1);
  }
  if (!metaAfter) {
    console.error('WARNING: metadata account missing after create');
    process.exit(1);
  }
}
