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

function gitFetch(args) {
  const result = spawnSync('git', ['fetch', '--no-tags', ...args], {
    stdio: ['ignore', 'ignore', 'ignore'],
    env: process.env,
  })
  return result.status === 0
}

function ensureCommitAvailable(ref) {
  if (!ref) return false
  if (gitCommitExists(ref)) return true
  // Fast path: ask origin for exactly this commit-ish.
  gitFetch(['--depth=1', 'origin', ref])
  if (gitCommitExists(ref)) return true
  // Fallback for shallow clones where previous SHA is just outside depth.
  gitFetch(['--depth=64', 'origin', '+refs/heads/main:refs/remotes/origin/main'])
  return gitCommitExists(ref)
}

function resolveCommitRange() {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (previousSha && currentSha && ensureCommitAvailable(previousSha) && ensureCommitAvailable(currentSha)) {
    return { from: previousSha, to: currentSha }
  }
  if (!gitCommitExists('HEAD^')) {
    gitFetch(['--depth=2', 'origin', 'HEAD'])
    gitFetch(['--depth=64', 'origin', '+refs/heads/main:refs/remotes/origin/main'])
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

function shouldBuildTelegramLinkStandalone(files) {
  if (!files) return { build: true, matchedTrigger: null }
  if (files.length === 0) return { build: false, matchedTrigger: null }

  for (const file of files) {
    if (file === 'pnpm-lock.yaml') return { build: true, matchedTrigger: file }
    if (file === 'frontend/package.json') return { build: true, matchedTrigger: file }
    if (file === 'frontend/pnpm-lock.yaml') return { build: true, matchedTrigger: file }
    if (file === 'frontend/vite.config.ts') return { build: true, matchedTrigger: file }
    if (file === 'frontend/scripts/build-vercel.mjs') return { build: true, matchedTrigger: file }
    if (file === 'frontend/scripts/generate-html-shells.mjs') return { build: true, matchedTrigger: file }
    if (file === 'frontend/scripts/html-shells.config.mjs') return { build: true, matchedTrigger: file }
    if (file === 'frontend/telegram-link.html') return { build: true, matchedTrigger: file }

    if (file.startsWith('frontend/html-shells/templates/')) return { build: true, matchedTrigger: file }
    if (file.startsWith('frontend/src/')) return { build: true, matchedTrigger: file }
    if (file.startsWith('frontend/public/')) return { build: true, matchedTrigger: file }
  }

  return { build: false, matchedTrigger: null }
}

function buildPlan() {
  const ref = process.env.VERCEL_GIT_COMMIT_REF || ''
  const onMain = ref === '' || ref === 'main' || ref === 'refs/heads/main'
  if (!onMain) {
    return {
      buildTelegramLinkStandalone: true,
      telegramReason: 'non-main ref (conservative full build)',
      telegramMatchedTrigger: null,
      buildMarketingVault: true,
      marketingReason: 'non-main ref (conservative full build)',
      marketingMatchedTrigger: null,
    }
  }

  const range = resolveCommitRange()
  if (!range) {
    return {
      buildTelegramLinkStandalone: true,
      telegramReason: 'commit range unavailable (conservative full build)',
      telegramMatchedTrigger: null,
      buildMarketingVault: true,
      marketingReason: 'commit range unavailable (conservative full build)',
      marketingMatchedTrigger: null,
    }
  }

  const message = readCommitMessage(range.to)
  if (message.includes('[force-vercel]') || message.includes('[force-vercel-full-build]')) {
    return {
      buildTelegramLinkStandalone: true,
      telegramReason: 'forced by commit message override',
      telegramMatchedTrigger: '[force-vercel]',
      buildMarketingVault: true,
      marketingReason: 'forced by commit message override',
      marketingMatchedTrigger: '[force-vercel]',
    }
  }

  const changedFiles = listChangedFiles(range)
  const buildTelegram = shouldBuildTelegramLinkStandalone(changedFiles)
  const buildMarketing = shouldBuildMarketingVault(changedFiles)
  return {
    buildTelegramLinkStandalone: buildTelegram.build,
    telegramReason: buildTelegram.build
      ? 'telegram-link inputs changed'
      : 'telegram-link inputs unchanged',
    telegramMatchedTrigger: buildTelegram.matchedTrigger,
    buildMarketingVault: buildMarketing.build,
    marketingReason: buildMarketing.build ? 'marketing inputs changed' : 'marketing inputs unchanged',
    marketingMatchedTrigger: buildMarketing.matchedTrigger,
  }
}

const plan = buildPlan()
const telegramTriggerSuffix = plan.telegramMatchedTrigger
  ? ` [trigger: ${plan.telegramMatchedTrigger}]`
  : ''
const marketingTriggerSuffix = plan.marketingMatchedTrigger
  ? ` [trigger: ${plan.marketingMatchedTrigger}]`
  : ''
const useParallelAppTelegramBuild =
  String(process.env.VERCEL_EXPERIMENTAL_PARALLEL_APP_TELEGRAM_BUILD ?? '').trim() === '1'
console.log(
  `[build:vercel] telegram-link bundle: ${plan.buildTelegramLinkStandalone ? 'build' : 'skip'} (${plan.telegramReason})${telegramTriggerSuffix}`,
)
console.log(
  `[build:vercel] marketing bundle: ${plan.buildMarketingVault ? 'build' : 'skip'} (${plan.marketingReason})${marketingTriggerSuffix}`,
)
if ((process.env.VERCEL_FORCE_NO_BUILD_CACHE || '').trim() !== '') {
  console.warn(
    '[build:vercel] warning: VERCEL_FORCE_NO_BUILD_CACHE is set; cache restore is disabled and build time will increase.',
  )
}

if (PLAN_ONLY) process.exit(0)

run('pnpm', ['run', 'build:server-core'])
if (useParallelAppTelegramBuild) {
  console.log(
    '[build:vercel] app+telegram: parallel experimental mode enabled (VERCEL_EXPERIMENTAL_PARALLEL_APP_TELEGRAM_BUILD=1)',
  )
  run('pnpm', ['run', 'build:app-and-telegram:parallel-experimental'])
} else {
  run('pnpm', ['run', 'build:app'])
  if (plan.buildTelegramLinkStandalone) {
    run('pnpm', ['run', 'build:telegram-link-standalone'])
  } else {
    console.log('[build:vercel] skipping build:telegram-link-standalone')
  }
}

if (plan.buildMarketingVault) {
  run('pnpm', ['run', 'build:marketing-vault'])
} else {
  console.log('[build:vercel] skipping build:marketing-vault')
}
