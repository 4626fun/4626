/**
 * Repeatable correctness harness for solana-share-mesh cost probe assumptions.
 *
 *   pnpm -C kpr solana:cost-probe-validate
 *   COST_PROBE_VALIDATE_ITERATIONS=1000 pnpm -C kpr solana:cost-probe-validate
 *
 * Phases (same RPC, no mainnet SOL):
 *   1. Rent lamports for fixed byte sizes — must be identical every iteration
 *   2. Path 1 program deploy — fresh program id each iteration; spend must match golden rent
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ExtensionType, getMintLen } from '@solana/spl-token';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const HOOK_SO = resolve(
  REPO_ROOT,
  'programs/creator-share-hook/target/deploy/creator_share_hook.so',
);
const KEYPAIR_FILE = '/tmp/4626-devnet-cost-probe.json';
const DEFAULT_RPC = 'http://127.0.0.1:8899';

const ITERATIONS = Math.max(1, Number(process.env.COST_PROBE_VALIDATE_ITERATIONS ?? '1000'));
const RPC_URL = process.env.SOLANA_RPC_URL ?? DEFAULT_RPC;

/** Golden rent lamports from local validator / solana 3.0.15 (2026-05-27 probe). */
const GOLDEN_RENT_LAMPORTS: Record<string, number> = {
  hookMint: 0, // filled at startup via getMintLen
  creatorConfig: 0,
  pendingEntries: 0,
  winnerRecord: 0,
  lzProxy323Kb: 0,
  lzOft560Kb: 0,
};

const HOOK_BYTES = {
  creatorConfig: 501,
  pendingEntries: 12_352,
  winnerRecord: 89,
} as const;

const LZ_PROXY_BYTES = 323_432;
const LZ_OFT_BYTES = 560 * 1024;

function loadPayer(): Keypair {
  if (!existsSync(KEYPAIR_FILE)) {
    throw new Error(`Missing ${KEYPAIR_FILE} — run cost probe once or create keypair`);
  }
  const parsed = JSON.parse(readFileSync(KEYPAIR_FILE, 'utf8')) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

function assertEq(label: string, actual: number, expected: number, iteration: number) {
  if (actual !== expected) {
    throw new Error(`${label} iteration ${iteration}: expected ${expected} lamports, got ${actual}`);
  }
}

async function fundIfNeeded(connection: Connection, payer: Keypair, minSol: number) {
  const min = minSol * LAMPORTS_PER_SOL;
  const bal = await connection.getBalance(payer.publicKey, 'confirmed');
  if (bal >= min) return;
  execFileSync(
    'solana',
    [
      'airdrop',
      String(Math.ceil(minSol)),
      payer.publicKey.toBase58(),
      '--url',
      RPC_URL,
      '--keypair',
      KEYPAIR_FILE,
    ],
    { stdio: 'inherit' },
  );
}

async function fillGoldenRent(connection: Connection) {
  const mintLen = getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.TransferHook]);
  GOLDEN_RENT_LAMPORTS.hookMint = await connection.getMinimumBalanceForRentExemption(mintLen);
  GOLDEN_RENT_LAMPORTS.creatorConfig = await connection.getMinimumBalanceForRentExemption(
    HOOK_BYTES.creatorConfig,
  );
  GOLDEN_RENT_LAMPORTS.pendingEntries = await connection.getMinimumBalanceForRentExemption(
    HOOK_BYTES.pendingEntries,
  );
  GOLDEN_RENT_LAMPORTS.winnerRecord = await connection.getMinimumBalanceForRentExemption(
    HOOK_BYTES.winnerRecord,
  );
  GOLDEN_RENT_LAMPORTS.lzProxy323Kb = await connection.getMinimumBalanceForRentExemption(LZ_PROXY_BYTES);
  GOLDEN_RENT_LAMPORTS.lzOft560Kb = await connection.getMinimumBalanceForRentExemption(LZ_OFT_BYTES);
}

