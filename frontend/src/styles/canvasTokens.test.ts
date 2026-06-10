import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// @ts-expect-error canvasTokens.mjs is a Node build helper without strict typings
import { hexToRgbTriplet, readSiteConfig, renderCanvasTokensCss, resolveCanvasTokens } from '../../scripts/canvasTokens.mjs'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('canvas tokens', () => {
  it('derives rgb from site-config backgroundColor', () => {
    const siteConfig = readSiteConfig()
    const tokens = resolveCanvasTokens(siteConfig)
    expect(tokens.bg).toBe(siteConfig.backgroundColor)
    expect(tokens.bgRgb).toBe(hexToRgbTriplet(siteConfig.backgroundColor))
  })

  it('keeps generated css files aligned with site-config', () => {
    const expected = renderCanvasTokensCss(resolveCanvasTokens())
    for (const relativePath of ['shared/canvas-tokens.css', 'public/canvas-tokens.css']) {
      const filePath = path.join(frontendRoot, relativePath)
      expect(fs.readFileSync(filePath, 'utf8')).toBe(expected)
    }
  })
})
