export const LENS_MAINNET_CHAIN_ID = 232

type GroveUploadItem = {
  storage_key: string
  gateway_url: string
  uri: string
  status_url?: string
}

export type GroveUploadResult = {
  storageKey: string
  gatewayUrl: string
  lensUri: string
  statusUrl: string | null
}

function parseGroveJson(text: string): GroveUploadItem[] {
  const parsed = JSON.parse(text) as GroveUploadItem | GroveUploadItem[]
  return Array.isArray(parsed) ? parsed : [parsed]
}

function normalizeUploadItem(item: GroveUploadItem): GroveUploadResult {
  if (!item.storage_key || !item.gateway_url || !item.uri) {
    throw new Error('Grove response missing required fields')
  }
  return {
    storageKey: item.storage_key,
    gatewayUrl: item.gateway_url,
    lensUri: item.uri,
    statusUrl: item.status_url ?? null,
  }
}

async function parseGroveResponse(response: Response): Promise<GroveUploadResult> {
  if (!response.ok && response.status !== 202) {
    const text = await response.text().catch(() => '')
    throw new Error(`Grove upload failed (${response.status}): ${text || 'Unknown error'}`)
  }
  const text = await response.text()
  if (!text.trim()) {
    throw new Error('Grove upload returned empty response')
  }
  const items = parseGroveJson(text)
  if (!items.length) throw new Error('Grove upload returned empty payload')
  return normalizeUploadItem(items[0])
}

export async function uploadImmutableJson(
  data: unknown,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const body = JSON.stringify(data, null, 2)
  const response = await fetch(`https://api.grove.storage/?chain_id=${chainId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
  return parseGroveResponse(response)
}

// ---------------------------------------------------------------------------
// Graceful variant — retry once, return null on failure instead of throwing.
// ---------------------------------------------------------------------------

export type GroveUploadAttempt =
  | { ok: true; result: GroveUploadResult }
  | { ok: false; error: string }

/**
 * Try to upload JSON to Grove with one automatic retry.
 * Returns `{ ok: true, result }` on success or `{ ok: false, error }` on
 * failure — never throws.
 */
export async function tryUploadImmutableJson(
  data: unknown,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadAttempt> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await uploadImmutableJson(data, chainId)
      return { ok: true, result }
    } catch (err) {
      // On first failure, wait briefly then retry once.
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1_500))
        continue
      }
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  }
  // Unreachable, but satisfies TS.
  return { ok: false, error: 'Upload failed after retries' }
}

export function resolveLensUri(uri: string): string {
  if (!uri) return ''
  if (uri.startsWith('lens://')) {
    return `https://api.grove.storage/${uri.slice('lens://'.length)}`
  }
  return uri
}
