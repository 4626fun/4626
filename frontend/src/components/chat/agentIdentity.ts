import { resolveClientAgentXmtpAddressLower } from '@/lib/xmtp/agentXmtpAddress'

const CANONICAL_CSW_INBOX_ADDRESS = resolveClientAgentXmtpAddressLower()
const AGENT_DISPLAY_NAME = String(import.meta.env.VITE_AGENT_DISPLAY_NAME ?? '4626').trim() || '4626'
const AGENT_SUBTITLE = 'Agent 4626'
const AGENT_AVATAR_URL =
  String(import.meta.env.VITE_AGENT_AVATAR_URL ?? '/assets/base-app-icon-1024.png').trim() ||
  '/assets/base-app-icon-1024.png'

export type AgentIdentity = {
  name: string
  subtitle: string
  avatar: string
}

export function getAgentIdentity(address: string | null | undefined): AgentIdentity | null {
  const normalized = (address ?? '').trim().toLowerCase()
  if (!normalized || normalized !== CANONICAL_CSW_INBOX_ADDRESS) return null
  return {
    name: AGENT_DISPLAY_NAME,
    subtitle: AGENT_SUBTITLE,
    avatar: AGENT_AVATAR_URL,
  }
}
