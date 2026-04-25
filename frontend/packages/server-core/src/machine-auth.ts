import { timingSafeEqual } from 'node:crypto'

import type { VercelRequest, VercelResponse } from '@vercel/node'

import type { ApiEnvelope } from './auth.js'

type BearerAuthOptions = {
  envKey: string
  missingSecretError?: string
  unauthorizedError?: string
}

type OptionalHeaderAuthOptions = {
  envKey: string
  headerName: string
  unauthorizedError?: string
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  if (expectedBytes.length === 0 || providedBytes.length !== expectedBytes.length) return false
  return timingSafeEqual(providedBytes, expectedBytes)
}

function readHeaderValue(req: VercelRequest, headerName: string): string | null {
  const direct = req.headers?.[headerName] ?? req.headers?.[headerName.toLowerCase()]
  const raw = Array.isArray(direct) ? String(direct[0] ?? '') : String(direct ?? '')
  const trimmed = raw.trim()
  if (!trimmed) return null
  const bearer = /^Bearer\s+(.+)$/i.exec(trimmed)
  if (bearer?.[1]) return bearer[1].trim() || null
  return trimmed
}

export function readBearerToken(authorizationHeader: string | string[] | undefined): string | null {
  const value = Array.isArray(authorizationHeader)
    ? String(authorizationHeader[0] ?? '')
    : String(authorizationHeader ?? '')
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = /^Bearer\s+(.+)$/i.exec(trimmed)
  if (!match) return null
  const token = match[1]?.trim()
  return token ? token : null
}

export function requireBearerEnvAuth(
  req: VercelRequest,
  res: VercelResponse,
  options: BearerAuthOptions,
): boolean {
  const configuredSecret = String(process.env[options.envKey] ?? '').trim()
  if (!configuredSecret) {
    const error = options.missingSecretError ?? 'Server misconfigured'
    res.status(500).json({ success: false, error } satisfies ApiEnvelope<never>)
    return false
  }

  const token = readBearerToken(req.headers.authorization)
  if (!token || !safeCompareSecret(token, configuredSecret)) {
    const error = options.unauthorizedError ?? 'Unauthorized'
    res.status(401).json({ success: false, error } satisfies ApiEnvelope<never>)
    return false
  }

  return true
}

export function requireKeeprApiKey(
  req: VercelRequest,
  res: VercelResponse,
  options?: Pick<BearerAuthOptions, 'missingSecretError' | 'unauthorizedError'>,
): boolean {
  return requireBearerEnvAuth(req, res, {
    envKey: 'KEEPR_API_KEY',
    missingSecretError: options?.missingSecretError ?? 'KEEPR_API_KEY not configured',
    unauthorizedError: options?.unauthorizedError ?? 'Unauthorized',
  })
}

/**
 * M-06 (audit 2026-04-25) centralization helper. Wraps `requireBearerEnvAuth`
 * for handlers under `frontend/api/_handlers/admin/**` that gate on a single
 * `ADMIN_API_TOKEN` env var with a constant-time bearer compare.
 *
 * Use from new handlers; existing handlers that re-implement the same
 * pattern inline (see audit M-06 / L-04 for the migration surface) should
 * be migrated to this helper one PR at a time so admin-token logic lives
 * in exactly one place.
 *
 * Returns false and writes a 401 (or 500 if the env var is unset) to `res`
 * when the request fails the gate; returns true and leaves `res` untouched
 * on success.
 */
export function requireAdminApiToken(
  req: VercelRequest,
  res: VercelResponse,
  options?: {
    /** Custom error string for the 401 path. Defaults to 'admin_token_invalid'. */
    unauthorizedError?: string
    /** Custom error string for the 500 path when ADMIN_API_TOKEN is unset. Defaults to 'admin_token_missing'. */
    missingSecretError?: string
  },
): boolean {
  return requireBearerEnvAuth(req, res, {
    envKey: 'ADMIN_API_TOKEN',
    missingSecretError: options?.missingSecretError ?? 'admin_token_missing',
    unauthorizedError: options?.unauthorizedError ?? 'admin_token_invalid',
  })
}

// FIX: FINDING-06 — fail closed when the env var is absent instead of allowing
// unauthenticated access. A misconfigured deployment should reject requests,
// not silently bypass auth.
export function requireOptionalHeaderEnvAuth(
  req: VercelRequest,
  res: VercelResponse,
  options: OptionalHeaderAuthOptions,
): boolean {
  const configuredSecret = String(process.env[options.envKey] ?? '').trim()
  if (!configuredSecret) {
    res.status(500).json({ success: false, error: `Server misconfigured: ${options.envKey} is not set` } satisfies ApiEnvelope<never>)
    return false
  }

  const providedSecret = readHeaderValue(req, options.headerName)
  if (!providedSecret || !safeCompareSecret(providedSecret, configuredSecret)) {
    const error = options.unauthorizedError ?? 'Unauthorized'
    res.status(401).json({ success: false, error } satisfies ApiEnvelope<never>)
    return false
  }
  return true
}
