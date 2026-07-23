/**
 * Devnet / local cost probe for Path 1 + Path 2 Solana share-mesh setup.
 *
 * Measures payer SOL spent (balance delta incl. rent + fees) without mainnet funds.
 * Rent lamports/byte matches mainnet; use local validator when devnet faucet is limited.
 *
 *   pnpm -C kpr solana:cost-probe-devnet -- --execute
 *
 * Optional env:
 *   SOLANA_DEVNET_RPC_URL          — devnet RPC (preferred when both are loaded)
 *   SOLANA_RPC_URL                 — devnet RPC (accepted when it is actually devnet/local)
 *   RPC_URL_SOLANA_TESTNET         — LayerZero alias for devnet RPC
 *   SOLANA_PRIVATE_KEY             — fallback when COST_PROBE_KEYPAIR unset
 *   COST_PROBE_KEYPAIR             — base58, JSON array, or keypair path
 *   COST_PROBE_TARGET_SOL          — funding target (default 6)
 *   COST_PROBE_HOOK_PROGRAM_KEYPAIR — path to the selected hook program-id keypair for one-time devnet hook deploy
 *   SOLANA_HOOK_PROGRAM_ID          — devnet/local-only hook program override
 *   SOLANA_HOOK_SO_PATH             — devnet/local-only matching hook binary override
 *   SKIP_PROGRAM_DEPLOY            — "1" skip Path 1 LZ-proxy program deploy
 *   SKIP_METEORA                   — "1" skip DLMM pool create
 *   SKIP_HOOK                      — "1" skip hook mint + PDA init
 *   SKIP_HOOK_DEPLOY               — "1" do not attempt hook program deploy even if keypair set
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import {
  ExtensionType,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeTransferHookInstruction,
  createMint,
  getMintLen,
} from '@solana/spl-token';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { CHAINS } from '../../config.js';
import { sendConfirmedSolanaTransaction } from '../../utils/solana.js';
const require = createRequire(import.meta.url);
const { BN } = require('@coral-xyz/anchor');
const DLMM = require('@meteora-ag/dlmm');

const __dirname = dirname(fileURLToPath(import.meta.url));
const KPR_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(KPR_ROOT, '..');
const DEFAULT_HOOK_SO = resolve(
  REPO_ROOT,
  'programs/creator-share-hook/target/deploy/creator_share_hook.so',
);
const HOOK_SO = String(process.env.SOLANA_HOOK_SO_PATH ?? '').trim() || DEFAULT_HOOK_SO;
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const HOOK_PROGRAM_ID = new PublicKey(
  String(process.env.SOLANA_HOOK_PROGRAM_ID ?? '').trim() || CHAINS.solana.programId,
);

const HOOK_PDA_RENT_BYTES = {
  creatorConfig: 501,
  pendingEntries: 12_352,
  winnerRecord: 89,
} as const;

type StepResult = {
  step: string;
  spendLamports: number;
  spendSol: number;
  signature?: string;
  note?: string;
  estimated?: boolean;
};

export type CostProbeCli = {
  help: boolean;
  execute: boolean;
  unknown: string[];
};

type LoadedPayer = {
  keypair: Keypair;
  keypairFile: string | null;
  source: 'file' | 'generated_tmp' | 'inline_env';
};

/**
 * Parse the explicit execution gate before any RPC connection or key material
 * is touched. Unknown arguments are rejected so a typo can never fall through
 * to a live devnet mutation.
 */
export function parseCostProbeArgs(args: readonly string[]): CostProbeCli {
  const help = args.includes('--help') || args.includes('-h');
  const execute = args.includes('--execute') || args.includes('--live-devnet');
  const unknown = args.filter((arg) => !['--', '--help', '-h', '--execute', '--live-devnet'].includes(arg));
  return { help, execute, unknown };
}

function printUsage(): void {
  console.log(`Solana devnet cost probe (mutating rehearsal)

Usage:
  pnpm -C kpr solana:cost-probe-devnet -- --execute

The probe is fail-closed by default. --execute (or --live-devnet) is required
after explicit operator approval and a passing read-only devnet preflight.
--help only prints this message and never contacts Solana.`);
}

