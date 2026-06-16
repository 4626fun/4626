import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { RATE_LIMITS, checkRateLimit, getClientIp, rateLimitKey } from '@4626/server-core'

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

function resolveBacktestsDirCandidates(): string[] {
  const cwd = process.cwd()
  return [path.resolve(cwd, 'tmp/backtests'), path.resolve(cwd, 'frontend/tmp/backtests')]
}

type BacktestFileEntry = {
  dir: string
  name: string
  mtimeMs: number
}

function normalizeRequestedFile(raw: string | null): string | null {
  if (!raw) return null
  const base = path.basename(raw)
  if (base !== raw) return null
  if (!base.endsWith('.csv')) return null
  return base
}

function toSeriesFileName(baseCsvFile: string): string {
  return baseCsvFile.endsWith('.csv') ? baseCsvFile.replace(/\.csv$/i, '-series.json') : `${baseCsvFile}-series.json`
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
    rateLimitKey('alfaclub-backtest-series', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  try {
    const candidateDirs = resolveBacktestsDirCandidates()
    const requestedFile = normalizeRequestedFile(parseStringQuery(req.query.file))
    const requestedRunId = parseStringQuery(req.query.runId)

    const discovered: BacktestFileEntry[] = []
    for (const dir of candidateDirs) {
      const dirEntries = await readdir(dir, { withFileTypes: true }).catch(() => [])
      const csvFiles = dirEntries.filter(
        (entry) => entry.isFile() && entry.name.endsWith('.csv') && !entry.name.endsWith('-rebalances.csv'),
      )
      for (const file of csvFiles) {
        const fullPath = path.join(dir, file.name)
        const mtimeMs = await stat(fullPath)
          .then((meta) => meta.mtimeMs)
          .catch(() => 0)
        discovered.push({ dir, name: file.name, mtimeMs })
      }
    }

    const sorted = discovered.sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))
    const files = Array.from(new Set(sorted.map((entry) => entry.name)))

    if (files.length === 0) {
      return res.status(200).json({
        success: true,
        data: null,
      })
    }

    const selected =
      requestedFile && files.includes(requestedFile) ? requestedFile : (sorted[0]?.name ?? files[0])
    const selectedEntry = sorted.find((entry) => entry.name === selected) ?? sorted[0]
    if (!selectedEntry) {
      return res.status(500).json({ success: false, error: 'backtest_series_file_resolve_failed' })
    }

    const seriesFile = toSeriesFileName(selected)
    const fullPath = path.join(selectedEntry.dir, seriesFile)
    const raw = await readFile(fullPath, 'utf8').catch(() => null)
    if (!raw) {
      return res.status(200).json({
        success: true,
        data: null,
      })
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (
      requestedRunId &&
      typeof parsed.runId === 'string' &&
      parsed.runId !== requestedRunId
    ) {
      // One series JSON per sweep CSV — return it even when runId strings drift (float formatting).
      res.setHeader('X-Backtest-Series-RunId-Mismatch', '1')
    }

    return res.status(200).json({
      success: true,
      data: parsed,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'backtest_series_read_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
