#!/usr/bin/env node

/**
 * Pins curated public docs to onchain product facts.
 *
 * Sources of truth:
 * - contracts/helpers/batchers/DeploymentBatcher.sol (share split, deposit bounds)
 * - contracts/vault/CreatorOVault.sol (MINIMUM_FIRST_DEPOSIT)
 * - frontend/src/config/contracts.defaults.ts (live batcher address)
 * - frontend/server/_lib/creatorStrategy/catalog.ts (bundle price)
 * - frontend/server/_lib/creatorStrategy/resolveWeights.ts (strategy weights)
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED_PUBLISH_GLOBS } from '../curatedPublishAllowlist.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const BATCHER_SOL = path.join(REPO_ROOT, 'contracts/helpers/batchers/DeploymentBatcher.sol');
const VAULT_SOL = path.join(REPO_ROOT, 'contracts/vault/CreatorOVault.sol');
const DEFAULTS_TS = path.join(REPO_ROOT, 'frontend/src/config/contracts.defaults.ts');
const CATALOG_TS = path.join(REPO_ROOT, 'frontend/server/_lib/creatorStrategy/catalog.ts');
const WEIGHTS_TS = path.join(REPO_ROOT, 'frontend/server/_lib/creatorStrategy/resolveWeights.ts');
const ADDRESSES_MD = path.join(REPO_ROOT, 'docs/reference/addresses.md');

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
  { pattern: /5M tokens on first deposit/i, label: '5M minimum deposit (retired; live is 50M)' },
  { pattern: /auction seed 99%/i, label: '99% CCA auction seed misclaim' },
  { pattern: /CCA itself is seeded\s*99%/i, label: '99% CCA seed misclaim' },
];

function readNumericConstant(source, name) {
  const matches = [...source.matchAll(new RegExp(`${name}\\s*=\\s*(\\d+)`, 'g'))];
  if (matches.length === 0) {
    throw new Error(`Could not find ${name}`);
  }
  const nums = [...new Set(matches.map((m) => Number(m[1])))];
  if (nums.length !== 1) {
    throw new Error(`${name} has conflicting values: ${nums.join(', ')}`);
  }
  return nums[0];
}

function readBatcherSplitConstants() {
  const source = readFileSync(BATCHER_SOL, 'utf8');
  const values = {};
  for (const key of SPLIT_KEYS) {
    const matches = [...source.matchAll(
      new RegExp(`(?:uint8\\s+(?:public\\s+)?constant\\s+|internal\\s+constant\\s+)${key}\\s*=\\s*(\\d+)`, 'g'),
    )];
    if (matches.length === 0) {
      throw new Error(`Could not find ${key} in DeploymentBatcher.sol`);
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

function readDepositBounds() {
  const batcher = readFileSync(BATCHER_SOL, 'utf8');
  const vault = readFileSync(VAULT_SOL, 'utf8');
  const minMatch = batcher.match(/MIN_FIRST_DEPOSIT\s*=\s*([\d_]+)e18/);
  const maxMatch = batcher.match(/MAX_FIRST_DEPOSIT\s*=\s*([\d_]+)e18/);
  const vaultMinMatch = vault.match(/MINIMUM_FIRST_DEPOSIT\s*=\s*([\d_]+)e18/);
  if (!minMatch || !maxMatch || !vaultMinMatch) {
    throw new Error('Could not parse deposit bounds from batcher/vault sources');
  }
  const minBatcher = Number(minMatch[1].replace(/_/g, ''));
  const maxBatcher = Number(maxMatch[1].replace(/_/g, ''));
  const minVault = Number(vaultMinMatch[1].replace(/_/g, ''));
  if (minBatcher !== minVault) {
    throw new Error(`Deposit min mismatch: batcher ${minBatcher} vs vault ${minVault}`);
  }
  return { minTokens: minBatcher / 1e6, maxTokens: maxBatcher / 1e6 };
}

function readLiveBatcherAddress() {
  const source = readFileSync(DEFAULTS_TS, 'utf8');
  const match = source.match(
    /export const SPLIT_PHASE1_DEPLOYMENT_BATCHER\s*=\s*addr\('([0-9a-fA-F]{40})'\)/,
  );
  if (!match) {
    throw new Error('Could not parse SPLIT_PHASE1_DEPLOYMENT_BATCHER from contracts.defaults.ts');
  }
  return match[1];
}

function readBundlePriceUsdc() {
  const source = readFileSync(CATALOG_TS, 'utf8');
  const match = source.match(/FULL_VAULT_DEPLOY_PRICE_USDC\s*=\s*([\d_]+)n/);
  if (!match) {
    throw new Error('Could not parse FULL_VAULT_DEPLOY_PRICE_USDC from catalog.ts');
  }
  return Number(match[1].replace(/_/g, '')) / 1_000_000;
}

function readStrategyWeights() {
  const source = readFileSync(WEIGHTS_TS, 'utf8');
  const idleMatch = source.match(/DEFAULT_IDLE_RESERVE_BPS\s*=\s*([\d_]+)n/);
  if (!idleMatch) {
    throw new Error('Could not parse DEFAULT_IDLE_RESERVE_BPS from resolveWeights.ts');
  }
  const idleBps = Number(idleMatch[1].replace(/_/g, ''));
  const productiveBps = 10_000 - idleBps;
  if (productiveBps % 2 !== 0) {
    throw new Error(`Productive allocation must split evenly; got ${productiveBps} bps`);
  }
  const legBps = productiveBps / 2;
  return { charmPct: legBps / 100, ajnaPct: legBps / 100, idlePct: idleBps / 100 };
}

function curatedDocPaths() {
  return CURATED_PUBLISH_GLOBS.map((rel) => path.join(REPO_ROOT, 'docs', rel));
}

function main() {
  for (const file of [BATCHER_SOL, VAULT_SOL, DEFAULTS_TS, CATALOG_TS, WEIGHTS_TS, ADDRESSES_MD]) {
    if (!existsSync(file)) {
      throw new Error(`Missing source file: ${file}`);
    }
  }

  const split = readBatcherSplitConstants();
  const deposit = readDepositBounds();
  const batcher = readLiveBatcherAddress();
  const bundleUsd = readBundlePriceUsdc();
  const weights = readStrategyWeights();
  const failures = [];

  const splitLabel = `${split.AUCTION_PERCENT}/${split.VESTING_PERCENT}/${split.SOLANA_ALLOC_PERCENT}/${split.LP_RESERVE_PERCENT}`;
  console.log(`[docs] Share split: ${splitLabel}`);
  console.log(`[docs] Deposit bounds: ${deposit.minTokens}M–${deposit.maxTokens}M tokens`);
  console.log(`[docs] Live batcher: 0x${batcher}`);
  console.log(`[docs] Launch bundle: $${bundleUsd} USDC`);
  console.log(`[docs] Strategy weights: Charm ${weights.charmPct}% · Ajna ${weights.ajnaPct}% · idle ${weights.idlePct}%`);

  const addresses = readFileSync(ADDRESSES_MD, 'utf8');
  if (!addresses.toLowerCase().includes(batcher.toLowerCase())) {
    failures.push(`docs/reference/addresses.md: missing live DeploymentBatcher 0x${batcher}`);
  }
  if (!addresses.includes('v1.14.1')) {
    failures.push('docs/reference/addresses.md: missing v1.14.1 release label');
  }

  const strategyBundle = readFileSync(path.join(REPO_ROOT, 'docs/guides/strategy-bundle.md'), 'utf8');
  if (!strategyBundle.includes(String(bundleUsd))) {
    failures.push(`docs/guides/strategy-bundle.md: must mention $${bundleUsd} bundle price`);
  }

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
  const cca = readFileSync(ccaLaunchPath, 'utf8');
  if (!cca.includes(`${splitLabel} split`)) {
    failures.push(`docs/contracts/strategies/cca-launch.md: must document ${splitLabel} split`);
  }
  if (!cca.includes('Thursday 00:00 UTC')) {
    failures.push('docs/contracts/strategies/cca-launch.md: must document Thursday 00:00 UTC auction schedule');
  }

  const ovaultPath = path.join(REPO_ROOT, 'docs/contracts/core/creator-ovault.md');
  const ovault = readFileSync(ovaultPath, 'utf8');
  if (!ovault.includes('50M')) {
    failures.push('docs/contracts/core/creator-ovault.md: must document 50M minimum first deposit');
  }

  const howItWorks = readFileSync(path.join(REPO_ROOT, 'docs/overview/how-it-works.md'), 'utf8');
  if (!howItWorks.includes(`${weights.charmPct}%`) || !howItWorks.includes(`${weights.ajnaPct}%`)) {
    failures.push('docs/overview/how-it-works.md: must document Charm/Ajna strategy weight split');
  }

  if (failures.length > 0) {
    console.error('[docs] Contract-facts guard failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('[docs] Contract-facts guard passed.');
}

main();
