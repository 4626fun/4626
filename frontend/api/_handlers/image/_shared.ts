import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getSessionAddress, isAdminAddress } from '../../../server/_lib/session.js'

export type ImageMutationBody = {
  projectId?: string
}

export type ApiSuccess<T> = { success: true; data: T }
export type ApiFailure = { success: false; error: string }

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

export async function readBody<T>(req: VercelRequest): Promise<T> {
  const body = (await readJsonBody<T>(req).catch(() => null)) ?? ((req as any).body as T | null)
  return (body ?? {}) as T
}

export function parseRequiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function isReferenceAssetRole(value: unknown): value is 'frame' | 'subject' {
  return value === 'frame' || value === 'subject'
}

export function decodeBase64Payload(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'))
}
