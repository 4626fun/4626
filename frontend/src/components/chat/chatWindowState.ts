type ConversationType = 'dm' | 'group'

function isEvmAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function shouldAttemptInactiveDmRecovery(params: {
  reason: string
  conversationType: ConversationType
  dmPeerAddress: string | null
  dmPeerInboxId: string | null
}): boolean {
  if (params.conversationType !== 'dm') return false
  const hasPeerAddress = Boolean(params.dmPeerAddress && isEvmAddress(params.dmPeerAddress))
  const hasPeerInboxId = Boolean(params.dmPeerInboxId?.trim())
  if (!hasPeerAddress && !hasPeerInboxId) return false
  return /group is inactive/i.test(params.reason)
}

export function resolveCommandCenterVisibility(params: {
  isMobile: boolean
  showCommandCenter: boolean
  desktopCommandsOpen: boolean
}): boolean {
  if (!params.showCommandCenter) return false
  if (params.isMobile) return true
  return params.desktopCommandsOpen
}
