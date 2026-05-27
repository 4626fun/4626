/**
 * Devnet / local cost probe for Path 1 + Path 2 Solana share-mesh setup.
 *
 * Measures payer SOL spent (balance delta incl. rent + fees) without mainnet funds.
 * Rent lamports/byte matches mainnet; use local validator when devnet faucet is limited.
 *
 *   pnpm -C kpr solana:cost-probe-devnet
 *
 * Optional env:
 *   SOLANA_RPC_URL                 — default https://api.devnet.solana.com
 *   COST_PROBE_KEYPAIR             — base58, JSON array, or keypair path
 *   COST_PROBE_TARGET_SOL          — funding target (default 6)
 *   COST_PROBE_HOOK_PROGRAM_KEYPAIR — path to Ejpzi program id keypair for one-time devnet hook deploy
 *   SKIP_PROGRAM_DEPLOY            — "1" skip Path 1 LZ-proxy program deploy
 *   SKIP_METEORA                   — "1" skip DLMM pool create
 *   SKIP_HOOK                      — "1" skip hook mint + PDA init
 *   SKIP_HOOK_DEPLOY               — "1" do not attempt hook program deploy even if keypair set
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor';
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
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';

import { CHAINS } from '../../config.js';
import idl from '../../../programs/creator-share-hook/target/idl/creator_share_hook.json' with {
  type: 'json',
};

const require = createRequire(import.meta.url);
const DLMM = require('@meteora-ag/dlmm');
const { BN } = require('@coral-xyz/anchor');

const __dirname = dirname(fileURLToPath(import.meta.url));
const KPR_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(KPR_ROOT, '..');
const HOOK_SO = resolve(
  REPO_ROOT,
  'programs/creator-share-hook/target/deploy/creator_share_hook.so',
);
const DEFAULT_RPC = 'https://api.devnet.solana.com';
const KEYPAIR_FILE = '/tmp/4626-devnet-cost-probe.json';
const LZ_PROXY_PROGRAM_KEYPAIR_FILE = '/tmp/4626-devnet-lz-proxy-program.json';
const HOOK_PROGRAM_ID = new PublicKey(CHAINS.solana.programId);

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

function envFlag(name: string): boolean {
  return String(process.env[name] ?? '').trim() === '1';
}

function isLocalRpc(rpcUrl: string): boolean {
  return rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost');
}

function isDevnetRpc(rpcUrl: string): boolean {
  return rpcUrl.includes('devnet') || isLocalRpc(rpcUrl);
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

function loadOrCreateKeypair(): Keypair {
  const raw = String(process.env.COST_PROBE_KEYPAIR ?? '').trim();
  if (raw) return loadKeypairFromRaw(raw);
  if (existsSync(KEYPAIR_FILE)) {
    return loadKeypairFromRaw(KEYPAIR_FILE);
  }
  const kp = Keypair.generate();
  writeFileSync(KEYPAIR_FILE, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

function loadOrCreateProgramKeypair(path: string): Keypair {
  if (existsSync(path)) {
    return loadKeypairFromRaw(path);
  }
  const kp = Keypair.generate();
  writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fundPayer(
  connection: Connection,
  rpcUrl: string,
  payer: Keypair,
  targetSol: number,
): Promise<number> {
  const target = targetSol * LAMPORTS_PER_SOL;
  let bal = await connection.getBalance(payer.publicKey, 'confirmed');
  if (bal >= target) return bal;

  if (isLocalRpc(rpcUrl)) {
    execFileSync(
      'solana',
      [
        'airdrop',
        String(Math.ceil(targetSol)),
        payer.publicKey.toBase58(),
        '--url',
        rpcUrl,
        '--keypair',
        KEYPAIR_FILE,
      ],
      { stdio: 'inherit' },
    );
    return connection.getBalance(payer.publicKey, 'confirmed');
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    bal = await connection.getBalance(payer.publicKey, 'confirmed');
    if (bal >= target) return bal;
    const chunkSol = Math.min(1, targetSol - bal / LAMPORTS_PER_SOL);
    try {
      execFileSync(
        'solana',
        [
          'airdrop',
          String(chunkSol),
          payer.publicKey.toBase58(),
          '--url',
          rpcUrl,
          '--keypair',
          KEYPAIR_FILE,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch {
      try {
        const sig = await connection.requestAirdrop(
          payer.publicKey,
          Math.floor(chunkSol * LAMPORTS_PER_SOL),
        );
        await connection.confirmTransaction(sig, 'confirmed');
      } catch {
        // devnet faucet rate limits — retry
      }
    }
    await sleep(4000);
  }

  return connection.getBalance(payer.publicKey, 'confirmed');
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
  payer: Keypair,
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
      KEYPAIR_FILE,
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

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? DEFAULT_RPC;
  const connection = new Connection(rpcUrl, 'confirmed');
  const payer = loadOrCreateKeypair();
  const targetSol = Number(process.env.COST_PROBE_TARGET_SOL ?? '6');

  console.log('=== Solana share-mesh cost probe ===');
  console.log('RPC:   ', rpcUrl);
  console.log('Cluster:', isLocalRpc(rpcUrl) ? 'local-test-validator' : isDevnetRpc(rpcUrl) ? 'devnet' : 'custom');
  console.log('Payer: ', payer.publicKey.toBase58());
  console.log('Hook:  ', HOOK_PROGRAM_ID.toBase58());
  console.log('Key:   ', KEYPAIR_FILE);
  console.log();

  writeFileSync(KEYPAIR_FILE, JSON.stringify(Array.from(payer.secretKey)));

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
    const programKp = loadOrCreateProgramKeypair(LZ_PROXY_PROGRAM_KEYPAIR_FILE);

    const r = await measureStep(connection, payer.publicKey, 'path1_lz_oft_program_proxy_deploy', async () => {
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
          KEYPAIR_FILE,
          '--program-id',
          LZ_PROXY_PROGRAM_KEYPAIR_FILE,
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

    const mintShare = await measureStep(connection, payer.publicKey, 'path2_meteora_mint_share', async () => {
      shareMintPubkey = await createMint(connection, payer, payer.publicKey, null, 9, shareMintKp);
      return { note: shareMintPubkey.toBase58() };
    });
    results.push(mintShare);

    const meteora = await measureStep(connection, payer.publicKey, 'path2_meteora_dlmm_pool_create', async () => {
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
        payer.publicKey,
        new BN(Math.floor(Date.now() / 1000)),
        false,
        { cluster },
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: 'confirmed' });
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
      const mintKp = Keypair.generate();
      const hookMint = await measureStep(connection, payer.publicKey, 'path2_hook_token2022_mint', async () => {
        const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook];
        const mintLen = getMintLen(extensions);
        const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);
        const tx = new Transaction().add(
          SystemProgram.createAccount({
            fromPubkey: payer.publicKey,
            newAccountPubkey: mintKp.publicKey,
            space: mintLen,
            lamports,
            programId: TOKEN_2022_PROGRAM_ID,
          }),
          createInitializeTransferFeeConfigInstruction(
            mintKp.publicKey,
            payer.publicKey,
            payer.publicKey,
            0,
            BigInt(0),
            TOKEN_2022_PROGRAM_ID,
          ),
          createInitializeTransferHookInstruction(
            mintKp.publicKey,
            payer.publicKey,
            HOOK_PROGRAM_ID,
            TOKEN_2022_PROGRAM_ID,
          ),
          createInitializeMintInstruction(
            mintKp.publicKey,
            9,
            payer.publicKey,
            null,
            TOKEN_2022_PROGRAM_ID,
          ),
        );
        const sig = await sendAndConfirmTransaction(connection, tx, [payer, mintKp], {
          commitment: 'confirmed',
        });
        return { signature: sig, note: mintKp.publicKey.toBase58() };
      });
      results.push(hookMint);

      const wallet = new Wallet(payer);
      const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
      const program = new Program(idl as any, provider);

      const cluster = isDevnetRpc(rpcUrl) ? 'devnet' : 'mainnet-beta';
      const knownAmmPrograms = [new PublicKey(DLMM.LBCLMM_PROGRAM_IDS[cluster])];

      const hookPdas = await measureStep(
        connection,
        payer.publicKey,
        'path2_hook_initialize_creator_pdas',
        async () => {
          const hubCreator = '0x' + '11'.repeat(32);
          const hubShare = '0x' + '22'.repeat(32);
          const hexToBytes32 = (hex: string): number[] => {
            const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
            const bytes: number[] = [];
            for (let i = 0; i < 64; i += 2) bytes.push(parseInt(clean.substring(i, i + 2), 16));
            return bytes;
          };
          const sig = await program.methods
            .initializeCreator({
              keeperAuthority: payer.publicKey,
              hubCreatorCoin: hexToBytes32(hubCreator),
              hubShareOft: hexToBytes32(hubShare),
              feeBps: 0,
              settlementThreshold: new (require('@coral-xyz/anchor').BN)(0),
              lotteryEnabled: true,
              knownAmmPrograms,
            })
            .accounts({ creatorMint: mintKp.publicKey })
            .rpc();
          return { signature: sig };
        },
      );
      results.push(hookPdas);

      const extraMeta = await measureStep(
        connection,
        payer.publicKey,
        'path2_hook_extra_account_meta_list',
        async () => {
          const sig = await program.methods
            .initializeExtraAccountMetaList()
            .accounts({ mint: mintKp.publicKey })
            .rpc();
          return { signature: sig };
        },
      );
      results.push(extraMeta);
    }
  }

  const endBal = await connection.getBalance(payer.publicKey, 'confirmed');
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

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
