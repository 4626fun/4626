/**
 * Upgrade the creator-share-hook program on Solana.
 *
 * Usage:
 *   pnpm solana:upgrade-program
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Authority keypair (must be upgrade authority)
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   PROGRAM_SO_PATH         - Path to the compiled .so file
 *
 * Optional env:
 *   SOLANA_PROGRAM_ID       - Program ID to upgrade (default: from config)
 *   BUFFER_AUTHORITY         - Buffer authority keypair (default: payer)
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { CHAINS } from '../../../config.js';
import { loadKeeperKeypair } from '../../../utils/solana.js';

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const programId = CHAINS.solana.programId;
const soPath = process.env.PROGRAM_SO_PATH ?? 'target/deploy/creator_share_hook.so';
const payer = loadKeeperKeypair();
const keypairPath = `${process.env.HOME ?? ''}/.config/solana/id.json`;

if (!existsSync(soPath)) {
  console.error(`Program binary not found at: ${soPath}`);
  console.error('Run: anchor build --arch sbf');
  process.exit(1);
}

console.log('=== Upgrade Program ===');
console.log('RPC:        ', rpcUrl);
console.log('Program ID: ', programId);
console.log('Binary:     ', soPath);
console.log('Authority:  ', payer.publicKey.toBase58());
console.log();

const args = [
  'program',
  'deploy',
  '--url',
  rpcUrl,
  '--program-id',
  programId,
  '--keypair',
  keypairPath,
  soPath,
];

console.log('Running:', ['solana', ...args].join(' '));
console.log();

try {
  execFileSync('solana', args, { stdio: 'inherit' });
  console.log('\nProgram upgraded successfully!');
} catch (error) {
  console.error('\nProgram upgrade failed');
  process.exit(1);
}
