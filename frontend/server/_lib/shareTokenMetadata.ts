import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'
import { resolveLensUserByOwner } from './lensAccounts.js'

type ShareTokenMetadataParams = {
  address: Address
  chainId: number
  rpcUrl?: string
  apiHost?: string
  appHost?: string
  zoraKey?: string | null
}

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
  let creatorCoinName: string | null = null
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
        creatorCoinImage =
          coinData.mediaContent?.previewImage?.medium ||
          coinData.mediaContent?.previewImage?.small ||
          coinData.mediaContent?.originalUri ||
          null
        creatorCoinName = coinData.name || null
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

  const apiHostValue = apiHost || 'api.4626.fun'
  const appHostValue = appHost || 'app.4626.fun'
  const protocol = apiHostValue.includes('localhost') ? 'http' : 'https'
  const apiBaseUrl = `${protocol}://${apiHostValue}`
  const appBaseUrl = `${protocol}://${appHostValue}`
  const metadataUrl = `${apiBaseUrl}/v1/token/${address}/metadata?chain=${chainId}`
  const lensMetadataPreviewUrl = `${apiBaseUrl}/lens/share-token-metadata?address=${address}&chain=${chainId}&store=false`
  const lensMetadataStoreUrl = `${apiBaseUrl}/lens/share-token-metadata?address=${address}&chain=${chainId}&store=true`
  const lensProfileUrl = lensProfile?.handle ? `https://hey.xyz/u/${lensProfile.handle}` : null

  const imageUrl = creatorCoin
    ? `${apiBaseUrl}/v1/token/${address}/image?chain=${chainId}&format=png`
    : `${appBaseUrl}/logo.svg`

  return {
    id: `${chainId}:${address.toLowerCase()}`,
    name: String(name),
    symbol: String(symbol),
    decimals: Number(decimals),
    description: description
      ? String(description)
      : `${symbol} - CreatorVault Share Token representing ownership in a Creator Coin vault. Enables cross-chain transfers via LayerZero.`,
    image: imageUrl,
    metadata_uri: metadataUrl,
    contract_uri: metadataUrl,
    external_link: `${appBaseUrl}/vault/${address}`,
    extensions: {
      standards: ['ERC-7572', 'LayerZero OFT', 'SPL Token-2022 Bridge'],
      metadataApi: metadataUrl,
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
    },
    properties: {
      category: 'Creator Vault Share Token',
      version: String(version),
      chainId,
      owner: ownerAddress,
      vault: vault || null,
      underlyingAsset: creatorCoin || null,
      underlyingAssetName: creatorCoinName,
      underlyingAssetImage: creatorCoinImage,
      creatorAddress: creatorAddress || lensProfile?.ownerAddress || null,
      creatorHandle: creatorHandle || lensProfile?.handle || null,
      creatorAvatar: creatorAvatar || lensProfile?.avatar || null,
      lensProfileUrl,
      lensAccountAddress: lensProfile?.accountAddress ?? null,
      lensOwnerAddress: lensProfile?.ownerAddress ?? null,
      metadataApi: metadataUrl,
      lensMetadataPreviewUrl,
      lensMetadataStoreUrl,
      twitter: 'https://x.com/4626fun',
      website: 'https://app.4626.fun',
      isOFT: true,
      supportedChains: [8453, 1, 42161, 56, 43114],
    },
  }
}
