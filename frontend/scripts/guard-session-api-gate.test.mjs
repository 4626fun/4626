import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

const SCRIPT = fileURLToPath(new URL('./guard-session-api-gate.mjs', import.meta.url))

describe('guard-session-api-gate', () => {
  it('passes on the current tree', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /ok: session-api-gate/)
  })
})
