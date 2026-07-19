import sharp from 'sharp'

const MAX_BYTES = 8 * 1024 * 1024
const FETCH_TIMEOUT_MS = 12_000

export type RemoteImageDataUrl = {
  dataUrl: string
  contentType: string
  byteLength: number
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Fetch a remote image and normalize to a PNG data URL for Satori.
 * Animated GIFs become their first frame. Failures return null.
 */
export async function fetchImageAsPngDataUrl(
  url: string,
  opts?: { maxEdge?: number },
): Promise<RemoteImageDataUrl | null> {
  const clean = String(url ?? '').trim()
  if (!isHttpUrl(clean)) return null
  const maxEdge = Math.min(2048, Math.max(64, Math.round(opts?.maxEdge ?? 1280)))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(clean, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'image/*,*/*;q=0.8' },
    })
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') ?? 'application/octet-stream')
      .split(';')[0]
      ?.trim()
      .toLowerCase() || 'application/octet-stream'
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) return null

    const png = await sharp(buf, { animated: false, pages: 1 })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 8 })
      .toBuffer()

    return {
      dataUrl: `data:image/png;base64,${png.toString('base64')}`,
      contentType,
      byteLength: png.byteLength,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function twitterAvatarUrl(handle: string): string | null {
  const clean = String(handle ?? '').trim().replace(/^@/, '')
  if (!/^[A-Za-z0-9_]{1,15}$/.test(clean)) return null
  return `https://unavatar.io/x/${clean}`
}
