#!/usr/bin/env node

/**
 * Pins public docs to onchain DeploymentBatcher share-split constants.
 *
 * Source of truth: contracts/helpers/batchers/DeploymentBatcher.sol
 * Forge regression: test/DeploymentBatcher.ThreeWaySplit.t.sol
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED_PUBLISH_GLOBS } from '../curatedPublishAllowlist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const BATCHER_SOL = path.join(REPO_ROOT, 'contracts/helpers/batchers/DeploymentBatcher.sol');

const SPLIT_KEYS = [
  'AUCTION_PERCENT',
  'VESTING_PERCENT',
  'SOLANA_ALLOC_PERCENT',
  'LP_RESERVE_PERCENT',
];

const STALE_DOC_PATTERNS = [
  { pattern: /40\s*\/\s*40\s*\/\s*20/i, label: '40/40/20 split (retired)' },
  { pattern: /40%\s*CCA\s*auction/i, label: '40% CCA auction (retired)' },
  { pattern: /40%\s*creator\s*vesting/i, label: '40% creator vesting (retired)' },
  { pattern: /20%\s*strategy\s*LP\s*reserve/i, label: '20% strategy LP reserve (retired)' },
  { pattern: /20%\s*seeded\s*as\s*protocol-owned\s*liquidity/i, label: '20% POOL liquidity (retired)' },
];

function readBatcherConstants() {
  if (!existsSync(BATCHER_SOL)) {
    throw new Error(`Missing batcher source: ${BATCHER_SOL}`);
  }
  const source = readFileSync(BATCHER_SOL, 'utf8');
  const values = {};

  for (const key of SPLIT_KEYS) {
    const matches = [...source.matchAll(
      new RegExp(`(?:uint8\\s+(?:public\\s+)?constant\\s+|internal\\s+constant\\s+)${key}\\s*=\\s*(\\d+)`, 'g'),
    )];
    if (matches.length === 0) {
      throw new Error(`Could not find ${key} in ${BATCHER_SOL}`);
    }
    const nums = [...new Set(matches.map((m) => Number(m[1])))];
    if (nums.length !== 1) {
      throw new Error(`${key} has conflicting values in batcher shell/module: ${nums.join(', ')}`);
    }
    values[key] = nums[0];
  }

  const sum = SPLIT_KEYS.reduce((acc, key) => acc + values[key], 0);
  if (sum !== 100) {
    throw new Error(`Share split constants must sum to 100; got ${sum}`);
  }

  return values;
}

function curatedDocPaths() {
  return CURATED_PUBLISH_GLOBS.map((rel) => path.join(REPO_ROOT, 'docs', rel));
}

function main() {
  const constants = readBatcherConstants();
  const failures = [];
  const expectedSplitLabel = `${constants.AUCTION_PERCENT}/${constants.VESTING_PERCENT}/${constants.SOLANA_ALLOC_PERCENT}/${constants.LP_RESERVE_PERCENT}`;

  console.log(`[docs] Batcher share split (onchain): ${expectedSplitLabel}`);

  for (const docPath of curatedDocPaths()) {
    if (!existsSync(docPath)) {
      failures.push(`Missing curated doc: ${path.relative(REPO_ROOT, docPath)}`);
      continue;
    }

    const rel = path.relative(REPO_ROOT, docPath);
    const content = readFileSync(docPath, 'utf8');

    for (const { pattern, label } of STALE_DOC_PATTERNS) {
      if (pattern.test(content)) {
        failures.push(`${rel}: contains stale ${label}`);
      }
    }
  }

  const ccaLaunchPath = path.join(REPO_ROOT, 'docs/contracts/strategies/cca-launch.md');
  if (existsSync(ccaLaunchPath)) {
    const cca = readFileSync(ccaLaunchPath, 'utf8');
    if (!cca.includes(`${expectedSplitLabel} split`)) {
      failures.push(
        `docs/contracts/strategies/cca-launch.md: must document ${expectedSplitLabel} split (matches DeploymentBatcher constants)`,
      );
    }
    for (const key of SPLIT_KEYS) {
      const pct = constants[key];
      const human = key.replace('_PERCENT', '').replace('_ALLOC', '').toLowerCase().replace(/_/g, ' ');
      const loose = new RegExp(`${pct}%`, 'i');
      if (!loose.test(cca)) {
        failures.push(`docs/contracts/strategies/cca-launch.md: missing ${pct}% leg (${human})`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('[docs] Contract-facts guard failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('[docs] Contract-facts guard passed (share split aligned with DeploymentBatcher.sol).');
}

main();
