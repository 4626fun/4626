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
import { getHostMode } from '@/lib/host'
import {
  Client,
  getInboxIdForIdentifier,
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
  peerAddress?: string
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
  /** InboxId extracted from a 10/10 installations error (if present). */
  installationLimitInboxId: string | null
  connect: () => Promise<void>
  /** Emergency recovery: revoke installations to free a slot, then reconnect. */
  resetInstallations: () => Promise<void>
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
  installationLimitInboxId: null,
  connect: async () => {},
  resetInstallations: async () => {},
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

/**
 * @deprecated Kept for backward-compat: old installs used a signature-derived
 * key. New installs use a random key (no wallet popup needed).
 */
export const ENC_KEY_MESSAGE =
  'Enable encrypted messaging on CreatorVault (4626.fun)\n\nThis signature encrypts your local message database.\nNo blockchain transaction will occur.'

const RAW_XMTP_ENV = String(import.meta.env.VITE_XMTP_ENV ?? '').trim().toLowerCase()
const XMTP_ENV: 'production' | 'dev' | 'local' =
  RAW_XMTP_ENV === 'dev' || RAW_XMTP_ENV === 'local' || RAW_XMTP_ENV === 'production'
    ? (RAW_XMTP_ENV as 'production' | 'dev' | 'local')
    : 'production'
const XMTP_APP_VERSION = '4626.fun-web'
const ENC_KEY_HEX_RE = /^0x[0-9a-fA-F]{64}$/

function encKeyStorageKey(address: string): string {
  return `cv:xmtp:encKey:${XMTP_ENV}:${address.toLowerCase()}`
}

function autoConnectStorageKey(address: string): string {
  return `cv:xmtp:autoConnect:${XMTP_ENV}:${address.toLowerCase()}`
}

export function readStoredEncKeyHex(address: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(encKeyStorageKey(address))
    if (!raw || !ENC_KEY_HEX_RE.test(raw)) return null
    return raw
  } catch {
    return null
  }
}

export function writeStoredEncKeyHex(address: string, encKeyHex: string): void {
  if (typeof window === 'undefined') return
  if (!ENC_KEY_HEX_RE.test(encKeyHex)) return
  try {
    window.localStorage.setItem(encKeyStorageKey(address), encKeyHex)
  } catch {
    // ignore storage errors
  }
}

function clearStoredEncKeyHex(address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(encKeyStorageKey(address))
  } catch {
    // ignore storage errors
  }
}

/**
 * Get or create a random XMTP DB encryption key for this address.
 * Stored in localStorage — no wallet popup required.
 * Falls back to any existing signature-derived key for backward compat.
 */
