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

export function normalizeExactWrapTokenName(raw: string): string | null {
  const value = String(raw ?? '')
  if (!value) return null
  if (value.includes('\u0000')) return null
  if (value.length > WRAP_TOKEN_NAME_MAX_LENGTH) return null
  if (Buffer.byteLength(value, 'utf8') > WRAP_TOKEN_NAME_MAX_LENGTH) return null
  return value
}

export function normalizeExactWrapTokenSymbol(raw: string): string | null {
  const value = String(raw ?? '')
  if (!value) return null
  if (value.includes('\u0000')) return null
  if (value.length > WRAP_TOKEN_SYMBOL_MAX_LENGTH) return null
  if (Buffer.byteLength(value, 'utf8') > WRAP_TOKEN_SYMBOL_MAX_LENGTH) return null
  return value
}

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
