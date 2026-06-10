/**
 * Set the program upgrade authority for the creator-share-hook program.
 *
 * Usage:
 *   pnpm solana:set-program-upgrade-authority
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Current upgrade authority keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   NEW_AUTHORITY           - New upgrade authority pubkey (or "none" to make immutable)
 *
 * Optional env:
 *   SOLANA_PROGRAM_ID       - Program ID (default: from config)
 */

import { execFileSync } from 'node:child_process';
import { CHAINS, requireEnv } from '../../../config.js';

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const programId = CHAINS.solana.programId;
const newAuthority = requireEnv('NEW_AUTHORITY');
const keypairPath = `${process.env.HOME ?? ''}/.config/solana/id.json`;

console.log('=== Set Program Upgrade Authority ===');
console.log('RPC:           ', rpcUrl);
console.log('Program ID:    ', programId);
console.log('New Authority: ', newAuthority);
console.log();

const args = [
  'program',
  'set-upgrade-authority',
  programId,
  ...(newAuthority.toLowerCase() === 'none'
    ? ['--final']
    : ['--new-upgrade-authority', newAuthority]),
  '--url',
  rpcUrl,
  '--keypair',
  keypairPath,
];

console.log('Running:', ['solana', ...args].join(' '));
console.log();

try {
  execFileSync('solana', args, { stdio: 'inherit' });
  console.log('\nUpgrade authority updated!');
  if (newAuthority.toLowerCase() === 'none') {
    console.log('WARNING: Program is now IMMUTABLE and cannot be upgraded.');
  }
} catch {
  console.error('\nFailed to set upgrade authority');
  process.exit(1);
}
