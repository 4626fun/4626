import { timingSafeEqual } from 'node:crypto'

import type { VercelRequest, VercelResponse } from '@vercel/node'

import type { ApiEnvelope } from './auth.js'

type BearerAuthOptions = {
  envKey: string
  missingSecretError?: string
  unauthorizedError?: string
}

function safeCompareSecret(provided: string, expected: string): boolean {
  const expectedBytes = Buffer.from(expected)
  const providedBytes = Buffer.from(provided)
  if (expectedBytes.length === 0 || providedBytes.length !== expectedBytes.length) return false
  return timingSafeEqual(providedBytes, expectedBytes)
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
