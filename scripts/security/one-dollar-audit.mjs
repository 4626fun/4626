#!/usr/bin/env node
/**
 * Root shim — runtime deps (`viem`, `@x402/*`) live in `frontend/package.json`.
 * Delegates to `frontend/scripts/security/one-dollar-audit.mjs` with cwd=frontend
 * so Node module resolution finds those packages after a normal frontend install.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const frontend = path.join(root, 'frontend')
const script = path.join(frontend, 'scripts/security/one-dollar-audit.mjs')

const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  cwd: frontend,
  stdio: 'inherit',
  env: process.env,
})

process.exit(result.status ?? 1)