function getOrCreateEncKeyHex(address: string): string {
  // 1. Return existing key (works for both old sig-derived and new random keys)
  const existing = readStoredEncKeyHex(address)
  if (existing) return existing

  // 2. Generate a random 32-byte key
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const hex = `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
  writeStoredEncKeyHex(address, hex)
  return hex
}

function isAutoConnectEnabled(address: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(autoConnectStorageKey(address)) === '1'
  } catch {
    return false
  }
}

export function setAutoConnectEnabled(address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(autoConnectStorageKey(address), '1')
  } catch {
    // ignore storage errors
  }
}

/**
 * Signal the XMTP provider to auto-connect after auth completes.
 * Dispatches a custom event that the provider listens for.
 */
export function requestXmtpAutoConnect(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('cv:xmtp:autoConnectRequest'))
}

function clearAutoConnect(address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(autoConnectStorageKey(address))
  } catch {
    // ignore storage errors
  }
}

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

function extractInstallationLimitInboxId(message: string): string | null {
  const msg = String(message || '')
  // Example:
  // "Cannot register a new installation because the InboxID <hex> has already registered 10/10 installations..."
  const m = msg.match(/InboxID\s+([0-9a-fA-F]{64})/)
  return m?.[1] ? m[1].toLowerCase() : null
}

function isInstallationLimitError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return m.includes('registered 10/10 installations') || m.includes('10/10 installations')
}

/**
 * Maximum installations XMTP allows per inbox.
 * We preemptively revoke when at (MAX - 1) to leave room for Client.create().
 */
const XMTP_MAX_INSTALLATIONS = 10
const XMTP_SAFE_THRESHOLD = XMTP_MAX_INSTALLATIONS - 1 // 9

/**
 * Pre-flight check: query the inbox's installation count *before* calling
 * Client.create().  If we're at or above the safe threshold, revoke the
 * oldest installation(s) so the upcoming create won't hit 10/10.
 *
 * This uses the static Client methods so no client instance is needed.
 */
async function ensureInstallationSlot(
  signer: Signer,
  env: string,
): Promise<void> {
  try {
    // Resolve the inboxId for this signer's identifier
    const identifier = await signer.getIdentifier()
    const inboxId = await getInboxIdForIdentifier(identifier, env as any)
    if (!inboxId) return // new user, no installations yet

    const states = await Client.fetchInboxStates([inboxId], env as any)
    const state = states?.[0]
    if (!state) return // no state found, likely new inbox

    const installs = Array.isArray(state.installations) ? state.installations : []
    if (installs.length < XMTP_SAFE_THRESHOLD) return // plenty of room

    console.warn(
      `[xmtp] Pre-flight: inbox ${inboxId} has ${installs.length}/${XMTP_MAX_INSTALLATIONS} installations. ` +
        `Auto-revoking oldest to free a slot.`,
    )

    // Sort by createdAt ascending (oldest first), revoke enough to get to threshold - 1
    const revokeCount = Math.max(1, installs.length - (XMTP_SAFE_THRESHOLD - 1))
    const sorted = [...installs].sort((a: any, b: any) => {
      const aTime = typeof a.createdAt === 'number' ? a.createdAt : (Date.parse(a.createdAt) || 0)
      const bTime = typeof b.createdAt === 'number' ? b.createdAt : (Date.parse(b.createdAt) || 0)
      return aTime - bTime
    })
    const toRevoke = sorted.slice(0, revokeCount).map((i: any) => i.bytes ?? i.id)
    const validRevoke = toRevoke.filter(Boolean)

    if (validRevoke.length > 0) {
      await Client.revokeInstallations(signer, inboxId, validRevoke, env as any)
      console.log(`[xmtp] Pre-flight: revoked ${validRevoke.length} stale installation(s)`)
    }
  } catch (err) {
    // Non-fatal: if the pre-flight fails, Client.create() will either succeed
    // or throw the 10/10 error which is already handled.
    console.warn('[xmtp] Pre-flight installation check failed (non-fatal):', err)
  }
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
  const [installationLimitInboxId, setInstallationLimitInboxId] = useState<string | null>(null)

  const clientRef = useRef<Client | null>(null)
  const convoStreamRef = useRef<AsyncStreamProxy<any> | null>(null)
  const msgStreamRef = useRef<AsyncStreamProxy<any> | null>(null)
  const perConvoStreamsRef = useRef<Map<string, AsyncStreamProxy<any>>>(new Map())
  const perConvoCbRef = useRef<Map<string, Set<(msg: ChatMessage) => void>>>(new Map())
  const inboxAddressCache = useRef<Map<string, string | null>>(new Map())
  const conversationsRef = useRef<ChatConversation[]>([])
  const mountedRef = useRef(true)
  const connectInFlightRef = useRef(false)
  const autoConnectAttemptedRef = useRef<string | null>(null)

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
      setInstallationLimitInboxId(null)
      autoConnectAttemptedRef.current = null
    }
  }, [isConnected, address])

  useEffect(() => {
    autoConnectAttemptedRef.current = null
  }, [address])

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
    let peerAddress: string | undefined

    if (isDm) {
      try {
        peerInboxId = await (convo as Dm).peerInboxId()
        const states = await clientRef.current?.preferences.fetchInboxStates([peerInboxId])
        const resolved = getEthereumAddressFromInboxState(states?.[0])
        peerAddress = resolved ?? undefined
        name = resolved ? truncateAddress(resolved) : truncateAddress(peerInboxId)
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
      peerAddress,
      lastMessageText,
      lastMessageAt,
      unreadCount: 0,
    }
  }

  // ------- connect -------
  const connect = useCallback(async () => {
    if (!address || !walletClient) return
    if (clientRef.current) return // already connected
    if (connectInFlightRef.current) return
    if (getHostMode() !== 'app') return // XMTP only on app.4626.fun to avoid multi-origin installations

    connectInFlightRef.current = true
    try {
      setError(null)
      setInstallationLimitInboxId(null)

      const identifier = {
        identifier: address as `0x${string}`,
        identifierKind: IdentifierKind.Ethereum,
      }
      const baseOptions = {
        env: XMTP_ENV as any,
        appVersion: XMTP_APP_VERSION,
      }

      // Get or create a random encryption key — no wallet popup needed.
      // Backward-compatible: reuses any existing signature-derived key.
      const encKeyHex = getOrCreateEncKeyHex(address)
      const encKeyBytes = hexToBytes(encKeyHex)

      // Try restore first: Client.build uses existing local DB, no wallet popup.
      // Reuses the same installation, avoids revoke/install churn.
      setStatus('connecting')
      try {
        const restored = await Client.build(identifier, { ...baseOptions, dbEncryptionKey: encKeyBytes })
        if (restored?.inboxId) {
          const client = restored as any
          clientRef.current = client
          setInboxId(client.inboxId ?? null)
          await client.conversations.sync()
          const convos = await client.conversations.list()
          const summaries = await Promise.all(convos.map(buildConvoSummary))
          summaries.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
          conversationsRef.current = summaries
          if (mountedRef.current) setConversations(summaries)
          const convoStream = await client.conversations.stream({
            onValue: async (convo: any) => {
              if (!mountedRef.current) return
              const summary = await buildConvoSummary(convo)
              setConversations((prev) => {
                if (prev.find((c) => c.id === summary.id)) return prev
                const next = [summary, ...prev]
                conversationsRef.current = next
                return next
              })
            },
          })
          convoStreamRef.current = convoStream
          const allMsgStream = await client.conversations.streamAllMessages({
            onValue: (msg: DecodedMessage) => {
              if (!mountedRef.current) return
              const convoId = msg.conversationId
              const chatMsg = decodedToChat(msg, client.inboxId!)
              if (!chatMsg.isSelf) {
                const convoName = conversationsRef.current.find((c) => c.id === convoId)?.name ?? 'New message'
                showNotification(convoName, chatMsg.content)
              }
              setConversations((prev) => {
                const idx = prev.findIndex((c) => c.id === convoId)
                if (idx === -1) return prev
                const updated = { ...prev[idx] }
                if (typeof msg.content === 'string') updated.lastMessageText = msg.content
                updated.lastMessageAt = msg.sentAt
                if (!chatMsg.isSelf) updated.unreadCount += 1
                const next = [...prev]
                next.splice(idx, 1)
                const reordered = [updated, ...next]
                conversationsRef.current = reordered
                return reordered
              })
              const cbs = perConvoCbRef.current.get(convoId)
              if (cbs) for (const cb of cbs) cb(chatMsg)
            },
          })
          msgStreamRef.current = allMsgStream
          void requestNotificationPermission()
          if (mountedRef.current) {
            setAutoConnectEnabled(address)
            setStatus('connected')
          }
          return
        }
      } catch (_restoreErr) {
        // No existing installation — fall back to Client.create (needs signer)
      }

      setStatus('connecting')

      // Detect whether the connected wallet is a smart contract wallet (SCW).
      let isSmartWallet = false
      const chainId = walletClient.chain?.id ?? 8453
      if (publicClient) {
        try {
          const code = await publicClient.getCode({ address })
          isSmartWallet = typeof code === 'string' && code !== '0x' && code.length > 2
        } catch {
          isSmartWallet = chainId === 8453
        }
      } else {
        isSmartWallet = chainId === 8453
      }

      const signMessageFn = async (message: string) => {
        const s = await walletClient.signMessage({ message })
        return hexToBytes(s)
      }

      const signer: Signer = isSmartWallet
        ? {
            type: 'SCW',
            getIdentifier: () => ({ identifier: address as `0x${string}`, identifierKind: IdentifierKind.Ethereum }),
            signMessage: signMessageFn,
            getChainId: () => BigInt(chainId),
          }
        : {
            type: 'EOA',
            getIdentifier: () => ({ identifier: address as `0x${string}`, identifierKind: IdentifierKind.Ethereum }),
            signMessage: signMessageFn,
          }

      await ensureInstallationSlot(signer, XMTP_ENV)

      let client: Client
      try {
        client = await Client.create(signer, {
          ...baseOptions,
          dbEncryptionKey: encKeyBytes,
        })
      } catch (createErr) {
        // If the stored key is stale (e.g. corrupted localStorage), regenerate
        // and retry once.
        clearStoredEncKeyHex(address)
        const freshHex = getOrCreateEncKeyHex(address)
        setStatus('connecting')
        client = await Client.create(signer, {
          ...baseOptions,
          dbEncryptionKey: hexToBytes(freshHex),
        })
      }

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

      if (mountedRef.current) {
        setAutoConnectEnabled(address)
        setStatus('connected')
      }
    } catch (e) {
      console.error('[xmtp] connect error:', e)
      if (mountedRef.current) {
        const msg = e instanceof Error ? e.message : 'Failed to connect to XMTP'
        if (isInstallationLimitError(msg)) {
          setInstallationLimitInboxId(extractInstallationLimitInboxId(msg))
          // Disable auto-connect so the 10/10 error doesn't fire on every page load.
          // Auto-connect is re-enabled after a successful resetInstallations() → connect().
          if (address) clearAutoConnect(address)
        }
        setStatus('error')
        setError(msg)
      }
    } finally {
      connectInFlightRef.current = false
    }
  }, [address, walletClient, publicClient])

  const resetInstallations = useCallback(async () => {
    if (!address || !walletClient) throw new Error('Connect wallet first.')
    const targetInboxId = installationLimitInboxId
    if (!targetInboxId) {
      throw new Error('No inboxId available to reset installations.')
    }

    // This consumes inbox updates. Only do it when you are already blocked.
    setStatus('signing')
    setError(null)

    const chainId = walletClient.chain?.id ?? 8453
    const signMessageFn = async (message: string) => {
      const s = await walletClient.signMessage({ message })
      return hexToBytes(s)
    }

    // Use the same signer shape we use for normal Client.create.
    let isSmartWallet = false
    if (publicClient) {
      try {
        const code = await publicClient.getCode({ address })
        isSmartWallet = typeof code === 'string' && code !== '0x' && code.length > 2
      } catch {
        isSmartWallet = chainId === 8453
      }
    } else {
      isSmartWallet = chainId === 8453
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

    setStatus('connecting')
    try {
      const states = (await (Client as any).fetchInboxStates([targetInboxId], XMTP_ENV as any)) as any[]
      const state = Array.isArray(states) ? states[0] : null
      const recoveryIdentityRaw = String(state?.recoveryIdentity ?? '').trim()
      const recoveryIdentity = recoveryIdentityRaw.toLowerCase()
      if (recoveryIdentity.startsWith('0x') && recoveryIdentity.length === 42) {
        const connectedLower = address.toLowerCase()
        if (recoveryIdentity !== connectedLower) {
          throw new Error(
            `Only the recovery identity can revoke installations for this inbox. ` +
              `Recovery is ${recoveryIdentityRaw}; connected wallet is ${address}.`,
          )
        }
      }

      const installsRaw = Array.isArray(state?.installations) ? state.installations : []
      const installs = installsRaw
        .map((i: any) => {
          const bytes = i?.bytes ?? i
          const createdAt =
            typeof i?.createdAt === 'string' && i.createdAt ? Date.parse(i.createdAt) : Number.NaN
          return { bytes, createdAt: Number.isFinite(createdAt) ? createdAt : null }
        })
        .filter((i: any) => Boolean(i.bytes))

      if (installs.length === 0) {
        // Nothing to revoke; attempt a normal connect.
        await connect()
        return
      }

      // Revoke only the minimum number of installations needed to get under the 10-installation limit.
      // Keep at most 9 so `Client.create()` can register a new installation.
      const revokeCount = Math.max(1, installs.length - 9)
      const sorted = [...installs].sort((a, b) => {
        // Prefer revoking oldest known installs first; fall back to stable order.
        const aa = a.createdAt ?? 0
        const bb = b.createdAt ?? 0
        return aa - bb
      })
      const toRevoke = sorted.slice(0, revokeCount).map((i) => i.bytes)

      if (typeof window !== 'undefined') {
        const ok = window.confirm(
          `XMTP inbox ${targetInboxId} has ${installs.length} installation(s) (max 10). ` +
            `This will revoke ${toRevoke.length} installation(s) to free a slot.\n\n` +
            `This may log you out on other devices and consumes inbox updates (max 256 lifetime). Continue?`,
        )
        if (!ok) {
          setStatus('idle')
          setError('XMTP reset cancelled.')
          return
        }
      }

      await (Client as any).revokeInstallations(signer, targetInboxId, toRevoke, XMTP_ENV as any)

      setInstallationLimitInboxId(null)
      setError(null)
      await connect()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reset XMTP installations'
      setStatus('error')
      setError(msg)
      throw err
    }
  }, [address, walletClient, installationLimitInboxId, publicClient, connect])

  // Auto-connect when user previously enabled: try Client.build first (restore, no wallet).
  // Only triggers wallet if restore fails (new user).
  useEffect(() => {
    if (getHostMode() !== 'app') return
    if (!isConnected || !address || !walletClient) return
    if (!isAutoConnectEnabled(address)) return
    if (clientRef.current || connectInFlightRef.current) return
    if (status === 'signing' || status === 'connecting' || status === 'connected' || status === 'error') return
    const attemptKey = `${address.toLowerCase()}:${walletClient.chain?.id ?? 'unknown'}`
    if (autoConnectAttemptedRef.current === attemptKey) return
    autoConnectAttemptedRef.current = attemptKey
    void connect()
  }, [isConnected, address, walletClient, status, connect])

  // SIWE / auth-flow auto-connect request
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => {
      if (getHostMode() !== 'app') return
      if (!isConnected || !address || !walletClient) return
      if (clientRef.current || connectInFlightRef.current) return
      if (status === 'signing' || status === 'connecting' || status === 'connected') return
      void connect()
    }
    window.addEventListener('cv:xmtp:autoConnectRequest', handler)
    return () => window.removeEventListener('cv:xmtp:autoConnectRequest', handler)
  }, [isConnected, address, walletClient, status, connect])

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
        installationLimitInboxId,
        connect,
        resetInstallations,
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
