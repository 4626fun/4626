import type { DmRecipientResolution } from '@/lib/xmtp/socialIdentity'

function normalizeAddress(value: string | null | undefined): `0x${string}` | null {
  const raw = String(value ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase() as `0x${string}`
}

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
  const recipientAddress = normalizeAddress(params.recipient.address)
  const selfAddresses = new Set<string>(
    [normalizeAddress(params.identityAddress), normalizeAddress(params.connectedAddress)].filter(
      (entry): entry is `0x${string}` => Boolean(entry),
    ),
  )
  const agentAddress = normalizeAddress(params.agentAddress)

  if (recipientAddress && selfAddresses.has(recipientAddress)) {
    const notice = 'Use Akita to chat about your wallet. Opening Akita instead.'
    if (agentAddress && agentAddress !== recipientAddress) {
      return {
        recipient: {
          ...params.recipient,
          address: agentAddress,
          basenameHint: params.agentDisplayName,
        },
        notice,
        reroutedToAgent: true,
      }
    }

    return {
      recipient: params.recipient,
      notice: 'Use Akita to chat about your wallet.',
      reroutedToAgent: false,
    }
  }

  return {
    recipient: params.recipient,
    notice: null,
    reroutedToAgent: false,
  }
}
