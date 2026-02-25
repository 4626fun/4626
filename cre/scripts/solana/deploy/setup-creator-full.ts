/**
 * Full Solana-side creator setup: Token-2022 mint + PDA init + extra-account-meta.
 *
 * Called by the Solana route provisioner (`POST /setup-creator`) after the bridge
 * route is created via `wrap-token`. Outputs JSON to stdout for programmatic
 * consumption; all human-readable logs go to stderr.
 *
 * Usage:
 *   tsx scripts/solana/deploy/setup-creator-full.ts \
 *     --hub-creator-coin 0x... \
 *     --hub-share-oft 0x... \
 *     [--keeper-pubkey <base58>] \
 *     [--fee-bps 690] \
 *     [--decimals 9] \
 *     [--amm-programs <pubkey1>,<pubkey2>]
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer + authority keypair (base58 or JSON array)
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *
 * Output (JSON to stdout):
 *   { "mint": "<base58>", "mintBytes32": "0x...", "pdas": { ... }, "signatures": [...] }
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeTransferHookInstruction,
  getMintLen,
} from '@solana/spl-token';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { loadKeeperKeypair } from '../../utils/solana.js';
import { CHAINS } from '../../config.js';

import idl from '../../../../target/idl/creator_share_hook.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(): {
  hubCreatorCoin: string;
  hubShareOft: string;
  keeperPubkey: string | null;
  feeBps: number;
  decimals: number;
  ammPrograms: string[];
  flushThreshold: string;
  lotteryEnabled: boolean;
} {
  const args = process.argv.slice(2);
  let hubCreatorCoin = '';
  let hubShareOft = '';
  let keeperPubkey: string | null = null;
  let feeBps = 690;
  let decimals = 9;
  let ammPrograms: string[] = [];
  let flushThreshold = '0';
  let lotteryEnabled = true;

  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case '--hub-creator-coin':
        hubCreatorCoin = args[++i] ?? '';
        break;
      case '--hub-share-oft':
        hubShareOft = args[++i] ?? '';
        break;
      case '--keeper-pubkey':
        keeperPubkey = args[++i] ?? null;
        break;
      case '--fee-bps':
        feeBps = Number(args[++i] ?? '690');
        break;
      case '--decimals':
        decimals = Number(args[++i] ?? '9');
        break;
      case '--amm-programs':
        ammPrograms = (args[++i] ?? '').split(',').map(s => s.trim()).filter(Boolean);
        break;
      case '--flush-threshold':
        flushThreshold = args[++i] ?? '0';
        break;
      case '--lottery-disabled':
        lotteryEnabled = false;
        break;
    }
  }

  if (!hubCreatorCoin || !hubShareOft) {
    process.stderr.write('error: --hub-creator-coin and --hub-share-oft are required\n');
    process.exit(1);
  }

  return { hubCreatorCoin, hubShareOft, keeperPubkey, feeBps, decimals, ammPrograms, flushThreshold, lotteryEnabled };
}

function hexToBytes32(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error(`Invalid bytes32 hex: ${hex}`);
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  return bytes;
}

function pubkeyToBytes32Hex(pubkey: PublicKey): string {
  return '0x' + Buffer.from(pubkey.toBytes()).toString('hex');
}

function log(msg: string): void {
  process.stderr.write(`[setup-creator-full] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const config = parseArgs();
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();
const wallet = new Wallet(payer);
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

const hookProgramId = new PublicKey(CHAINS.solana.programId);
const program = new Program(idl as any, provider);

const keeperPubkey = config.keeperPubkey
  ? new PublicKey(config.keeperPubkey)
  : payer.publicKey;

const signatures: string[] = [];

// ---------------------------------------------------------------------------
// Step 1: Create Token-2022 Mint with TransferHook + TransferFeeConfig
// ---------------------------------------------------------------------------

log('Step 1: Creating Token-2022 mint with TransferHook + TransferFeeConfig');

const mintKeypair = Keypair.generate();
const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook];
const mintLen = getMintLen(extensions);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
const maxFee = 2n ** 64n - 1n;

const createMintTx = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  }),
  createInitializeTransferFeeConfigInstruction(
    mintKeypair.publicKey,
    payer.publicKey,
    payer.publicKey,
    config.feeBps,
    maxFee,
    TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeTransferHookInstruction(
    mintKeypair.publicKey,
    payer.publicKey,
    hookProgramId,
    TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeMintInstruction(
    mintKeypair.publicKey,
    config.decimals,
    payer.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID,
  ),
);

const mintSig = await sendAndConfirmTransaction(connection, createMintTx, [payer, mintKeypair], {
  commitment: 'confirmed',
});
signatures.push(mintSig);
log(`  Mint created: ${mintKeypair.publicKey.toBase58()} (sig: ${mintSig})`);

// ---------------------------------------------------------------------------
// Step 2: Initialize Creator PDAs
// ---------------------------------------------------------------------------

log('Step 2: Initializing creator PDAs (CreatorConfig + PendingEntries + WinnerRecord)');

const ammProgramPubkeys = config.ammPrograms.map(s => new PublicKey(s));

const initSig = await program.methods
  .initializeCreator({
    keeperAuthority: keeperPubkey,
    hubCreatorCoin: hexToBytes32(config.hubCreatorCoin),
    hubShareOft: hexToBytes32(config.hubShareOft),
    feeBps: config.feeBps,
    flushThreshold: new BN(config.flushThreshold),
    lotteryEnabled: config.lotteryEnabled,
    knownAmmPrograms: ammProgramPubkeys,
  })
  .accounts({ creatorMint: mintKeypair.publicKey })
  .rpc();

signatures.push(initSig);
log(`  PDAs initialized (sig: ${initSig})`);

// ---------------------------------------------------------------------------
// Step 3: Initialize Extra Account Meta List (required for Transfer Hook)
// ---------------------------------------------------------------------------

log('Step 3: Initializing extra account meta list');

const extraMetaSig = await program.methods
  .initializeExtraAccountMetaList()
  .accounts({ mint: mintKeypair.publicKey })
  .rpc();

signatures.push(extraMetaSig);
log(`  Extra account meta list initialized (sig: ${extraMetaSig})`);

// ---------------------------------------------------------------------------
// Derive PDA addresses for output
// ---------------------------------------------------------------------------

const [creatorConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('creator_config'), mintKeypair.publicKey.toBuffer()],
  hookProgramId,
);
const [pendingEntriesPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pending_entries'), mintKeypair.publicKey.toBuffer()],
  hookProgramId,
);
const [winnerRecordPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('winner_record'), mintKeypair.publicKey.toBuffer()],
  hookProgramId,
);

// ---------------------------------------------------------------------------
// Output JSON to stdout
// ---------------------------------------------------------------------------

const result = {
  success: true,
  mint: mintKeypair.publicKey.toBase58(),
  mintBytes32: pubkeyToBytes32Hex(mintKeypair.publicKey),
  decimals: config.decimals,
  feeBps: config.feeBps,
  transferHookProgram: hookProgramId.toBase58(),
  keeper: keeperPubkey.toBase58(),
  pdas: {
    creatorConfig: creatorConfigPda.toBase58(),
    pendingEntries: pendingEntriesPda.toBase58(),
    winnerRecord: winnerRecordPda.toBase58(),
  },
  hubCreatorCoin: config.hubCreatorCoin,
  hubShareOft: config.hubShareOft,
  signatures,
};

process.stdout.write(JSON.stringify(result) + '\n');
log('Done');
