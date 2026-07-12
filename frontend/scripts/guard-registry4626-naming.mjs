#!/usr/bin/env node
/**
 * Guard: block re-introduction of wrong 4626 suffix naming on shared infra types.
 *
 * Canonical names use the *4626 suffix* (or ve4626* for the ve stack):
 *   Registry4626, IRegistry4626
 *   LotteryManager4626, ILotteryManager4626
 *   VRFConsumer4626
 *   BribeDepot4626, BribesFactory4626
 *   RewardStream4626, RewardStreamFactory4626, IRewardStream4626
 *
 * Forbidden in active paths:
 *   - 4626Registry / I4626Registry*
 *   - CreatorRegistry*, CreatorLotteryManager, CreatorVRFConsumer*
 *   - 4626LotteryManager / 4626VRFConsumer prefix artifact paths
 *   - bare BribeDepot / BribesFactory / RewardStream / RewardStreamFactory (missing 4626 suffix)
 *
 * Run: pnpm -C frontend guard:registry4626-naming
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))

const SCAN_PATHS = [
  join(REPO_ROOT, 'contracts'),
  join(REPO_ROOT, 'script'),
  join(REPO_ROOT, 'kpr'),
  join(REPO_ROOT, 'test'),
  join(REPO_ROOT, 'frontend', 'src'),
  join(REPO_ROOT, 'frontend', 'server'),
  join(REPO_ROOT, 'frontend', 'api'),
  join(REPO_ROOT, 'frontend', 'scripts'),
  join(REPO_ROOT, 'docs', 'reference'),
  join(REPO_ROOT, 'docs', 'contracts'),
  join(REPO_ROOT, 'docs', 'guides'),
  join(REPO_ROOT, 'docs', 'overview'),
  join(REPO_ROOT, 'docs', 'architecture'),
  join(REPO_ROOT, 'docs', 'agent-learned-facts.md'),
  join(REPO_ROOT, 'docs', '_internal', 'operations', 'deployment'),
  join(REPO_ROOT, '.cursor', 'skills'),
  join(REPO_ROOT, 'README.md'),
  join(REPO_ROOT, 'AGENTS.md'),
  join(REPO_ROOT, 'deployments'),
  join(REPO_ROOT, '.env.example'),
  join(ROOT, '.env.example'),
]

const EXCLUDE_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  'out',
  'cache',
  'lib',
  'archives',
  '__tests__',
  'snapshots',
  'test-ledger',
])

const ALLOWLIST_SUFFIXES = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.sol',
  '.md',
  '.json',
  '.sh',
  '.sql',
  '.example',
])

const ALLOWLIST_RELATIVE = new Set([
  'frontend/scripts/guard-registry4626-naming.mjs',
  'frontend/scripts/guard-registry4626-naming.test.mjs',
  // React components must be PascalCase; export alias at call sites (see ve-naming.md).
  'frontend/src/components/ve33/Ve4626GaugeVotingPanel.tsx',
  'frontend/src/pages/GaugeVoting.tsx',
  'docs/architecture/contracts-folder-optimization-proposal.md',
  'docs/contracts/governance/contract-naming.md', // documents forbidden legacy aliases by name
  'docs/contracts/governance/ve-naming.md', // documents forbidden Ve4626 token
  'docs/contracts/governance/abi-source-naming-parity.md', // documents ABI rename maps
  'script/sync-greenfield-env-from-handoff.sh',
  // Migration helper still mirrors retired env keys onto live addresses for one release.
  'script/sync-v1180-vercel-env.sh',
])

function walk(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDE_DIR_NAMES.has(entry.name)) continue
      walk(full, out)
      continue
    }
    const rel = relative(REPO_ROOT, full).replaceAll('\\', '/')
    if (ALLOWLIST_RELATIVE.has(rel)) continue
    const dot = rel.lastIndexOf('.')
    const suffix = dot >= 0 ? rel.slice(dot) : ''
    if (suffix && !ALLOWLIST_SUFFIXES.has(suffix)) continue
    out.push(full)
  }
}

function collectFiles() {
  const files = []
  for (const path of SCAN_PATHS) {
    try {
      const st = statSync(path)
      if (st.isDirectory()) walk(path, files)
      else files.push(path)
    } catch {
      // optional path
    }
  }
  return files
}

function stripAllowed4626SuffixTokens(line) {
  return line
    .replaceAll('IRegistry4626', '')
    .replaceAll('Registry4626', '')
    .replaceAll('REGISTRY_4626', '')
    .replaceAll('ILotteryManager4626', '')
    .replaceAll('LotteryManager4626', '')
    .replaceAll('VRFConsumer4626', '')
    // Governance / rewards (strip longest / most-specific tokens first)
    .replaceAll('Ive4626GaugeVotingForBribesFactory4626', '')
    .replaceAll('Ive4626GaugeVotingForBribeDepot4626', '')
    .replaceAll('getOrCreateBribeDepot4626', '')
    .replaceAll('createBribeDepot4626', '')
    .replaceAll('bribeDepot4626Of', '')
    .replaceAll('BribeDepot4626Created', '')
    .replaceAll('BribesFactory4626', '')
    .replaceAll('BribeDepot4626', '')
    .replaceAll('RewardStreamFactory4626', '')
    .replaceAll('IRewardStream4626', '')
    .replaceAll('RewardStream4626', '')
}

function findViolations(content) {
  const hits = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNo = i + 1
    const stripped = stripAllowed4626SuffixTokens(line)

    if (/\b4626Registry\b/i.test(stripped)) {
      hits.push({ lineNo, reason: 'use Registry4626 (4626 suffix), not 4626Registry prefix', line })
    }
    if (/\b(?:DEFAULT|BASE_MAINNET)_4626_REGISTRY\b/.test(line)) {
      hits.push({ lineNo, reason: 'use *_REGISTRY_4626 constant naming', line })
    }
    if (/\bget4626Registry[A-Za-z0-9_]*/.test(line)) {
      hits.push({ lineNo, reason: 'use getRegistry4626* helper naming', line })
    }
    if (/\bSeed4626Registry\b/.test(line)) {
      hits.push({ lineNo, reason: 'use SeedRegistry4626 / SeedRegistry4626 script naming', line })
    }
    if (/\bI4626Registry(?:\.sol|[A-Za-z0-9_]*)?\b/.test(line)) {
      hits.push({ lineNo, reason: 'use IRegistry4626 (4626 suffix), not I4626Registry prefix', line })
    }
    if (/\bCreatorRegistry\.sol\b/.test(line)) {
      hits.push({ lineNo, reason: 'contract file must be Registry4626.sol', line })
    }
    if (/\b(?:4626Registry|CreatorRegistry)\.json\b/.test(line)) {
      hits.push({ lineNo, reason: 'deployment artifact must be Registry4626.json', line })
    }
    if (/\|\s*CreatorRegistry\s*\|/.test(line)) {
      hits.push({ lineNo, reason: 'addresses table must use Registry4626', line })
    }
    if (/\bCreatorLotteryManager\b/.test(line)) {
      hits.push({ lineNo, reason: 'use LotteryManager4626 (4626 suffix)', line })
    }
    if (/\bCreatorVRFConsumer(?:V2_5)?\b/.test(line)) {
      hits.push({ lineNo, reason: 'use VRFConsumer4626 (4626 suffix)', line })
    }
    if (/\bICreatorVRFConsumer[A-Za-z0-9_]*/.test(line)) {
      hits.push({ lineNo, reason: 'use IVRFConsumer4626* interface naming', line })
    }
    if (/\b4626LotteryManager\b/.test(line)) {
      hits.push({ lineNo, reason: 'use LotteryManager4626.json / LotteryManager4626.sol', line })
    }
    if (/\b4626VRFConsumer\b/.test(line)) {
      hits.push({ lineNo, reason: 'use VRFConsumer4626.json / VRFConsumer4626.sol', line })
    }
    if (/\bCREATOR_REGISTRY\b/.test(line)) {
      hits.push({ lineNo, reason: 'use REGISTRY_4626 (or REGISTRY deploy handoff), not CREATOR_REGISTRY', line })
    }
    if (/\bCREATOR_FACTORY\b/.test(line)) {
      hits.push({ lineNo, reason: 'use OVAULT_FACTORY for OVaultFactory4626 registrar', line })
    }
    if (/\bCREATOR_LOTTERY_MANAGER\b/.test(line)) {
      hits.push({ lineNo, reason: 'use LOTTERY_MANAGER for LotteryManager4626', line })
    }
    if (/\bCREATOR_VRF_CONSUMER\b/.test(line)) {
      hits.push({ lineNo, reason: 'use VRF_CONSUMER for VRFConsumer4626', line })
    }
    if (/\bCREATOR_VAULT_BATCHER\b/.test(line)) {
      hits.push({ lineNo, reason: 'use DEPLOYMENT_BATCHER for DeploymentBatcher shell', line })
    }
    if (/creatorRegistryVerification/.test(line)) {
      hits.push({ lineNo, reason: 'use registry4626Verification module naming', line })
    }
    if (/\bvalidateCreatorRegistryBinding\b/.test(line)) {
      hits.push({ lineNo, reason: 'use validateRegistry4626Binding', line })
    }
    if (/\bSeedCreatorRegistry\b/.test(line)) {
      hits.push({ lineNo, reason: 'use SeedRegistry4626 script naming', line })
    }
    if (/creator_registry_batcher/.test(line)) {
      hits.push({ lineNo, reason: 'use registry_4626_batcher_* check/log naming', line })
    }
    if (/creatorVaultBatcher/.test(line)) {
      hits.push({ lineNo, reason: 'use deploymentBatcher config/API naming', line })
    }
    if (/creatorVaultBatcherConfigError/.test(line)) {
      hits.push({ lineNo, reason: 'use deploymentBatcherConfigError', line })
    }
    if (/\bVITE_CREATOR_VAULT_BATCHER\b/.test(line)) {
      hits.push({ lineNo, reason: 'use VITE_DEPLOYMENT_BATCHER', line })
    }
    if (/\bnormalizeCreatorVaultBatcherAddress\b/.test(line)) {
      hits.push({ lineNo, reason: 'use normalizeDeploymentBatcherAddress', line })
    }
    if (/\bCreatorLotteryManager\.json\b/.test(line)) {
      hits.push({ lineNo, reason: 'deployment artifact must be LotteryManager4626.json', line })
    }
    if (/\bCreatorVRFConsumer(?:V2_5)?\.json\b/.test(line)) {
      hits.push({ lineNo, reason: 'deployment artifact must be VRFConsumer4626.json', line })
    }
    if (/\|\s*CreatorLotteryManager\s*\|/.test(line)) {
      hits.push({ lineNo, reason: 'addresses table must use LotteryManager4626', line })
    }
    if (/\|\s*CreatorVRFConsumer/.test(line)) {
      hits.push({ lineNo, reason: 'addresses table must use VRFConsumer4626', line })
    }
    // Shared governance: bare names without 4626 suffix (after stripping *4626 forms)
    if (/\bBribeDepot\b/.test(stripped)) {
      hits.push({ lineNo, reason: 'use BribeDepot4626 (4626 suffix)', line })
    }
    if (/\bBribesFactory\b/.test(stripped)) {
      hits.push({ lineNo, reason: 'use BribesFactory4626 (4626 suffix)', line })
    }
    if (/\bRewardStreamFactory\b/.test(stripped)) {
      hits.push({ lineNo, reason: 'use RewardStreamFactory4626 (4626 suffix)', line })
    }
    if (/\bRewardStream\b/.test(stripped)) {
      hits.push({ lineNo, reason: 'use RewardStream4626 (4626 suffix)', line })
    }
    if (/\bcreateBribeDepot\b/.test(stripped)) {
      hits.push({ lineNo, reason: 'use createBribeDepot4626', line })
    }
    if (/\bbribeDepotOf\b/.test(stripped)) {
      hits.push({ lineNo, reason: 'use bribeDepot4626Of', line })
    }
    if (/\bgetOrCreateBribeDepot\b/.test(stripped)) {
      hits.push({ lineNo, reason: 'use getOrCreateBribeDepot4626', line })
    }
    // ve-naming: never capital-V "Ve4626" token (use lowercase ve4626 / Ive4626*)
    // Skip documentation lines that only *forbid* the bad token.
    const veDocExemption =
      /\bnever\b/i.test(line) ||
      /\binvent\b/i.test(line) ||
      /\bnot the\b/i.test(line) ||
      /\(\*\*not\*\*\)/i.test(line) ||
      /\bnot\b[^\n]{0,40}\bIVe4626/i.test(line) ||
      /\bnot\b[^\n]{0,40}\bVe4626/i.test(line) ||
      /lowercase \*\*ve\*\*/i.test(line)
    if (!veDocExemption) {
      if (/\bIVe4626\b/.test(line) || /\bIVe4626[A-Za-z*]/.test(line)) {
        hits.push({ lineNo, reason: 'use Ive4626* (lowercase ve), not IVe4626*', line })
      }
      if (/\bsetVe4626\b/.test(line) || /\bsetVe4626[A-Za-z]/.test(line)) {
        hits.push({ lineNo, reason: 'use setve4626* (lowercase ve), not setVe4626*', line })
      }
      if (/\bVe4626[A-Za-z]/.test(line) || /\bVe4626\b/.test(line)) {
        hits.push({ lineNo, reason: 'use ve4626* (lowercase ve), not Ve4626*', line })
      }
    }
  }
  return hits
}

function main() {
  const files = collectFiles()
  const failures = []

  for (const file of files) {
    const rel = relative(REPO_ROOT, file).replaceAll('\\', '/')
    const content = readFileSync(file, 'utf8')
    const hits = findViolations(content)
    for (const hit of hits) {
      failures.push({ rel, ...hit })
    }
  }

  if (failures.length === 0) {
    console.log('registry4626 naming guard passed')
    return
  }

  console.error(`registry4626 naming guard failed (${failures.length} hit(s)):`)
  for (const failure of failures) {
    console.error(`  ${failure.rel}:${failure.lineNo} — ${failure.reason}`)
    console.error(`    ${failure.line.trim()}`)
  }
  process.exit(1)
}

main()
