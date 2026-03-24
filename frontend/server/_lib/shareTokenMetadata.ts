import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'
import { resolveCreatorTokenArtwork, type CreatorTokenArtwork } from './creatorTokenArtwork.js'
import { resolveLensUserByOwner } from './lensAccounts.js'

type ShareTokenMetadataParams = {
  address: Address
  chainId: number
  rpcUrl?: string
  apiHost?: string
  appHost?: string
  zoraKey?: string | null
}

const SHARE_TOKEN_PUBLIC_DESCRIPTION = '4626.fun Share Token'
const LEGACY_SHARE_DESCRIPTION_MARKERS = [
  'Represents proportional ownership of assets in a Creator Coin Omnichain Vault',
  'Enables cross-chain transfers via LayerZero',
]

const SHARE_OFT_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'vault', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'registry', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'version', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'description', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

const VAULT_ABI = [
  { type: 'function', name: 'asset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

function normalizeHost(value?: string | null): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).host
    } catch {
      return ''
    }
  }
  return raw.replace(/^\/+|\/+$/g, '')
}

function inferProtocol(host: string): 'http' | 'https' {
  const normalized = host.toLowerCase()
  if (
    normalized.startsWith('localhost') ||
    normalized.startsWith('127.0.0.1') ||
    normalized.startsWith('0.0.0.0')
  ) {
    return 'http'
  }
  return 'https'
}

export function resolveShareTokenMetadataUrls(params: {
  address: Address
  chainId: number
  apiHost?: string
  appHost?: string
}): {
  apiBaseUrl: string
  appBaseUrl: string
  metadataUrl: string
  lensMetadataPreviewUrl: string
  lensMetadataStoreUrl: string
  imagePngUrl: string
  imageSvgUrl: string
} {
  const appHostValue = normalizeHost(params.appHost) || 'v1.4626.fun'
  // Prefer explicit API host when configured; otherwise keep metadata links on the app host.
  // This avoids emitting broken api.4626.fun links when API_HOST is unset or unavailable.
  const apiHostValue = normalizeHost(params.apiHost) || appHostValue
  const apiBaseUrl = `${inferProtocol(apiHostValue)}://${apiHostValue}`
  const appBaseUrl = `${inferProtocol(appHostValue)}://${appHostValue}`
  const metadataUrl = `${apiBaseUrl}/v1/token/${params.address}/metadata?chain=${params.chainId}`
  const lensMetadataPreviewUrl =
    `${apiBaseUrl}/lens/share-token-metadata?address=${params.address}&chain=${params.chainId}&store=false`
  const lensMetadataStoreUrl =
    `${apiBaseUrl}/lens/share-token-metadata?address=${params.address}&chain=${params.chainId}&store=true`
  const imagePngUrl = `${apiBaseUrl}/v1/token/${params.address}/image?chain=${params.chainId}&format=png`
  const imageSvgUrl = `${apiBaseUrl}/v1/token/${params.address}/image?chain=${params.chainId}&format=svg`
  return {
    apiBaseUrl,
    appBaseUrl,
    metadataUrl,
    lensMetadataPreviewUrl,
    lensMetadataStoreUrl,
    imagePngUrl,
    imageSvgUrl,
  }
}

