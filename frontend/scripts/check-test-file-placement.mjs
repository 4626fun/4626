#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const TEST_FILE_RE = /\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i
const ALLOWED_LOCATION_RES = [
  /^src\/features\/.+\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /^src\/pages\/.+\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i,
  /^api\/__tests__\/.+\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i,
]

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.status !== 0 && !options.allowNonZero) {
    const message = (result.stderr || result.stdout || '').trim()
    throw new Error(message || `git ${args.join(' ')} failed`)
  }

  return {
    status: result.status ?? 1,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  }
}

function hasCommit(ref) {
  const result = runGit(['rev-parse', '--verify', `${ref}^{commit}`], { allowNonZero: true })
  return result.status === 0
}

function normalizeRepoPath(filePath) {
  const normalized = String(filePath || '').replaceAll('\\', '/').trim()
  if (!normalized) return ''
  if (normalized.startsWith('frontend/')) return normalized.slice('frontend/'.length)
  return normalized
}

function resolveBaseRef() {
  const explicit = String(process.env.TEST_PLACEMENT_BASE ?? '').trim()
  if (explicit) return explicit

  const baseRef = String(process.env.GITHUB_BASE_REF ?? '').trim()
  const candidates = [
    ...(baseRef ? [`origin/${baseRef}`, baseRef] : []),
    'origin/main',
    'origin/master',
    'main',
    'master',
    'HEAD~1',
  ]

  for (const candidate of candidates) {
    if (hasCommit(candidate)) return candidate
  }

  return null
}

function parseAddedPathsFromDiff(baseRef) {
  const result = runGit(
    ['diff', '--name-status', '--diff-filter=ACR', `${baseRef}...HEAD`, '--'],
    { allowNonZero: true },
  )
  if (!result.stdout) return []

  const lines = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean)
  const paths = []
  for (const line of lines) {
    const parts = line.split('\t')
    if (parts.length < 2) continue
    const status = parts[0]
    if (status.startsWith('R') || status.startsWith('C')) {
      const nextPath = parts[2]
      if (nextPath) paths.push(nextPath)
      continue
    }
    paths.push(parts[1])
  }
  return paths
}

function isAllowedLocation(frontendRelativePath) {
  return ALLOWED_LOCATION_RES.some((re) => re.test(frontendRelativePath))
}

function main() {
  const baseRef = resolveBaseRef()
  if (!baseRef) {
    console.log('ok: test placement guard skipped (no comparison base found; set TEST_PLACEMENT_BASE to enforce)')
    return
  }

  const candidates = new Set(parseAddedPathsFromDiff(baseRef))
  const includeUntracked = String(process.env.TEST_PLACEMENT_INCLUDE_UNTRACKED ?? '').trim() === '1'
  if (includeUntracked) {
    const untrackedResult = runGit(['ls-files', '--others', '--exclude-standard'], { allowNonZero: true })
    const untrackedPaths = untrackedResult.stdout
      ? untrackedResult.stdout.split('\n').map((line) => line.trim()).filter(Boolean)
      : []
    for (const filePath of untrackedPaths) {
      candidates.add(filePath)
    }
  }

  const violating = []
  for (const repoPath of candidates) {
    const frontendPath = normalizeRepoPath(repoPath)
    if (!frontendPath) continue
    if (!TEST_FILE_RE.test(frontendPath)) continue
    if (isAllowedLocation(frontendPath)) continue
    violating.push(frontendPath)
  }

  if (violating.length === 0) {
    console.log(`ok: test placement guard passed (base=${baseRef})`)
    return
  }

  console.error('error: newly added test files are outside allowed locations:')
  for (const filePath of violating.sort()) {
    console.error(`- ${filePath}`)
  }
  console.error('')
  console.error('Allowed locations for newly added frontend test files:')
  console.error('- src/features/**')
  console.error('- src/pages/**')
  console.error('- api/__tests__/**')
  console.error('')
  console.error('See frontend/docs/testing-structure.md for policy.')
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`error: ${String(error?.message ?? error)}`)
  process.exit(1)
}