function envFlag(name: string): boolean {
  return String(process.env[name] ?? '').trim() === '1';
}

function isLocalRpc(rpcUrl: string): boolean {
  return rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost');
}

function isDevnetRpc(rpcUrl: string): boolean {
  return rpcUrl.includes('devnet') || isLocalRpc(rpcUrl);
}

function redactRpcUrl(rpcUrl: string): string {
  try {
    const parsed = new URL(rpcUrl);
    // Paid providers commonly put the API key in the path. Keep only the
    // origin so operator logs can be shared without leaking credentials.
    return parsed.pathname === '/' && !parsed.search
      ? parsed.origin
      : `${parsed.origin}/<redacted>`;
  } catch {
    return '<redacted-rpc-url>';
  }
}

function loadKeypairFromRaw(raw: string): Keypair {
  if (existsSync(raw)) {
    const parsed = JSON.parse(readFileSync(raw, 'utf8')) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  }
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
  }
  return Keypair.fromSecretKey(bs58.decode(raw));
}

export function createSecureEphemeralKeypairFile(
  secretKey: Uint8Array,
  stem = 'payer',
): string {
  const directory = mkdtempSync(join(tmpdir(), '4626-devnet-cost-probe-'));
  const path = join(directory, `${stem}.json`);
  writeFileSync(path, JSON.stringify(Array.from(secretKey)), {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
  return path;
}

function resolveDevnetRpcUrl(): string {
  const explicitDevnet = String(process.env.SOLANA_DEVNET_RPC_URL ?? '').trim();
  if (explicitDevnet) return explicitDevnet;
  const explicit = String(process.env.SOLANA_RPC_URL ?? '').trim();
  if (explicit) {
    if (!isDevnetRpc(explicit)) {
      throw new Error(
        'SOLANA_RPC_URL_FOR_DEVNET_PROBE_MUST_BE_DEVNET_OR_LOCAL: set SOLANA_DEVNET_RPC_URL for a loaded mainnet SOLANA_RPC_URL',
      );
    }
    return explicit;
  }
  const lzAlias = String(process.env.RPC_URL_SOLANA_TESTNET ?? '').trim();
  if (lzAlias) return lzAlias;
  return DEFAULT_RPC;
}

function loadOrCreateKeypair(): LoadedPayer {
  const raw =
    String(process.env.COST_PROBE_KEYPAIR ?? '').trim() ||
    String(process.env.SOLANA_PRIVATE_KEY ?? '').trim();
  if (raw) {
    if (existsSync(raw)) {
      return { keypair: loadKeypairFromRaw(raw), keypairFile: raw, source: 'file' };
    }
    return { keypair: loadKeypairFromRaw(raw), keypairFile: null, source: 'inline_env' };
  }
  const kp = Keypair.generate();
  const keypairFile = createSecureEphemeralKeypairFile(kp.secretKey);
  console.warn(
    'No COST_PROBE_KEYPAIR or SOLANA_PRIVATE_KEY — generated a mode-0600 ephemeral payer. Fund devnet SOL or set COST_PROBE_KEYPAIR to an existing protected keypair path.',
  );
  return { keypair: kp, keypairFile, source: 'generated_tmp' };
}

function requirePayerKeypairFile(payer: LoadedPayer, context: string): string {
  if (payer.keypairFile) return payer.keypairFile;
  throw new Error(
    `Refusing to persist inline env key for ${context}. Set COST_PROBE_KEYPAIR to an existing keypair file instead.`,
  );
}

async function assertRpcReachable(connection: Connection, rpcUrl: string): Promise<void> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await connection.getLatestBlockhash('confirmed');
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isRateLimit = message.includes('429') || message.toLowerCase().includes('too many requests');
      if (attempt >= maxAttempts) {
        if (isRateLimit && rpcUrl.includes('api.devnet.solana.com')) {
          throw new Error(
            `Solana devnet RPC rate-limited (429). Set SOLANA_DEVNET_RPC_URL (or RPC_URL_SOLANA_TESTNET) to a paid devnet endpoint, or use SOLANA_RPC_URL=http://127.0.0.1:8899 with solana-test-validator.`,
          );
        }
        throw error;
      }
      await sleep(isRateLimit ? 4000 * attempt : 1000 * attempt);
    }
  }
}

