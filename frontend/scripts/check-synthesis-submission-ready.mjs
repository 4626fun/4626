#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const cwd = process.cwd()

const CHECKS = [
  {
    id: 'registration',
    label: 'ERC-8004 registration file',
    type: 'file',
    path: 'public/.well-known/agent-registration.json',
    required: true,
  },
  {
    id: 'domain-proof',
    label: 'ERC-8004 domain proof file',
    type: 'file',
    path: 'public/.well-known/erc8004.json',
    required: true,
  },
  {
    id: 'deploy-plan',
    label: 'canonical canary deploy plan',
    type: 'file',
    path: '../tmp/deploy-plan-v1.4.7-canary.json',
    required: true,
  },
  {
    id: 'audit-log',
    label: 'deploy audit log',
    type: 'file',
    path: 'artifacts/deploy-run.json',
    required: false,
  },
  {
    id: 'evidence',
    label: 'live evidence file',
    type: 'file',
    path: 'artifacts/synthesis-evidence.json',
    required: false,
  },
  {
    id: 'cv-auth',
    label: 'CV_AUTH_SESSION_TOKEN',
    type: 'env',
    key: 'CV_AUTH_SESSION_TOKEN',
    required: true,
  },
  {
    id: 'uniswap-key',
    label: 'UNISWAP_API_KEY',
    type: 'env',
    key: 'UNISWAP_API_KEY',
    required: true,
  },
  {
    id: 'bankr-key',
    label: 'BANKR_API_KEY',
    type: 'env',
    key: 'BANKR_API_KEY',
    required: true,
  },
  {
    id: 'base-rpc',
    label: 'BASE_RPC_URL',
    type: 'env',
    key: 'BASE_RPC_URL',
    required: true,
  },
]

async function readEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    const env = {}
    for (const line of raw.split(/\r?\n/g)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const idx = trimmed.indexOf('=')
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      env[key] = value
    }
    return env
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {}
    }
    throw error
  }
}

async function fileExists(relativePath) {
  try {
    await fs.access(path.resolve(cwd, relativePath))
    return true
  } catch {
    return false
  }
}

async function main() {
  const envFiles = [
    path.resolve(cwd, '.env'),
    path.resolve(cwd, '../.env'),
  ]

  const envMaps = await Promise.all(envFiles.map((filePath) => readEnvFile(filePath)))
  const mergedEnv = Object.assign({}, ...envMaps, process.env)

  const results = []
  for (const check of CHECKS) {
    if (check.type === 'file') {
      const present = await fileExists(check.path)
      results.push({ ...check, present })
      continue
    }
    const value = String(mergedEnv[check.key] ?? '').trim()
    results.push({ ...check, present: Boolean(value) })
  }

  const requiredMissing = results.filter((entry) => entry.required && !entry.present)
  const optionalMissing = results.filter((entry) => !entry.required && !entry.present)

  console.log('4626 Synthesis preflight')
  console.log('')

  for (const entry of results) {
    const status = entry.present ? 'ready' : entry.required ? 'missing' : 'not-yet'
    const suffix = entry.type === 'file' ? ` (${entry.path})` : ''
    console.log(`- ${entry.label}: ${status}${suffix}`)
  }

  console.log('')
  if (requiredMissing.length === 0) {
    console.log('Required inputs: ready')
  } else {
    console.log(`Required inputs missing: ${requiredMissing.length}`)
  }

  if (optionalMissing.length > 0) {
    console.log(`Optional proof artifacts missing: ${optionalMissing.length}`)
  }

  if (requiredMissing.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(`synthesis preflight failed: ${String(error?.message || error)}`)
  process.exit(1)
})
