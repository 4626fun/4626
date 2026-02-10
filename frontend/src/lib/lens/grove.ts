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

/**
 * One-step immutable upload to Grove.
 *
 * Per the Lens docs the one-step shortcut sends the raw binary body with a
 * `Content-Type` header — **not** multipart form-data.
 *
 * @see https://lens.xyz/docs/protocol/grove
 */
export async function uploadImmutableBlob(
  input: Blob,
  contentType: string,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const response = await fetch(`https://api.grove.storage/?chain_id=${chainId}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body: input,
  })
  return parseGroveResponse(response)
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

export function resolveLensUri(uri: string): string {
  if (!uri) return ''
  if (uri.startsWith('lens://')) {
    return `https://api.grove.storage/${uri.slice('lens://'.length)}`
  }
  return uri
}

export async function fetchLensResource(uri: string, init?: RequestInit): Promise<Response> {
  const resolved = resolveLensUri(uri).trim()
  if (!resolved) {
    throw new Error('Lens URI is required')
  }
  const response = await fetch(resolved, init)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Lens fetch failed (${response.status}): ${text || 'Unknown error'}`)
  }
  return response
}

export async function fetchLensJson<T = unknown>(uri: string, init?: RequestInit): Promise<T> {
  const response = await fetchLensResource(uri, init)
  return (await response.json()) as T
}
