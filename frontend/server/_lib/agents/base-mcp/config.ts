import { BASE_CHAIN_ID } from './schemas'

export interface BaseMcpRuntimeConfig {
  enabled: boolean
  allowedTokens: Set<string>
  tokenNotionalLimitsBaseUnits: Map<string, bigint>
  allowedChainIds: number[]
}

const normalizeAddress = (value: string): string | null => {
  const candidate = value.trim().toLowerCase()
  if (!candidate) return null
  if (!/^0x[a-f0-9]{40}$/.test(candidate)) return null
  return candidate
}

function parseTokenNotionalLimits(): Map<string, bigint> {
  const raw = (process.env.BASE_MCP_TOKEN_LIMITS_JSON ?? '').trim()
  if (!raw) return new Map()

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return new Map()

    const limits = new Map<string, bigint>()
    for (const [token, value] of Object.entries(parsed as Record<string, unknown>)) {
      const normalized = normalizeAddress(token)
      if (!normalized) continue
      const amount = typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null
      if (amount !== null && amount > 0n) limits.set(normalized, amount)
    }
    return limits
  } catch {
    return new Map()
  }
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
    tokenNotionalLimitsBaseUnits: parseTokenNotionalLimits(),
    allowedChainIds: [BASE_CHAIN_ID],
  }
}
