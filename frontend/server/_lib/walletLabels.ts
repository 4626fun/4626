/**
 * WalletLabels API client for entity labeling.
 *
 * Resolves wallet addresses to known entity labels (e.g. "Coinbase", "Binance",
 * "Uniswap") with categories and subcategories.
 *
 * @see https://docs.walletlabels.xyz/
 */

const WALLET_LABELS_BASE = 'https://api.walletlabels.xyz'

export type WalletLabel = {
  /** Display name of the entity (e.g. "Coinbase"). */
  name: string
  /** Category (e.g. "exchange", "defi", "mixer", "bridge"). */
  category: string
  /** Subcategory for finer granularity. */
  subcategory?: string
  /** Source of the label. */
  source: 'walletlabels' | 'etherscan'
}

export type WalletLabelResult = {
  address: string
  labels: WalletLabel[]
  /** Whether the address is associated with a known entity. */
  isKnownEntity: boolean
}

type WalletLabelsApiResponse = {
  address?: string
  address_name?: string
  label_type?: string
  label_subtype?: string
  label?: string
}

function getWalletLabelsApiKey(): string {
  return (process.env.WALLET_LABELS_API_KEY ?? '').trim()
}

function chainSlug(chainId: number): string {
  switch (chainId) {
    case 1:
      return 'ethereum'
    case 8453:
      return 'base'
    case 10:
      return 'optimism'
    case 42161:
      return 'arbitrum'
    default:
      return 'ethereum'
  }
}

async function fetchWalletLabels(
  address: string,
  chainId: number,
): Promise<WalletLabel[]> {
  const apiKey = getWalletLabelsApiKey()
  if (!apiKey) return []

  const slug = chainSlug(chainId)
  const url = `${WALLET_LABELS_BASE}/${slug}/label/${address.toLowerCase()}`

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 8_000)

  try {
    const res = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        Accept: 'application/json',
      },
      signal: ctrl.signal,
    })

    if (!res.ok) return []

    const data = await res.json()

    // The API can return a single object or an array.
    const items: WalletLabelsApiResponse[] = Array.isArray(data) ? data : data ? [data] : []

    return items
      .filter((item) => item.address_name || item.label)
      .map((item) => ({
        name: item.address_name || item.label || 'Unknown',
        category: item.label_type || 'unknown',
        subcategory: item.label_subtype || undefined,
        source: 'walletlabels' as const,
      }))
  } catch {
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fallback: Etherscan name tag lookup via the public page scrape pattern.
 * This is a best-effort fallback when WalletLabels is unavailable.
 * Uses the Etherscan v2 API if a name tag is available.
 */
async function fetchEtherscanNameTag(
  address: string,
  chainId: number,
): Promise<WalletLabel | null> {
  const apiKey = (process.env.ETHERSCAN_API_KEY ?? '').trim()
  if (!apiKey) return null

  // Etherscan v2 doesn't have a direct name-tag endpoint on free tier.
  // We'll skip this fallback for now and rely on WalletLabels.
  return null
}

/**
 * Resolve labels for a single address.
 */
export async function getWalletLabelsForAddress(
  address: string,
  chainId: number = 8453,
): Promise<WalletLabelResult> {
  const labels = await fetchWalletLabels(address, chainId)

  // If WalletLabels returned nothing, try Etherscan fallback.
  if (labels.length === 0) {
    const etherscanLabel = await fetchEtherscanNameTag(address, chainId)
    if (etherscanLabel) labels.push(etherscanLabel)
  }

  return {
    address: address.toLowerCase(),
    labels,
    isKnownEntity: labels.length > 0,
  }
}

/**
 * Resolve labels for multiple addresses in parallel.
 */
export async function getWalletLabelsBatch(
  addresses: string[],
  chainId: number = 8453,
): Promise<Record<string, WalletLabelResult>> {
  const results: Record<string, WalletLabelResult> = {}

  // Batch in groups of 10 to avoid overwhelming the API.
  const BATCH_SIZE = 10
  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((addr) => getWalletLabelsForAddress(addr, chainId)),
    )
    for (const result of batchResults) {
      results[result.address] = result
    }
  }

  return results
}
