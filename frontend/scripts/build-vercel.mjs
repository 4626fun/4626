#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const PLAN_ONLY = process.argv.includes('--plan') || process.env.VERCEL_BUILD_PLAN_ONLY === '1'

function run(command, args) {
  const rendered = `${command} ${args.join(' ')}`
  console.log(`[build:vercel] ${rendered}`)
  const startedAt = Date.now()
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  })
  const elapsedMs = Date.now() - startedAt
  console.log(`[build:vercel] completed in ${(elapsedMs / 1000).toFixed(2)}s: ${rendered}`)
  if (result.status !== 0) {
    const exitCode = typeof result.status === 'number' ? result.status : 1
    process.exit(exitCode)
  }
}

function gitOutput(args) {
  const result = spawnSync('git', args, {
    stdio: ['ignore', 'pipe', 'ignore'],
    env: process.env,
    encoding: 'utf8',
  })
  if (result.status !== 0) return null
  return (result.stdout || '').trim()
}

function gitCommitExists(ref) {
  const result = spawnSync('git', ['cat-file', '-e', `${ref}^{commit}`], {
    stdio: 'ignore',
    env: process.env,
  })
  return result.status === 0
}

function resolveCommitRange() {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (
    previousSha &&
    currentSha &&
    gitCommitExists(previousSha) &&
    gitCommitExists(currentSha)
  ) {
    return { from: previousSha, to: currentSha }
  }
  if (gitCommitExists('HEAD^') && gitCommitExists('HEAD')) {
    return { from: 'HEAD^', to: 'HEAD' }
  }
  return null
}

function readCommitMessage(toRef) {
  const fromEnv = (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').trim()
  if (fromEnv) return fromEnv
  return gitOutput(['log', '-1', '--pretty=%B', toRef]) || ''
}

function listChangedFiles(range) {
  const changed = gitOutput(['diff', '--name-only', range.from, range.to])
  if (changed == null) return null
  const files = changed
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
  return files
}

function shouldBuildMarketingVault(files) {
  if (!files) return { build: true, matchedTrigger: null }
  if (files.length === 0) return { build: false, matchedTrigger: null }

  for (const file of files) {
    if (file === 'pnpm-lock.yaml') return { build: true, matchedTrigger: file }
    if (file === 'frontend/package.json') return { build: true, matchedTrigger: file }
    if (file === 'frontend/pnpm-lock.yaml') return { build: true, matchedTrigger: file }
    if (file === 'frontend/vite.marketing-vault.config.ts') return { build: true, matchedTrigger: file }
    if (file === 'frontend/scripts/build-vercel.mjs') return { build: true, matchedTrigger: file }
    if (file === 'frontend/scripts/sync-immersive-three-vendor.mjs') return { build: true, matchedTrigger: file }
    if (file === 'frontend/scripts/copy-marketing-vault-bundle.mjs') return { build: true, matchedTrigger: file }
    if (file === 'frontend/html-shells/templates/index.html.tpl') return { build: true, matchedTrigger: file }

    if (file.startsWith('frontend/src/marketing/')) return { build: true, matchedTrigger: file }
    if (file.startsWith('frontend/public/immersive/')) return { build: true, matchedTrigger: file }
    if (file.startsWith('tools/vault-images/')) return { build: true, matchedTrigger: file }
  }

  return { build: false, matchedTrigger: null }
}

function buildPlan() {
  const ref = process.env.VERCEL_GIT_COMMIT_REF || ''
  const onMain = ref === '' || ref === 'main' || ref === 'refs/heads/main'
  if (!onMain) {
    return {
      buildMarketingVault: true,
      reason: 'non-main ref (conservative full build)',
      matchedTrigger: null,
    }
  }

  const range = resolveCommitRange()
  if (!range) {
    return {
      buildMarketingVault: true,
      reason: 'commit range unavailable (conservative full build)',
      matchedTrigger: null,
    }
  }

  const message = readCommitMessage(range.to)
  if (message.includes('[force-vercel]') || message.includes('[force-vercel-full-build]')) {
    return {
      buildMarketingVault: true,
      reason: 'forced by commit message override',
      matchedTrigger: '[force-vercel]',
    }
  }

  const changedFiles = listChangedFiles(range)
  const buildMarketing = shouldBuildMarketingVault(changedFiles)
  return {
    buildMarketingVault: buildMarketing.build,
    reason: buildMarketing.build ? 'marketing inputs changed' : 'marketing inputs unchanged',
    matchedTrigger: buildMarketing.matchedTrigger,
  }
}

const plan = buildPlan()
const triggerSuffix = plan.matchedTrigger ? ` [trigger: ${plan.matchedTrigger}]` : ''
console.log(
  `[build:vercel] marketing bundle: ${plan.buildMarketingVault ? 'build' : 'skip'} (${plan.reason})${triggerSuffix}`,
)
if ((process.env.VERCEL_FORCE_NO_BUILD_CACHE || '').trim() !== '') {
  console.warn(
    '[build:vercel] warning: VERCEL_FORCE_NO_BUILD_CACHE is set; cache restore is disabled and build time will increase.',
  )
}

if (PLAN_ONLY) process.exit(0)

run('pnpm', ['run', 'build:server-core'])
run('pnpm', ['run', 'build:app'])
run('pnpm', ['run', 'build:telegram-link-standalone'])

if (plan.buildMarketingVault) {
  run('pnpm', ['run', 'build:marketing-vault'])
} else {
  console.log('[build:vercel] skipping build:marketing-vault')
}
