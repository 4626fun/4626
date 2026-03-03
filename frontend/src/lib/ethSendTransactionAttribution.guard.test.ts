import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const FRONTEND_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const SCAN_DIRS = ['src', 'server', 'api'] as const
const EXCLUDED_FILE_REGEX = [
  /\.d\.ts$/,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /\/__tests__\//,
  /\/__mocks__\//,
  /\/generated\//,
]
const ALLOWLIST_FILE_PATTERNS = [
  'server/keepr/sendCommand.ts',
  'server/zora/commands.ts',
]
const ALLOWLIST_MARKER = 'builder-codes-allow-raw-send'
const SEND_METHOD_REGEX = /method:\s*['"]eth_sendTransaction['"]/g

function isExcluded(filePath: string): boolean {
  const normalized = filePath.split(path.sep).join('/')
  return EXCLUDED_FILE_REGEX.some((pattern) => pattern.test(normalized))
}

function isAllowlisted(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join('/')
  return ALLOWLIST_FILE_PATTERNS.some((pattern) => normalized.endsWith(pattern))
}

function collectFiles(dirPath: string): string[] {
  if (!statSync(dirPath, { throwIfNoEntry: false })?.isDirectory()) return []

  const entries = readdirSync(dirPath, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath))
      continue
    }
    if (!entry.isFile()) continue
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) continue
    if (isExcluded(fullPath)) continue
    files.push(fullPath)
  }
  return files
}

function lineForIndex(content: string, index: number): number {
  return content.slice(0, index).split('\n').length
}

describe('eth_sendTransaction attribution guard', () => {
  it('enforces attribution helper on raw provider request sends', () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(path.join(FRONTEND_ROOT, dir)))
    const violations: string[] = []

    for (const absolutePath of files) {
      const relativePath = path.relative(FRONTEND_ROOT, absolutePath)
      const content = readFileSync(absolutePath, 'utf8')
      const requestAwareAllowlist = isAllowlisted(relativePath)
      const hasFileAllowlistMarker = content.includes(ALLOWLIST_MARKER)
      const methodMatches = content.matchAll(SEND_METHOD_REGEX)

      for (const match of methodMatches) {
        const matchIndex = match.index ?? 0
        const line = lineForIndex(content, matchIndex)
        const start = Math.max(0, matchIndex - 300)
        const end = Math.min(content.length, matchIndex + 1000)
        const nearby = content.slice(start, end)
        const hasProviderRequestContext = /\.request\s*\(\s*\{/.test(nearby)

        if (!hasProviderRequestContext) continue
        if (requestAwareAllowlist || hasFileAllowlistMarker) continue

        const hasAttributionHelper =
          nearby.includes('appendBuilderSuffixToHex(') || nearby.includes('appendBuilderSuffixToHex (')

        if (!hasAttributionHelper) {
          violations.push(`${relativePath}:${line}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps allowlist scoped to known server wrappers', () => {
    for (const relativePath of ALLOWLIST_FILE_PATTERNS) {
      const absolutePath = path.join(FRONTEND_ROOT, relativePath)
      expect(statSync(absolutePath, { throwIfNoEntry: false })?.isFile()).toBe(true)
    }
  })
})
