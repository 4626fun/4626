// Agent swarm role parsing + resolution extracted from eliza/index.ts.
// Pure logic: no plugins, no Eliza runtime dependency, no character imports.
// Role-to-character translation stays in index.ts where the character
// constants live — this module only handles role taxonomy and capability
// mapping.

import { logger } from '../../_lib/infra/logger.js'

export type AgentSwarmRole = 'general' | 'trader' | 'social' | 'knowledge'

export const DEFAULT_SWARM_CAPABILITIES: Record<AgentSwarmRole, string[]> = {
  general: [],
  trader: ['uniswap', 'zora', 'cre', 'keepr'],
  social: ['lens'],
  knowledge: ['knowledge', 'reputation', 'wallet'],
}

export function normalizeSwarmRole(raw: string): AgentSwarmRole | null {
  const normalized = raw.trim().toLowerCase()
  if (
    normalized === 'general' ||
    normalized === 'trader' ||
    normalized === 'social' ||
    normalized === 'knowledge'
  ) {
    return normalized
  }
  return null
}

export function parseSwarmRoleMap(raw: string | undefined): Record<string, AgentSwarmRole> {
  const source = String(raw ?? '').trim()
  if (!source) return {}
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    const out: Record<string, AgentSwarmRole> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const role = normalizeSwarmRole(String(value ?? ''))
      if (!role) continue
      out[key.toLowerCase()] = role
    }
    return out
  } catch {
    logger.warn('[eliza/swarm] failed to parse ELIZA_SWARM_ROLE_MAP_JSON; using defaults')
    return {}
  }
}

export function parseSwarmCapabilityMap(raw: string | undefined): Partial<Record<AgentSwarmRole, string[]>> {
  const source = String(raw ?? '').trim()
  if (!source) return {}
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>
    const out: Partial<Record<AgentSwarmRole, string[]>> = {}
    for (const [key, value] of Object.entries(parsed ?? {})) {
      const role = normalizeSwarmRole(key)
      if (!role || !Array.isArray(value)) continue
      out[role] = value
        .map((entry) => String(entry ?? '').trim().toLowerCase())
        .filter(Boolean)
    }
    return out
  } catch {
    logger.warn('[eliza/swarm] failed to parse ELIZA_SWARM_CAPABILITIES_JSON; using defaults')
    return {}
  }
}

export function inferSwarmRoleFromAgentKey(agentKey: string): AgentSwarmRole {
  const normalized = agentKey.trim().toLowerCase()
  if (normalized.includes('trader')) return 'trader'
  if (normalized.includes('social')) return 'social'
  if (normalized.includes('knowledge')) return 'knowledge'
  return 'general'
}

export function resolveSwarmProfile(
  agentKey: string,
  roleMap: Record<string, AgentSwarmRole>,
  capabilityOverrides: Partial<Record<AgentSwarmRole, string[]>>,
): { role: AgentSwarmRole; capabilities: string[] } {
  const normalized = agentKey.trim().toLowerCase()
  const mapped = roleMap[normalized]
  const role = mapped ?? inferSwarmRoleFromAgentKey(agentKey)
  const overridden = capabilityOverrides[role]
  const capabilities = (overridden ?? DEFAULT_SWARM_CAPABILITIES[role]).map((entry) =>
    entry.toLowerCase(),
  )
  return { role, capabilities }
}
