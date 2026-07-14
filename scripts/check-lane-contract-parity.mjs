#!/usr/bin/env node
/**
 * Static CI guard: agent/creator lane contract parity.
 *
 * Two classifications:
 *
 * 1. PAIRS — copy-renamed forks whose LOGIC must stay identical (modulo the
 *    approved rename map). Currently empty: every former pair has intentional
 *    behavioral divergence documented below. Re-add a pair here only when the
 *    two files are again rename-equivalent.
 *
 * 2. INTENTIONALLY_DIVERGENT — lane forks that share an I*4626 capability
 *    surface but keep real behavioral differences. The guard verifies the
 *    files exist and prints the justification; it does NOT force false parity.
 *
 * Intentionally divergent justifications (see also contracts/README.md):
 *   ShareOFT / OVaultWrapper — Agent cooldown hook takes amount; Creator does not.
 *     Agent also differs on remote-peer lottery callback authority and mint auth.
 *   GaugeController — Agent lottery-manager timelock + direct fee accounting;
 *     Creator balance-delta fee accounting + emergency withdraw path.
 *   RevenueRouter / PayoutRouter — Creator-only keeper spend caps and delayed
 *     emergency withdraw; Agent omits those creator-custody controls.
 *
 * Thin overlays (not listed): AgentOVault / AgentOVaultCoreModule inherit creator.
 * Oracles remain intentionally divergent (Agent V2 TWAP path).
 *
 * Run: node scripts/check-lane-contract-parity.mjs
 *      node scripts/check-lane-contract-parity.mjs --self-test
 *      pnpm guard:lane-contract-parity
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function fail(msg) {
  console.error(`${RED}[FAIL]${RESET} ${msg}`);
}

function ok(msg) {
  console.log(`${GREEN}[ok]${RESET}   ${msg}`);
}

function info(msg) {
  console.log(`${CYAN}[..]${RESET}   ${msg}`);
}

/**
 * Pairs that must remain rename-equivalent. Empty while all former forks have
 * intentional behavioral differences. Reintroduce a pair only after restoring
 * logic parity.
 */
const PAIRS = [];

/**
 * Documented intentional divergences. Guard checks presence + justification only.
 */
const INTENTIONALLY_DIVERGENT = [
  {
    name: 'ShareOFT',
    agent: 'contracts/agent/vault/AgentShareOFT.sol',
    creator: 'contracts/creator/vault/CreatorShareOFT.sol',
    reason:
      'Cooldown hook arity (amount), mint/owner auth, and hub lottery peer callback rules diverge; shared surface is IShareOFT4626.',
  },
  {
    name: 'OVaultWrapper',
    agent: 'contracts/agent/vault/AgentOVaultWrapper.sol',
    creator: 'contracts/creator/vault/CreatorOVaultWrapper.sol',
    reason:
      'propagateCooldownOnTransfer(from,to,amount) vs (from,to); shared surface is IOVaultWrapper4626 (excludes cooldown hook).',
  },
  {
    name: 'GaugeController',
    agent: 'contracts/agent/revenue/AgentGaugeController.sol',
    creator: 'contracts/creator/revenue/CreatorGaugeController.sol',
    reason:
      'Agent lottery-manager timelock + direct receiveFees accounting; Creator balance-delta fees + emergency withdraw. Shared surface is ITradeFeeCollector4626.',
  },
  {
    name: 'RevenueRouter/PayoutRouter',
    agent: 'contracts/agent/revenue/AgentRevenueRouter.sol',
    creator: 'contracts/creator/revenue/CreatorPayoutRouter.sol',
    reason:
      'Creator-only keeper external spend caps and delayed emergency withdraw. Shared surface is IRevenueRouter4626.',
  },
];

/**
 * Strip // line comments and block comments from Solidity source,
 * preserving line structure so we can report original line numbers.
 * String-literal aware so "//" inside a string is not treated as a comment.
 */
