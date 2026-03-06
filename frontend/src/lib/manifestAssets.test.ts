import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = path.resolve(import.meta.dirname, '../..')
const publicRoot = path.join(frontendRoot, 'public')
const manifestPath = path.join(publicRoot, 'manifest.json')

describe('public manifest assets', () => {
  it('ships every referenced manifest icon in public for local dev', () => {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      icons?: Array<{ src?: string }>
    }

    const iconPaths = (manifest.icons ?? [])
      .map((icon) => String(icon?.src ?? '').trim())
      .filter(Boolean)

    expect(iconPaths.length).toBeGreaterThan(0)

    for (const iconPath of iconPaths) {
      const relativePath = iconPath.replace(/^\//, '')
      expect(existsSync(path.join(publicRoot, relativePath))).toBe(true)
    }
  })
})
