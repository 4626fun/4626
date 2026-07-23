/**
 * Full Solana-side creator setup: verify an existing Token-2022 mint, then
 * initialize its hook PDAs + extra-account-meta list.
 *
 * Called by the Solana provisioner (`POST /setup-creator`) for the lottery hook
 * lane. Outputs JSON to stdout for programmatic consumption; all human-readable
 * logs go to stderr.
 *
 * Usage:
 *   tsx scripts/solana/deploy/setup-creator-full.ts \
 *     --hub-creator-coin 0x... \
 *     --hub-share-token 0x... \
 *     --mint <token-2022-mint> \
 *     [--keeper-pubkey <base58>] \
 *     [--fee-bps 0] \
 *     [--decimals 9] \
 *     [--amm-programs <pubkey1>,<pubkey2>]
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer + authority keypair (base58 or JSON array)
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *
 * Output (JSON to stdout):
 *   { "mint": "<base58>", "mintBytes32": "0x...", "pdas": { ... }, "signatures": [...] }
 *
 * This command deliberately does not create a mint. The mint must already be
 * the mapped share-mesh mint; creating a second mint would make the Base OFT
 * mapping and the Meteora pool diverge. A partially initialized mint fails
 * closed unless it is the known, verifiable post-initializeCreator shell; that
 * shell can safely resume the program's deterministic finalize/extra-meta
 * steps after an RPC timeout.
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getTransferFeeConfig,
  getTransferHook,
} from '@solana/spl-token';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import BN from 'bn.js';
import { loadKeeperKeypair } from '../../../utils/solana.js';
import { CHAINS } from '../../../config.js';

import idl from '../../../../programs/creator-share-hook/target/idl/creator_share_hook.json' with { type: 'json' };

// ---------------------------------------------------------------------------
// Parse CLI arguments
// ---------------------------------------------------------------------------

function parseArgs(): {
  hubCreatorCoin: string;
  hubShareToken: string;
  mint: string;
  keeperPubkey: string | null;
  feeBps: number;
  decimals: number;
  ammPrograms: string[];
  settlementThreshold: string;
  lotteryEnabled: boolean;
} {
  const defaultMeteoraDlmmProgram =
    String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() ||
    'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo';
  const args = process.argv.slice(2);
  let hubCreatorCoin = '';
  let hubShareToken = '';
  let mint = '';
  let keeperPubkey: string | null = null;
  let feeBps = 0;
  let decimals = 9;
  let ammPrograms: string[] = [defaultMeteoraDlmmProgram];
  let settlementThreshold = '0';
  let lotteryEnabled = true;

  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case '--hub-creator-coin':
        hubCreatorCoin = args[++i] ?? '';
        break;
      case '--hub-share-token':
        hubShareToken = args[++i] ?? '';
        break;
      case '--mint':
        mint = args[++i] ?? '';
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
      case '--settlement-threshold':
        settlementThreshold = args[++i] ?? '0';
        break;
      case '--lottery-disabled':
        lotteryEnabled = false;
        break;
    }
  }

  if (!hubCreatorCoin || !hubShareToken || !mint) {
    process.stderr.write('error: --hub-creator-coin, --hub-share-token and --mint are required\n');
    process.exit(1);
  }

  return {
    hubCreatorCoin,
    hubShareToken,
    mint,
    keeperPubkey,
    feeBps,
    decimals,
    ammPrograms,
    settlementThreshold,
    lotteryEnabled,
  };
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

function bytesEqual(left: Uint8Array, right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function readAdapterModeHint(): 'regular-oft' | 'oft-adapter' {
  const raw = String(process.env.SOLANA_OVAULT_ADAPTER_MODE ?? '').trim().toLowerCase();
  if (raw === 'oft-adapter' || raw === 'adapter') return 'oft-adapter';
  return 'regular-oft';
}

function canonicalMeteoraDlmmProgram(): string {
  return (
    String(process.env.SOLANA_METEORA_DLMM_PROGRAM_ID ?? '').trim() ||
    'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo'
  )
}

function enforceCanonicalAmmPrograms(values: string[]): string[] {
  const canonical = new PublicKey(canonicalMeteoraDlmmProgram()).toBase58()
  const normalized = values.map((value) => new PublicKey(value).toBase58())
  if (normalized.some((value) => value !== canonical)) {
    throw new Error(`unsupported_amm_program:${normalized.find((value) => value !== canonical)}`)
  }
  return [canonical]
}

function log(msg: string): void {
  process.stderr.write(`[setup-creator-full] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const config = parseArgs();
config.ammPrograms = enforceCanonicalAmmPrograms(config.ammPrograms);
if (config.feeBps !== 0) {
  process.stderr.write(
    'error: TransferHook mint setup requires --fee-bps 0 for OVault compatibility.\n',
  );
  process.exit(1);
}
if (readAdapterModeHint() === 'oft-adapter') {
  process.stderr.write(
    'error: TransferHook mints must use regular-oft mode; oft-adapter is not allowed.\n',
  );
  process.exit(1);
}
const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const connection = new Connection(rpcUrl, 'finalized');
const payer = loadKeeperKeypair();
const wallet = new Wallet(payer);
const provider = new AnchorProvider(connection, wallet, { commitment: 'finalized' });

const configuredHookProgramId = String(process.env.SOLANA_HOOK_PROGRAM_ID ?? '').trim();
const nonMainnetRpc = /(?:devnet|testnet|localhost|127\.0\.0\.1)/i.test(rpcUrl);
if (configuredHookProgramId && !nonMainnetRpc) {
  throw new Error('SOLANA_HOOK_PROGRAM_ID_OVERRIDE_FORBIDDEN_ON_MAINNET');
}
const hookProgramId = new PublicKey(configuredHookProgramId || CHAINS.solana.programId);
const hookProgramAccount = await connection.getAccountInfo(hookProgramId, 'finalized');
if (!hookProgramAccount?.executable) {
  throw new Error('hook_program_not_executable');
}
const programIdl = configuredHookProgramId
  ? { ...(idl as any), address: hookProgramId.toBase58() }
  : idl;
const program = new Program(programIdl as any, provider);

const keeperPubkey = config.keeperPubkey
  ? new PublicKey(config.keeperPubkey)
  : payer.publicKey;

const signatures: string[] = [];

async function confirmSignatureOverHttp(signature: string, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = (await connection.getSignatureStatuses([signature])).value[0];
    if (status?.err) {
      throw new Error(`solana_transaction_failed:${signature}:${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === 'finalized') return;
    if (Date.now() >= deadline) {
      throw new Error(`solana_transaction_confirmation_timeout:${signature}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1_500));
  }
}

async function sendAnchorTransaction(methodBuilder: any): Promise<string> {
  // Anchor's `.rpc()` waits on signatureSubscribe. Some paid HTTP RPC
  // providers intentionally omit WebSocket methods, so send the fully-built
  // instruction directly and confirm through HTTP status polling instead.
  const transaction = await methodBuilder.transaction();
  const latestBlockhash = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = payer.publicKey;
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
  transaction.sign(payer);
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    preflightCommitment: 'confirmed',
  });
  await confirmSignatureOverHttp(signature);
  return signature;
}

const mint = new PublicKey(config.mint);
const [creatorConfigPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('creator_config'), mint.toBuffer()],
  hookProgramId,
);
const [pendingEntriesPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('pending_entries'), mint.toBuffer()],
  hookProgramId,
);
const [winnerRecordPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('winner_record'), mint.toBuffer()],
  hookProgramId,
);
const [extraAccountMetaListPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('extra-account-metas'), mint.toBuffer()],
  hookProgramId,
);

const CANONICAL_SETUP_ACCOUNT_SIZES = {
  creatorConfig: 501,
  pendingEntriesShell: 10_240,
  pendingEntries: 12_352,
  winnerRecord: 89,
  extraAccountMetaList: 86,
} as const;

// ---------------------------------------------------------------------------
// Step 1: Verify the mapped Token-2022 mint and existing setup state
// ---------------------------------------------------------------------------

log(`Step 1: Verifying existing Token-2022 mint ${mint.toBase58()}`);

const mintAccount = await connection.getAccountInfo(mint, 'finalized');
if (!mintAccount || !mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)) {
  throw new Error('hook_mint_missing_or_not_token_2022');
}
const mintState = await getMint(connection, mint, 'finalized', TOKEN_2022_PROGRAM_ID);
if (mintState.decimals !== config.decimals) {
  throw new Error(`hook_mint_decimals_mismatch:${mintState.decimals}:${config.decimals}`);
}
if (!mintState.mintAuthority || !mintState.mintAuthority.equals(payer.publicKey)) {
  throw new Error('hook_mint_authority_not_payer');
}
const transferHook = getTransferHook(mintState);
if (!transferHook || !transferHook.programId.equals(hookProgramId)) {
  throw new Error(`hook_mint_transfer_hook_mismatch:${transferHook?.programId.toBase58() ?? 'missing'}`);
}
const transferFees = getTransferFeeConfig(mintState);
if (!transferFees || transferFees.olderTransferFee.transferFeeBasisPoints !== 0 || transferFees.newerTransferFee.transferFeeBasisPoints !== 0) {
  throw new Error('hook_mint_transfer_fee_not_zero');
}

const setupAddresses = [creatorConfigPda, pendingEntriesPda, winnerRecordPda, extraAccountMetaListPda];
const setupAccounts = await connection.getMultipleAccountsInfo(setupAddresses, 'finalized');
const presentCount = setupAccounts.filter(Boolean).length;
let alreadyInitialized = presentCount === setupAddresses.length;
let resumedPartial = false;
let pendingNeedsFinalize = false;
let extraMetaNeedsInit = false;

const verifyExistingCreatorConfig = async (): Promise<void> => {
  const existingConfig = await (program.account as any).creatorConfig.fetch(creatorConfigPda);
  const configuredAmmPrograms = (existingConfig.knownAmmPrograms ?? [])
    .slice(0, Number(existingConfig.ammProgramCount ?? 0))
    .map((value: PublicKey) => value.toBase58());
  const expectedAmmPrograms = config.ammPrograms.map((value) => new PublicKey(value).toBase58());
  if (
    !existingConfig.creatorMint.equals(mint) ||
    !existingConfig.keeperAuthority.equals(keeperPubkey) ||
    !bytesEqual(existingConfig.hubCreatorCoin, hexToBytes32(config.hubCreatorCoin)) ||
    !bytesEqual(existingConfig.hubShareOft, hexToBytes32(config.hubShareToken)) ||
    Number(existingConfig.feeBps) !== config.feeBps ||
    String(existingConfig.settlementThreshold) !== config.settlementThreshold ||
    Boolean(existingConfig.lotteryEnabled) !== config.lotteryEnabled ||
    configuredAmmPrograms.length !== expectedAmmPrograms.length ||
    configuredAmmPrograms.some((value, index) => value !== expectedAmmPrograms[index])
  ) {
    throw new Error('existing_creator_config_mismatch');
  }
};

function verifyExistingSetupAccountShapes(accounts: Array<Awaited<ReturnType<Connection['getAccountInfo']>>>): void {
  const [creatorAccount, pendingAccount, winnerAccount, extraAccount] = accounts;
  if (!creatorAccount || !pendingAccount || !winnerAccount || !extraAccount) {
    throw new Error('existing_creator_setup_accounts_missing');
  }
  if (creatorAccount.data.length !== CANONICAL_SETUP_ACCOUNT_SIZES.creatorConfig) {
    throw new Error(`existing_creator_config_invalid_size:${creatorAccount.data.length}`);
  }
  if (pendingAccount.data.length !== CANONICAL_SETUP_ACCOUNT_SIZES.pendingEntries) {
    throw new Error(`existing_pending_entries_not_finalized:${pendingAccount.data.length}`);
  }
  if (winnerAccount.data.length !== CANONICAL_SETUP_ACCOUNT_SIZES.winnerRecord) {
    throw new Error(`existing_winner_record_invalid_size:${winnerAccount.data.length}`);
  }
  if (extraAccount.data.length !== CANONICAL_SETUP_ACCOUNT_SIZES.extraAccountMetaList) {
    throw new Error(`existing_extra_account_meta_invalid_size:${extraAccount.data.length}`);
  }
};

if (alreadyInitialized) {
  for (const account of setupAccounts) {
    if (!account || !account.owner.equals(hookProgramId)) {
      throw new Error('existing_creator_setup_wrong_owner');
    }
  }
  verifyExistingSetupAccountShapes(setupAccounts);
  await verifyExistingCreatorConfig();
  log('  Existing hook PDAs and extra-account-meta list verified; no transactions needed');
} else if (presentCount > 0) {
  // The only resumable partial state is the deterministic shell left after a
  // successful initializeCreator: CreatorConfig + PendingEntries + WinnerRecord
  // exist, all are owned by this hook, and the extra-meta PDA is not present.
  // Anything else is ambiguous and remains fail-closed.
  const [creatorAccount, pendingAccount, winnerAccount, extraAccount] = setupAccounts;
  if (!creatorAccount || !pendingAccount || !winnerAccount || extraAccount) {
    throw new Error('existing_creator_setup_partial');
  }
  for (const account of [creatorAccount, pendingAccount, winnerAccount]) {
    if (!account.owner.equals(hookProgramId)) {
      throw new Error('existing_creator_setup_wrong_owner');
    }
  }
  if (creatorAccount.data.length !== CANONICAL_SETUP_ACCOUNT_SIZES.creatorConfig) {
    throw new Error(`existing_creator_config_invalid_size:${creatorAccount.data.length}`);
  }
  if (pendingAccount.data.length !== 10_240 && pendingAccount.data.length !== 12_352) {
    throw new Error(`existing_pending_entries_invalid_size:${pendingAccount.data.length}`);
  }
  if (winnerAccount.data.length !== CANONICAL_SETUP_ACCOUNT_SIZES.winnerRecord) {
    throw new Error(`existing_winner_record_invalid_size:${winnerAccount.data.length}`);
  }
  await verifyExistingCreatorConfig();
  resumedPartial = true;
  pendingNeedsFinalize = pendingAccount.data.length === 10_240;
  extraMetaNeedsInit = true;
  log(
    `  Resuming verified partial setup (pending ${pendingAccount.data.length} bytes; ` +
      `${pendingNeedsFinalize ? 'finalize required' : 'already finalized'})`,
  );
} else {
  pendingNeedsFinalize = true;
  extraMetaNeedsInit = true;
}

// ---------------------------------------------------------------------------
// Step 2: Initialize Creator PDAs
// ---------------------------------------------------------------------------

if (!alreadyInitialized) {
  log('Step 2: Initializing creator PDAs (CreatorConfig + PendingEntries + WinnerRecord)');

  if (!resumedPartial) {
    const ammProgramPubkeys = config.ammPrograms.map(s => new PublicKey(s));

    const initSig = await sendAnchorTransaction(program.methods
      .initializeCreator({
        keeperAuthority: keeperPubkey,
        hubCreatorCoin: hexToBytes32(config.hubCreatorCoin),
        hubShareOft: hexToBytes32(config.hubShareToken),
        feeBps: config.feeBps,
        settlementThreshold: new BN(config.settlementThreshold),
        lotteryEnabled: config.lotteryEnabled,
        knownAmmPrograms: ammProgramPubkeys,
      })
      .accounts({ creatorMint: mint }));

    signatures.push(initSig);
    log(`  PDAs initialized (sig: ${initSig})`);
  }

  if (pendingNeedsFinalize) {
    log('Step 2b: Finalizing PendingEntries (10KiB shell → full 12352-byte ring)');
    const finalizeSig = await sendAnchorTransaction(program.methods
      .finalizePendingEntries()
      .accounts({ creatorMint: mint }));
    signatures.push(finalizeSig);
    log(`  PendingEntries finalized (sig: ${finalizeSig})`);
  }

  // -------------------------------------------------------------------------
  // Step 3: Initialize Extra Account Meta List (required for Transfer Hook)
  // -------------------------------------------------------------------------

  if (extraMetaNeedsInit) {
    log('Step 3: Initializing extra account meta list');

    const extraMetaSig = await sendAnchorTransaction(program.methods
      .initializeExtraAccountMetaList()
      .accounts({ mint }));

    signatures.push(extraMetaSig);
    log(`  Extra account meta list initialized (sig: ${extraMetaSig})`);
  }
}

// Never report a successful mutation until every account is visible at the
// finalized commitment and the canonical CreatorConfig bytes match the exact
// mint/creator/share mapping requested by the caller. A timeout or partial
// readback therefore remains a failed provisioning attempt and is safe to
// reconcile idempotently on the next call.
const finalizedSetupAccounts = await connection.getMultipleAccountsInfo(setupAddresses, 'finalized');
for (const account of finalizedSetupAccounts) {
  if (!account || !account.owner.equals(hookProgramId)) {
    throw new Error('finalized_creator_setup_readback_missing_or_wrong_owner');
  }
}
verifyExistingSetupAccountShapes(finalizedSetupAccounts);
await verifyExistingCreatorConfig();
log('  Finalized hook PDA/config readback verified');

// ---------------------------------------------------------------------------
// Derive PDA addresses for output
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Output JSON to stdout
// ---------------------------------------------------------------------------

const result = {
  success: true,
  mint: mint.toBase58(),
  mintBytes32: pubkeyToBytes32Hex(mint),
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
  hubShareToken: config.hubShareToken,
  mintCompatibilityHints: {
    tokenProgram: 'token-2022',
    transferHookDetected: true,
    oftFeeBps: config.feeBps,
    adapterMode: readAdapterModeHint(),
    authorityCompatible: true,
    rentValueLamports: '0',
  },
  idempotent: alreadyInitialized,
  resumedPartial,
  signatures,
};

process.stdout.write(JSON.stringify(result) + '\n');
log('Done');
