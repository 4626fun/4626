/**
 * XMTP Chat Provider
 *
 * Manages the XMTP browser client lifecycle, conversation list, and message
 * streaming.  Exposes everything downstream components need via React context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import { keccak256 } from 'viem'
import {
  Client,
  type Signer,
  type Conversation,
  type Dm,
  type Group,
  type DecodedMessage,
  type AsyncStreamProxy,
} from '@xmtp/browser-sdk'
import { IdentifierKind } from '@xmtp/browser-sdk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type XmtpStatus = 'idle' | 'signing' | 'connecting' | 'connected' | 'error'

export type ChatConversation = {
  id: string
  type: 'dm' | 'group'
  name: string
  imageUrl?: string
  peerInboxId?: string
  lastMessageText?: string
  lastMessageAt?: Date
  unreadCount: number
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderInboxId: string
  content: string
  sentAt: Date
  isSelf: boolean
}

type XmtpContextValue = {
  status: XmtpStatus
  error: string | null
  inboxId: string | null
  connect: () => Promise<void>
  disconnect: () => void
  conversations: ChatConversation[]
  loadMessages: (conversationId: string) => Promise<ChatMessage[]>
  sendMessage: (conversationId: string, text: string) => Promise<void>
  startDm: (peerAddress: `0x${string}`) => Promise<string | null>
  subscribeToMessages: (conversationId: string, cb: (msg: ChatMessage) => void) => () => void
  /** Resolve an XMTP inboxId to an Ethereum address (cached). */
  resolveInboxAddress: (inboxId: string) => Promise<string | null>
}

const noop = () => {}
const XmtpContext = createContext<XmtpContextValue>({
  status: 'idle',
  error: null,
  inboxId: null,
  connect: async () => {},
  disconnect: noop,
  conversations: [],
  loadMessages: async () => [],
  sendMessage: async () => {},
  startDm: async () => null,
  subscribeToMessages: () => noop,
  resolveInboxAddress: async () => null,
})

