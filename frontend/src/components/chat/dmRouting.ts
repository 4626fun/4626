import type { DmRecipientResolution } from '@/lib/xmtp/socialIdentity'

export type DmRouteDecision = {
  recipient: DmRecipientResolution
  notice: string | null
  reroutedToAgent: boolean
}

export function resolveDmRoute(params: {
  recipient: DmRecipientResolution
  identityAddress?: string | null
  connectedAddress?: string | null
  agentAddress?: string | null
  agentDisplayName: string
}): DmRouteDecision {
  return {
    recipient: params.recipient,
    notice: null,
    reroutedToAgent: false,
  }
}