function createProgramKeypair(): { keypair: Keypair; path: string } {
  const kp = Keypair.generate();
  return {
    keypair: kp,
    path: createSecureEphemeralKeypairFile(kp.secretKey, 'lz-proxy-program'),
  };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fundPayer(
  connection: Connection,
  rpcUrl: string,
  payer: LoadedPayer,
  targetSol: number,
): Promise<number> {
  const target = targetSol * LAMPORTS_PER_SOL;
  let bal = await connection.getBalance(payer.keypair.publicKey, 'confirmed');
  if (bal >= target) return bal;

  if (isLocalRpc(rpcUrl)) {
    if (payer.keypairFile) {
      execFileSync(
        'solana',
        [
          'airdrop',
          String(Math.ceil(targetSol)),
          payer.keypair.publicKey.toBase58(),
          '--url',
          rpcUrl,
          '--keypair',
          payer.keypairFile,
        ],
        { stdio: 'inherit' },
      );
      return connection.getBalance(payer.keypair.publicKey, 'confirmed');
    }
    const sig = await connection.requestAirdrop(
      payer.keypair.publicKey,
      Math.ceil(targetSol * LAMPORTS_PER_SOL),
    );
    await connection.confirmTransaction(sig, 'confirmed');
    return connection.getBalance(payer.keypair.publicKey, 'confirmed');
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    bal = await connection.getBalance(payer.keypair.publicKey, 'confirmed');
    if (bal >= target) return bal;
    const chunkSol = Math.min(1, targetSol - bal / LAMPORTS_PER_SOL);
    try {
      execFileSync(
        'solana',
        [
          'airdrop',
          String(chunkSol),
          payer.keypair.publicKey.toBase58(),
          '--url',
          rpcUrl,
          '--keypair',
          requirePayerKeypairFile(payer, 'devnet airdrop'),
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch {
      try {
        const sig = await connection.requestAirdrop(
          payer.keypair.publicKey,
          Math.floor(chunkSol * LAMPORTS_PER_SOL),
        );
        await connection.confirmTransaction(sig, 'confirmed');
      } catch {
        // devnet faucet rate limits — retry
      }
    }
    await sleep(4000);
  }

  return connection.getBalance(payer.keypair.publicKey, 'confirmed');
}

async function measureStep(
  connection: Connection,
  payer: PublicKey,
  step: string,
  fn: () => Promise<{ signature?: string; note?: string }>,
): Promise<StepResult> {
  const before = await connection.getBalance(payer, 'confirmed');
  const out = await fn();
  const after = await connection.getBalance(payer, 'confirmed');
  return {
    step,
    spendLamports: before - after,
    spendSol: (before - after) / LAMPORTS_PER_SOL,
    signature: out.signature,
    note: out.note,
  };
}

async function rentEstimateStep(
  connection: Connection,
  step: string,
  bytes: number,
  note: string,
): Promise<StepResult> {
  const lamports = await connection.getMinimumBalanceForRentExemption(bytes);
  return {
    step,
    spendLamports: lamports,
    spendSol: lamports / LAMPORTS_PER_SOL,
    note: `${note} (rent estimate, no tx)`,
    estimated: true,
  };
}

async function ensureHookProgramDeployed(
  connection: Connection,
  rpcUrl: string,
  payer: LoadedPayer,
): Promise<{ deployed: boolean; note?: string }> {
  const existing = await connection.getAccountInfo(HOOK_PROGRAM_ID);
  if (existing?.executable) {
    return { deployed: true, note: `hook program live at ${HOOK_PROGRAM_ID.toBase58()}` };
  }

  if (envFlag('SKIP_HOOK_DEPLOY')) {
    return {
      deployed: false,
      note: `hook program missing on cluster; set COST_PROBE_HOOK_PROGRAM_KEYPAIR to deploy ${HOOK_PROGRAM_ID.toBase58()}`,
    };
  }

  const programKeypairPath = String(process.env.COST_PROBE_HOOK_PROGRAM_KEYPAIR ?? '').trim();
  if (!programKeypairPath) {
    return {
      deployed: false,
      note: `hook program missing; provide COST_PROBE_HOOK_PROGRAM_KEYPAIR (${HOOK_PROGRAM_ID.toBase58()}) for devnet deploy`,
    };
  }

  if (!existsSync(HOOK_SO)) {
    throw new Error(`Missing hook binary: ${HOOK_SO}`);
  }

  execFileSync(
    'solana',
    [
      'program',
      'deploy',
      HOOK_SO,
      '--url',
      rpcUrl,
      '--keypair',
      requirePayerKeypairFile(payer, 'hook program deploy'),
      '--program-id',
      programKeypairPath,
      '--with-compute-unit-price',
      '100000',
    ],
    { encoding: 'utf8', stdio: 'inherit', maxBuffer: 4 * 1024 * 1024 },
  );

  const deployed = await connection.getAccountInfo(HOOK_PROGRAM_ID);
  if (!deployed?.executable) {
    throw new Error('Hook program deploy finished but program account is not executable');
  }
  return { deployed: true, note: `deployed hook to ${HOOK_PROGRAM_ID.toBase58()}` };
}

/**
 * Validate every hook-deploy input before the probe can fund a payer or touch
 * any unrelated Path-1/Meteora account. A missing or mismatched selected
 * program-id keypair is an operator/configuration error, not a reason to
 * continue with partial devnet mutations.
 */
export async function preflightHookMutationInputs(connection: Pick<Connection, 'getAccountInfo'>): Promise<void> {
  if (envFlag('SKIP_HOOK')) return

  const existing = await connection.getAccountInfo(HOOK_PROGRAM_ID, 'finalized')
  if (existing?.executable) return

  if (envFlag('SKIP_HOOK_DEPLOY')) {
    throw new Error(
      `hook_program_missing_and_skip_hook_deploy_enabled:${HOOK_PROGRAM_ID.toBase58()} (set SKIP_HOOK=1 only for a non-hook probe)`,
    )
  }

  const programKeypairPath = String(process.env.COST_PROBE_HOOK_PROGRAM_KEYPAIR ?? '').trim()
  if (!programKeypairPath) {
    throw new Error(`hook_program_missing_keypair_required:${HOOK_PROGRAM_ID.toBase58()}`)
  }
  if (!existsSync(programKeypairPath)) {
    throw new Error(`hook_program_keypair_not_found:${programKeypairPath}`)
  }
  let programKeypair: Keypair
  try {
    programKeypair = loadKeypairFromRaw(programKeypairPath)
  } catch {
    throw new Error(`hook_program_keypair_invalid:${programKeypairPath}`)
  }
  if (!programKeypair.publicKey.equals(HOOK_PROGRAM_ID)) {
    throw new Error(
      `hook_program_keypair_mismatch:${programKeypair.publicKey.toBase58()}:${HOOK_PROGRAM_ID.toBase58()}`,
    )
  }
  if (!existsSync(HOOK_SO)) {
    throw new Error(`Missing hook binary: ${HOOK_SO}`)
  }
}

async function main() {
  const cli = parseCostProbeArgs(process.argv.slice(2));
  if (cli.help) {
    printUsage();
    return;
  }
  if (cli.unknown.length > 0) {
    console.error(`Unknown cost-probe argument(s): ${cli.unknown.join(', ')}`);
    printUsage();
    process.exitCode = 2;
    return;
  }
  if (!cli.execute) {
    console.error('Refusing devnet mutation: pass --execute only after explicit approval and a passing read-only preflight.');
    process.exitCode = 2;
    return;
  }

  const rpcUrl = resolveDevnetRpcUrl();
  if (String(process.env.SOLANA_HOOK_PROGRAM_ID ?? '').trim() && !isDevnetRpc(rpcUrl)) {
    throw new Error('SOLANA_HOOK_PROGRAM_ID_OVERRIDE_REQUIRES_DEVNET_OR_LOCAL_RPC');
  }
  if (String(process.env.SOLANA_HOOK_SO_PATH ?? '').trim() && !isDevnetRpc(rpcUrl)) {
    throw new Error('SOLANA_HOOK_SO_PATH_OVERRIDE_REQUIRES_DEVNET_OR_LOCAL_RPC');
  }
  const connection = new Connection(rpcUrl, 'confirmed');
  await preflightHookMutationInputs(connection);
  const payer = loadOrCreateKeypair();
  const targetSol = Number(process.env.COST_PROBE_TARGET_SOL ?? '6');

  console.log('=== Solana share-mesh cost probe ===');
  console.log('RPC:   ', redactRpcUrl(rpcUrl));
  if (rpcUrl === DEFAULT_RPC) {
    console.log('RPC note: public devnet often 429s — set SOLANA_DEVNET_RPC_URL or RPC_URL_SOLANA_TESTNET for rehearsal.');
  }
  console.log('Cluster:', isLocalRpc(rpcUrl) ? 'local-test-validator' : isDevnetRpc(rpcUrl) ? 'devnet' : 'custom');
  console.log('Payer: ', payer.keypair.publicKey.toBase58());
  console.log('Hook:  ', HOOK_PROGRAM_ID.toBase58());
  console.log('Key:   ', payer.keypairFile ?? '<memory-only>');
  console.log();

  await assertRpcReachable(connection, rpcUrl);

  const startBal = await fundPayer(connection, rpcUrl, payer, targetSol);
  console.log(`Funded balance: ${(startBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (startBal < 2 * LAMPORTS_PER_SOL) {
    throw new Error(
      'Insufficient SOL — retry later, use SOLANA_RPC_URL=http://127.0.0.1:8899 with solana-test-validator, or set COST_PROBE_KEYPAIR with a funded wallet',
    );
  }

  const results: StepResult[] = [];

  if (!envFlag('SKIP_PROGRAM_DEPLOY')) {
    if (!existsSync(HOOK_SO)) {
      throw new Error(`Missing proxy program binary: ${HOOK_SO}`);
    }
    const { keypair: programKp, path: programKeypairPath } = createProgramKeypair();

    const r = await measureStep(connection, payer.keypair.publicKey, 'path1_lz_oft_program_proxy_deploy', async () => {
      const existing = await connection.getAccountInfo(programKp.publicKey);
      if (existing?.executable) {
        return { note: `program already deployed ${programKp.publicKey.toBase58()}` };
      }
      const out = execFileSync(
        'solana',
        [
          'program',
          'deploy',
          HOOK_SO,
          '--url',
          rpcUrl,
          '--keypair',
          requirePayerKeypairFile(payer, 'program deploy'),
          '--program-id',
          programKeypairPath,
          '--with-compute-unit-price',
          '100000',
        ],
        { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
      );
      const sigLine = out.split('\n').find((l) => l.includes('Signature:'));
      return {
        signature: sigLine?.split(':').slice(1).join(':').trim(),
        note: `323KB .so proxy for LZ OFT program rent; id ${programKp.publicKey.toBase58()}`,
      };
    });
    results.push(r);
  }

  if (!envFlag('SKIP_METEORA')) {
    const shareMintKp = Keypair.generate();
    let shareMintPubkey: PublicKey | null = null;

    const mintShare = await measureStep(connection, payer.keypair.publicKey, 'path2_meteora_mint_share', async () => {
      shareMintPubkey = await createMint(connection, payer.keypair, payer.keypair.publicKey, null, 9, shareMintKp);
      return { note: shareMintPubkey.toBase58() };
    });
    results.push(mintShare);

    const meteora = await measureStep(connection, payer.keypair.publicKey, 'path2_meteora_dlmm_pool_create', async () => {
      if (!shareMintPubkey) throw new Error('missing share mint');
      const cluster = isDevnetRpc(rpcUrl) ? 'devnet' : 'mainnet-beta';
      const programId = new PublicKey(DLMM.LBCLMM_PROGRAM_IDS[cluster]);
      const tokenMintX = shareMintPubkey;
      const tokenMintY = NATIVE_MINT;
      const [poolAddress] = DLMM.deriveCustomizablePermissionlessLbPair(
        tokenMintX,
        tokenMintY,
        programId,
      );
      const existing = await connection.getAccountInfo(poolAddress);
      if (existing) {
        return { note: `pool already exists ${poolAddress.toBase58()}` };
      }
      const tx = await DLMM.createCustomizablePermissionlessLbPair2(
        connection,
        new BN(25),
        tokenMintX,
        tokenMintY,
        new BN(0),
        new BN(100),
        DLMM.ActivationType.Timestamp,
        false,
        payer.keypair.publicKey,
        new BN(Math.floor(Date.now() / 1000)),
        false,
        { cluster },
      );
      const sig = await sendConfirmedSolanaTransaction({
        connection,
        transaction: tx,
        signers: [payer.keypair],
        commitment: 'confirmed',
      });
      return { signature: sig, note: `${poolAddress.toBase58()} (share/WSOL)` };
    });
    results.push(meteora);
  }

  if (!envFlag('SKIP_HOOK')) {
    const hookStatus = await ensureHookProgramDeployed(connection, rpcUrl, payer);
    console.log(`Hook program: ${hookStatus.note ?? 'ready'}`);
    console.log();

    if (!hookStatus.deployed) {
      const mintLen = getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.TransferHook]);
      results.push(
        await rentEstimateStep(connection, 'path2_hook_token2022_mint_rent', mintLen, 'Token-2022 mint'),
        await rentEstimateStep(
          connection,
          'path2_hook_creator_config_rent',
          HOOK_PDA_RENT_BYTES.creatorConfig,
          'CreatorConfig PDA',
        ),
        await rentEstimateStep(
          connection,
          'path2_hook_pending_entries_rent',
          HOOK_PDA_RENT_BYTES.pendingEntries,
          'PendingEntries PDA',
        ),
        await rentEstimateStep(
          connection,
          'path2_hook_winner_record_rent',
          HOOK_PDA_RENT_BYTES.winnerRecord,
          'WinnerRecord PDA',
        ),
      );
    } else {
      const configuredHookMint = String(process.env.COST_PROBE_HOOK_MINT ?? '').trim();
      let hookMint: PublicKey;
      if (configuredHookMint) {
        hookMint = new PublicKey(configuredHookMint);
        results.push({
          step: 'path2_hook_token2022_mint',
          spendLamports: 0,
          spendSol: 0,
          note: `reusing exact existing mint ${hookMint.toBase58()}`,
        });
      } else {
        const mintKp = Keypair.generate();
        const mintResult = await measureStep(connection, payer.keypair.publicKey, 'path2_hook_token2022_mint', async () => {
          const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook];
          const mintLen = getMintLen(extensions);
          const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
          const tx = new Transaction().add(
            SystemProgram.createAccount({
              fromPubkey: payer.keypair.publicKey,
              newAccountPubkey: mintKp.publicKey,
              space: mintLen,
              lamports,
              programId: TOKEN_2022_PROGRAM_ID,
            }),
            createInitializeTransferFeeConfigInstruction(
              mintKp.publicKey,
              payer.keypair.publicKey,
              payer.keypair.publicKey,
              0,
              BigInt(0),
              TOKEN_2022_PROGRAM_ID,
            ),
            createInitializeTransferHookInstruction(
              mintKp.publicKey,
              payer.keypair.publicKey,
              HOOK_PROGRAM_ID,
              TOKEN_2022_PROGRAM_ID,
            ),
            createInitializeMintInstruction(
              mintKp.publicKey,
              9,
              payer.keypair.publicKey,
              null,
              TOKEN_2022_PROGRAM_ID,
            ),
          );
          const sig = await sendConfirmedSolanaTransaction({
            connection,
            transaction: tx,
            signers: [payer.keypair, mintKp],
            commitment: 'confirmed',
          });
          return { signature: sig, note: mintKp.publicKey.toBase58() };
        });
        results.push(mintResult);
        hookMint = mintKp.publicKey;
      }

      const cluster = isDevnetRpc(rpcUrl) ? 'devnet' : 'mainnet-beta';
      const knownAmmPrograms = [new PublicKey(DLMM.LBCLMM_PROGRAM_IDS[cluster])];

      const hookPdas = await measureStep(
        connection,
        payer.keypair.publicKey,
        'path2_hook_initialize_creator_pdas',
        async () => {
          const hubCreator = '0x' + '11'.repeat(32);
          const hubShare = '0x' + '22'.repeat(32);
          const output = execFileSync(
            'pnpm',
            [
              'solana:setup-creator-full',
              '--hub-creator-coin', hubCreator,
              '--hub-share-token', hubShare,
              '--mint', hookMint.toBase58(),
              '--amm-programs', knownAmmPrograms.map((programId: PublicKey) => programId.toBase58()).join(','),
            ],
            {
              cwd: KPR_ROOT,
              encoding: 'utf8',
              env: {
                ...process.env,
                SOLANA_RPC_URL: rpcUrl,
                SOLANA_KEEPER_KEYPAIR: bs58.encode(payer.keypair.secretKey),
                SOLANA_HOOK_PROGRAM_ID: HOOK_PROGRAM_ID.toBase58(),
              },
              maxBuffer: 4 * 1024 * 1024,
            },
          );
          // pnpm/tsx may print lifecycle banners before the setup command's
          // machine-readable JSON. Parse the final JSON record only; never
          // treat a successful setup as failed because of wrapper noise.
          const jsonLine = output
            .trim()
            .split(/\r?\n/)
            .reverse()
            .find(line => line.trim().startsWith('{'));
          if (!jsonLine) throw new Error('setup_creator_full_missing_json');
          const result = JSON.parse(jsonLine) as { signatures?: string[]; idempotent?: boolean };
          const signatures = Array.isArray(result.signatures) ? result.signatures : [];
          return {
            signature: signatures.at(-1),
            note: result.idempotent ? 'exact-mint setup already verified' : 'exact-mint setup via provisioner script',
          };
        },
      );
      results.push(hookPdas);
    }
  }

  const endBal = await connection.getBalance(payer.keypair.publicKey, 'confirmed');
  const totalSpend = startBal - endBal;

  console.log('\n--- Step costs (payer balance delta unless marked estimated) ---');
  for (const r of results) {
    const est = r.estimated ? ' [estimated]' : '';
    console.log(
      `${r.step.padEnd(42)} ${r.spendSol.toFixed(6)} SOL${est}${r.note ? `  (${r.note})` : ''}${r.signature ? `  sig=${r.signature.slice(0, 20)}…` : ''}`,
    );
  }

  const measured = results.filter((r) => !r.estimated);
  const estimated = results.filter((r) => r.estimated);
  const path1 = measured.filter((r) => r.step.startsWith('path1_')).reduce((a, r) => a + r.spendSol, 0);
  const path2Measured = measured.filter((r) => r.step.startsWith('path2_')).reduce((a, r) => a + r.spendSol, 0);
  const path2Estimated = estimated.filter((r) => r.step.startsWith('path2_')).reduce((a, r) => a + r.spendSol, 0);

  console.log('\n--- Totals ---');
  console.log(`Path 1 (LZ program proxy):     ${path1.toFixed(4)} SOL`);
  console.log(`Path 2 measured (tx):          ${path2Measured.toFixed(4)} SOL`);
  if (path2Estimated > 0) {
    console.log(`Path 2 estimated (rent only):  ${path2Estimated.toFixed(4)} SOL`);
    console.log(`Path 2 combined (meas + est):    ${(path2Measured + path2Estimated).toFixed(4)} SOL`);
  }
  console.log(`Combined measured tx spend:    ${(path1 + path2Measured).toFixed(4)} SOL`);
  console.log(`Wallet start:                  ${(startBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Wallet end:                    ${(endBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`Total wallet delta:              ${(totalSpend / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log('\nNotes:');
  console.log('- Path 1 uses 323KB hook .so as LZ OFT program size proxy (560KB mainnet LZ OFT ≈ 3.99 SOL rent).');
  console.log('- Hook tx steps require creator-share-hook at', HOOK_PROGRAM_ID.toBase58(), 'on the target cluster.');
  console.log('- Devnet hook is not deployed by default; set COST_PROBE_HOOK_PROGRAM_KEYPAIR or deploy via anchor.');
  console.log('- Meteora pool uses share/WSOL pair (matches kpr/scripts/solana/launch/create-dlmm-pool.ts).');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
