type EnvLike = Record<string, string | undefined>

export type SwapPolicy = {
  enabled: boolean
  maxSlippageBps: number | null
  maxInputBaseUnits: bigint | null
  allowedRoutings: Set<string> | null
  tokenAllowlist: Set<string>
  tokenDenylist: Set<string>
  canary7702Enabled: boolean
  canary7702Allowlist: Set<string>
  diagnosticsEnabled: boolean
}

export type SwapPolicyDecision = {
  allowed: boolean
  code: 'OK' | 'TOKEN_DENYLIST' | 'TOKEN_ALLOWLIST' | 'MAX_SLIPPAGE' | 'MAX_INPUT' | 'ROUTING_NOT_ALLOWED'
  message: string
}

function isTruthy(value: string | undefined): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) return null
  const raw = value.trim()
  if (!/^\d+$/.test(raw)) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

function parsePositiveBigInt(value: string | undefined): bigint | null {
  if (!value) return null
  const raw = value.trim()
  if (!/^\d+$/.test(raw)) return null
  try {
    const parsed = BigInt(raw)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}

function normalizeAddress(value: string): string | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw
}

function parseAddressSet(value: string | undefined): Set<string> {
  if (!value) return new Set()
  const out = new Set<string>()
  for (const piece of value.split(/[\s,]+/g)) {
    const addr = normalizeAddress(piece)
    if (addr) out.add(addr)
  }
  return out
}

function parseRouteSet(value: string | undefined): Set<string> | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const parsed = raw
    .split(/[\s,]+/g)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
  if (parsed.length === 0) return null
  return new Set(parsed)
}

function normalizeAmount(value: string | null | undefined): bigint | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) return null
  try {
    return BigInt(raw)
  } catch {
    return null
  }
}

export function parseSwapPolicyFromEnv(env: EnvLike): SwapPolicy {
  return {
    enabled: !String(env.VITE_UNISWAP_POLICY_ENABLED ?? '').trim() || isTruthy(env.VITE_UNISWAP_POLICY_ENABLED),
    maxSlippageBps: parsePositiveInteger(env.VITE_UNISWAP_MAX_SLIPPAGE_BPS),
    maxInputBaseUnits: parsePositiveBigInt(env.VITE_UNISWAP_MAX_INPUT_BASE_UNITS),
    allowedRoutings: parseRouteSet(env.VITE_UNISWAP_ALLOWED_ROUTE_TYPES),
    tokenAllowlist: parseAddressSet(env.VITE_UNISWAP_TOKEN_ALLOWLIST),
    tokenDenylist: parseAddressSet(env.VITE_UNISWAP_TOKEN_DENYLIST),
    canary7702Enabled: isTruthy(env.VITE_UNISWAP_7702_CANARY_ENABLED),
    canary7702Allowlist: parseAddressSet(env.VITE_UNISWAP_7702_CANARY_ALLOWLIST),
    diagnosticsEnabled: isTruthy(env.VITE_UNISWAP_INTERNAL_DIAGNOSTICS),
  }
}

export function readClientSwapPolicy(): SwapPolicy {
  return parseSwapPolicyFromEnv(import.meta.env as unknown as EnvLike)
}

export function evaluateSwapPolicyInput(params: {
  policy: SwapPolicy
  tokenIn: string
  tokenOut: string
  amountBaseUnits?: string | null
  slippageBps?: number | null
}): SwapPolicyDecision {
  const { policy } = params
  if (!policy.enabled) return { allowed: true, code: 'OK', message: 'Swap policy disabled' }

  const tokenIn = normalizeAddress(params.tokenIn)
  const tokenOut = normalizeAddress(params.tokenOut)
  const allTokens = [tokenIn, tokenOut].filter((value): value is string => Boolean(value))

  if (allTokens.some((token) => policy.tokenDenylist.has(token))) {
    return { allowed: false, code: 'TOKEN_DENYLIST', message: 'Swap blocked by token denylist policy.' }
  }

  if (policy.tokenAllowlist.size > 0 && allTokens.some((token) => !policy.tokenAllowlist.has(token))) {
    return { allowed: false, code: 'TOKEN_ALLOWLIST', message: 'Swap blocked because token is not allowlisted.' }
  }

  if (policy.maxSlippageBps !== null && typeof params.slippageBps === 'number' && Number.isFinite(params.slippageBps)) {
    if (params.slippageBps > policy.maxSlippageBps) {
      return {
        allowed: false,
        code: 'MAX_SLIPPAGE',
        message: `Swap blocked: slippage exceeds ${policy.maxSlippageBps} bps policy cap.`,
      }
    }
  }

  if (policy.maxInputBaseUnits !== null) {
    const amount = normalizeAmount(params.amountBaseUnits)
    if (amount !== null && amount > policy.maxInputBaseUnits) {
      return {
        allowed: false,
        code: 'MAX_INPUT',
        message: 'Swap blocked: input amount exceeds configured max.',
      }
    }
  }

  return { allowed: true, code: 'OK', message: 'Swap input policy passed' }
}

export function evaluateSwapPolicyRouting(params: {
  policy: SwapPolicy
  routing: unknown
}): SwapPolicyDecision {
  const { policy } = params
  if (!policy.enabled) return { allowed: true, code: 'OK', message: 'Swap policy disabled' }
  if (!policy.allowedRoutings || policy.allowedRoutings.size === 0) {
    return { allowed: true, code: 'OK', message: 'Routing policy passed' }
  }

  const routing = String(params.routing ?? '')
    .trim()
    .toUpperCase()
  if (routing && policy.allowedRoutings.has(routing)) {
    return { allowed: true, code: 'OK', message: 'Routing policy passed' }
  }

  return {
    allowed: false,
    code: 'ROUTING_NOT_ALLOWED',
    message: `Swap blocked: routing "${String(params.routing ?? 'unknown')}" is not allowed by policy.`,
  }
}

export function shouldEnable7702CanaryForAddress(policy: SwapPolicy, address: string | null | undefined): boolean {
  if (!policy.canary7702Enabled) return false
  if (policy.canary7702Allowlist.size === 0) return true
  const normalized = normalizeAddress(String(address ?? ''))
  if (!normalized) return false
  return policy.canary7702Allowlist.has(normalized)
}
