import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getSessionAddress,
  isAdminAddress,
} from '@4626/server-core'



export type ImageMutationBody = {
  projectId?: string
}

export type ApiSuccess<T> = { success: true; data: T }
export type ApiFailure = { success: false; error: string }

/** CORS + no-store + admin-only gate. Used by AdminImageGeneration flows. */
export function prepareImageApi(req: VercelRequest, res: VercelResponse): boolean {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return true

  const admin = getSessionAddress(req)
  if (!admin) {
    res.status(401).json({ success: false, error: 'Sign in required' })
    return true
  }
  if (!isAdminAddress(admin)) {
    res.status(403).json({ success: false, error: 'Admin only' })
    return true
  }

  return false
}

/** CORS + no-store + any-authenticated-user gate. Used by vault-deploy image gen flows. */
export function prepareImageApiAuthenticated(req: VercelRequest, res: VercelResponse): boolean {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return true

  const actor = getSessionAddress(req)
  if (!actor) {
    res.status(401).json({ success: false, error: 'Sign in required' })
    return true
  }

  return false
}

export function requireImageApiAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const actor = getSessionAddress(req)
  if (!actor) {
    res.status(401).json({ success: false, error: 'Not authenticated' })
    return true
  }
  if (!isAdminAddress(actor)) {
    res.status(403).json({ success: false, error: 'Admin only' })
    return true
  }
  return false
}

/** Returns the authenticated session address, or null if not signed in. */
export function getImageApiActor(req: VercelRequest): string | null {
  return getSessionAddress(req) ?? null
}

export async function readBody<T>(
  req: VercelRequest,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const maxBytes = Number.isFinite(options.maxBytes) && (options.maxBytes ?? 0) > 0
    ? Math.floor(options.maxBytes ?? 256_000)
    : 256_000
  const preParsedBody = (req as any).body
  if (preParsedBody && typeof preParsedBody === 'object') {
    try {
      const estimatedBytes = Buffer.byteLength(JSON.stringify(preParsedBody), 'utf8')
      if (estimatedBytes > maxBytes) throw new Error('body_too_large')
    } catch {
      throw new Error('body_too_large')
    }
  }
  const body = (await readJsonBody<T>(req, { maxBytes }).catch(() => null)) ?? (preParsedBody as T | null)
  return (body ?? {}) as T
}

export function parseRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function isReferenceAssetRole(value: unknown): value is 'frame' | 'subject' {
  return value === 'frame' || value === 'subject'
}

export function decodeBase64Payload(value: string, options: { maxBytes?: number } = {}): Uint8Array {
  const maxBytes = Number.isFinite(options.maxBytes) && (options.maxBytes ?? 0) > 0
    ? Math.floor(options.maxBytes ?? 10 * 1024 * 1024)
    : 10 * 1024 * 1024
  const decoded = Buffer.from(value, 'base64')
  if (decoded.byteLength > maxBytes) {
    throw new Error('payload_too_large')
  }
  return new Uint8Array(decoded)
}
