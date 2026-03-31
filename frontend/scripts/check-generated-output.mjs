#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0 && result.status !== 1) {
    const message = (result.stderr || result.stdout || '').trim()
    throw new Error(message || `git ${args.join(' ')} failed`)
  }
  return (result.stdout || '').trim()
}

function listTracked(pathspec) {
  const out = runGit(['ls-files', '--', pathspec])
  if (!out) return []
  return out.split('\n').map((line) => line.trim()).filter(Boolean)
}

function failIfTracked(pathspec) {
  const tracked = listTracked(pathspec)
  if (tracked.length === 0) return
  console.error(`error: generated output path is tracked: ${pathspec}`)
  for (const entry of tracked) console.error(`- ${entry}`)
  process.exitCode = 1
}

failIfTracked('dist')
failIfTracked('build')

if (process.exitCode && process.exitCode !== 0) {
  console.error('generated output must remain untracked; keep source assets in public/ and app code in src/.')
} else {
  console.log('ok: generated output paths (dist/build) are untracked')
}
