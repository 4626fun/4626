#!/usr/bin/env node
/**
 * Interface-surface guard for the neutral 4626 capability layer.
 *
 * Invariants:
 * 1. Shared I*4626 interfaces declare required Creator/Agent selectors.
 * 2. Placeholder FutureEcosystem* contract/interface names are forbidden.
 * 3. Named ecosystems are not a third VaultKind — VaultKind stays Creator|Agent.
 *
 * Run: node scripts/guard-lane-interface-surface.mjs
 *      node scripts/guard-lane-interface-surface.mjs --self-test
 *      pnpm guard:lane-interface-surface
 */

import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
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

const REQUIRED_SELECTORS = {
  'contracts/shared/interfaces/vault/IOVault4626.sol': [
    'function deposit(',
    'function setModulesOnce(',
    'function setGaugeController(',
    'function convertToAssets(',
    'function transferOwnership(',
  ],
  'contracts/shared/interfaces/vault/IOVaultWrapper4626.sol': [
    'function setWhitelist(',
    'function setShareOFT(',
    'function unwrap(',
  ],
  'contracts/shared/interfaces/vault/IShareOFT4626.sol': [
    'function setHubConfig(',
    'function setMinter(',
    'function transferOwnership(',
    'function tradeFeeCollector()',
  ],
  'contracts/shared/interfaces/revenue/IRevenueRouter4626.sol': [
    'function convertAndQueue(',
    'function setKeeper(',
  ],
  'contracts/shared/interfaces/revenue/ITradeFeeCollector4626.sol': [
    'function receiveFees(',
    'function setLotteryManager(',
  ],
  'contracts/shared/interfaces/revenue/IRevenuePolicyController4626.sol': [
    'function owner()',
    'function transferOwnership(',
  ],
};

const LANE_EXTENSION_SELECTORS = {
  'contracts/creator/interfaces/ICreatorGaugeController.sol': ['function setCreatorCoin('],
  'contracts/agent/interfaces/IAgentGaugeController.sol': ['function setAgentToken('],
  'contracts/creator/interfaces/ICreatorCoinPolicyController4626.sol': ['function enforcePayoutRouter('],
  'contracts/agent/interfaces/IAgentRevenuePolicyController4626.sol': ['function enforceProjectTaxRecipient('],
};

const FORBIDDEN_PLACEHOLDER = /\bFutureEcosystem[A-Za-z0-9_]*\b/;
// Production code only — docs may mention the forbidden pattern while banning it.
const SCAN_ROOTS = ['contracts', 'frontend/src', 'frontend/api', 'frontend/shared', 'kpr'];

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function assertSelectors(rel, required) {
  const src = read(rel);
  const missing = required.filter((sel) => !src.includes(sel));
  if (missing.length) {
    fail(`${rel} missing selectors: ${missing.join(', ')}`);
    return false;
  }
  ok(`${rel} has required selectors (${required.length})`);
  return true;
}

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'out' || entry.name === 'cache' || entry.name === 'dist') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
      else if (/\.(sol|ts|tsx|mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function scanForbiddenPlaceholders() {
  let failures = 0;
  for (const root of SCAN_ROOTS) {
    const abs = path.join(repoRoot, root);
    for (const file of walkFiles(abs)) {
      const rel = path.relative(repoRoot, file);
      // Allow this guard file and naming docs that forbid the pattern by name.
      if (rel.endsWith('guard-lane-interface-surface.mjs')) continue;
      if (rel.endsWith('contract-naming.md')) continue;
      const src = fs.readFileSync(file, 'utf8');
      if (FORBIDDEN_PLACEHOLDER.test(src)) {
        fail(`${rel} contains forbidden FutureEcosystem* placeholder name`);
        failures++;
      }
    }
  }
  if (failures === 0) ok('no FutureEcosystem* placeholder names in active surfaces');
  return failures === 0;
}

function assertVaultKindBinary() {
  const sources = [
    'contracts/shared/interfaces/core/IRegistry4626.sol',
    'contracts/shared/deploy/batchers/DeploymentBatcher.sol',
  ];
  for (const rel of sources) {
    const src = read(rel);
    const m = src.match(/enum\s+VaultKind\s*\{([^}]*)\}/);
    if (!m) {
      fail(`${rel} missing VaultKind enum`);
      return false;
    }
    const members = m[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const allowed = new Set(['Creator', 'Agent']);
    const unexpected = members.filter((name) => !allowed.has(name));
    if (unexpected.length) {
      fail(
        `${rel}: VaultKind has unexpected members (named ecosystems are not a third kind): ${unexpected.join(', ')}`,
      );
      return false;
    }
    if (!members.includes('Creator') || !members.includes('Agent')) {
      fail(`${rel}: VaultKind must include Creator and Agent, got: ${members.join(', ')}`);
      return false;
    }
    ok(`${rel}: VaultKind remains binary (${members.join(', ')})`);
  }
  return true;
}

function selfTest() {
  info('Running interface-surface self-test...');
  const sampleOk =
    'interface IOVault4626 { function deposit(uint256 assets, address receiver) external returns (uint256 shares); function setModulesOnce(address,address,address) external; function setGaugeController(address) external; function convertToAssets(uint256) external view returns (uint256); function transferOwnership(address) external; }';
  for (const sel of REQUIRED_SELECTORS['contracts/shared/interfaces/vault/IOVault4626.sol']) {
    if (!sampleOk.includes(sel)) {
      fail(`self-test selector probe failed for ${sel}`);
      return false;
    }
  }
  if (!FORBIDDEN_PLACEHOLDER.test('contract FutureEcosystemGauge {}')) {
    fail('self-test: FutureEcosystem detector failed');
    return false;
  }
  if (FORBIDDEN_PLACEHOLDER.test('contract AgentGaugeController {}')) {
    fail('self-test: false positive on AgentGaugeController');
    return false;
  }
  ok('self-test passed');
  return true;
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }

  info('Checking lane-neutral interface surface');
  let failures = 0;

  for (const [file, selectors] of Object.entries(REQUIRED_SELECTORS)) {
    if (!assertSelectors(file, selectors)) failures++;
  }
  for (const [file, selectors] of Object.entries(LANE_EXTENSION_SELECTORS)) {
    if (!assertSelectors(file, selectors)) failures++;
  }
  if (!scanForbiddenPlaceholders()) failures++;
  if (!assertVaultKindBinary()) failures++;

  if (failures > 0) {
    console.error(`\n${RED}[FAIL]${RESET} lane interface surface guard failed (${failures}).`);
    process.exit(1);
  }
  console.log(`\n${GREEN}lane interface surface guard passed.${RESET}`);
}

main();
