/**
 * Etherscan API v2 (unified multichain) — Base via chainid=8453.
 * @see https://docs.etherscan.io/etherscan-v2
 */

export const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api'
export const ETHERSCAN_V2_BASE_CHAIN_ID = 8453

export function getEtherscanApiKey(): string {
  return (process.env.ETHERSCAN_API_KEY ?? '').trim()
}

export function hasEtherscanApiKey(): boolean {
  return Boolean(getEtherscanApiKey())
}

export function hasDebankAccessKey(): boolean {
  return Boolean((process.env.DEBANK_ACCESS_KEY ?? '').trim())
}

export function preferTrayPortfolioEtherscan(): boolean {
  const raw = (process.env.TRAY_PORTFOLIO_PREFER_ETHERSCAN ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export async function fetchEtherscanV2Json<T>(
  params: Record<string, string>,
  options?: { chainId?: number; timeoutMs?: number },
): Promise<T | null> {
  const apiKey = getEtherscanApiKey()
  if (!apiKey) return null

  const chainId = options?.chainId ?? ETHERSCAN_V2_BASE_CHAIN_ID
  const url = new URL(ETHERSCAN_V2_BASE)
  url.searchParams.set('chainid', String(chainId))
  url.searchParams.set('apikey', apiKey)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), options?.timeoutMs ?? 12_000)
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { status?: string; message?: string; result?: T }
    if (data.status !== '1') return null
    return data.result ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
