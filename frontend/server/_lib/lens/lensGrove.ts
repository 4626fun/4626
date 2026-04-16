import {
  StorageClient,
  immutable,
  walletOnly,
  lensAccountOnly,
  production,
  type FileUploadResponse,
} from '@lens-chain/storage-client'

export const LENS_MAINNET_CHAIN_ID = 232
export const BASE_CHAIN_ID = 8453

/**
 * Returns the configured Grove chain ID from the environment.
 * Defaults to Lens Mainnet (232). Set `GROVE_CHAIN_ID=8453` for Base-specific data.
 */
export function getGroveChainId(): number {
  const envVal = process.env.GROVE_CHAIN_ID
  if (envVal) {
    const parsed = parseInt(envVal, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return LENS_MAINNET_CHAIN_ID
}

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

export { getStorageClient }

// ---------------------------------------------------------------------------
// Result types — kept backward-compatible with all existing callers.
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
// Immutable JSON upload (replaces raw fetch)
// ---------------------------------------------------------------------------

export async function uploadImmutableJson(
  data: unknown,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const client = getStorageClient()
  const result = await client.uploadAsJson(data, { acl: immutable(chainId) })
  return toGroveUploadResult(result)
}

// ---------------------------------------------------------------------------
// Immutable file upload (binary / Blob)
// ---------------------------------------------------------------------------

export async function uploadImmutableFile(
  file: File,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadResult> {
  const client = getStorageClient()
  const result = await client.uploadFile(file, { acl: immutable(chainId) })
  return toGroveUploadResult(result)
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

/**
 * Try to upload a file to Grove with one automatic retry.
 * Returns `{ ok: true, result }` on success or `{ ok: false, error }` on
 * failure — never throws.
 */
export async function tryUploadImmutableFile(
  file: File,
  chainId: number = LENS_MAINNET_CHAIN_ID,
): Promise<GroveUploadAttempt> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await uploadImmutableFile(file, chainId)
      return { ok: true, result }
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1_500))
        continue
      }
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  }
  return { ok: false, error: 'File upload failed after retries' }
}

// ---------------------------------------------------------------------------
// Mutable uploads — content that can be updated or deleted by the owner.
// ---------------------------------------------------------------------------

export type MutableAclType = 'wallet' | 'lensAccount'

type HexAddress = `0x${string}`

function toHex(address: string): HexAddress {
  return (address.startsWith('0x') ? address : `0x${address}`) as HexAddress
}

/**
 * Upload JSON to Grove with a mutable ACL.
 *
 * - `wallet` ACL: only the specified wallet address can update/delete.
 * - `lensAccount` ACL: only the specified Lens account can update/delete.
 *
 * Use for content that changes over time: agent metadata, creator profiles,
 * vault configuration, etc.
 */
export async function uploadMutableJson(
  data: unknown,
  opts: {
    aclType: MutableAclType
    address: string
    chainId?: number
  },
): Promise<GroveUploadResult> {
  const client = getStorageClient()
  const chainId = opts.chainId ?? LENS_MAINNET_CHAIN_ID
  const hex = toHex(opts.address)
  const acl =
    opts.aclType === 'lensAccount'
      ? lensAccountOnly(hex, chainId)
      : walletOnly(hex, chainId)
  const result = await client.uploadAsJson(data, { acl })
  return toGroveUploadResult(result)
}

/**
 * Upload a file to Grove with a mutable ACL.
 */
export async function uploadMutableFile(
  file: File,
  opts: {
    aclType: MutableAclType
    address: string
    chainId?: number
  },
): Promise<GroveUploadResult> {
  const client = getStorageClient()
  const chainId = opts.chainId ?? LENS_MAINNET_CHAIN_ID
  const hex = toHex(opts.address)
  const acl =
    opts.aclType === 'lensAccount'
      ? lensAccountOnly(hex, chainId)
      : walletOnly(hex, chainId)
  const result = await client.uploadFile(file, { acl })
  return toGroveUploadResult(result)
}

/**
 * Signer for mutable Grove operations (matches the SDK's `Signer` interface).
 */
export type GroveSigner = {
  signMessage: (args: { message: string }) => Promise<string>
  address: HexAddress
}

/**
 * Update existing mutable JSON content on Grove.
 *
 * Requires the storage key from a previous mutable upload, the new data,
 * a signer that matches the original ACL, and the ACL for the updated content.
 */
export async function updateMutableJson(
  storageKey: string,
  data: unknown,
  signer: GroveSigner,
  opts: {
    aclType: MutableAclType
    address: string
    chainId?: number
  },
): Promise<GroveUploadResult> {
  const client = getStorageClient()
  const chainId = opts.chainId ?? LENS_MAINNET_CHAIN_ID
  const hex = toHex(opts.address)
  const acl =
    opts.aclType === 'lensAccount'
      ? lensAccountOnly(hex, chainId)
      : walletOnly(hex, chainId)
  const result = await client.updateJson(storageKey, data, signer, { acl })
  return toGroveUploadResult(result)
}

/**
 * Graceful mutable JSON upload — retry once, return null on failure.
 */
export async function tryUploadMutableJson(
  data: unknown,
  opts: {
    aclType: MutableAclType
    address: string
    chainId?: number
  },
): Promise<GroveUploadAttempt> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await uploadMutableJson(data, opts)
      return { ok: true, result }
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1_500))
        continue
      }
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  }
  return { ok: false, error: 'Mutable upload failed after retries' }
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
