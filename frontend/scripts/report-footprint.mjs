import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const FRONTEND_ROOT = new URL('..', import.meta.url)
const PUBLIC_DIR = new URL('../public', import.meta.url)
const DIST_DIR = new URL('../dist', import.meta.url)
const VERCEL_JSON = new URL('../vercel.json', import.meta.url)
const LARGE_CHUNK_BYTES = 500 * 1024

function walkFiles(dirUrl) {
  const dirPath = dirUrl.pathname
  if (!existsSync(dirPath)) return []

  const out = []
  const stack = [dirPath]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const next = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(next)
        continue
      }
      if (!entry.isFile()) continue
      out.push({
        path: next,
        rel: relative(FRONTEND_ROOT.pathname, next),
        size: statSync(next).size,
      })
    }
  }
  return out
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function sumSizes(files) {
  return files.reduce((total, file) => total + file.size, 0)
}

function topFiles(files, limit = 10) {
  return [...files].sort((a, b) => b.size - a.size).slice(0, limit)
}

function markdownTable(files) {
  if (files.length === 0) return '_none_'
  const lines = ['| Size | File |', '| --- | --- |']
  for (const file of files) {
    lines.push(`| ${formatBytes(file.size)} | \`${file.rel}\` |`)
  }
  return lines.join('\n')
}

function loadFunctionCount() {
  const raw = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'))
  return Object.keys(raw.functions ?? {}).length
}

function buildSummary() {
  const publicFiles = walkFiles(PUBLIC_DIR)
  const distFiles = walkFiles(DIST_DIR)
  const largeDistFiles = distFiles.filter((file) => file.size >= LARGE_CHUNK_BYTES)
  const functionCount = loadFunctionCount()

  const lines = [
    '## Frontend Footprint',
    '',
    `- Public assets: ${publicFiles.length} files, ${formatBytes(sumSizes(publicFiles))}`,
    `- Vercel function entries: ${functionCount}`,
    `- Built assets: ${distFiles.length > 0 ? `${distFiles.length} files, ${formatBytes(sumSizes(distFiles))}` : 'dist not present'}`,
    '',
    '### Largest public assets',
    markdownTable(topFiles(publicFiles)),
    '',
    '### Largest built assets',
    distFiles.length > 0 ? markdownTable(topFiles(distFiles)) : '_dist not present in this run_',
    '',
    '### Large chunk warnings',
    largeDistFiles.length > 0
      ? largeDistFiles.map((file) => `- ${formatBytes(file.size)} \`${file.rel}\``).join('\n')
      : '_none_',
    '',
  ]

  return `${lines.join('\n')}\n`
}

const summary = buildSummary()
process.stdout.write(summary)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
}
