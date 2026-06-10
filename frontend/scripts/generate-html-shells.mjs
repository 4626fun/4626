#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { HTML_SHELL_TEMPLATE_VARS } from './html-shells.config.mjs'
import { syncCanvasTokens } from './sync-canvas-tokens.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendRoot = path.resolve(__dirname, '..')
const shellsRoot = path.join(frontendRoot, 'html-shells')

const templateTargets = [
  { template: 'templates/index.html.tpl', output: 'index.html' },
  { template: 'templates/app.html.tpl', output: 'app.html' },
  { template: 'templates/telegram-link.html.tpl', output: 'telegram-link.html' },
]

const INCLUDE_LINE_PATTERN = /^[ \t]*\{\{>\s*([^\}\n]+)\s*\}\}[ \t]*\r?\n?/gm
const INCLUDE_TOKEN_PATTERN = /\{\{>\s*([^\}\n]+)\s*\}\}/
const VARIABLE_PATTERN = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g
const KNOWN_ARGS = new Set(['--check'])

function resolveShellPath(relativePath) {
  const resolved = path.resolve(shellsRoot, relativePath)
  const allowedRoot = `${shellsRoot}${path.sep}`
  if (!resolved.startsWith(allowedRoot) && resolved !== shellsRoot) {
    throw new Error(`include path escapes html-shells root: ${relativePath}`)
  }
  return resolved
}

function renderShellFile(relativePath, stack = []) {
  const absPath = resolveShellPath(relativePath)
  if (!fs.existsSync(absPath)) {
    throw new Error(`missing shell file: ${relativePath}`)
  }
  const raw = fs.readFileSync(absPath, 'utf8')

  const rendered = raw.replace(INCLUDE_LINE_PATTERN, (_, includePathRaw) => {
    const includePath = includePathRaw.trim()
    if (stack.includes(includePath)) {
      throw new Error(`circular include detected: ${[...stack, includePath].join(' -> ')}`)
    }
    return renderShellFile(includePath, [...stack, includePath])
  })

  const unresolved = rendered.match(INCLUDE_TOKEN_PATTERN)
  if (unresolved) {
    throw new Error(`unresolved include token "${unresolved[0]}" in ${relativePath}`)
  }

  const interpolated = rendered.replace(VARIABLE_PATTERN, (_, variableNameRaw) => {
    const variableName = variableNameRaw.trim()
    const value = HTML_SHELL_TEMPLATE_VARS[variableName]
    if (typeof value !== 'string') {
      throw new Error(`unresolved template variable "${variableName}" in ${relativePath}`)
    }
    return value
  })

  return interpolated
}

function writeIfChanged(relativeOutputPath, nextContent) {
  const outputPath = path.join(frontendRoot, relativeOutputPath)
  const prevContent = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : ''
  if (prevContent === nextContent) return false
  fs.writeFileSync(outputPath, nextContent, 'utf8')
  return true
}

function isStale(relativeOutputPath, nextContent) {
  const outputPath = path.join(frontendRoot, relativeOutputPath)
  const prevContent = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : ''
  return prevContent !== nextContent
}

function main() {
  const argList = process.argv.slice(2)
  const unknownArgs = argList.filter((arg) => !KNOWN_ARGS.has(arg))
  if (unknownArgs.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`unknown arg(s): ${unknownArgs.join(', ')}`)
    // eslint-disable-next-line no-console
    console.error('usage: node scripts/generate-html-shells.mjs [--check]')
    process.exitCode = 1
    return
  }

  const args = new Set(argList)
  const checkOnly = args.has('--check')
  let changedCount = 0
  const stalePaths = []

  const canvasSync = syncCanvasTokens({ checkOnly })
  if (checkOnly && canvasSync.stalePaths.length > 0) {
    stalePaths.push(...canvasSync.stalePaths)
  }

  for (const { template, output } of templateTargets) {
    const rendered = renderShellFile(template)
    if (checkOnly) {
      if (isStale(output, rendered)) stalePaths.push(output)
      continue
    }
    if (writeIfChanged(output, rendered)) changedCount += 1
  }

  if (checkOnly) {
    if (stalePaths.length === 0) {
      // eslint-disable-next-line no-console
      console.log('html shells are up to date')
      return
    }

    // eslint-disable-next-line no-console
    console.error('html shells are out of date (run: pnpm generate:html-shells):')
    for (const stalePath of stalePaths) {
      // eslint-disable-next-line no-console
      console.error(`- ${stalePath}`)
    }
    process.exitCode = 1
    return
  }

  if (changedCount === 0) {
    // eslint-disable-next-line no-console
    console.log('html shells are already up to date')
    return
  }

  // eslint-disable-next-line no-console
  console.log(`updated ${changedCount} html shell${changedCount === 1 ? '' : 's'}`)
}

main()
