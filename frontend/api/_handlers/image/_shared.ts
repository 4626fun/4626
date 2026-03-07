import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'

export type ImageMutationBody = {
  projectId?: string
}

export type ApiSuccess<T> = { success: true; data: T }
export type ApiFailure = { success: false; error: string }

export function prepareImageApi(req: VercelRequest, res: VercelResponse): boolean {
  setCors(req, res)
  setNoStore(res)
  return handleOptions(req, res)
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
