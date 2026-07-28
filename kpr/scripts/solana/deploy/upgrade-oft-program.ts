/**
 * Upgrade the share-mesh LayerZero OFT program (6ste36…).
 *
 * Usage:
 *   PROGRAM_SO_PATH=artifacts/oft-upgrade/oft-admin-set-mint-auth.so \
 *     pnpm solana:upgrade-oft-program
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - must be upgrade authority
 *   SOLANA_RPC_URL
 *   PROGRAM_SO_PATH         - path to oft.so
 *
 * Optional:
 *   SOLANA_OFT_PROGRAM_ID   - default 6ste36…
 */

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { loadKeeperKeypair } from '../../../utils/solana.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env') });

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const programId =
  process.env.SOLANA_OFT_PROGRAM_ID?.trim() ||
  '6ste36Y7fcbzJXkVQj3ApEqYb3wFZsZX63gT6wymhy3s';
const soPath = process.env.PROGRAM_SO_PATH?.trim() ||
  path.resolve(__dirname, '../../../artifacts/oft-upgrade/oft-admin-set-mint-auth.so');

if (!existsSync(soPath)) {
  console.error(`Program binary not found at: ${soPath}`);
  process.exit(1);
}

const payer = loadKeeperKeypair();
const keypairPath = path.join(tmpdir(), `oft-upgrade-authority-${payer.publicKey.toBase58()}.json`);
writeFileSync(keypairPath, JSON.stringify(Array.from(payer.secretKey)), { mode: 0o600 });

console.log('=== Upgrade OFT program ===');
console.log('RPC:        ', rpcUrl);
console.log('Program ID: ', programId);
console.log('Binary:     ', soPath);
console.log('Authority:  ', payer.publicKey.toBase58());
console.log();

try {
  execFileSync(
    'solana',
    [
      'program',
      'deploy',
      '--url',
      rpcUrl,
      '--program-id',
      programId,
      '--keypair',
      keypairPath,
      '--upgrade-authority',
      keypairPath,
      soPath,
    ],
    { stdio: 'inherit' },
  );
  console.log('\nOFT program upgraded successfully');
} catch {
  console.error('\nOFT program upgrade failed');
  console.error('If the error is insufficient funds, fund the upgrade authority with ~4.1 SOL');
  console.error('(buffer rent for ~580KB) then re-run.');
  process.exit(1);
}