async function phaseRentConsistency(connection: Connection, iterations: number) {
  const mintLen = getMintLen([ExtensionType.TransferFeeConfig, ExtensionType.TransferHook]);
  for (let i = 1; i <= iterations; i += 1) {
    assertEq(
      'hookMint rent',
      await connection.getMinimumBalanceForRentExemption(mintLen),
      GOLDEN_RENT_LAMPORTS.hookMint,
      i,
    );
    assertEq(
      'creatorConfig rent',
      await connection.getMinimumBalanceForRentExemption(HOOK_BYTES.creatorConfig),
      GOLDEN_RENT_LAMPORTS.creatorConfig,
      i,
    );
    assertEq(
      'pendingEntries rent',
      await connection.getMinimumBalanceForRentExemption(HOOK_BYTES.pendingEntries),
      GOLDEN_RENT_LAMPORTS.pendingEntries,
      i,
    );
    assertEq(
      'winnerRecord rent',
      await connection.getMinimumBalanceForRentExemption(HOOK_BYTES.winnerRecord),
      GOLDEN_RENT_LAMPORTS.winnerRecord,
      i,
    );
    assertEq(
      'lzProxy323Kb rent',
      await connection.getMinimumBalanceForRentExemption(LZ_PROXY_BYTES),
      GOLDEN_RENT_LAMPORTS.lzProxy323Kb,
      i,
    );
    assertEq(
      'lzOft560Kb rent',
      await connection.getMinimumBalanceForRentExemption(LZ_OFT_BYTES),
      GOLDEN_RENT_LAMPORTS.lzOft560Kb,
      i,
    );
    if (i % 100 === 0 || i === iterations) {
      process.stderr.write(`  rent checks: ${i}/${iterations}\n`);
    }
  }
}

async function phaseDeployConsistency(
  connection: Connection,
  payer: Keypair,
  iterations: number,
  deployFundSol: number,
) {
  if (!existsSync(HOOK_SO)) {
    throw new Error(`Missing ${HOOK_SO}`);
  }

  const spends: number[] = [];
  const rentFloor = GOLDEN_RENT_LAMPORTS.lzProxy323Kb;
  // Deploy spend = program data rent + buffer rent + tx fee; fee is small vs rent.
  const maxFeeSlack = 5_000_000; // 0.005 SOL

  for (let i = 1; i <= iterations; i += 1) {
    const programKp = Keypair.generate();
    const programKeyFile = `/tmp/4626-cost-validate-program-${i}.json`;
    writeFileSync(programKeyFile, JSON.stringify(Array.from(programKp.secretKey)));

    const before = await connection.getBalance(payer.publicKey, 'confirmed');
    execFileSync(
      'solana',
      [
        'program',
        'deploy',
        HOOK_SO,
        '--url',
        RPC_URL,
        '--keypair',
        KEYPAIR_FILE,
        '--program-id',
        programKeyFile,
        '--with-compute-unit-price',
        '100000',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4 * 1024 * 1024 },
    );
    const after = await connection.getBalance(payer.publicKey, 'confirmed');
    const spend = before - after;
    spends.push(spend);

    if (spend < rentFloor || spend > rentFloor + maxFeeSlack) {
      throw new Error(
        `deploy iteration ${i}: spend ${spend} lamports (${spend / LAMPORTS_PER_SOL} SOL) outside [${rentFloor}, ${rentFloor + maxFeeSlack}]`,
      );
    }

    if (i % (iterations <= 50 ? 1 : 50) === 0 || i === iterations) {
      await fundIfNeeded(connection, payer, deployFundSol);
      process.stderr.write(`  deploy checks: ${i}/${iterations}\n`);
    }
  }

  const min = Math.min(...spends);
  const max = Math.max(...spends);
  const mean = spends.reduce((a, b) => a + b, 0) / spends.length;
  return { min, max, mean, rentFloor };
}

async function main() {
  console.log('=== Cost probe validate ===');
  console.log('RPC:       ', RPC_URL);
  console.log('Iterations:', ITERATIONS);
  console.log();

  const connection = new Connection(RPC_URL, 'confirmed');
  const payer = loadPayer();
  writeFileSync(KEYPAIR_FILE, JSON.stringify(Array.from(payer.secretKey)));

  await connection.getVersion();
  await fillGoldenRent(connection);

  console.log('Golden rent (lamports):');
  for (const [k, v] of Object.entries(GOLDEN_RENT_LAMPORTS)) {
    console.log(`  ${k}: ${v} (${(v / LAMPORTS_PER_SOL).toFixed(9)} SOL)`);
  }
  console.log();

  console.log(`Phase 1: rent consistency x${ITERATIONS}…`);
  await phaseRentConsistency(connection, ITERATIONS);
  console.log('Phase 1: PASS');
  console.log();

  // Each deploy ~2.26 SOL; fund enough for all iterations plus tx-fee slack.
  const deployFundSol = Math.min(2500, Math.max(30, Math.ceil(ITERATIONS * 2.5) + 10));
  await fundIfNeeded(connection, payer, deployFundSol);

  console.log(`Phase 2: Path 1 deploy x${ITERATIONS} (fresh program id each)…`);
  const stats = await phaseDeployConsistency(connection, payer, ITERATIONS, deployFundSol);
  console.log('Phase 2: PASS');
  console.log(`  deploy spend min: ${(stats.min / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
  console.log(`  deploy spend max: ${(stats.max / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
  console.log(`  deploy spend mean: ${(stats.mean / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
  console.log(`  rent floor:       ${(stats.rentFloor / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
  console.log();
  console.log(`ALL ${ITERATIONS} iterations passed on ${RPC_URL}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
