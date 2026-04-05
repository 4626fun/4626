import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const frontendRoot = path.resolve(import.meta.dirname, '../..')

describe('generated html shells guard', () => {
  it('keeps generated html files synchronized with templates', () => {
    const result = spawnSync(process.execPath, ['scripts/generate-html-shells.mjs', '--check'], {
      cwd: frontendRoot,
      encoding: 'utf8',
    })

    if (result.error) {
      throw result.error
    }

    const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
    expect(result.status, output || 'html shell generator check failed').toBe(0)
  })
})
