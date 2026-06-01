import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  checkEnvExampleFile,
  checkSourceFile,
  collectCanonicalCswGuardViolations,
} from './guard-no-legacy-canonical-csw-env.mjs'

test('checkSourceFile flags retired env reads outside tests', () => {
  const dir = mkdtempSync(join(tmpdir(), 'canonical-csw-guard-'))
  const file = join(dir, 'server', 'bad.ts')
  mkdirSync(join(dir, 'server'), { recursive: true })
  writeFileSync(
    file,
    "const x = process.env.XMTP_AGENT_CSW_ADDRESS\n",
    'utf8',
  )
  const violations = checkSourceFile(file)
  assert.equal(violations.length, 1)
  assert.match(violations[0].message, /retired/)
})

test('checkSourceFile allows canonicalCswEnv.ts entry point', () => {
  const violations = checkSourceFile(
    join(process.cwd(), 'server/_lib/wallet/canonicalCswEnv.ts'),
  )
  assert.equal(
    violations.filter((v) => v.message.includes('direct process.env.CANONICAL_CSW')).length,
    0,
  )
})

test('checkEnvExampleFile flags active retired env assignments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'canonical-csw-guard-'))
  const file = join(dir, '.env.example')
  writeFileSync(
    file,
    '# ok comment\nXMTP_AGENT_CSW_ADDRESS=0xabc\nCANONICAL_CSW_ADDRESS=\n',
    'utf8',
  )
  const violations = checkEnvExampleFile(file)
  assert.equal(violations.length, 1)
  assert.match(violations[0].message, /env.example/)
})

test('collectCanonicalCswGuardViolations passes on current tree', () => {
  const violations = collectCanonicalCswGuardViolations()
  assert.deepEqual(violations, [])
})