function stripComments(src) {
  let out = '';
  let i = 0;
  let inBlockComment = false;
  let inLineComment = false;
  let inString = false;
  let stringQuote = '';

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (inLineComment) {
      if (ch === '\n') {
        inLineComment = false;
        out += ch;
      }
      i++;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      if (ch === '\n') out += ch;
      i++;
      continue;
    }

    if (inString) {
      out += ch;
      if (ch === '\\') {
        if (next !== undefined) {
          out += next;
          i += 2;
          continue;
        }
      } else if (ch === stringQuote) {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyRenames(src, renames) {
  let out = src;
  for (const entry of renames ?? []) {
    const [from, to, opts] = Array.isArray(entry) ? entry : [entry.from, entry.to, entry];
    if (opts?.word) {
      out = out.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to);
    } else {
      out = out.split(from).join(to);
    }
  }
  return out;
}

function normalize(src, renames) {
  const stripped = stripComments(src);
  const renamed = applyRenames(stripped, renames);
  return renamed
    .split('\n')
    .map((line, idx) => ({ line: idx + 1, text: line.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text.length > 0);
}

function diffLines(agentNorm, creatorNorm) {
  const a = agentNorm.map((l) => l.text);
  const b = creatorNorm.map((l) => l.text);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const hunks = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    const agentLines = [];
    const creatorLines = [];
    while (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      agentLines.push(agentNorm[i]);
      i++;
    }
    while (j < m && (i >= n || dp[i][j + 1] > dp[i + 1][j])) {
      creatorLines.push(creatorNorm[j]);
      j++;
    }
    if (agentLines.length || creatorLines.length) {
      hunks.push({ agentLines, creatorLines });
    }
  }
  return hunks;
}

function checkPair(pair) {
  const agentPath = path.join(repoRoot, pair.agent);
  const creatorPath = path.join(repoRoot, pair.creator);
  if (!fs.existsSync(agentPath)) {
    fail(`${pair.name}: missing agent file ${pair.agent}`);
    return false;
  }
  if (!fs.existsSync(creatorPath)) {
    fail(`${pair.name}: missing creator file ${pair.creator}`);
    return false;
  }

  const agentNorm = normalize(fs.readFileSync(agentPath, 'utf8'), pair.renames);
  const creatorNorm = normalize(fs.readFileSync(creatorPath, 'utf8'), null);

  const hunks = diffLines(agentNorm, creatorNorm);
  if (hunks.length === 0) {
    ok(`${pair.name}: ${pair.agent} matches ${pair.creator} (${creatorNorm.length} normalized lines)`);
    return true;
  }

  fail(`${pair.name}: ${hunks.length} drift hunk(s) between ${pair.agent} and ${pair.creator}`);
  const MAX_HUNKS = 10;
  for (const hunk of hunks.slice(0, MAX_HUNKS)) {
    console.error('');
    for (const l of hunk.agentLines.slice(0, 6)) {
      console.error(`  ${YELLOW}agent${RESET}   ${pair.agent}:${l.line}: ${l.text}`);
    }
    if (hunk.agentLines.length > 6) console.error(`  ${YELLOW}agent${RESET}   ... ${hunk.agentLines.length - 6} more line(s)`);
    for (const l of hunk.creatorLines.slice(0, 6)) {
      console.error(`  ${YELLOW}creator${RESET} ${pair.creator}:${l.line}: ${l.text}`);
    }
    if (hunk.creatorLines.length > 6) console.error(`  ${YELLOW}creator${RESET} ... ${hunk.creatorLines.length - 6} more line(s)`);
  }
  if (hunks.length > MAX_HUNKS) {
    console.error(`\n  ... ${hunks.length - MAX_HUNKS} more hunk(s) not shown`);
  }
  return false;
}

function checkIntentional(entry) {
  const agentPath = path.join(repoRoot, entry.agent);
  const creatorPath = path.join(repoRoot, entry.creator);
  let okEntry = true;
  if (!fs.existsSync(agentPath)) {
    fail(`${entry.name}: missing agent file ${entry.agent}`);
    okEntry = false;
  }
  if (!fs.existsSync(creatorPath)) {
    fail(`${entry.name}: missing creator file ${entry.creator}`);
    okEntry = false;
  }
  if (!entry.reason || !String(entry.reason).trim()) {
    fail(`${entry.name}: intentional divergence requires a written reason`);
    okEntry = false;
  }
  if (okEntry) {
    ok(`${entry.name}: intentionally divergent — ${entry.reason}`);
  }
  return okEntry;
}

function selfTest() {
  info('Running self-test...');

  // 1. Identical after rename map -> no drift.
  const agentSrc = [
    'contract AgentFoo {',
    '    address public agentTreasury; // lane treasury',
    '    string public constant URL = "https://example.com/a"; ',
    '    function ping() external {}',
    '}',
  ].join('\n');
  const creatorSrc = [
    'contract CreatorFoo {',
    '    /* the lane treasury */',
    '    address public creatorTreasury;',
    '    string public constant URL = "https://example.com/a";',
    '    function ping() external {}',
    '}',
  ].join('\n');
  const renames = [
    ['agentTreasury', 'creatorTreasury'],
    ['Agent', 'Creator'],
  ];
  const cleanHunks = diffLines(normalize(agentSrc, renames), normalize(creatorSrc, null));
  if (cleanHunks.length !== 0) {
    fail(`self-test: expected 0 hunks for rename-equivalent sources, got ${cleanHunks.length}`);
    return false;
  }

  // 2. Real logic drift -> detected.
  const driftedCreatorSrc = creatorSrc.replace('function ping() external {}', 'function ping() external { revert(); }');
  const driftHunks = diffLines(normalize(agentSrc, renames), normalize(driftedCreatorSrc, null));
  if (driftHunks.length === 0) {
    fail('self-test: expected drift to be detected, got 0 hunks');
    return false;
  }

  // 3. Comment containing code-like text is ignored; "//" inside string is kept.
  const aSrc = 'uint256 x = 1; // uint256 x = 2;\nstring s = "a//b";';
  const bSrc = 'uint256 x = 1;\nstring s = "a//b";';
  if (diffLines(normalize(aSrc, []), normalize(bSrc, null)).length !== 0) {
    fail('self-test: comment/string normalization mismatch');
    return false;
  }

  // 4. Intentional classification requires reasons and existing files.
  if (INTENTIONALLY_DIVERGENT.length === 0) {
    fail('self-test: expected intentional divergence registry to be non-empty');
    return false;
  }
  for (const entry of INTENTIONALLY_DIVERGENT) {
    if (!entry.reason?.trim()) {
      fail(`self-test: ${entry.name} missing reason`);
      return false;
    }
  }

  ok('self-test passed');
  return true;
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }

  info('Checking agent/creator lane contract parity classification');

  let failures = 0;
  for (const pair of PAIRS) {
    if (!checkPair(pair)) failures++;
  }
  for (const entry of INTENTIONALLY_DIVERGENT) {
    if (!checkIntentional(entry)) failures++;
  }

  if (failures > 0) {
    console.error(`\n${RED}[FAIL]${RESET} ${failures} lane classification check(s) failed.`);
    console.error('       For rename-equivalent pairs: mirror logic or extend the rename map.');
    console.error('       For intentional divergences: keep files present and document the reason.');
    process.exit(1);
  }

  console.log(
    `\n${GREEN}lane-contract-parity guard passed (${PAIRS.length} parity pairs, ${INTENTIONALLY_DIVERGENT.length} intentional divergences).${RESET}`,
  );
}

main();
