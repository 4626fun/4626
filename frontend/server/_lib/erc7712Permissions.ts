import { getAddress, type Address, type Hex } from 'viem'

export type DeployCall = { to: Address; value: bigint; data: Hex }

export type Erc7712PermissionGrant = {
  version: 'erc7712-v1'
  chainId: number
  validAfter: string
  validUntil: string
  sessionId: string
  allowedTargets: Address[]
  allowedSelectors: Hex[]
}

function normalizeHex(value: unknown): Hex | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (!/^0x[0-9a-f]*$/.test(v)) return null
  return v as Hex
}

function selectorFromData(data: Hex): Hex | null {
  const v = String(data || '').toLowerCase()
  if (!/^0x[0-9a-f]{8,}$/.test(v)) return null
  return (`0x${v.slice(2, 10)}`) as Hex
}

export function buildDeployPermissionGrant(params: {
  sessionId: string
  chainId?: number
  validAfter: Date
  validUntil: Date
  calls: DeployCall[]
}): Erc7712PermissionGrant {
  const chainId = Number.isFinite(Number(params.chainId)) ? Number(params.chainId) : 8453
  const targets = new Set<string>()
  const selectors = new Set<string>()
  for (const call of params.calls) {
    try {
      targets.add(getAddress(call.to).toLowerCase())
    } catch {
      // ignore malformed address
    }
    const sel = selectorFromData(call.data)
    if (sel) selectors.add(sel.toLowerCase())
  }

  return {
    version: 'erc7712-v1',
    chainId,
    sessionId: String(params.sessionId),
    validAfter: params.validAfter.toISOString(),
    validUntil: params.validUntil.toISOString(),
    allowedTargets: Array.from(targets).map((v) => getAddress(v)),
    allowedSelectors: Array.from(selectors) as Hex[],
  }
}

export function validateCallsAgainstGrant(params: {
  grant: Erc7712PermissionGrant | null | undefined
  calls: DeployCall[]
  now?: Date
  expectedChainId?: number
  expectedSessionId?: string
}): { ok: boolean; reason?: string } {
  const { grant, calls } = params
  if (!grant) return { ok: true }
  const now = params.now ?? new Date()

  const validAfter = Date.parse(String(grant.validAfter || ''))
  const validUntil = Date.parse(String(grant.validUntil || ''))
  if (!Number.isFinite(validAfter) || !Number.isFinite(validUntil)) return { ok: false, reason: 'erc7712_invalid_window' }
  const ts = now.getTime()
  const expectedChainId = Number.isFinite(Number(params.expectedChainId)) ? Number(params.expectedChainId) : null
  const expectedSessionId = typeof params.expectedSessionId === 'string' ? params.expectedSessionId.trim() : ''
  if (expectedChainId !== null && Number(grant.chainId) !== expectedChainId) {
    return { ok: false, reason: 'erc7712_chain_mismatch' }
  }
  if (expectedSessionId && String(grant.sessionId || '') !== expectedSessionId) {
    return { ok: false, reason: 'erc7712_session_mismatch' }
  }

  if (ts < validAfter) return { ok: false, reason: 'erc7712_not_yet_valid' }
  if (ts > validUntil) return { ok: false, reason: 'erc7712_expired' }

  const targets = new Set((grant.allowedTargets || []).map((a) => getAddress(a).toLowerCase()))
  const selectors = new Set((grant.allowedSelectors || []).map((s) => String(s).toLowerCase()))

  for (const call of calls) {
    const to = getAddress(call.to).toLowerCase()
    if (!targets.has(to)) return { ok: false, reason: 'erc7712_target_not_allowed' }
    const sel = selectorFromData(call.data)
    if (!sel) return { ok: false, reason: 'erc7712_selector_missing' }
    if (!selectors.has(sel.toLowerCase())) return { ok: false, reason: 'erc7712_selector_not_allowed' }
  }
  return { ok: true }
}

export function parseGrant(raw: unknown): Erc7712PermissionGrant | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as any
  if (String(g.version || '') !== 'erc7712-v1') return null
  const targets = Array.isArray(g.allowedTargets)
    ? g.allowedTargets.map((v: unknown) => {
        try {
          return getAddress(String(v))
        } catch {
          return null
        }
      }).filter((v: Address | null): v is Address => Boolean(v))
    : []
  const selectors = Array.isArray(g.allowedSelectors)
    ? g.allowedSelectors.map((v: unknown) => normalizeHex(v)).filter((v: Hex | null): v is Hex => Boolean(v))
    : []

  return {
    version: 'erc7712-v1',
    chainId: Number(g.chainId || 8453),
    validAfter: String(g.validAfter || ''),
    validUntil: String(g.validUntil || ''),
    sessionId: String(g.sessionId || ''),
    allowedTargets: targets,
    allowedSelectors: selectors,
  }
}
