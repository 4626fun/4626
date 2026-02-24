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
import { APP_ORIGIN } from '@/lib/host'
import { apiFetch } from '@/lib/apiBase'
import { getBasenameName } from '@/lib/xmtp/socialIdentity'
import { CANONICAL_SCW_CHAIN_ID, decideXmtpSignerType, resolveXmtpChainId } from '@/lib/xmtp/signerUtils'
import {
  Client,
  Opfs,
  type Signer,
  type Conversation,
  type Dm,
  type Group,
  type DecodedMessage,
  type AsyncStreamProxy,
} from '@xmtp/browser-sdk'
import { IdentifierKind } from '@xmtp/browser-sdk'
import { getAddress, isAddress } from 'viem'

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

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }
type WaitlistMeData = {
  cswAddress?: string | null
  primarySmartWallet?: string | null
  baseSubAccount?: string | null
  connectedAccounts?: Array<{
    address?: string | null
    provider?: string | null
    verifiedAt?: string | null
    isCanonicalSmartWallet?: boolean
  }>
}

const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

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

function signerTypeStorageKey(address: string): string {
  return `cv:xmtp:signerType:${XMTP_ENV}:${address.toLowerCase()}`
}

function readStoredSignerType(address: string): 'SCW' | 'EOA' | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(signerTypeStorageKey(address))
    if (raw === 'SCW' || raw === 'EOA') return raw
    return null
  } catch {
    return null
  }
}

function writeStoredSignerType(address: string, signerType: 'SCW' | 'EOA'): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(signerTypeStorageKey(address), signerType)
  } catch {
    // ignore storage errors
  }
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

