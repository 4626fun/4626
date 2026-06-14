import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '@4626/server-core'

type CsvValue = string | number
type CsvRow = Record<string, CsvValue>

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function parseStringQuery(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(value)) return parseStringQuery(value[0] ?? null)
  return null
}

function parseNumberCell(raw: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map((cell) => cell.trim())
  const rows: CsvRow[] = []

  for (const line of lines.slice(1)) {
    const cells = line.split(',').map((cell) => cell.trim())
    const row: CsvRow = {}
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i]
      if (!key) continue
      const raw = cells[i] ?? ''
      const numeric = parseNumberCell(raw)
      row[key] = numeric == null ? raw : numeric
    }
    rows.push(row)
  }

  return rows
}

function resolveBacktestsDirCandidates(): string[] {
  const cwd = process.cwd()
  return [
    path.resolve(cwd, 'tmp/backtests'),
    path.resolve(cwd, 'frontend/tmp/backtests'),
  ]
}

function normalizeRequestedFile(raw: string | null): string | null {
  if (!raw) return null
  const base = path.basename(raw)
  if (base !== raw) return null
  if (!base.endsWith('.csv')) return null
  return base
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-backtest-sweep', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const candidateDirs = resolveBacktestsDirCandidates()
    const requestedFile = normalizeRequestedFile(parseStringQuery(req.query.file))
    let selectedDir: string | null = null
    let files: string[] = []

    for (const dir of candidateDirs) {
      const dirEntries = await readdir(dir, { withFileTypes: true }).catch(() => [])
      const csvFiles = dirEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.csv'))
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a))
      if (csvFiles.length > 0) {
        selectedDir = dir
        files = csvFiles
        break
      }
    }

    if (files.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          files: [],
          file: null,
          rows: [],
          searchedDirs: candidateDirs,
        },
      })
    }

    const selected = requestedFile && files.includes(requestedFile) ? requestedFile : files[0]
    const fullPath = path.join(selectedDir ?? candidateDirs[0], selected)
    const raw = await readFile(fullPath, 'utf8')
    const rows = parseCsv(raw)

    return res.status(200).json({
      success: true,
      data: {
        files,
        file: selected,
        rows,
        resolvedDir: selectedDir,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'backtest_sweep_read_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
