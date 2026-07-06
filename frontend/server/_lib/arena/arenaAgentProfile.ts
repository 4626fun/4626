import type { ArenaConfig } from './arenaConfig.js'

export type ArenaAgentProfile = {
  id: string
  name: string
  url: string
  walletAddress: string | null
}

const DEGEN_AGENT_API_BASE = 'https://degen.virtuals.io/api/agents'
const DEGEN_AGENT_PAGE_BASE = 'https://degen.virtuals.io/agents'
const FETCH_TIMEOUT_MS = 5_000

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function buildArenaAgentPageUrl(profileId: string): string {
  return `${DEGEN_AGENT_PAGE_BASE}/${encodeURIComponent(profileId.trim())}`
}

export function resolveArenaDegenProfileId(
  config: Pick<ArenaConfig, 'agentId' | 'degenProfileId'>,
): string | null {
  const explicit = String(config.degenProfileId ?? '').trim()
  if (/^\d+$/.test(explicit)) return explicit

  const agentId = String(config.agentId ?? '').trim()
  if (/^\d+$/.test(agentId)) return agentId

  return null
}

export async function fetchArenaAgentProfile(profileId: string): Promise<ArenaAgentProfile | null> {
  const normalizedId = String(profileId ?? '').trim()
  if (!/^\d+$/.test(normalizedId)) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(`${DEGEN_AGENT_API_BASE}/${normalizedId}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) return null

    const payload = asObject(await response.json())
    const data = asObject(payload?.data)
    if (!data) return null

    const name = String(data.name ?? asObject(data.acpAgent)?.name ?? '').trim()
    if (!name) return null

    const walletRaw = String(
      data.agentAddress ?? data.hlAddress ?? asObject(data.acpAgent)?.walletAddress ?? '',
    ).trim()
    const walletAddress = /^0x[a-fA-F0-9]{40}$/.test(walletRaw) ? walletRaw.toLowerCase() : null

    return {
      id: String(data.id ?? normalizedId),
      name,
      url: buildArenaAgentPageUrl(String(data.id ?? normalizedId)),
      walletAddress,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
