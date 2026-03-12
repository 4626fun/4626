const AGENT_XMTP_ADDRESS = String(import.meta.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim().toLowerCase()
const AGENT_DISPLAY_NAME = String(import.meta.env.VITE_AGENT_DISPLAY_NAME ?? 'akita').trim() || 'akita'
const AGENT_AVATAR_URL =
  String(import.meta.env.VITE_AGENT_AVATAR_URL ?? '/base/base-square-blue.svg').trim() || '/base/base-square-blue.svg'

export function getAgentIdentity(address: string | null | undefined): { name: string; avatar: string } | null {
  const normalized = (address ?? '').trim().toLowerCase()
  if (!normalized || !AGENT_XMTP_ADDRESS || normalized !== AGENT_XMTP_ADDRESS) return null
  return {
    name: AGENT_DISPLAY_NAME,
    avatar: AGENT_AVATAR_URL,
  }
}
