import { createPublicClient, http, type Address } from 'viem'
import { base } from 'viem/chains'

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

  const [name, symbol, decimals, vault, version, description] = await Promise.all([
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'name' }).catch(() => 'Unknown'),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'symbol' }).catch(() => '■TOKEN'),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'decimals' }).catch(() => 18),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'vault' }).catch(() => null),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'version' }).catch(() => '1.0.0'),
    client.readContract({ address, abi: SHARE_OFT_ABI, functionName: 'description' }).catch(() => null),
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
      }
    } catch {
      // ignore
    }
  }

  const apiHostValue = apiHost || 'api.4626.fun'
  const appHostValue = appHost || 'app.4626.fun'
  const protocol = apiHostValue.includes('localhost') ? 'http' : 'https'
  const apiBaseUrl = `${protocol}://${apiHostValue}`
  const appBaseUrl = `${protocol}://${appHostValue}`

  const imageUrl = creatorCoin
    ? `${apiBaseUrl}/v1/token/${address}/image?chain=${chainId}&format=png`
    : `${appBaseUrl}/logo.svg`

  return {
    name: String(name),
    symbol: String(symbol),
    decimals: Number(decimals),
    description: description
      ? String(description)
      : `${symbol} - CreatorVault Share Token representing ownership in a Creator Coin vault. Enables cross-chain transfers via LayerZero.`,
    image: imageUrl,
    external_link: `${appBaseUrl}/vault/${address}`,
    properties: {
      category: 'Creator Vault Share Token',
      version: String(version),
      chainId,
      vault: vault || null,
      underlyingAsset: creatorCoin || null,
      underlyingAssetName: creatorCoinName,
      underlyingAssetImage: creatorCoinImage,
      twitter: 'https://x.com/4626fun',
      website: 'https://app.4626.fun',
      isOFT: true,
      supportedChains: [8453, 1, 42161, 56, 43114],
    },
  }
}