export async function buildShareTokenMetadata({
  address,
  chainId,
  rpcUrl,
  apiHost,
  appHost,
  zoraKey,
}: ShareTokenMetadataParams): Promise<Record<string, unknown>> {
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl || 'https://mainnet.base.org'),
  })

  const [name, symbol, decimals, vault, version, description, owner] = await Promise.all([
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'name' }).catch(() => 'Unknown'),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'symbol' }).catch(() => '■TOKEN'),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'decimals' }).catch(() => 18),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'vault' }).catch(() => null),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'version' }).catch(() => '1.0.0'),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'description' }).catch(() => null),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'owner' }).catch(() => null),
  ])

  let creatorCoin: Address | null = null
  if (vault) {
    try {
      creatorCoin = (await client.readContract({
        address: vault as Address,
        abi: VAULT_ABI,
        functionName: 'asset',
      })) as Address
    } catch {
      // ignore
    }
  }

  let creatorCoinImage: string | null = null
  let creatorTokenArtwork: CreatorTokenArtwork | null = null
  let creatorCoinName: string | null = null
  let creatorCoinSymbol: string | null = null
  let creatorAddress: string | null = null
  let creatorHandle: string | null = null
  let creatorAvatar: string | null = null

  if (zoraKey && creatorCoin) {
    try {
      const sdk: any = await import('@zoralabs/coins-sdk')
      sdk.setApiKey(zoraKey)
      const coinResponse = await sdk.getCoin({
        address: creatorCoin,
        chain: chainId,
      })
      const coinData = coinResponse.data?.zora20Token
      if (coinData) {
        creatorTokenArtwork = resolveCreatorTokenArtwork(coinData)
        creatorCoinImage = creatorTokenArtwork?.artworkUrl ?? null
        creatorCoinName = coinData.name || null
        creatorCoinSymbol = typeof coinData.symbol === 'string' ? coinData.symbol : null
        creatorAddress = typeof coinData.creatorAddress === 'string' ? coinData.creatorAddress : null
        creatorHandle = typeof coinData.creatorProfile?.handle === 'string' ? coinData.creatorProfile.handle : null
        creatorAvatar =
          coinData.creatorProfile?.avatar?.previewImage?.medium ||
          coinData.creatorProfile?.avatar?.previewImage?.small ||
          null
      }
    } catch {
      // ignore
    }
  }

  const ownerAddress = typeof owner === 'string' ? owner : null
  const lensLookupAddress = creatorAddress || ownerAddress
  let lensProfile: Awaited<ReturnType<typeof resolveLensUserByOwner>> | null = null
  if (lensLookupAddress) {
    try {
      lensProfile = await resolveLensUserByOwner(lensLookupAddress)
    } catch {
      // ignore
    }
  }

  const {
    appBaseUrl,
    metadataUrl,
    lensMetadataPreviewUrl,
    lensMetadataStoreUrl,
    imagePngUrl,
    imageSvgUrl,
  } = resolveShareTokenMetadataUrls({
    address,
    chainId,
    apiHost,
    appHost,
  })
  const lensProfileUrl = lensProfile?.handle ? `https://hey.xyz/u/${lensProfile.handle}` : null

  // Always expose both raster and vector image endpoints.
  // The image handler gracefully falls back when upstream creator coin media is unavailable.
  const rawDescription = typeof description === 'string' ? description.trim() : ''
  const isLegacyDescription =
    rawDescription.length > 0 &&
    LEGACY_SHARE_DESCRIPTION_MARKERS.every((marker) => rawDescription.includes(marker))
  const publicDescription = !rawDescription || isLegacyDescription ? SHARE_TOKEN_PUBLIC_DESCRIPTION : rawDescription
  const artworkContract = creatorTokenArtwork
    ? {
        artworkUrl: creatorTokenArtwork.artworkUrl,
        ...(creatorTokenArtwork.heroCutoutArtworkUrl
          ? { heroCutoutArtworkUrl: creatorTokenArtwork.heroCutoutArtworkUrl }
          : {}),
      }
    : null

  return {
    id: `${chainId}:${address.toLowerCase()}`,
    name: String(name),
    symbol: String(symbol),
    decimals: Number(decimals),
    description: publicDescription,
    // Keep PNG as the default primary image for broad wallet compatibility.
    image: imagePngUrl,
    // Expose SVG in a standard rich-media field for clients that support vector rendering.
    animation_url: imageSvgUrl,
    metadata_uri: metadataUrl,
    contract_uri: metadataUrl,
    external_link: `${appBaseUrl}/vault/${address}`,
    underlying: {
      // This is the token bridged to Solana via the adapter flow.
      bridgeSourceToken: 'creatorCoin',
      address: creatorCoin || null,
      name: creatorCoinName,
      symbol: creatorCoinSymbol,
      image: creatorCoinImage,
    },
    extensions: {
      standards: ['ERC-7572', 'LayerZero OFT', 'SPL Token-2022 Bridge'],
      metadataApi: metadataUrl,
      images: {
        png: imagePngUrl,
        svg: imageSvgUrl,
      },
      lens: {
        profileUrl: lensProfileUrl,
        handle: lensProfile?.handle ?? creatorHandle,
        accountAddress: lensProfile?.accountAddress ?? null,
        ownerAddress: lensProfile?.ownerAddress ?? null,
        avatar: lensProfile?.avatar ?? creatorAvatar,
      },
      grove: {
        previewEndpoint: lensMetadataPreviewUrl,
        storeEndpoint: lensMetadataStoreUrl,
      },
      zora: {
        creatorCoinAddress: creatorCoin,
        creatorAddress: creatorAddress,
      },
      artwork: artworkContract,
    },
    properties: {
      category: SHARE_TOKEN_PUBLIC_DESCRIPTION,
      version: String(version),
      chainId,
      owner: ownerAddress,
      vault: vault || null,
      bridgeSourceToken: 'creatorCoin',
      underlyingAsset: creatorCoin || null,
      underlyingAssetName: creatorCoinName,
      underlyingAssetSymbol: creatorCoinSymbol,
      underlyingAssetImage: creatorCoinImage,
      artworkUrl: artworkContract?.artworkUrl ?? null,
      heroCutoutArtworkUrl: artworkContract?.heroCutoutArtworkUrl ?? null,
      creatorAddress: creatorAddress || lensProfile?.ownerAddress || null,
      creatorHandle: creatorHandle || lensProfile?.handle || null,
      creatorAvatar: creatorAvatar || lensProfile?.avatar || null,
      lensProfileUrl,
      lensAccountAddress: lensProfile?.accountAddress ?? null,
      lensOwnerAddress: lensProfile?.ownerAddress ?? null,
      metadataApi: metadataUrl,
      lensMetadataPreviewUrl,
      lensMetadataStoreUrl,
      imagePng: imagePngUrl,
      imageSvg: imageSvgUrl,
      twitter: 'https://x.com/4626fun',
      website: 'https://v1.4626.fun',
      isOFT: true,
      supportedChains: [8453, 1, 42161, 56, 43114],
    },
  }
}
