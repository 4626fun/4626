/**
 * Recent Base mainnet transactions for the account-tray Activity tab.
 */

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api'
const BASE_CHAIN_ID = 8453

export type TrayOnchainActivityRow = {
  txHash: string
  walletAddress: string
  timestampMs: number
  title: string
  subtitle: string
  kind: 'swap' | 'transfer' | 'contract' | 'unknown'
  failed: boolean
}

type EtherscanTxRow = {
  hash?: string
  timeStamp?: string
  from?: string
  to?: string
  value?: string
  functionName?: string
  isError?: string
  txreceipt_status?: string
  methodId?: string
}

function getEtherscanApiKey(): string {
  return (process.env.ETHERSCAN_API_KEY ?? '').trim()
}

async function fetchEtherscanJson<T>(params: Record<string, string>, apiKey: string): Promise<T | null> {
  const url = new URL(ETHERSCAN_V2_BASE)
  url.searchParams.set('chainid', String(BASE_CHAIN_ID))
  url.searchParams.set('apikey', apiKey)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 12_000)
  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { status?: string; result?: T }
    if (data.status !== '1') return null
    return data.result ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function classifyTx(row: EtherscanTxRow): Pick<TrayOnchainActivityRow, 'title' | 'subtitle' | 'kind'> {
  const fn = String(row.functionName ?? '').trim()
  const fnLower = fn.toLowerCase()
  const methodId = String(row.methodId ?? '').toLowerCase()
  const valueWei = (() => {
    try {
      return BigInt(String(row.value ?? '0'))
    } catch {
      return 0n
    }
  })()

  if (
    fnLower.includes('swap') ||
    fnLower.includes('execute') ||
    fnLower.includes('exactinput') ||
    fnLower.includes('exactoutput') ||
    methodId === '0x3593564c'
  ) {
    return {
      kind: 'swap',
      title: 'Swap or trade',
      subtitle: fn ? fn.split('(')[0] ?? 'Router call' : 'DEX interaction',
    }
  }

  if (valueWei > 0n && (!fn || fnLower === '')) {
    return {
      kind: 'transfer',
      title: 'Sent ETH',
      subtitle: 'Native transfer on Base',
    }
  }

  if (fn) {
    return {
      kind: 'contract',
      title: 'Contract interaction',
      subtitle: fn.split('(')[0] ?? 'Contract call',
    }
  }

  return {
    kind: 'unknown',
    title: 'Transaction',
    subtitle: 'On Base',
  }
}

export async function getTrayWalletActivityBaseEtherscan(
  address: string,
  options: { limit?: number } = {},
): Promise<TrayOnchainActivityRow[]> {
  const apiKey = getEtherscanApiKey()
  if (!apiKey) return []

  const addr = address.toLowerCase()
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)

  const rows = await fetchEtherscanJson<EtherscanTxRow[]>(
    {
      module: 'account',
      action: 'txlist',
      address: addr,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(limit),
      sort: 'desc',
    },
    apiKey,
  )

  if (!Array.isArray(rows)) return []

  const out: TrayOnchainActivityRow[] = []
  for (const row of rows) {
    const txHash = String(row.hash ?? '').trim().toLowerCase()
    if (!/^0x[a-f0-9]{64}$/.test(txHash)) continue
    const tsSec = Number.parseInt(String(row.timeStamp ?? ''), 10)
    const timestampMs = Number.isFinite(tsSec) && tsSec > 0 ? tsSec * 1000 : Date.now()
    const failed = row.isError === '1' || row.txreceipt_status === '0'
    const classified = classifyTx(row)
    out.push({
      txHash,
      walletAddress: addr,
      timestampMs,
      failed,
      ...classified,
    })
  }

  return out
}
