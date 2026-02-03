import { createHash } from 'node:crypto'

import { head, put } from '@vercel/blob'

declare const process: { env: Record<string, string | undefined> }

export type BlobHead = { url: string; size: number; contentType: string | null }

export function requireBlobToken() {
  const token = (process.env.BLOB_READ_WRITE_TOKEN ?? '').trim()
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured')
  return token
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export async function blobHeadOrNull(pathname: string): Promise<BlobHead | null> {
  try {
    const r: any = await head(pathname)
    const url = typeof r?.url === 'string' ? r.url : ''
    if (!url) return null
    const size = typeof r?.size === 'number' ? r.size : 0
    const contentType = typeof r?.contentType === 'string' ? r.contentType : null
    return { url, size, contentType }
  } catch {
    return null
  }
}

export async function fetchBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`fetch_failed(${res.status})`)
  const ab = await res.arrayBuffer()
  const ctRaw = res.headers.get('content-type')
  const contentType = ctRaw && ctRaw.trim().length > 0 ? ctRaw.trim() : null
  return { bytes: new Uint8Array(ab), contentType }
}

export async function blobPutBytes(params: {
  pathname: string
  bytes: Uint8Array
  contentType: string
  cacheControlMaxAgeSeconds?: number
}): Promise<{ url: string }> {
  const token = requireBlobToken()
  const r: any = await put(params.pathname, params.bytes, {
    access: 'public',
    contentType: params.contentType,
    token,
    ...(typeof params.cacheControlMaxAgeSeconds === 'number'
      ? { cacheControlMaxAge: params.cacheControlMaxAgeSeconds }
      : null),
  } as any)
  const url = typeof r?.url === 'string' ? r.url : ''
  if (!url) throw new Error('blob_put_failed')
  return { url }
}

