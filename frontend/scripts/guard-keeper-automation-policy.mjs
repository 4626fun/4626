#!/usr/bin/env node
/**
 * CI guard: block retired keeper automation address drift.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const RETIRED = '0xed401e824df0f3de05Da00C939e81Df60c68a0Cd'.toLowerCase()
const CANONICAL = '0xed7efe34d25a0b219de1b25ac99eb35e48cc1379'
const HOT_SAFE_HEX = '08f0875e40781578f902998b2b831cc48d838ebe'

const roots = [
  resolve(import.meta.dirname, '../server/_lib/wallet/keeperAutomationPolicy.ts'),
  resolve(import.meta.dirname, '../src/config/contracts.defaults.ts'),
  resolve(import.meta.dirname, '../../docs/_internal/operations/wallet/protocol-automation-safe-manifest.json'),
]

const errors = []

for (const file of roots) {
  const text = readFileSync(file, 'utf8').toLowerCase()
  if (text.includes(RETIRED) && !file.endsWith('keeperAutomationPolicy.test.ts')) {
    errors.push(`${file} references retired keeper EOA`)
  }
}

const policy = readFileSync(roots[0], 'utf8')
if (!policy.includes(CANONICAL)) {
  errors.push('keeperAutomationPolicy.ts missing canonical keeper EOA pin')
}

const defaults = readFileSync(roots[1], 'utf8').toLowerCase()
if (!defaults.includes(HOT_SAFE_HEX)) {
  errors.push('contracts.defaults.ts missing hot automation Safe pin')
}

if (errors.length > 0) {
  console.error('keeper automation guard failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

console.log('keeper automation guard OK')
