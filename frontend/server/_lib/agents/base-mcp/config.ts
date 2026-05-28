import { BASE_CHAIN_ID } from './schemas'

export interface BaseMcpRuntimeConfig {
  enabled: boolean
  allowedTokens: Set<string>
  canonicalSender: string | null
  eoaSender: string | null
  allowedChainIds: number[]
}

const normalizeAddress = (value: string): string | null => {
  const candidate = value.trim().toLowerCase()
  if (!candidate) return null
  if (!/^0x[a-f0-9]{40}$/.test(candidate)) return null
  return candidate
}

export function loadBaseMcpRuntimeConfig(): BaseMcpRuntimeConfig {
  const enabled = process.env.BASE_MCP_ENABLED === '1'
  const allowedTokens = new Set(
    (process.env.BASE_MCP_ALLOWED_TOKENS ?? '')
      .split(',')
      .map((token) => normalizeAddress(token) ?? '')
      .filter(Boolean),
  )

  return {
    enabled,
    allowedTokens,
    canonicalSender: normalizeAddress(process.env.BASE_MCP_CANONICAL_SENDER ?? ''),
    eoaSender: normalizeAddress(process.env.BASE_MCP_EOA_SENDER ?? ''),
    allowedChainIds: [BASE_CHAIN_ID],
  }
}
