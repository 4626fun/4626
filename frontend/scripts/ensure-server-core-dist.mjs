#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { execSync } from 'node:child_process'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(scriptDir, '..')
const distIndex = resolve(frontendRoot, 'packages/server-core/dist/index.js')
const distAuth = resolve(frontendRoot, 'packages/server-core/dist/auth.js')

if (existsSync(distIndex) && existsSync(distAuth)) {
  process.exit(0)
}

console.log('[dev bootstrap] Missing @4626/server-core dist artifacts; building now...')
execSync('pnpm run build:server-core', {
  cwd: frontendRoot,
  stdio: 'inherit',
})
