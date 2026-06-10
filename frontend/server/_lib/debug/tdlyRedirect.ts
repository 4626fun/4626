import { gunzipSync } from 'node:zlib'

export type TdlyRedirectParams = {
  block: string
  contractAddress: string
  from: string
  gas: string
  network: string
  rawFunctionInput: string
}

function decodeBase64UrlToBuffer(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const pad = '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(normalized + pad, 'base64')
}

export function decodeTdlyRedirectQuery(q: string): TdlyRedirectParams {
  const raw = gunzipSync(decodeBase64UrlToBuffer(q.trim())).toString('utf8')
  const params = new URLSearchParams(raw)
  const required = ['block', 'contractAddress', 'from', 'gas', 'network', 'rawFunctionInput'] as const
  const out: Partial<TdlyRedirectParams> = {}
  for (const key of required) {
    const value = params.get(key)
    if (!value) throw new Error(`tdly-redirect payload missing ${key}`)
    out[key] = value
  }
  return out as TdlyRedirectParams
}

export function extractTdlyRedirectQueryFromUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error('invalid tdly-redirect URL (expected https://base.github.io/tdly-redirect/?q=...)')
  }
  const q = parsed.searchParams.get('q')
  if (!q) throw new Error('URL missing q= query parameter')
  return q
}

export function parseTenderlyApiUrl(apiUrl: string): { account: string; project: string; simulateEndpoint: string } {
  const trimmed = apiUrl.trim().replace(/\/+$/, '')
  const match = trimmed.match(/\/account\/([^/]+)\/project\/([^/]+)/i)
  if (!match) {
    throw new Error(
      'TENDERLY_API_URL must look like https://api.tenderly.co/api/v1/account/{user}/project/{slug}/',
    )
  }
  return {
    account: match[1]!,
    project: match[2]!,
    simulateEndpoint: `${trimmed}/simulate`,
  }
}

export function buildTenderlyDashboardUrl(account: string, project: string, simulationId: string): string {
  return `https://dashboard.tenderly.co/${account}/${project}/simulator/${simulationId}`
}