export function useXmtp() {
  return useContext(XmtpContext)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENC_KEY_MESSAGE =
  'Enable encrypted messaging on CreatorVault (4626.fun)\n\nThis signature encrypts your local message database.\nNo blockchain transaction will occur.'

const RAW_XMTP_ENV = String(import.meta.env.VITE_XMTP_ENV ?? '').trim().toLowerCase()
const XMTP_ENV: 'production' | 'dev' | 'local' =
  RAW_XMTP_ENV === 'dev' || RAW_XMTP_ENV === 'local' || RAW_XMTP_ENV === 'production'
    ? (RAW_XMTP_ENV as 'production' | 'dev' | 'local')
    : 'production'

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function getEthereumAddressFromInboxState(state: any): string | null {
  const identifiers = Array.isArray(state?.identifiers) ? state.identifiers : []
  for (const id of identifiers) {
    const kind = id?.identifierKind
    const identifier = typeof id?.identifier === 'string' ? id.identifier : ''
    if ((kind === IdentifierKind.Ethereum || kind === 0 || kind === 'Ethereum') && /^0x[a-fA-F0-9]{40}$/.test(identifier)) {
      return identifier.toLowerCase()
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Browser notifications
// ---------------------------------------------------------------------------
async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showNotification(title: string, body: string) {
  if (typeof document === 'undefined' || !document.hidden) return // only when tab is in background
  if (Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body: body.slice(0, 120),
      icon: '/icon-192.png',
      tag: 'xmtp-message', // collapse multiple
    })
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function XmtpChatProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [status, setStatus] = useState<XmtpStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [inboxId, setInboxId] = useState<string | null>(null)

  const clientRef = useRef<Client | null>(null)
  const convoStreamRef = useRef<AsyncStreamProxy<any> | null>(null)
  const msgStreamRef = useRef<AsyncStreamProxy<any> | null>(null)
  const perConvoStreamsRef = useRef<Map<string, AsyncStreamProxy<any>>>(new Map())
  const perConvoCbRef = useRef<Map<string, Set<(msg: ChatMessage) => void>>>(new Map())
  const inboxAddressCache = useRef<Map<string, string | null>>(new Map())
  const conversationsRef = useRef<ChatConversation[]>([])
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      void cleanup()
    }
  }, [])

  // Reset when wallet changes
  useEffect(() => {
    if (!isConnected) {
      void cleanup()
      setStatus('idle')
      setError(null)
      setConversations([])
      conversationsRef.current = []
      setInboxId(null)
    }
  }, [isConnected, address])

  // ------- cleanup -------
  async function cleanup() {
    try { convoStreamRef.current?.end() } catch {}
    try { msgStreamRef.current?.end() } catch {}
    for (const s of perConvoStreamsRef.current.values()) {
      try { s.end() } catch {}
    }
    perConvoStreamsRef.current.clear()
    perConvoCbRef.current.clear()
      try { clientRef.current?.close() } catch {}
      clientRef.current = null
      conversationsRef.current = []
  }

  // ------- build conversation summary -------
  async function buildConvoSummary(convo: Conversation | Dm | Group): Promise<ChatConversation> {
    const isDm = 'peerInboxId' in convo
    let name = ''
    let peerInboxId: string | undefined

    if (isDm) {
      try {
        peerInboxId = await (convo as Dm).peerInboxId()
        name = truncateAddress(peerInboxId)
      } catch {
        name = 'DM'
      }
    } else {
      name = (convo as Group).name ?? 'Group'
    }

    let lastMessageText: string | undefined
    let lastMessageAt: Date | undefined
    try {
      const last = await convo.lastMessage()
      if (last) {
        lastMessageText = typeof last.content === 'string' ? last.content : undefined
        lastMessageAt = last.sentAt
      }
    } catch {}

    return {
      id: convo.id,
      type: isDm ? 'dm' : 'group',
      name,
      imageUrl: isDm ? undefined : (convo as Group).imageUrl,
      peerInboxId,
      lastMessageText,
      lastMessageAt,
      unreadCount: 0,
    }
  }

  // ------- connect -------
  const connect = useCallback(async () => {
    if (!address || !walletClient) return
    if (clientRef.current) return // already connected

    try {
      setStatus('signing')
      setError(null)

      // Derive deterministic encryption key
      const sig = await walletClient.signMessage({ message: ENC_KEY_MESSAGE })
      const encKeyHex = keccak256(sig)
      const encKeyBytes = hexToBytes(encKeyHex)

      setStatus('connecting')

      // Detect whether the connected wallet is a smart contract wallet (SCW).
      // Coinbase Smart Wallets are contracts on Base (chain 8453) and must use
      // the SCW signer type so XMTP matches the chain ID from registration.
      let isSmartWallet = false
      const chainId = walletClient.chain?.id ?? 8453
      if (publicClient) {
        try {
          const code = await publicClient.getCode({ address })
          isSmartWallet = typeof code === 'string' && code !== '0x' && code.length > 2
        } catch {
          // If we can't determine, default to SCW on Base (safer for this app)
          isSmartWallet = chainId === 8453
        }
      } else {
        // No public client — assume SCW on Base
        isSmartWallet = chainId === 8453
      }

      const signMessageFn = async (message: string) => {
        const s = await walletClient.signMessage({ message })
        return hexToBytes(s)
      }

      const signer: Signer = isSmartWallet
        ? {
            type: 'SCW',
            getIdentifier: () => ({
              identifier: address,
              identifierKind: IdentifierKind.Ethereum,
            }),
            signMessage: signMessageFn,
            getChainId: () => BigInt(chainId),
          }
        : {
            type: 'EOA',
            getIdentifier: () => ({
              identifier: address,
              identifierKind: IdentifierKind.Ethereum,
            }),
            signMessage: signMessageFn,
          }

      const client = await Client.create(signer, {
        env: XMTP_ENV as any,
        dbEncryptionKey: encKeyBytes,
      })

      if (!mountedRef.current) {
        client.close()
        return
      }

      clientRef.current = client
      setInboxId(client.inboxId ?? null)

      // Sync & load conversations
      await client.conversations.sync()
      const convos = await client.conversations.list()
      const summaries = await Promise.all(convos.map(buildConvoSummary))
      summaries.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
      conversationsRef.current = summaries
      if (mountedRef.current) setConversations(summaries)

      // Stream new conversations
      const convoStream = await client.conversations.stream({
        onValue: async (convo) => {
          if (!mountedRef.current) return
          const summary = await buildConvoSummary(convo as any)
          setConversations((prev) => {
            if (prev.find((c) => c.id === summary.id)) return prev
            const next = [summary, ...prev]
            conversationsRef.current = next
            return next
          })
        },
      })
      convoStreamRef.current = convoStream

      // Stream all incoming messages (for unread counts + live updates)
      const allMsgStream = await client.conversations.streamAllMessages({
        onValue: (msg: DecodedMessage) => {
          if (!mountedRef.current) return
          const convoId = msg.conversationId
          const chatMsg = decodedToChat(msg, client.inboxId!)

          // Browser notification for background messages
          if (!chatMsg.isSelf) {
            const convoName = conversationsRef.current.find((c) => c.id === convoId)?.name ?? 'New message'
            showNotification(convoName, chatMsg.content)
          }

          // Update conversation list (bump to top + last message)
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === convoId)
            if (idx === -1) return prev
            const updated = { ...prev[idx] }
            if (typeof msg.content === 'string') {
              updated.lastMessageText = msg.content
            }
            updated.lastMessageAt = msg.sentAt
            if (!chatMsg.isSelf) updated.unreadCount += 1
            const next = [...prev]
            next.splice(idx, 1)
            const reordered = [updated, ...next]
            conversationsRef.current = reordered
            return reordered
          })

          // Notify per-conversation subscribers
          const cbs = perConvoCbRef.current.get(convoId)
          if (cbs) {
            for (const cb of cbs) cb(chatMsg)
          }
        },
      })
      msgStreamRef.current = allMsgStream

      // Request browser notification permission (non-blocking)
      void requestNotificationPermission()

      if (mountedRef.current) setStatus('connected')
    } catch (e) {
      console.error('[xmtp] connect error:', e)
      if (mountedRef.current) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Failed to connect to XMTP')
      }
    }
  }, [address, walletClient])

  // ------- disconnect -------
  const disconnect = useCallback(() => {
    void cleanup()
    setStatus('idle')
    setError(null)
    setConversations([])
    conversationsRef.current = []
    setInboxId(null)
  }, [])

  // ------- decode message helper -------
  function decodedToChat(msg: DecodedMessage, selfInboxId: string): ChatMessage {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderInboxId: msg.senderInboxId,
      content: typeof msg.content === 'string' ? msg.content : (msg.fallback ?? '[unsupported]'),
      sentAt: msg.sentAt,
      isSelf: msg.senderInboxId === selfInboxId,
    }
  }

  // ------- load messages -------
  const loadMessages = useCallback(async (conversationId: string): Promise<ChatMessage[]> => {
    const client = clientRef.current
    if (!client) return []
    try {
      const convo = await client.conversations.getConversationById(conversationId)
      if (!convo) return []
      await convo.sync()
      const msgs = await convo.messages()
      return msgs
        .filter((m) => typeof m.content === 'string' || m.fallback)
        .map((m) => decodedToChat(m, client.inboxId!))
    } catch (e) {
      console.error('[xmtp] loadMessages error:', e)
      return []
    }
  }, [])

  // ------- send message -------
  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    const client = clientRef.current
    if (!client || !text.trim()) return
    try {
      const convo = await client.conversations.getConversationById(conversationId)
      if (!convo) throw new Error('conversation_not_found')
      await convo.sendText(text.trim())
    } catch (e) {
      console.error('[xmtp] sendMessage error:', e)
      throw e
    }
  }, [])

  // ------- start DM -------
  const startDm = useCallback(async (peerAddress: `0x${string}`): Promise<string | null> => {
    const client = clientRef.current
    if (!client) return null
    try {
      const dm = await client.conversations.createDmWithIdentifier({
        identifier: peerAddress,
        identifierKind: IdentifierKind.Ethereum,
      })
      const summary = await buildConvoSummary(dm as any)
      setConversations((prev) => {
        if (prev.find((c) => c.id === summary.id)) return prev
        const next = [summary, ...prev]
        conversationsRef.current = next
        return next
      })
      return dm.id
    } catch (e) {
      console.error('[xmtp] startDm error:', e)
      return null
    }
  }, [])

  // ------- subscribe to per-conversation messages -------
  const subscribeToMessages = useCallback(
    (conversationId: string, cb: (msg: ChatMessage) => void): (() => void) => {
      if (!perConvoCbRef.current.has(conversationId)) {
        perConvoCbRef.current.set(conversationId, new Set())
      }
      perConvoCbRef.current.get(conversationId)!.add(cb)

      // Clear unread when subscribing
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
        conversationsRef.current = next
        return next
      })

      return () => {
        perConvoCbRef.current.get(conversationId)?.delete(cb)
      }
    },
    [],
  )

  // ------- resolve inboxId → Ethereum address -------
  const resolveInboxAddress = useCallback(async (targetInboxId: string): Promise<string | null> => {
    const cached = inboxAddressCache.current.get(targetInboxId)
    if (cached !== undefined) return cached
    const client = clientRef.current
    if (!client) return null
    try {
      const states = await client.preferences.fetchInboxStates([targetInboxId])
      const addr = getEthereumAddressFromInboxState(states?.[0])
      inboxAddressCache.current.set(targetInboxId, addr)
      return addr
    } catch {
      inboxAddressCache.current.set(targetInboxId, null)
      return null
    }
  }, [])

  return (
    <XmtpContext.Provider
      value={{
        status,
        error,
        inboxId,
        connect,
        disconnect,
        conversations,
        loadMessages,
        sendMessage,
        startDm,
        subscribeToMessages,
        resolveInboxAddress,
      }}
    >
      {children}
    </XmtpContext.Provider>
  )
}
