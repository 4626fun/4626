import fs from 'node:fs'
import path from 'node:path'

declare const process: { env: Record<string, string | undefined>; cwd: () => string }

type DocsEntry = {
  title: string
  source: string
  body: string
  bodyLower: string
}

export type DocsMatch = {
  title: string
  source: string
  snippet: string
  score: number
}

const CACHE_TTL_MS = 60_000
const DEFAULT_MAX_FILES = 2_500
const DEFAULT_MAX_FILE_BYTES = 200_000
const DEFAULT_MIN_TOKEN_LENGTH = 3
const DEFAULT_EXCLUDE_PREFIXES = ['api/contracts/']

let cachedDocs: DocsEntry[] | null = null
let cacheLoadedAtMs = 0

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function readBool(raw: string | undefined, fallback: boolean): boolean {
  const v = String(raw ?? '').trim().toLowerCase()
  if (!v) return fallback
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  return fallback
}

function normalizePathLike(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '')
}

function getConfiguredRoots(): string[] {
  const raw = String(process.env.ELIZA_DOCS_PATHS ?? '').trim()
  if (raw) {
    return raw
      .split(/[,\n]+/g)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => path.resolve(process.cwd(), entry))
  }

  const cwd = process.cwd()
  const candidates = [
    path.resolve(cwd, '../apps/docs-site/docs'),
    path.resolve(cwd, 'apps/docs-site/docs'),
    path.resolve(cwd, 'docs'),
  ]
  const existing = candidates.filter((candidate) => fs.existsSync(candidate))
  return existing.length > 0 ? existing : candidates.slice(0, 1)
}

function getExcludePrefixes(): string[] {
  const raw = String(process.env.ELIZA_DOCS_EXCLUDE_PREFIXES ?? '').trim()
  if (!raw) return DEFAULT_EXCLUDE_PREFIXES
  return raw
    .split(/[,\n]+/g)
    .map((entry) => normalizePathLike(entry.trim()))
    .filter(Boolean)
}

function shouldIncludeFile(filePath: string): boolean {
  const lower = filePath.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.mdx')
}

function walkMarkdownFiles(root: string, maxFiles: number, excludePrefixes: string[]): string[] {
  const files: string[] = []
  const stack: string[] = [root]

  while (stack.length > 0 && files.length < maxFiles) {
    const dir = stack.pop()
    if (!dir) break
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const rel = normalizePathLike(path.relative(root, full))
      if (entry.isDirectory()) {
        const shouldSkip = excludePrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))
        if (!shouldSkip) stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      if (!shouldIncludeFile(entry.name)) continue
      const blocked = excludePrefixes.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))
      if (blocked) continue
      files.push(full)
      if (files.length >= maxFiles) break
    }
  }
  return files
}

function stripMarkdown(raw: string): string {
  return raw
    .replace(/\r/g, '')
    .replace(/`{3}[\s\S]*?`{3}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function deriveTitle(raw: string, source: string): string {
  const h1 = raw.match(/^#\s+(.+)$/m)
  if (h1?.[1]?.trim()) return h1[1].trim()
  const base = path.basename(source).replace(/\.mdx?$/i, '')
  return base.replace(/[-_]/g, ' ').trim() || source
}

function readDocsFromRoot(root: string): DocsEntry[] {
  const maxFiles = parsePositiveInt(process.env.ELIZA_DOCS_MAX_FILES, DEFAULT_MAX_FILES)
  const maxFileBytes = parsePositiveInt(process.env.ELIZA_DOCS_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES)
  const excludePrefixes = getExcludePrefixes()
  const files = walkMarkdownFiles(root, maxFiles, excludePrefixes)
  const docs: DocsEntry[] = []

  for (const filePath of files) {
    try {
      const stat = fs.statSync(filePath)
      if (!stat.isFile()) continue
      if (stat.size > maxFileBytes) continue
      const raw = fs.readFileSync(filePath, 'utf8')
      const body = stripMarkdown(raw)
      if (!body) continue
      const source = normalizePathLike(path.relative(root, filePath))
      docs.push({
        title: deriveTitle(raw, source),
        source,
        body,
        bodyLower: body.toLowerCase(),
      })
    } catch {
      // Skip unreadable docs.
    }
  }

  return docs
}

function loadDocs(): DocsEntry[] {
  const now = Date.now()
  if (cachedDocs && now - cacheLoadedAtMs < CACHE_TTL_MS) return cachedDocs

  const roots = getConfiguredRoots()
  const allDocs: DocsEntry[] = []
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    allDocs.push(...readDocsFromRoot(root))
  }

  cachedDocs = allDocs
  cacheLoadedAtMs = now
  return allDocs
}

export function invalidateDocsKnowledgeCache(): void {
  cachedDocs = null
  cacheLoadedAtMs = 0
}

function tokenize(input: string): string[] {
  const minLen = parsePositiveInt(process.env.ELIZA_DOCS_MIN_TOKEN_LENGTH, DEFAULT_MIN_TOKEN_LENGTH)
  const out = new Set<string>()
  input
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= minLen)
    .forEach((token) => out.add(token))
  return [...out]
}

function scoreEntry(entry: DocsEntry, query: string, tokens: string[]): number {
  if (tokens.length === 0) return 0
  const titleLower = entry.title.toLowerCase()
  let tokenHits = 0
  let titleHits = 0
  for (const token of tokens) {
    if (entry.bodyLower.includes(token)) tokenHits += 1
    if (titleLower.includes(token)) titleHits += 1
  }
  const coverage = tokenHits / tokens.length
  const titleBoost = Math.min(0.35, (titleHits / tokens.length) * 0.35)
  const phraseBoost = entry.bodyLower.includes(query.toLowerCase()) ? 0.25 : 0
  return coverage + titleBoost + phraseBoost
}

function buildSnippet(body: string, tokens: string[]): string {
  if (tokens.length === 0) return body.slice(0, 320).trim()
  const bodyLower = body.toLowerCase()
  let first = -1
  for (const token of tokens) {
    const idx = bodyLower.indexOf(token)
    if (idx >= 0 && (first === -1 || idx < first)) first = idx
  }
  if (first < 0) return body.slice(0, 320).trim()
  const start = Math.max(0, first - 140)
  const end = Math.min(body.length, first + 260)
  return body.slice(start, end).trim()
}

export function queryDocsKnowledge(
  query: string,
  options?: { limit?: number; minScore?: number },
): DocsMatch[] {
  const docs = loadDocs()
  if (docs.length === 0) return []
  const q = String(query ?? '').trim()
  if (!q) return []
  const limit = Math.max(1, Math.min(10, options?.limit ?? 3))
  const minScore = typeof options?.minScore === 'number' ? options.minScore : 0.2
  const tokens = tokenize(q)
  if (tokens.length === 0) return []

  const scored = docs
    .map((entry) => {
      const score = scoreEntry(entry, q, tokens)
      return {
        title: entry.title,
        source: entry.source,
        score,
        snippet: buildSnippet(entry.body, tokens),
      }
    })
    .filter((entry) => entry.score >= minScore)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit)
}

export function formatDocsContext(matches: DocsMatch[]): string {
  if (!matches.length) return ''
  const withSources = readBool(process.env.ELIZA_DOCS_INCLUDE_SOURCES, true)
  return matches
    .map((match, index) => {
      const src = withSources ? ` [source: ${match.source}]` : ''
      return `${index + 1}. ${match.title}${src}\n${match.snippet}`
    })
    .join('\n\n')
}
