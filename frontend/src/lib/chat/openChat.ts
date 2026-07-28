export const CHAT_OPEN_REQUEST_EVENT = '4626:chat-open-request'
export const CHAT_TOGGLE_REQUEST_EVENT = '4626:chat-toggle-request'
export const CHAT_NEW_DM_REQUEST_EVENT = '4626:chat-new-dm-request'
export const CHAT_UNREAD_CHANGE_EVENT = '4626:chat-unread-change'

type ChatUnreadListener = (count: number) => void

let chatUnreadTotal = 0
const chatUnreadListeners = new Set<ChatUnreadListener>()

export function getChatUnreadTotal(): number {
  return chatUnreadTotal
}

export function setChatUnreadTotal(count: number): void {
  const next = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (next === chatUnreadTotal) return
  chatUnreadTotal = next
  for (const listener of chatUnreadListeners) {
    listener(chatUnreadTotal)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<number>(CHAT_UNREAD_CHANGE_EVENT, { detail: chatUnreadTotal }),
    )
  }
}

export function subscribeChatUnreadTotal(listener: ChatUnreadListener): () => void {
  chatUnreadListeners.add(listener)
  listener(chatUnreadTotal)
  return () => {
    chatUnreadListeners.delete(listener)
  }
}

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
  | {
      kind: 'existing'
      conversationId: string
      type: 'dm' | 'group'
      name: string
      peerInboxId?: string
      peerAddress?: string
      imageUrl?: string | null
      seedCommandId?: string | null
    }

export function requestOpenChat(request: ChatOpenRequest): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<ChatOpenRequest>(CHAT_OPEN_REQUEST_EVENT, { detail: request }))
}

export function requestToggleChat(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CHAT_TOGGLE_REQUEST_EVENT))
}

export function requestNewDm(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CHAT_NEW_DM_REQUEST_EVENT))
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
  if (candidate.kind === 'existing') {
    return typeof candidate.conversationId === 'string' && candidate.conversationId.trim().length > 0
  }
  return false
}
