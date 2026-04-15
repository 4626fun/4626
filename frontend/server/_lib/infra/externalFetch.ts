import { logger } from './logger.js'

type RejectReason = 'invalid_url' | 'disallowed_host' | 'timeout' | 'response_too_large' | 'upstream_error' | 'invalid_json'

type ExternalFetchBaseOptions = {
  label: string
  allowedHosts: readonly string[]
  timeoutMs?: number
  maxResponseBytes?: number
}

type ExternalFetchJsonOptions = ExternalFetchBaseOptions & {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export class ExternalFetchError extends Error {
  readonly reason: RejectReason
  readonly statusCode: number

  constructor(message: string, reason: RejectReason, statusCode = 502) {
    super(message)
    this.name = 'ExternalFetchError'
    this.reason = reason
    this.statusCode = statusCode
  }
}

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RESPONSE_BYTES = 1_000_000

function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

function isHostAllowed(hostname: string, allowedHosts: readonly string[]): boolean {
  const host = normalizeHost(hostname)
  return allowedHosts.some((entry) => {
    const rule = normalizeHost(entry)
    if (!rule) return false
    if (rule.startsWith('*.')) {
      const suffix = rule.slice(1) // keep leading dot
      return host.endsWith(suffix)
    }
    return host === rule
  })
}

function getRejectCounter(): Map<string, number> {
  const g = globalThis as any
  const key = '__4626_external_fetch_reject_counts'
  if (!g[key]) g[key] = new Map<string, number>()
  return g[key] as Map<string, number>
}

function recordReject(label: string, reason: RejectReason, context: Record<string, unknown>) {
  const counters = getRejectCounter()
  const key = `${label}:${reason}`
  counters.set(key, (counters.get(key) ?? 0) + 1)
  logger.warn('[external-fetch] rejected', { label, reason, ...context })
}

function parseAndValidateUrl(rawUrl: string, opts: ExternalFetchBaseOptions): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    recordReject(opts.label, 'invalid_url', { rawUrl })
    throw new ExternalFetchError('Invalid external URL', 'invalid_url', 500)
  }

  if (!isHostAllowed(parsed.hostname, opts.allowedHosts)) {
    recordReject(opts.label, 'disallowed_host', {
      host: parsed.hostname,
      allowedHosts: opts.allowedHosts,
    })
    throw new ExternalFetchError('Disallowed external host', 'disallowed_host', 500)
  }

  return parsed
}

async function readTextWithLimit(response: Response, opts: ExternalFetchBaseOptions): Promise<string> {
  const maxBytes = Math.max(1, Math.floor(opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES))
  const lenHeader = response.headers.get('content-length')
  const len = lenHeader ? Number(lenHeader) : NaN
  if (Number.isFinite(len) && len > maxBytes) {
    recordReject(opts.label, 'response_too_large', { contentLength: len, maxBytes })
    throw new ExternalFetchError('External response exceeds size limit', 'response_too_large', 502)
  }

  const text = await response.text()
  const size = new TextEncoder().encode(text).byteLength
  if (size > maxBytes) {
    recordReject(opts.label, 'response_too_large', { size, maxBytes })
    throw new ExternalFetchError('External response exceeds size limit', 'response_too_large', 502)
  }
  return text
}

export async function fetchExternalJson<T>(
  rawUrl: string,
  options: ExternalFetchJsonOptions,
): Promise<{ status: number; data: T }> {
  const opts: ExternalFetchBaseOptions = {
    ...options,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
  }

  const url = parseAndValidateUrl(rawUrl, opts)
  const timeoutMs = Math.max(1, Math.floor(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS))

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: ctrl.signal,
    })
  } catch (err) {
    if (ctrl.signal.aborted) {
      recordReject(opts.label, 'timeout', { timeoutMs, host: url.hostname })
      throw new ExternalFetchError('External request timed out', 'timeout', 504)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  const text = await readTextWithLimit(response, opts)
  if (!response.ok) {
    recordReject(opts.label, 'upstream_error', { status: response.status, host: url.hostname })
    throw new ExternalFetchError(`External upstream returned ${response.status}`, 'upstream_error', 502)
  }

  try {
    return { status: response.status, data: (text ? JSON.parse(text) : null) as T }
  } catch {
    recordReject(opts.label, 'invalid_json', { host: url.hostname })
    throw new ExternalFetchError('External upstream returned invalid JSON', 'invalid_json', 502)
  }
}
