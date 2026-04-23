import { useEffect, useState } from 'react'
import { useReadContract } from 'wagmi'
import { logger } from '@/lib/observability/logger'

// ABI for tokenURI function (common to CreatorCoin contracts)
const tokenURIAbi = [
  {
    inputs: [],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// ABI for ERC-7572 contract-level metadata (used by ShareOFT)
const contractURIAbi = [
  {
    inputs: [],
    name: 'contractURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

interface TokenMetadata {
  name?: string
  description?: string
  image?: string
  animation_url?: string
  external_url?: string
  attributes?: Array<{ trait_type: string; value: string | number }>
}

const DEFAULT_IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'

/**
 * L-20: Validate VITE_IPFS_GATEWAY before interpolating it into image
 * `src` attributes. Any value that is not a well-formed https:// URL
 * (e.g. `javascript:`, `data:`, a plain http:// URL that would trip
 * mixed-content on an https page, or garbage) is discarded in favour
 * of DEFAULT_IPFS_GATEWAY, with a console.warn so the misconfiguration
 * is visible in DevTools at startup.
 */
function resolveIpfsGateway(raw: string | undefined | null): string {
  const fallback = DEFAULT_IPFS_GATEWAY
  if (typeof raw !== 'string' || raw.trim().length === 0) return fallback
  const candidate = raw.trim()
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'https:') {
      console.warn(
        '[ipfs] VITE_IPFS_GATEWAY ignored: only https:// gateways are permitted, got protocol',
        u.protocol,
      )
      return fallback
    }
    if (!u.hostname) {
      console.warn('[ipfs] VITE_IPFS_GATEWAY ignored: missing hostname')
      return fallback
    }
    // Normalize trailing slashes so the concatenation below stays correct.
    return candidate.replace(/\/+$/, '') + '/'
  } catch {
    console.warn('[ipfs] VITE_IPFS_GATEWAY ignored: not a valid URL')
    return fallback
  }
}

const IPFS_GATEWAY = resolveIpfsGateway(import.meta.env.VITE_IPFS_GATEWAY as string | undefined)

const SAFE_HTTP_PROTOCOLS = new Set(['http:', 'https:'])

function isSafeHttpUrl(input: string): boolean {
  try {
    const u = new URL(input)
    return SAFE_HTTP_PROTOCOLS.has(u.protocol)
  } catch {
    return false
  }
}

function normalizeUrl(input: string | null | undefined): string | null {
  const s = typeof input === 'string' ? input.trim() : ''
  return s ? s : null
}

function normalizeImageUrl(input: string | null | undefined): string | null {
  const s = normalizeUrl(input)
  if (!s) return null
  if (s.startsWith('data:image/')) return s
  return isSafeHttpUrl(s) ? s : null
}

function toIpfsPath(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  // ipfs://<cid> or ipfs://ipfs/<cid>
  if (s.startsWith('ipfs://')) {
    const noProto = s.slice('ipfs://'.length)
    return noProto.replace(/^ipfs\//, '').replace(/^\/+/, '')
  }
  // direct cid
  if (s.startsWith('Qm') || s.startsWith('bafy')) return s
  // already an http(s) or data/ar uri
  return ''
}

// Convert IPFS URI to HTTP gateway URL
function ipfsToHttp(uri: string): string {
  if (!uri) return ''
  
  const ipfsPath = toIpfsPath(uri)
  if (ipfsPath) return `${IPFS_GATEWAY}${ipfsPath}`

  // Already an HTTP URL (or other scheme)
  return uri
}

function buildCanonicalTokenImageUrl(tokenAddress: `0x${string}`): string {
  return `/api/v1/token/${tokenAddress.toLowerCase()}/image?chain=8453&format=png`
}

export function selectMetadataSourceUri(params: { tokenURI?: unknown; contractURI?: unknown }): string | null {
  const tokenUri = typeof params.tokenURI === 'string' ? params.tokenURI.trim() : ''
  if (tokenUri) return tokenUri

  const contractUri = typeof params.contractURI === 'string' ? params.contractURI.trim() : ''
  if (contractUri) return contractUri

  return null
}

export function useTokenMetadata(tokenAddress: `0x${string}` | undefined) {
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch tokenURI from contract
  const { data: tokenURI, refetch } = useReadContract({
    address: tokenAddress,
    abi: tokenURIAbi,
    functionName: 'tokenURI',
    query: {
      enabled: !!tokenAddress,
      staleTime: 1000 * 60 * 5, // Consider stale after 5 minutes
      gcTime: 1000 * 60 * 10, // Garbage collect after 10 minutes
    },
  })

  // ShareOFT exposes ERC-7572 metadata via contractURI()
  const { data: contractURI, refetch: refetchContractURI } = useReadContract({
    address: tokenAddress,
    abi: contractURIAbi,
    functionName: 'contractURI',
    query: {
      enabled: !!tokenAddress,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
    },
  })

  useEffect(() => {
    async function fetchMetadata() {
      if (!tokenAddress) {
        setMetadata(null)
        setImageUrl(null)
        setError(null)
        setIsLoading(false)
        return
      }

      const metadataSource = selectMetadataSourceUri({ tokenURI, contractURI })
      if (!metadataSource) {
        // Fall back to canonical token image endpoint while metadata is unavailable.
        setMetadata(null)
        setImageUrl(buildCanonicalTokenImageUrl(tokenAddress))
        setError(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const metadataUrl = normalizeUrl(ipfsToHttp(metadataSource))
        if (!metadataUrl) {
          throw new Error('Empty tokenURI')
        }
        if (!isSafeHttpUrl(metadataUrl) && !metadataUrl.startsWith('data:')) {
          throw new Error('Unsafe tokenURI URL')
        }
        
        // First, check if the URI is a direct image link
        const isImageExtension = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(metadataUrl)
        const isDataUri = metadataUrl.startsWith('data:image/')
        
        if (isImageExtension || isDataUri) {
          // tokenURI points directly to an image
          const directImageUrl = normalizeImageUrl(metadataUrl)
          if (directImageUrl) {
            setImageUrl(directImageUrl)
            setMetadata({ image: directImageUrl })
          } else {
            setImageUrl(null)
            setMetadata(null)
          }
          return
        }

        // Try to fetch and check content type
        const response = await fetch(metadataUrl)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.status}`)
        }

        const contentType = response.headers.get('content-type') || ''
        
        // If it's an image, use the URL directly
        if (contentType.startsWith('image/')) {
          setImageUrl(metadataUrl)
          setMetadata({ image: metadataUrl })
          return
        }

        // Otherwise, parse as JSON metadata
        const data: TokenMetadata = await response.json()
        setMetadata(data)

        // Convert image URI to HTTP URL
        if (data.image) {
          setImageUrl(normalizeImageUrl(ipfsToHttp(data.image)))
        } else {
          setImageUrl(buildCanonicalTokenImageUrl(tokenAddress))
        }
      } catch (err) {
        // If JSON parse fails, the URI might be a direct image link
        // Try using metadata source directly as an image.
        const directUrl = normalizeImageUrl(ipfsToHttp(metadataSource))
        if (directUrl) {
          setImageUrl(directUrl)
          setMetadata({ image: directUrl })
          logger.debug('Using tokenURI directly as image', { directUrl })
        } else {
          setImageUrl(buildCanonicalTokenImageUrl(tokenAddress))
          setMetadata(null)
        }
        setError(err instanceof Error ? err.message : 'Failed to load token metadata')
      } finally {
        setIsLoading(false)
      }
    }

    fetchMetadata()
  }, [tokenAddress, tokenURI, contractURI])

  const refetchMetadata = async () => {
    await Promise.allSettled([refetch(), refetchContractURI()])
  }

  return {
    metadata,
    imageUrl,
    tokenURI,
    contractURI,
    isLoading,
    error,
    refetch: refetchMetadata, // Allow manual refresh
  }
}

// Helper hook to just get the image URL
export function useTokenImage(tokenAddress: `0x${string}` | undefined) {
  const { imageUrl, isLoading, error } = useTokenMetadata(tokenAddress)
  return { imageUrl, isLoading, error }
}