export const CHAT_OPEN_REQUEST_EVENT = '4626:chat-open-request'

export type ChatOpenRequest =
  | {
      kind: 'dm'
      peerAddress: `0x${string}`
      nameHint?: string | null
      imageUrl?: string | null
      seedCommandId?: string | null
    }
  | {
      kind: 'group'
      conversationId: string
      name: string
      imageUrl?: string | null
      seedCommandId?: string | null
    }

export function requestOpenChat(request: ChatOpenRequest): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ChatOpenRequest>(CHAT_OPEN_REQUEST_EVENT, { detail: request }))
}

export function isChatOpenRequest(value: unknown): value is ChatOpenRequest {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ChatOpenRequest>
  if (candidate.kind === 'dm') {
    return typeof candidate.peerAddress === 'string' && /^0x[a-fA-F0-9]{40}$/.test(candidate.peerAddress)
  }
  if (candidate.kind === 'group') {
    return typeof candidate.conversationId === 'string' && candidate.conversationId.trim().length > 0
  }
  return false
}
