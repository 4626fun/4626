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

export async function uploadImmutableBlob(
  input: Blob,
  contentType: string,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const formData = new FormData()
  const fileName = `upload-${Date.now()}`
  const blob = contentType ? input.slice(0, input.size, contentType) : input
  formData.append('file', blob, fileName)
  const response = await fetch(`https://api.grove.storage/?chain_id=${chainId}`, {
    method: 'POST',
    body: formData,
  })
  return parseGroveResponse(response)
}

export async function uploadImmutableJson(
  data: unknown,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  return uploadImmutableBlob(blob, 'application/json', chainId)
}

export function resolveLensUri(uri: string): string {
  if (!uri) return ''
  if (uri.startsWith('lens://')) {
    return `https://api.grove.storage/${uri.slice('lens://'.length)}`
  }
  return uri
}
