import {
  StorageClient,
  immutable,
  production,
  type FileUploadResponse,
} from '@lens-chain/storage-client'

export const LENS_MAINNET_CHAIN_ID = 232
export const BASE_CHAIN_ID = 8453

// ---------------------------------------------------------------------------
// Shared StorageClient singleton (production environment)
// ---------------------------------------------------------------------------

let _storageClient: StorageClient | null = null

function getStorageClient(): StorageClient {
  if (!_storageClient) {
    _storageClient = StorageClient.create(production)
  }
  return _storageClient
}

// ---------------------------------------------------------------------------
// Result types — backward-compatible with existing callers.
// ---------------------------------------------------------------------------

export type GroveUploadResult = {
  storageKey: string
  gatewayUrl: string
  lensUri: string
  statusUrl: string | null
}

function toGroveUploadResult(res: FileUploadResponse): GroveUploadResult {
  return {
    storageKey: res.storageKey,
    gatewayUrl: res.gatewayUrl,
    lensUri: res.uri,
    statusUrl: null,
  }
}

// ---------------------------------------------------------------------------
// Immutable uploads
// ---------------------------------------------------------------------------

/**
 * Upload a Blob (binary file) immutably to Grove.
 */
export async function uploadImmutableBlob(
  input: Blob,
  contentType: string,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const client = getStorageClient()
  const file = new File([input], 'upload', { type: contentType || 'application/octet-stream' })
  const result = await client.uploadFile(file, { acl: immutable(chainId) })
  return toGroveUploadResult(result)
}

/**
 * Upload JSON data immutably to Grove.
 */
export async function uploadImmutableJson(
  data: unknown,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const client = getStorageClient()
  const result = await client.uploadAsJson(data, { acl: immutable(chainId) })
  return toGroveUploadResult(result)
}

// ---------------------------------------------------------------------------
// URI resolution — delegates to StorageClient.resolve()
// ---------------------------------------------------------------------------

export function resolveLensUri(uri: string): string {
  if (!uri) return ''
  if (uri.startsWith('lens://')) {
    return getStorageClient().resolve(uri)
  }
  return uri
}

// ---------------------------------------------------------------------------
// Fetch helpers — use resolved URIs
// ---------------------------------------------------------------------------

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
