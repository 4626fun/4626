#!/usr/bin/env node
/**
 * Lightweight SC hygiene guard.
 *
 * Checks:
 * 1. Canonical lane terminology (no forbidden prose in non-ABI contexts).
 * 2. Tombstone-aware patterns in identity resolvers.
 *
 * Intended to be run as `pnpm -C frontend guard:sc-hygiene`.
 * Keeps the spirit of the audit recommendations without heavy enforcement.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

const repoRoot = path.resolve(process.cwd(), '..'); // run from frontend/
const srcRoot = path.join(repoRoot, 'frontend/src');
const serverRoot = path.join(repoRoot, 'frontend/server');
const contractsRoot = path.join(repoRoot, 'contracts');

const FORBIDDEN_TERMS = [
  'externalRevenueRecipient',
  'external_revenue_recipient',
  /\bcreator earnings\b/i,
  // Bare "payoutRecipient" in prose/comments (not in ABI strings or known safe contexts)
];

const TOMBSTONE_PATTERNS = [
  'merged_into_profile_id',
  'COALESCE.*merged_into',
  'listProfileIdsForPrivyUser',
];

async function walk(dir, exts) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, exts)));
      continue;
    }
    if (exts.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

async function checkTerminology() {
  const files = [
    ...(await walk(srcRoot, new Set(['.ts', '.tsx']))),
    ...(await walk(serverRoot, new Set(['.ts']))),
    ...(await walk(contractsRoot, new Set(['.sol']))),
  ];

  let violations = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    const lower = content.toLowerCase();

    // Skip obvious ABI / interface / struct field contexts
    if (file.endsWith('.sol')) {
      if (lower.includes('payoutrecipient') && !lower.includes('creatorcoinpayoutrecipient')) {
        // Only flag if it's in a comment or string that is not the raw ABI name
        const lines = content.split('\n');
        lines.forEach((line, i) => {
          if (/payoutRecipient/i.test(line) && !/creatorCoinPayoutRecipient|setPayoutRecipient|InvalidCreatorCoinPayoutRecipient/i.test(line)) {
            console.warn(`[terminology] ${file}:${i+1}: possible bare payoutRecipient in prose`);
            violations++;
          }
        });
      }
    } else {
      for (const term of FORBIDDEN_TERMS) {
        if (typeof term === 'string' ? lower.includes(term.toLowerCase()) : term.test(content)) {
          console.warn(`[terminology] ${file}: contains forbidden term "${term}"`);
          violations++;
        }
      }
    }
  }

  if (violations > 0) {
    console.error(`\nSC hygiene: ${violations} terminology issues found.`);
    process.exitCode = 1;
  } else {
    console.log('SC hygiene: terminology check passed (no forbidden prose).');
  }
}

async function checkTombstoneAwareness() {
  const resolverFiles = [
    path.join(serverRoot, '_lib/identity/profileIdForPrivyUser.ts'),
    path.join(serverRoot, '_lib/identity/accountsIdentity.ts'),
    path.join(serverRoot, '_lib/wallet/commandIssuerContext.ts'),
    path.join(serverRoot, '_lib/wallet/walletSync.ts'),
    path.join(serverRoot, '_lib/identity/profileMerge.ts'),
  ];

  let missing = 0;

  for (const f of resolverFiles) {
    try {
      const content = await fs.readFile(f, 'utf8');
      const hasPattern = TOMBSTONE_PATTERNS.some(p => content.includes(p));
      if (!hasPattern) {
        console.warn(`[tombstone] ${f}: does not appear to contain expected tombstone chasing pattern`);
        missing++;
      }
    } catch {
      // file may not exist in this checkout; skip
    }
  }

  if (missing > 0) {
    console.error(`\nSC hygiene: ${missing} identity resolvers missing obvious tombstone patterns.`);
    process.exitCode = 1;
  } else {
    console.log('SC hygiene: tombstone-aware patterns present in key resolvers.');
  }
}

async function main() {
  await checkTerminology();
  await checkTombstoneAwareness();
  if (process.exitCode) {
    console.error('\nSC hygiene guard failed. See warnings above.');
  } else {
    console.log('\nSC hygiene guard passed.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});