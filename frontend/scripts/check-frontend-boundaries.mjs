#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { reportGuard } from './guard-utils.mjs'

const repoRoot = path.resolve(process.cwd())
const srcRoot = path.join(repoRoot, 'src')
const apiRoot = path.join(repoRoot, 'api')
const exts = new Set(['.ts', '.tsx'])

const importRegex =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

// Allowed cross-feature pairs: Map<from, Set<to>>.
// Keep tight: only add when two features are part of the same product flow.
const ALLOWED_CROSS_FEATURE = new Map([
  ['accountSetup', new Set(['waitlist', 'archB'])],
  ['waitlist', new Set(['accountSetup'])],
  // Sub-account reprovision flow legitimately shares logic with archB delegation
  // (spend permission prepare/commit for Base App sub-accounts). This is
  // flag-gated and scoped to the secondary execution track.
  ['executionScope', new Set(['archB'])],
])

// Allowed api -> src imports: exact normalized module specifiers.
// These are pure policy helpers shared between server + client surfaces.
const ALLOWED_API_TO_SRC = new Set([
  'src/lib/agent/erc8004AgentUriPolicy',
  'src/lib/deploy/finalizeShareBridgeFee',
  'src/lib/deploy/shareBridgeOftWiring',
  'src/lib/deploy/phase1ModuleDeploy',
  'src/config/contracts.defaults',
  'src/deploy/bytecode.generated',
  'src/lib/uniswap/swapQuoteSanitize',
  // Pure CREATE2 vanity-salt search shared by deploy UI and the
  // deploy/vanity API handlers (no React/Vite deps).
  'src/lib/deploy/perVaultVanityVersionSearch',
  // Pure OVault module fingerprint policy shared by deploy-session create
  // and the deploy page preflight.
  'src/lib/deploy/ovaultModuleIdentity',
  // Pure golden Relay Part 1 payload-shape policy shared by preview-add-owner
  // and the client owner-install lane.
  'src/lib/relay/goldenRelayPart1Shape',
  // Pure CSW MultiOwnable ABI constants shared by owner preview handlers.
  'src/lib/wallet/cswOwnerAbi',
])

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full)))
      continue
    }
    if (!exts.has(path.extname(entry.name))) continue
    out.push(full)
  }
  return out
}

function relFromSrc(filePath) {
  return path.relative(srcRoot, filePath).replace(/\\/g, '/')
}

function featureNameFromSrcPath(rel) {
  if (!rel.startsWith('features/')) return null
  const parts = rel.split('/')
  return parts[1] ?? null
}

function featureNameFromSpecifier(specifier) {
  // Handles @/features/<name>/... and ../features/<name>/...
  const aliasMatch = specifier.match(/^@\/features\/([^/]+)/)
  if (aliasMatch) return aliasMatch[1]
  const relMatch = specifier.match(/(?:^|\/)features\/([^/]+)/)
  if (relMatch) return relMatch[1]
  return null
}

function isUiFile(rel) {
  return rel.startsWith('components/ui/')
}

function importsFromFeatures(specifier) {
  return specifier.startsWith('@/features/') || /\.\.\/(\.\.\/)*features\//.test(specifier)
}

function resolveToRepoRel(fromFile, specifier) {
  // Only resolve relative specifiers; aliased/npm imports are out of scope.
  if (!specifier.startsWith('.')) return null
  const abs = path.resolve(path.dirname(fromFile), specifier)
  const rel = path.relative(repoRoot, abs).replace(/\\/g, '/')
  return rel
}

function isSrcRel(rel) {
  // Strip any .js/.ts/.tsx extension for comparison.
  const stripped = rel.replace(/\.(?:js|ts|tsx)$/, '')
  // Match only frontend/src/... (the client-side tree), not any /src/ inside packages.
  return stripped === 'src' || stripped.startsWith('src/')
}

function normalizeForAllowlist(rel) {
  return rel.replace(/\.(?:js|ts|tsx)$/, '')
}

async function scanUi(files) {
  const violations = []
  for (const filePath of files) {
    const rel = relFromSrc(filePath)
    if (!isUiFile(rel)) continue
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      if (!importsFromFeatures(specifier)) continue
      violations.push({ rule: 'ui-no-features', file: path.relative(repoRoot, filePath), specifier })
    }
  }
  return violations
}

async function scanCrossFeature(files) {
  const violations = []
  for (const filePath of files) {
    const rel = relFromSrc(filePath)
    const fromFeature = featureNameFromSrcPath(rel)
    if (!fromFeature) continue
    // Allow test files to reference same-feature modules via @/features/<self>/...
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      const toFeature = featureNameFromSpecifier(specifier)
      if (!toFeature) continue
      if (toFeature === fromFeature) continue
      const allowed = ALLOWED_CROSS_FEATURE.get(fromFeature)
      if (allowed && allowed.has(toFeature)) continue
      violations.push({
        rule: 'cross-feature',
        file: path.relative(repoRoot, filePath),
        specifier,
        fromFeature,
        toFeature,
      })
    }
  }
  return violations
}

async function scanApiToSrc(files) {
  const violations = []
  for (const filePath of files) {
    // Skip test files — they may legitimately reach into client helpers for setup.
    const relFile = path.relative(repoRoot, filePath).replace(/\\/g, '/')
    if (relFile.includes('/__tests__/')) continue
    const source = await fs.readFile(filePath, 'utf8')
    importRegex.lastIndex = 0
    for (let match = importRegex.exec(source); match; match = importRegex.exec(source)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      const resolved = resolveToRepoRel(filePath, specifier)
      if (!resolved) continue
      if (!isSrcRel(resolved)) continue
      const normalized = normalizeForAllowlist(resolved)
      if (ALLOWED_API_TO_SRC.has(normalized)) continue
      violations.push({
        rule: 'api-no-src',
        file: relFile,
        specifier,
      })
    }
  }
  return violations
}

async function main() {
  const srcFiles = await walk(srcRoot)
  const apiFiles = await walk(apiRoot)

  const violations = [
    ...(await scanUi(srcFiles)),
    ...(await scanCrossFeature(srcFiles)),
    ...(await scanApiToSrc(apiFiles)),
  ]

  const normalizedViolations = violations.map((violation) => ({
    ...violation,
    detail:
      violation.fromFeature && violation.toFeature
        ? `feature "${violation.fromFeature}" -> "${violation.toFeature}"`
        : undefined,
  }))

  const exitCode = reportGuard({
    guard: 'Frontend boundaries respected',
    violations: normalizedViolations,
    checks: [
      'src/components/ui does not import from src/features',
      'src/features/<A> does not import from src/features/<B> outside allowlist',
      'api/_handlers does not import from src/ outside allowlist',
    ],
    remediation: [
      'ui-no-features: move shared primitives into components/ui or invert the dependency.',
      'cross-feature: extract shared symbols into src/lib (or add explicit allowlist only when truly co-located).',
      'api-no-src: move shared helper to packages/server-core (or add explicit allowlist only for shared policy code).',
    ],
  })
  process.exit(exitCode)
}

main().catch((error) => {
  const exitCode = reportGuard({
    guard: 'Frontend boundaries respected',
    fatalError: String(error?.message ?? error),
  })
  process.exit(exitCode)
})