function closeClientSafe(client: Client | null | undefined): void {
  if (!client) return
  try {
    client.close()
  } catch {
    // ignore close errors
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

function normalizeEvmAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase()
}

function pickCanonicalSmartWalletAddress(row: WaitlistMeData | null): string | null {
  if (!row) return null

  const canonicalFromAccounts = (row.connectedAccounts ?? [])
    .filter((item) => item?.isCanonicalSmartWallet)
    .map((item) => ({
      address: normalizeEvmAddress(item?.address),
      provider: String(item?.provider ?? '').toLowerCase(),
      verifiedAt: Date.parse(String(item?.verifiedAt ?? '')),
    }))
    .filter((item) => Boolean(item.address))
    .sort((a, b) => {
      if (a.provider.includes('privy') !== b.provider.includes('privy')) {
        return a.provider.includes('privy') ? 1 : -1
      }
      const aMs = Number.isFinite(a.verifiedAt) ? a.verifiedAt : -1
      const bMs = Number.isFinite(b.verifiedAt) ? b.verifiedAt : -1
      return bMs - aMs
    })
  if (canonicalFromAccounts[0]?.address) return canonicalFromAccounts[0].address

  const candidates: Array<string | null | undefined> = [
    row.cswAddress,
    row.primarySmartWallet,
    row.baseSubAccount,
  ]
  for (const c of candidates) {
    const normalized = normalizeEvmAddress(c)
    if (normalized) return normalized
  }
  return null
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
 * Auto-revoke the single oldest XMTP installation to free exactly 1 slot.
 *
 * IMPORTANT: each revocation consumes 1 of the inbox's 256 lifetime updates.
 * We revoke only the minimum needed (1) to stay as frugal as possible.
 * Uses the static `Client.revokeInstallations` — no live client required.
 */
async function autoRevokeOldestInstallation(
  signer: Signer,
  inboxId: string,
): Promise<void> {
  console.log('[xmtp] Fetching installations for inbox', inboxId)
  const states = await (Client as any).fetchInboxStates(
    [inboxId],
    XMTP_ENV as any,
  ) as any[]
  const state = Array.isArray(states) ? states[0] : null
  const installsRaw = Array.isArray(state?.installations)
    ? state.installations
    : []
  const installs = installsRaw
    .map((i: any) => {
      const bytes = i?.bytes ?? i
      const createdAt =
        typeof i?.createdAt === 'string' && i.createdAt
          ? Date.parse(i.createdAt)
          : Number.NaN
      return {
        bytes,
        createdAt: Number.isFinite(createdAt) ? createdAt : null,
      }
    })
    .filter((i: any) => Boolean(i.bytes))

  if (installs.length === 0) return

  // Pick just the single oldest installation to revoke — 1 update spent.
  const sorted = [...installs].sort((a, b) => {
    const aa = a.createdAt ?? 0
    const bb = b.createdAt ?? 0
    return aa - bb // oldest first
  })
  const toRevoke = [sorted[0].bytes]

  console.log(
    `[xmtp] Revoking 1 oldest of ${installs.length} installation(s) (256-update budget)…`,
  )
  await (Client as any).revokeInstallations(
    signer,
    inboxId,
    toRevoke,
    XMTP_ENV as any,
  )
  console.log('[xmtp] Auto-revocation complete — freed 1 slot')
}

// ---------------------------------------------------------------------------
// OPFS / Storage persistence
// ---------------------------------------------------------------------------

/**
 * Request persistent storage so the browser doesn't evict the OPFS database
 * that holds the XMTP installation.  Without this, browsers may silently
 * garbage-collect OPFS data under storage pressure, forcing Client.build to
 * fail and Client.create to burn a new installation slot.
 *
 * See: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist
 */
async function requestPersistentStorage(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return
  try {
    const alreadyPersisted = await navigator.storage.persisted()
    if (alreadyPersisted) {
      console.log('[xmtp] Storage is already persistent')
      return
    }
    const granted = await navigator.storage.persist()
    console.log(`[xmtp] Persistent storage ${granted ? 'granted' : 'denied'}`)
  } catch (err) {
    console.warn('[xmtp] navigator.storage.persist() failed (non-fatal):', err)
  }
}

/**
 * Check whether an XMTP database file exists in OPFS for the given env.
 * Returns true if at least one `xmtp-{env}-*.db3` file is present.
 * When no database exists, Client.build cannot possibly succeed so callers
 * should skip directly to Client.create.
 */
async function hasOpfsDatabase(): Promise<boolean> {
  try {
    const opfs = await Opfs.create()
    try {
      const files = await opfs.listFiles()
      const prefix = `xmtp-${XMTP_ENV}-`
      const found = files.some(
        (f) => f.startsWith(prefix) && f.endsWith('.db3'),
      )
      console.log(
        `[xmtp] OPFS files: ${files.length} total, DB present: ${found}`,
        files.filter((f) => f.endsWith('.db3')),
      )
      return found
    } finally {
      opfs.close()
    }
  } catch (err) {
    // OPFS not supported or other error — assume DB might exist
    console.warn('[xmtp] OPFS check failed (assuming DB might exist):', err)
    return true
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
  const { address, isConnected, connector } = useAccount()
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
  const resolvedIdentityByWalletRef = useRef<
    Map<string, { identityAddress: string; isCanonicalSmartWallet: boolean }>
  >(new Map())

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

  // ------- resolve address → display name (Basename / truncated) -------
  const nameCache = useRef<Map<string, string>>(new Map())

  const resolveDisplayName = useCallback(async (address: string): Promise<string> => {
    const lower = address.toLowerCase()
    const cached = nameCache.current.get(lower)
    if (cached) return cached

    const basename = await getBasenameName(address).catch(() => null)
    if (basename) {
      const short = basename.replace(/\.base\.eth$/i, '')
      nameCache.current.set(lower, short)
      return short
    }

    const truncated = truncateAddress(address)
    nameCache.current.set(lower, truncated)
    return truncated
  }, [])

  // ------- build conversation summary -------
  const buildConvoSummary = useCallback(async (convo: Conversation | Dm | Group): Promise<ChatConversation> => {
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
        // Resolve to Basename / ENS name, falling back to truncated address
        name = resolved
          ? await resolveDisplayName(resolved)
          : truncateAddress(peerInboxId)
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
  }, [resolveDisplayName])

  // ------- connect -------
  const resolveXmtpIdentityAddress = useCallback(async (connectedAddress: string): Promise<{
    identityAddress: string
    isCanonicalSmartWallet: boolean
  }> => {
    const connected = normalizeEvmAddress(connectedAddress)
    if (!connected) return { identityAddress: connectedAddress.toLowerCase(), isCanonicalSmartWallet: false }

    const cached = resolvedIdentityByWalletRef.current.get(connected)
    if (cached) return cached

    let preferred = connected
    let isCanonicalSmartWallet = false
    try {
      const res = await apiFetch('/api/waitlist/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeData | null> | null
      const row = res.ok && json?.success ? (json.data ?? null) : null
      const canonical = pickCanonicalSmartWalletAddress(row)
      if (canonical) {
        preferred = canonical
        isCanonicalSmartWallet = true
      }
    } catch {
      // Best-effort canonical identity resolution; fallback to connected wallet.
    }

    if (preferred !== connected && publicClient) {
      try {
        const isOwner = (await publicClient.readContract({
          address: preferred as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [connected as `0x${string}`],
        })) as boolean
        if (!isOwner) {
          preferred = connected
          isCanonicalSmartWallet = false
        }
      } catch {
        preferred = connected
        isCanonicalSmartWallet = false
      }
    }

    const resolved = { identityAddress: preferred, isCanonicalSmartWallet }
    resolvedIdentityByWalletRef.current.set(connected, resolved)
    return resolved
  }, [publicClient])

  const connect = useCallback(async () => {
    if (!address || !walletClient) return
    if (clientRef.current) return // already connected
    if (connectInFlightRef.current) return

    // XMTP installations are scoped to a browser origin. Allowing messaging on
    // preview/staging origins would create additional installations and can
    // quickly hit 10/10 for users. We restrict to the canonical app origin.
    const canonicalAppOrigin = APP_ORIGIN.replace(/\/+$/, '')
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''
    const hostname = typeof window !== 'undefined' ? (window.location.hostname ?? '').toLowerCase() : ''
    const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1'
    const isCanonicalOrigin = currentOrigin === canonicalAppOrigin
    if (!isCanonicalOrigin && !isLocalDev) {
      const msg =
        `Messaging is disabled on ${currentOrigin || 'this origin'} to prevent XMTP installation churn. ` +
        `Open ${canonicalAppOrigin} to use chat.`
      if (mountedRef.current) {
        setStatus('error')
        setError(msg)
      }
      return
    }

    connectInFlightRef.current = true
    let xmtpIdentityAddress = String(address).toLowerCase()
    try {
      setError(null)
      setInstallationLimitInboxId(null)
      const resolved = await resolveXmtpIdentityAddress(address)
      xmtpIdentityAddress = resolved.identityAddress
      console.log('[xmtp] Using identity for connect:', xmtpIdentityAddress)

      const identifier = {
        identifier: xmtpIdentityAddress as `0x${string}`,
        identifierKind: IdentifierKind.Ethereum,
      }
      const baseOptions = {
        env: XMTP_ENV as any,
        appVersion: XMTP_APP_VERSION,
      }

      // Shared setup: sync conversations, start streams, mark connected.
      const setupConversations = async (client: Client) => {
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
          setAutoConnectEnabled(xmtpIdentityAddress)
          setStatus('connected')
        }

        // Auto-create a DM conversation with the Keepr agent so it appears
        // in the user's chat list.  We do NOT send any message on behalf of
        // the user — the agent will greet them when they send their first message.
        const agentAddr = (import.meta.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim()
        if (agentAddr && /^0x[a-fA-F0-9]{40}$/.test(agentAddr)) {
          void (async () => {
            try {
              const alreadyExists = summaries.some(
                (c) => c.peerAddress?.toLowerCase() === agentAddr.toLowerCase(),
              )
              if (alreadyExists) return // DM already exists
              const dm = await client.conversations.createDmWithIdentifier({
                identifier: agentAddr as `0x${string}`,
                identifierKind: IdentifierKind.Ethereum,
              })
              console.log('[xmtp] Created DM with agent (no message sent)', agentAddr)
              // Add to conversation list so it appears immediately
              const summary = await buildConvoSummary(dm as any)
              if (mountedRef.current) {
                setConversations((prev) => {
                  if (prev.find((c) => c.id === summary.id)) return prev
                  const next = [summary, ...prev]
                  conversationsRef.current = next
                  return next
                })
              }
            } catch (err) {
              console.warn('[xmtp] Auto-DM with agent failed (non-fatal):', err)
            }
          })()
        }
      }

      // ── Phase 0: Request persistent storage ──
      // Prevents the browser from silently evicting our OPFS database under
      // storage pressure.  Without this, Client.build can fail between sessions
      // even though the database was written successfully last time.
      await requestPersistentStorage()

      // Encryption key: the Browser SDK does NOT use it for encryption (per XMTP
      // docs), but the API still accepts it.  We keep the stored key for backward
      // compat with databases created by older versions of this code.
      const encKeyHex = getOrCreateEncKeyHex(xmtpIdentityAddress)
      const encKeyBytes = hexToBytes(encKeyHex)

      // ── Phase 1: Try Client.build (restore from local OPFS DB, zero popups) ──
      // This is the canonical reconnect path per XMTP docs.  It reuses the
      // existing installation (no new installation, no signature, zero updates
      // consumed).  The only requirement is that the OPFS database persists.
      setStatus('connecting')
      let buildClient: Client | null = null
      let buildSucceeded = false

      // Pre-check: does an OPFS database even exist?
      // If not, Client.build will always fail.  Skip straight to Client.create
      // to avoid confusing error logs and wasted time.
      const dbExists = await hasOpfsDatabase()

      if (dbExists) {
        // Attempt 1: try with the stored encryption key
        try {
          console.log('[xmtp] OPFS database found — attempting Client.build restore…')
          buildClient = await Client.build(identifier, {
            ...baseOptions,
            dbEncryptionKey: encKeyBytes,
          })
          if (buildClient?.inboxId) {
            buildSucceeded = true
            console.log(
              '[xmtp] Client.build succeeded — reusing installation',
              buildClient.installationId,
            )
          } else {
            console.log('[xmtp] Client.build returned no inboxId')
            try { buildClient?.close() } catch {}
            buildClient = null
          }
        } catch (buildErr) {
          const buildMsg = buildErr instanceof Error ? buildErr.message : String(buildErr)
          console.warn('[xmtp] Client.build failed with stored key:', buildMsg)
          closeClientSafe(buildClient)
          buildClient = null
          closeClientSafe(clientRef.current)
          clientRef.current = null
          await new Promise((r) => setTimeout(r, 200))
        }

        // Attempt 2: try without encryption key — the Browser SDK doesn't use
        // it for encryption, so the DB may be openable without one (or with a
        // different one) if the key in localStorage drifted.
        if (!buildSucceeded) {
          try {
            console.log('[xmtp] Retrying Client.build without dbEncryptionKey…')
            buildClient = await Client.build(identifier, { ...baseOptions })
            if (buildClient?.inboxId) {
              buildSucceeded = true
              console.log(
                '[xmtp] Client.build succeeded (no key) — reusing installation',
                buildClient.installationId,
              )
            } else {
              try { buildClient?.close() } catch {}
              buildClient = null
            }
          } catch (buildErr2) {
            console.warn('[xmtp] Client.build without key also failed:', buildErr2)
            closeClientSafe(buildClient)
            buildClient = null
            closeClientSafe(clientRef.current)
            clientRef.current = null
            await new Promise((r) => setTimeout(r, 200))
          }
        }
      } else {
        console.log('[xmtp] No OPFS database found — first use, will create new installation')
      }

      // ── Phase 1b: Client.build succeeded — set up conversations ──
      // If setupConversations fails here it's likely a transient network issue
      // or an "Uninitialized identity" error.  Do NOT fall through to
      // Client.create for transient failures — that would burn an installation.
      if (buildSucceeded && buildClient) {
        try {
          clientRef.current = buildClient
          setInboxId(buildClient.inboxId ?? null)
          await setupConversations(buildClient)
          return // fully connected via restore — done, zero updates consumed
        } catch (syncErr) {
          const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr)
          const isUninitialized = syncMsg.toLowerCase().includes('uninitialized')
          console.warn('[xmtp] Client.build restored but setupConversations failed:', syncMsg)

          if (isUninitialized) {
            // Identity exists locally but wasn't fully registered on the network
            // (e.g., user closed the tab mid-registration).  Must fall through
            // to Client.create to complete registration.
            console.log('[xmtp] Uninitialized identity — will re-create')
            try { buildClient.close() } catch {}
            clientRef.current = null
            buildClient = null
            await new Promise((r) => setTimeout(r, 200))
          } else {
            // Transient error (network timeout, server error, etc.).
            // Retry once — do NOT fall through to Client.create.
            console.log('[xmtp] Retrying setupConversations once…')
            try {
              await setupConversations(buildClient)
              return // retry succeeded
            } catch (retryErr) {
              console.error('[xmtp] setupConversations retry also failed:', retryErr)
              try { buildClient.close() } catch {}
              clientRef.current = null
              throw retryErr
            }
          }
        }
      }

      setStatus('connecting')

      const walletChainId = resolveXmtpChainId(walletClient.chain?.id)
      const storedSignerType = readStoredSignerType(xmtpIdentityAddress)

      let hasContractCode: boolean | null = null
      if (publicClient) {
        try {
          const code = await publicClient.getCode({ address: xmtpIdentityAddress as `0x${string}` })
          hasContractCode = typeof code === 'string' ? (code !== '0x' && code.length > 2) : null
        } catch {
          hasContractCode = null
        }
      }

      const signerDecision = decideXmtpSignerType({
        isCanonicalSmartWallet: resolved.isCanonicalSmartWallet,
        storedSignerType,
        connector,
        hasContractCode,
        walletChainId,
      })

      if (signerDecision.signerType === 'SCW') writeStoredSignerType(xmtpIdentityAddress, 'SCW')
      else writeStoredSignerType(xmtpIdentityAddress, 'EOA')

      const signMessageFn = async (message: string) => {
        const s = await walletClient.signMessage({ message })
        return hexToBytes(s)
      }

      const signer: Signer = signerDecision.signerType === 'SCW'
        ? {
            type: 'SCW',
            getIdentifier: () => ({ identifier: xmtpIdentityAddress as `0x${string}`, identifierKind: IdentifierKind.Ethereum }),
            signMessage: signMessageFn,
            getChainId: () => BigInt(signerDecision.scwChainId),
          }
        : {
            type: 'EOA',
            getIdentifier: () => ({ identifier: xmtpIdentityAddress as `0x${string}`, identifierKind: IdentifierKind.Ethereum }),
            signMessage: signMessageFn,
          }

      console.log('[xmtp] Client.build unavailable — falling through to Client.create (will require wallet signature)')

      // Helper: attempt Client.create, auto-revoking stale installations on 10/10.
      const tryCreate = async (dbKey: Uint8Array): Promise<Client> => {
        try {
          return await Client.create(signer, { ...baseOptions, dbEncryptionKey: dbKey })
        } catch (createErr) {
          const errMsg = createErr instanceof Error ? createErr.message : String(createErr)
          if (!isInstallationLimitError(errMsg)) throw createErr

          // 10/10 hit — auto-revoke stale installations and retry once.
          const limitInboxId = extractInstallationLimitInboxId(errMsg)
          if (!limitInboxId) throw createErr

          console.log('[xmtp] 10/10 installation limit hit — revoking oldest installation to free 1 slot…')
          setStatus('connecting')
          await autoRevokeOldestInstallation(signer, limitInboxId)
          return await Client.create(signer, { ...baseOptions, dbEncryptionKey: dbKey })
        }
      }

      // NOTE: the Browser SDK does NOT use dbEncryptionKey for encryption
      // (per XMTP docs), so generating a fresh key on failure would not help
      // and would only risk burning another installation slot.  We try once
      // with the stored key and let tryCreate handle 10/10 auto-revocation.
      const client = await tryCreate(encKeyBytes)

      if (!mountedRef.current) {
        client.close()
        return
      }

      clientRef.current = client
      setInboxId(client.inboxId ?? null)
      await setupConversations(client)

      // NOTE: we intentionally do NOT call revokeAllOtherInstallations() here.
      // Each revocation consumes 1 of the inbox's 256 lifetime updates.
      // Proactive bulk revocation would burn updates far too fast. Instead we
      // revoke only on-demand: when the 10/10 limit is actually hit (inside
      // tryCreate above) or via the manual resetInstallations() escape hatch.
    } catch (e) {
      console.error('[xmtp] connect error:', e)
      if (mountedRef.current) {
        const msg = e instanceof Error ? e.message : 'Failed to connect to XMTP'
        if (isInstallationLimitError(msg)) {
          setInstallationLimitInboxId(extractInstallationLimitInboxId(msg))
          // Disable auto-connect so the 10/10 error doesn't fire on every page load.
          // Auto-connect is re-enabled after a successful resetInstallations() → connect().
          clearAutoConnect(xmtpIdentityAddress)
        }
        setStatus('error')
        setError(msg)
      }
    } finally {
      connectInFlightRef.current = false
    }
  }, [address, connector, walletClient, publicClient, resolveXmtpIdentityAddress, buildConvoSummary])

  const resetInstallations = useCallback(async () => {
    if (!address || !walletClient) throw new Error('Connect wallet first.')
    const targetInboxId = installationLimitInboxId
    if (!targetInboxId) {
      throw new Error('No inboxId available to reset installations.')
    }

    // This consumes inbox updates. Only do it when you are already blocked.
    setStatus('signing')
    setError(null)

    const walletChainId = resolveXmtpChainId(walletClient.chain?.id)
    const signMessageFn = async (message: string) => {
      const s = await walletClient.signMessage({ message })
      return hexToBytes(s)
    }

    // Use the same signer shape we use for normal Client.create.
    const storedSignerType = readStoredSignerType(address)
    let hasContractCode: boolean | null = null
    if (publicClient) {
      try {
        const code = await publicClient.getCode({ address })
        hasContractCode = typeof code === 'string' ? (code !== '0x' && code.length > 2) : null
      } catch {
        hasContractCode = null
      }
    }
    const signerDecision = decideXmtpSignerType({
      isCanonicalSmartWallet: true,
      storedSignerType,
      connector,
      hasContractCode,
      walletChainId,
    })

    const signer: Signer = signerDecision.signerType === 'SCW'
      ? {
          type: 'SCW',
          getIdentifier: () => ({
            identifier: address,
            identifierKind: IdentifierKind.Ethereum,
          }),
          signMessage: signMessageFn,
          getChainId: () => BigInt(CANONICAL_SCW_CHAIN_ID),
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
  }, [buildConvoSummary])

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
