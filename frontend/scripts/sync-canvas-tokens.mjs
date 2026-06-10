#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderCanvasTokensCss, resolveCanvasTokens } from './canvasTokens.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')

const OUTPUT_PATHS = [
  path.join(frontendRoot, 'shared/canvas-tokens.css'),
  path.join(frontendRoot, 'public/canvas-tokens.css'),
]

function writeIfChanged(filePath, content) {
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  if (prev === content) return false
  fs.writeFileSync(filePath, content, 'utf8')
  return true
}

export function syncCanvasTokens({ checkOnly = false } = {}) {
  const tokens = resolveCanvasTokens()
  const css = renderCanvasTokensCss(tokens)
  const stalePaths = []

  for (const outputPath of OUTPUT_PATHS) {
    if (checkOnly) {
      const prev = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : ''
      if (prev !== css) stalePaths.push(path.relative(frontendRoot, outputPath))
      continue
    }
    writeIfChanged(outputPath, css)
  }

  return { tokens, stalePaths }
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const { tokens, stalePaths } = syncCanvasTokens({ checkOnly })

  if (checkOnly) {
    if (stalePaths.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`canvas tokens are up to date (${tokens.bg})`)
      return
    }
    // eslint-disable-next-line no-console
    console.error('canvas tokens are out of date (run: pnpm sync:canvas-tokens):')
    for (const stalePath of stalePaths) {
      // eslint-disable-next-line no-console
      console.error(`- ${stalePath}`)
    }
    process.exitCode = 1
    return
  }

  // eslint-disable-next-line no-console
  console.log(`synced canvas tokens (${tokens.bg})`)
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  main()
}
