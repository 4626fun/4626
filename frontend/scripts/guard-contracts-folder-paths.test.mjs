import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

test('guard-contracts-folder-paths passes on current repo', () => {
  const result = spawnSync(process.execPath, ['scripts/guard-contracts-folder-paths.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  assert.equal(
    result.status,
    0,
    result.stderr || result.stdout || 'guard failed unexpectedly',
  )
})
