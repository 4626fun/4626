#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function runNodeScript(scriptName, args = []) {
  const scriptPath = path.join(__dirname, scriptName)
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) throw result.error
  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status)
  }
}

function main() {
  const args = process.argv.slice(2)
  const skipCheck = args.includes('--skip-check')
  const artifactArgs = args.filter((arg) => arg !== '--skip-check')

  if (!skipCheck) {
    console.log('Running synthesis preflight...')
    runNodeScript('check-synthesis-submission-ready.mjs')
    console.log('')
  }

  console.log('Building synthesis submission bundle...')
  runNodeScript('generate-synthesis-artifacts.mjs', artifactArgs)
}

main()
