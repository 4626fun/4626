import type { Address, Abi } from 'viem'

export const WRAP_TOKEN_NAME_MAX_LENGTH = 32
export const WRAP_TOKEN_SYMBOL_MAX_LENGTH = 12
export const WRAP_TOKEN_METADATA_URI_MAX_LENGTH = 512

export const ERC20_METADATA_ABI = [
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const

type ReadContractClient = {
  readContract: (params: {
    address: Address
    abi: Abi | readonly unknown[]
    functionName: 'name' | 'symbol'
  }) => Promise<unknown>
}

export async function readBridgeTokenMetadata(params: {
  publicClient: ReadContractClient
  bridgeToken: Address
}): Promise<{ name: string; symbol: string } | null> {
  try {
    const [nameRaw, symbolRaw] = await Promise.all([
      params.publicClient.readContract({
        address: params.bridgeToken,
        abi: ERC20_METADATA_ABI,
        functionName: 'name',
      }),
      params.publicClient.readContract({
        address: params.bridgeToken,
        abi: ERC20_METADATA_ABI,
        functionName: 'symbol',
      }),
    ])
    const name = typeof nameRaw === 'string' ? nameRaw : ''
    const symbol = typeof symbolRaw === 'string' ? symbolRaw : ''
    if (!name || !symbol) return null
    return { name, symbol }
  } catch {
    return null
  }
}

/**
 * Normalize a Base ERC-20 `name()` for use as a Solana bridge-wrapped mint
 * name. Coerces to lowercase so every creator's Solana display is uniform
 * regardless of how the Base token cased its name. Rejects empty, null-byte,
 * and oversized inputs (fail-closed). The lowercase output is what flows
 * into the bridge program's wrapped-token PDA seed, so the Solana mint's
 * on-chain identity is bound to the lowercase form.
 */
export function normalizeWrapTokenName(raw: string): string | null {
  const value = String(raw ?? '')
  if (!value) return null
  if (value.includes('\u0000')) return null
  if (value.length > WRAP_TOKEN_NAME_MAX_LENGTH) return null
  if (Buffer.byteLength(value, 'utf8') > WRAP_TOKEN_NAME_MAX_LENGTH) return null
  const lowered = value.toLowerCase()
  // Re-check byte length after lowercasing — Unicode case folding can change
  // byte length (e.g. Turkish dotless i). Keep fail-closed if it overflows.
  if (Buffer.byteLength(lowered, 'utf8') > WRAP_TOKEN_NAME_MAX_LENGTH) return null
  return lowered
}

/**
 * Normalize a Base ERC-20 `symbol()` for use as a Solana bridge-wrapped mint
 * symbol. Same lowercase policy as the name normalizer: uniform lowercase
 * display, fail-closed on empty/null-byte/oversized inputs.
 */
export function normalizeWrapTokenSymbol(raw: string): string | null {
  const value = String(raw ?? '')
  if (!value) return null
  if (value.includes('\u0000')) return null
  if (value.length > WRAP_TOKEN_SYMBOL_MAX_LENGTH) return null
  if (Buffer.byteLength(value, 'utf8') > WRAP_TOKEN_SYMBOL_MAX_LENGTH) return null
  const lowered = value.toLowerCase()
  if (Buffer.byteLength(lowered, 'utf8') > WRAP_TOKEN_SYMBOL_MAX_LENGTH) return null
  return lowered
}

/**
 * @deprecated Renamed — use `normalizeWrapTokenName`. Kept as an alias so
 * consumers that import the old name don't break at the import layer; the
 * behavior changed at the same time (now lowercase-coerced, not exact-case).
 */
export const normalizeExactWrapTokenName = normalizeWrapTokenName

/**
 * @deprecated Renamed — use `normalizeWrapTokenSymbol`. Same aliasing
 * rationale as `normalizeExactWrapTokenName`.
 */
export const normalizeExactWrapTokenSymbol = normalizeWrapTokenSymbol

export function normalizeWrapTokenMetadataUri(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value) return null
  if (value.length > WRAP_TOKEN_METADATA_URI_MAX_LENGTH) return null
  try {
    const parsed = new URL(value)
    const protocol = parsed.protocol.toLowerCase()
    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'ipfs:' && protocol !== 'ar:') {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export function isLikelyUnsupportedMetadataUriFlagError(message: string): boolean {
  const lower = message.toLowerCase()
  const mentionsMetadataUri =
    lower.includes('--metadata-uri') ||
    lower.includes('metadata-uri') ||
    lower.includes('--metadatauri') ||
    lower.includes('metadatauri')
  if (!mentionsMetadataUri) return false
  return (
    lower.includes('unknown option') ||
    lower.includes('unknown argument') ||
    lower.includes('unexpected argument') ||
    lower.includes('unrecognized option') ||
    lower.includes("wasn't expected") ||
    lower.includes('unexpected value')
  )
}
