#!/usr/bin/env node
/**
 * Static CI guard: agent/creator lane contract parity.
 *
 * Invariant:
 *   Four agent-lane contracts are copy-renamed forks of their creator-lane
 *   counterparts. They are intentionally separate files (per-lane ABI naming:
 *   agentTreasury vs creatorTreasury, setAgentToken vs setCreatorCoin, etc.
 *   are ABI-visible and baked into deploy manifests), but their LOGIC must
 *   stay identical. This guard fails when the pairs drift beyond the approved
 *   identifier rename map, so a bug fix applied to one lane cannot silently
 *   skip the other.
 *
 * Guarded pairs:
 *   agent/vault/AgentShareOFT.sol        <-> creator/vault/CreatorShareOFT.sol
 *   agent/vault/AgentOVaultWrapper.sol   <-> creator/vault/CreatorOVaultWrapper.sol
 *   agent/revenue/AgentGaugeController.sol <-> creator/revenue/CreatorGaugeController.sol
 *   agent/revenue/AgentRevenueRouter.sol <-> creator/revenue/CreatorPayoutRouter.sol
 *
 * Intentionally NOT guarded (real functional divergence or thin overlays):
 *   - AgentOracle vs CreatorOracle (agent adds a Uniswap V2 pair TWAP path)
 *   - AgentOVault / AgentOVaultCoreModule (inherit the creator contracts)
 *
 * How it compares:
 *   1. Strip comments (string-literal aware) and blank lines from both files.
 *   2. Apply the pair's ordered rename map to the AGENT file only
 *      (agent identifiers -> creator identifiers).
 *   3. Normalize whitespace and diff line-by-line (LCS). Any residual
 *      difference is a violation and is printed with original line numbers.
 *
 * If a difference is INTENTIONAL (a genuinely lane-specific behavior), either
 * extend the pair's rename map (naming-only differences) or move the pair to
 * the "not guarded" list above with a written justification in
 * contracts/README.md.
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
 * Pair definitions.
 *
 * renames: ordered [pattern, replacement] applied to the AGENT source only,
 * most-specific first. Patterns are plain strings replaced globally; entries
 * marked { word: true } are wrapped in \b word boundaries.
 */
const PAIRS = [
  {
    name: 'ShareOFT',
    agent: 'contracts/agent/vault/AgentShareOFT.sol',
    creator: 'contracts/creator/vault/CreatorShareOFT.sol',
    renames: [
      ['@4626/agent/interfaces/', '@4626/creator/interfaces/'],
      ['Agent', 'Creator'],
      ['◆', '■'],
      ['◇', '▢'],
    ],
  },
  {
    name: 'OVaultWrapper',
    agent: 'contracts/agent/vault/AgentOVaultWrapper.sol',
    creator: 'contracts/creator/vault/CreatorOVaultWrapper.sol',
    renames: [
      ['agentToken', 'creatorCoin'],
      ['AgentToken', 'CreatorCoin'],
      ['Agent', 'Creator'],
      ['agent', 'creator'],
      ['◆', '■'],
      ['◇', '▢'],
    ],
  },
  {
    name: 'GaugeController',
    agent: 'contracts/agent/revenue/AgentGaugeController.sol',
    creator: 'contracts/creator/revenue/CreatorGaugeController.sol',
    renames: [
      ['AgentTokenNotSet', 'CreatorCoinNotSet'],
      ['AgentTokenSet', 'CreatorCoinSet'],
      ['setAgentToken', 'setCreatorCoin'],
      ['treasuryShareBps', 'creatorShareBps'],
      ['totalTreasuryEarned', 'totalCreatorEarned'],
      ['toTreasury', 'toCreator'],
      ['treasuryOft', 'creatorOft'],
      ['agentTreasury', 'creatorTreasury'],
      // getFeeSplit() return param is named `treasury` in the agent lane, `creator` in the creator lane
      ['uint256 treasury', 'uint256 creator'],
      ['agentToken', 'creatorCoin'],
      ['Agent', 'Creator'],
      ['agent', 'creator'],
      ['◆', '■'],
      ['◇', '▢'],
    ],
  },
  {
    name: 'RevenueRouter/PayoutRouter',
    agent: 'contracts/agent/revenue/AgentRevenueRouter.sol',
    creator: 'contracts/creator/revenue/CreatorPayoutRouter.sol',
    renames: [
      ['AgentRevenueRouter', 'CreatorPayoutRouter'],
      ['IVaultDeposit', 'ICreatorOVaultDeposit'],
      ['_queueAgentTokenDeposit', '_queueCreatorCoinDeposit'],
      ['agentToken', 'creatorCoin'],
      ['Agent', 'Creator'],
      ['agent', 'creator'],
      ['◆', '■'],
      ['◇', '▢'],
    ],
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
  for (const [from, to, opts] of renames) {
    const pattern = opts?.word ? `\\b${escapeRegExp(from)}\\b` : escapeRegExp(from);
    out = out.replace(new RegExp(pattern, 'g'), to);
  }
  return out;
}

/**
 * Produce normalized lines with original 1-indexed line numbers:
 * comments stripped, whitespace collapsed, empty lines dropped.
 */
function normalize(src, renames) {
  const stripped = stripComments(src);
  const renamed = renames ? applyRenames(stripped, renames) : stripped;
  const lines = renamed.split('\n');
  const result = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const text = lines[idx].replace(/\s+/g, ' ').trim();
    if (text.length === 0) continue;
    result.push({ text, line: idx + 1 });
  }
  return result;
}

/**
 * LCS-based diff over normalized lines.
 * Returns array of hunks: { agentLines: [...], creatorLines: [...] }.
 */
function diffLines(a, b) {
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs = new Array(n + 1);
  for (let i = n; i >= 0; i--) {
    lcs[i] = new Uint32Array(m + 1);
    if (i === n) continue;
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i].text === b[j].text
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const hunks = [];
  let i = 0;
  let j = 0;
  let current = null;
  const openHunk = () => {
    if (!current) {
      current = { agentLines: [], creatorLines: [] };
      hunks.push(current);
    }
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i].text === b[j].text) {
      current = null;
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      openHunk();
      current.creatorLines.push(b[j]);
      j++;
    } else {
      openHunk();
      current.agentLines.push(a[i]);
      i++;
    }
  }
  return hunks;
}

function checkPair(pair) {
  const agentPath = path.join(repoRoot, pair.agent);
  const creatorPath = path.join(repoRoot, pair.creator);

  for (const p of [agentPath, creatorPath]) {
    if (!fs.existsSync(p)) {
      fail(`${pair.name}: file not found: ${path.relative(repoRoot, p)}`);
      return false;
    }
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
  const renames = [['agentTreasury', 'creatorTreasury'], ['Agent', 'Creator']];
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

  ok('self-test passed');
  return true;
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }

  info('Checking agent/creator lane contract parity (logic must match modulo approved renames)');

  let failures = 0;
  for (const pair of PAIRS) {
    if (!checkPair(pair)) failures++;
  }

  if (failures > 0) {
    console.error(`\n${RED}[FAIL]${RESET} ${failures} lane pair(s) drifted.`);
    console.error('       A change landed in one lane but not its counterpart.');
    console.error('       Mirror the change to the other lane, or (for naming-only');
    console.error('       differences) extend the rename map in scripts/check-lane-contract-parity.mjs.');
    process.exit(1);
  }

  console.log(`\n${GREEN}lane-contract-parity guard passed (${PAIRS.length} pairs).${RESET}`);
}

main();
