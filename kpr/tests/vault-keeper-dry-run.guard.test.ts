import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('vault keeper dry-run bridge guard', () => {
  it('never routes dry-run writes through the live HTTP bridge', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'actions/vault-keeper.action.ts'),
      'utf8',
    )
    expect(source).toContain('!isDryRun() && shouldUseKeeperHttpBridge()')
  })
})
