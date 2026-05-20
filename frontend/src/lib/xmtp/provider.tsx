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
import { xmtpDebugFlag } from '@/lib/flags/featureFlags'
import { APP_ORIGIN } from '@/lib/env/host'
import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'
import { shouldBlockSelfDm } from '@/lib/xmtp/dmGuard'
import { getBasenameName } from '@/lib/xmtp/socialIdentity'
import { resolveModePreferredIdentity, shouldRequireAuthBackedXmtpIdentity } from '@/lib/xmtp/identityResolver'
import { useAccountContext } from '@/wallet/accountContext'
import {
  TARGET_CANONICAL_CSW_ADDRESS,
  isTargetCanonicalCsw,
  shouldApplyCanonicalEnforcement,
} from '@/wallet/canonicalWalletPolicy'
import { CANONICAL_SCW_CHAIN_ID, decideXmtpSignerType, resolveXmtpChainId } from '@/lib/xmtp/signerUtils'
import {
  buildNotRegisteredDmMessage,
  encodeWireContent,
  extractCanMessageResult,
  extractInstallationLimitInboxId,
  formatXmtpEnvLabel,
  hexToBytes,
  isInstallationLimitError,
  isOpfsAccessHandleError,
  isScwSignatureValidationError,
  isWrongChainIdError,
  isXmtpEnvironmentMismatchError,
  isXmtpNotRegisteredError,
  normalizeEvmAddress,
  parseWireContent,
  shouldFallbackToOriginalXmtpRecipient,
  truncateAddress,
} from '@/lib/xmtp/xmtpHelpers'
import {
  Client,
  LogLevel,
  Opfs,
  toSafeSigner,
  encodeText,
  isActions,
  isReaction,
  isTextReply,
  isWalletSendCalls,
  type Signer,
  type Conversation,
  type Dm,
  type Group,
  type DecodedMessage,
  type AsyncStreamProxy,
} from '@xmtp/browser-sdk'
import { IdentifierKind } from '@xmtp/browser-sdk'
import { encodeAbiParameters, recoverMessageAddress, hashMessage } from 'viem'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type XmtpStatus = 'idle' | 'signing' | 'connecting' | 'connected' | 'error'
type ConnectIntent = 'auto' | 'user'

export type ChatMessageStatus = 'sending' | 'sent' | 'failed'
export type ChatMessageContentType = 'text' | 'json' | 'code'

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

export type ChatMessageActionButton = {
  id: string
  label: string
  style?: 'primary' | 'secondary' | 'danger'
}

export type ChatMessageActions = {
  promptId: string
  description: string
  buttons: ChatMessageActionButton[]
}

export type ChatMessageWalletSendCalls = {
  from: string
  chainId: string
  calls: Array<{ to: string; data: string; metadata?: { description?: string } }>
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderInboxId: string
  content: string
  contentType: ChatMessageContentType
  richPreview?: string
  replyToId?: string | null
  actions?: ChatMessageActions | null
  walletSendCalls?: ChatMessageWalletSendCalls | null
  reactionEmoji?: string | null
  status: ChatMessageStatus
  error: string | null
  sentAt: Date
  isSelf: boolean
}

export type SendChatMessageOptions = {
  replyToId?: string | null
  replyToSenderInboxId?: string | null
}

export type StartDmOptions = {
  nameHint?: string | null
  imageUrl?: string | null
  /** Address resolved from user input before canonical remapping. */
  inputAddress?: `0x${string}` | null
}

export type StartDmFailureReason =
  | 'not_connected'
  | 'self_recipient'
  | 'recipient_not_registered'
  | 'canonical_recipient_not_registered'
  | 'environment_mismatch'
  | 'create_failed'

export type StartDmResult =
  | {
      ok: true
      conversationId: string
      peerAddress: `0x${string}`
      usedOriginalAddressFallback: boolean
    }
  | { ok: false; reason: StartDmFailureReason; message: string }

type XmtpContextValue = {
  status: XmtpStatus
  error: string | null
  identityAddress: string | null
  inboxId: string | null
  /** InboxId extracted from a 10/10 installations error (if present). */
  installationLimitInboxId: string | null
  /** True when the local XMTP OPFS installation is no longer accepted by the network. */
  localStateResetRequired: boolean
  connect: (intent?: ConnectIntent) => Promise<void>
  /** Emergency recovery: revoke installations to free a slot, then reconnect. */
  resetInstallations: () => Promise<void>
  /** Clears only this browser's local XMTP database and reconnects with a fresh installation. */
  resetLocalState: () => Promise<void>
  disconnect: () => void
  conversations: ChatConversation[]
  loadMessages: (conversationId: string) => Promise<ChatMessage[]>
  sendMessage: (
    conversationId: string,
    text: string,
    options?: SendChatMessageOptions,
  ) => Promise<ChatMessage>
  sendIntent: (
    conversationId: string,
    params: { promptId: string; actionId: string },
  ) => Promise<void>
  startDm: (peerAddress: `0x${string}`, options?: StartDmOptions) => Promise<StartDmResult>
  startDmByInbox: (peerInboxId: string, options?: StartDmOptions) => Promise<string | null>
  subscribeToMessages: (conversationId: string, cb: (msg: ChatMessage) => void) => () => void
  /** Resolve an XMTP inboxId to an Ethereum address (cached). */
  resolveInboxAddress: (inboxId: string) => Promise<string | null>
}

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

type AuthMeData = {
  address?: string | null
} | null

const COINBASE_SMART_WALLET_OWNER_CHECK_ABI = [
  {
    type: 'function',
    name: 'isOwnerAddress',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

const CSW_OWNER_AT_INDEX_ABI = [
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes' }],
  },
] as const

/**
 * Find the owner index of `signerAddress` in a Coinbase Smart Wallet.
 * CSW stores EOA owners as `abi.encode(address)` (32 bytes, left-padded).
 * Returns null if the signer is not found in indices 0-20.
 */
async function findCswOwnerIndex(
  pub: { readContract: (...args: any[]) => Promise<any> },
  cswAddress: string,
  signerAddress: string,
): Promise<number | null> {
  const target = encodeAbiParameters(
    [{ type: 'address' }],
    [signerAddress as `0x${string}`],
  ).toLowerCase()
  const hints = [10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
  for (const i of hints) {
    try {
      const raw = (await pub.readContract({
        address: cswAddress as `0x${string}`,
        abi: CSW_OWNER_AT_INDEX_ABI,
        functionName: 'ownerAtIndex',
        args: [BigInt(i)],
      })) as string
      if (raw.toLowerCase() === target) return i
    } catch {
      // ownerAtIndex reverts when index is out of bounds
    }
  }
  return null
}

/**
 * ABI-encode a CSW `SignatureWrapper` as a **tuple struct**.
 *
 * The CSW's `_isValidSignature` does `abi.decode(signature, (SignatureWrapper))`
 * which expects tuple encoding (with the leading 32-byte offset pointer),
 * NOT flat `(uint256, bytes)` encoding.
 */
function wrapCswSignature(ownerIndex: number, rawSig: Uint8Array): Uint8Array {
  const sigHex = `0x${Array.from(rawSig, (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`
  const wrapped = encodeAbiParameters(
    [{
      type: 'tuple',
      components: [
        { name: 'ownerIndex', type: 'uint256' },
        { name: 'signatureData', type: 'bytes' },
      ],
    }],
    [{ ownerIndex: BigInt(ownerIndex), signatureData: sigHex }],
  )
  return hexToBytes(wrapped)
}

/**
 * EIP-712 domain and type constants for Coinbase Smart Wallet.
 * Used to produce the same `replaySafeHash` that the CSW computes
 * inside `isValidSignature` before verifying `ecrecover`.
 *
 * The CSW's flow:  isValidSignature(hash, sig)
 *   → rsh = replaySafeHash(hash)
 *   → (ownerIndex, sigData) = abi.decode(sig, (SignatureWrapper))
 *   → recovered = ecrecover(rsh, sigData)
 *   → ownerAtIndex(ownerIndex) == recovered
 *
 * `signTypedData` with these params produces an ECDSA signature
 * of exactly `rsh`, making `ecrecover(rsh, sigData)` return the
 * correct signer address.
 */
const CSW_EIP712_TYPES = {
  CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
} as const

const noop = () => {}
const XmtpContext = createContext<XmtpContextValue>({
  status: 'idle',
  error: null,
  identityAddress: null,
  inboxId: null,
  installationLimitInboxId: null,
  localStateResetRequired: false,
  connect: async () => {},
  resetInstallations: async () => {},
  resetLocalState: async () => {},
  disconnect: noop,
  conversations: [],
  loadMessages: async () => [],
  sendMessage: async () => ({
    id: `local-${Date.now()}`,
    conversationId: '',
    senderInboxId: '',
    content: '',
    contentType: 'text',
    status: 'failed',
    error: 'not_connected',
    sentAt: new Date(),
    isSelf: true,
  }),
  sendIntent: async () => {},
  startDm: async () => ({
    ok: false,
    reason: 'not_connected',
    message: 'Messaging client not connected.',
  }),
  startDmByInbox: async () => null,
  subscribeToMessages: () => noop,
  resolveInboxAddress: async () => null,
})

export function useXmtp() {
  return useContext(XmtpContext)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RAW_XMTP_ENV = String(import.meta.env.VITE_XMTP_ENV ?? '').trim().toLowerCase()
const XMTP_ENV: 'production' | 'dev' | 'local' =
  RAW_XMTP_ENV === 'dev' || RAW_XMTP_ENV === 'local' || RAW_XMTP_ENV === 'production'
    ? (RAW_XMTP_ENV as 'production' | 'dev' | 'local')
    : 'production'
const XMTP_APP_VERSION = '4626.fun-web'
const XMTP_CONNECT_FAILURE_COOLDOWN_MS = 5_000
const XMTP_TAB_LOCK_STALE_MS = 20_000
const XMTP_TAB_LOCK_HEARTBEAT_MS = 5_000
const ENC_KEY_HEX_RE = /^0x[0-9a-fA-F]{64}$/
const inMemoryEncKeys = new Map<string, string>()

function encKeyStorageKey(address: string): string {
  return `cv:xmtp:encKey:${XMTP_ENV}:${address.toLowerCase()}`
}

function autoConnectStorageKey(address: string): string {
  return `cv:xmtp:autoConnect:${XMTP_ENV}:${address.toLowerCase()}`
}

function signerTypeStorageKey(address: string): string {
  return `cv:xmtp:signerType:${XMTP_ENV}:${address.toLowerCase()}`
}

function tabLockStorageKey(): string {
  return `cv:xmtp:tabLock:${XMTP_ENV}`
}

type XmtpTabLockRecord = {
  owner: string
  ts: number
  address: string
}

function readTabLockRecord(): XmtpTabLockRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(tabLockStorageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<XmtpTabLockRecord> | null
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.owner !== 'string' || typeof parsed.ts !== 'number' || typeof parsed.address !== 'string') {
      return null
    }
    return {
      owner: parsed.owner,
      ts: parsed.ts,
      address: parsed.address,
    }
  } catch {
    return null
  }
}

function isTabLockStale(lock: XmtpTabLockRecord | null): boolean {
  if (!lock) return true
  return Date.now() - lock.ts > XMTP_TAB_LOCK_STALE_MS
}

function installationProvisionedStorageKey(address: string): string {
  return `cv:xmtp:installationProvisioned:${XMTP_ENV}:${address.toLowerCase()}`
}

function readInstallationProvisioned(address: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(installationProvisionedStorageKey(address)) === '1'
  } catch {
    return false
  }
}

function writeInstallationProvisioned(address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(installationProvisionedStorageKey(address), '1')
  } catch {
    // ignore storage errors
  }
}

function clearInstallationProvisioned(address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(installationProvisionedStorageKey(address))
  } catch {
    // ignore storage errors
  }
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

function clearStoredSignerType(address: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(signerTypeStorageKey(address))
  } catch {
    // ignore storage errors
  }
}

export function readStoredEncKeyHex(address: string): string | null {
  const raw = inMemoryEncKeys.get(encKeyStorageKey(address)) ?? null
  if (!raw || !ENC_KEY_HEX_RE.test(raw)) return null
  return raw
}

export function writeStoredEncKeyHex(address: string, encKeyHex: string): void {
  if (!ENC_KEY_HEX_RE.test(encKeyHex)) return
  inMemoryEncKeys.set(encKeyStorageKey(address), encKeyHex)
}

function clearStoredEncKeyHex(address: string): void {
  inMemoryEncKeys.delete(encKeyStorageKey(address))
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
 * Kept in memory only for the current page session.
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


function upsertConversationSummary(
  prev: ChatConversation[],
  incoming: ChatConversation,
): ChatConversation[] {
  const incomingPeer =
    incoming.type === 'dm' && incoming.peerAddress
      ? incoming.peerAddress.toLowerCase()
      : null

  const existing = prev.find((item) => item.id === incoming.id) ?? null
  const merged: ChatConversation = existing
    ? {
        ...existing,
        ...incoming,
        name: incoming.name?.trim() || existing.name,
        imageUrl: incoming.imageUrl ?? existing.imageUrl,
        unreadCount: existing.unreadCount,
      }
    : incoming

  const filtered = prev.filter((item) => {
    if (item.id === incoming.id) return false
    if (!incomingPeer) return true
    if (item.type !== 'dm' || !item.peerAddress) return true
    return item.peerAddress.toLowerCase() !== incomingPeer
  })

  return [merged, ...filtered]
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

export async function canMessageAddressOnCurrentEnv(address: `0x${string}`): Promise<boolean | null> {
  const identifiers = [{ identifier: address, identifierKind: IdentifierKind.Ethereum }]
  try {
    const result = await (Client as any).canMessage(identifiers, XMTP_ENV as any)
    return extractCanMessageResult(result, address)
  } catch {
    try {
      const fallbackResult = await (Client as any).canMessage(identifiers)
      return extractCanMessageResult(fallbackResult, address)
    } catch {
      return null
    }
  }
}

function isXmtpVerboseLoggingEnabled(): boolean {
  if (xmtpDebugFlag()) return true
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('cv:debug:xmtp') === 'true'
  } catch {
    return false
  }
}

const XMTP_VERBOSE_LOGS = isXmtpVerboseLoggingEnabled()
const XMTP_DEFAULT_LOG_LEVEL = ((LogLevel as any).Error ?? LogLevel.Warn) as LogLevel

function xmtpDebug(...args: unknown[]): void {
  if (!XMTP_VERBOSE_LOGS) return
  console.log(...args)
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
      xmtpDebug('[xmtp] Storage is already persistent')
      return
    }
    const granted = await navigator.storage.persist()
    xmtpDebug(`[xmtp] Persistent storage ${granted ? 'granted' : 'denied'}`)
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
      xmtpDebug(
        `[xmtp] OPFS files: ${files.length} total, DB present: ${found}`,
        files.filter((f) => f.endsWith('.db3')),
      )
      return found
    } finally {
      opfs.close()
    }
  } catch (err) {
    // OPFS not supported or transiently unavailable. Treat as "no readable DB"
    // so we can still fall back to Client.create instead of hard-failing init.
    console.warn('[xmtp] OPFS check failed (treating as no local DB):', err)
    return false
  }
}

async function deleteXmtpOpfsDatabaseFiles(): Promise<number> {
  const opfs = await Opfs.create()
  try {
    const files = await opfs.listFiles()
    const prefix = `xmtp-${XMTP_ENV}-`
    const candidates = files.filter((file) => file.startsWith(prefix))
    let deleted = 0
    for (const file of candidates) {
      const ok = await opfs.deleteFile(file)
      if (ok) deleted += 1
      xmtpDebug(`[xmtp] Deleted local OPFS file: ${file} (${ok})`)
    }
    return deleted
  } finally {
    opfs.close()
  }
}

async function deleteXmtpOpfsDatabaseFilesWithRetry(): Promise<number> {
  const retryDelaysMs = [0, 200, 500, 1000]
  let lastError: unknown = null
  for (let attempt = 0; attempt < retryDelaysMs.length; attempt += 1) {
    const delayMs = retryDelaysMs[attempt] ?? 0
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    try {
      return await deleteXmtpOpfsDatabaseFiles()
    } catch (err) {
      lastError = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!isOpfsAccessHandleError(msg)) throw err
      if (attempt === retryDelaysMs.length - 1) throw err
      xmtpDebug(`[xmtp] OPFS cleanup attempt ${attempt + 1} failed due active lock; retrying...`)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? 'Failed to clear local OPFS files'))
}

function isLocalXmtpStateInvalidError(message: string): boolean {
  return (
    /InboxValidationFailed/i.test(message) ||
    /synced \d+ messages?, \d+ failed \d+ succeeded/i.test(message)
  )
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
      icon: '/assets/android-chrome-192x192.png',
      tag: 'xmtp-message', // collapse multiple
    })
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function XmtpChatProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, connector } = useAccount()
  const accountContext = useAccountContext()
  const xmtpModeOverride: 'EOA' | 'SMART_WALLET' | null =
    accountContext.activeAccountType === 'SMART_WALLET'
      ? 'SMART_WALLET'
      : accountContext.activeAccountType === 'EOA'
      ? 'EOA'
      : accountContext.preferredMode ?? null
  const { data: walletClient } = useWalletClient()
  const publicClient = usePublicClient()

  const [status, setStatus] = useState<XmtpStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [identityAddress, setIdentityAddress] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [inboxId, setInboxId] = useState<string | null>(null)
  const [installationLimitInboxId, setInstallationLimitInboxId] = useState<string | null>(null)
  const [localStateResetRequired, setLocalStateResetRequired] = useState(false)

  const clientRef = useRef<Client | null>(null)
  const convoStreamRef = useRef<AsyncStreamProxy<any> | null>(null)
  const msgStreamRef = useRef<AsyncStreamProxy<any> | null>(null)
  const perConvoStreamsRef = useRef<Map<string, AsyncStreamProxy<any>>>(new Map())
  const perConvoCbRef = useRef<Map<string, Set<(msg: ChatMessage) => void>>>(new Map())
  const inboxAddressCache = useRef<Map<string, string | null>>(new Map())
  const conversationsRef = useRef<ChatConversation[]>([])
  const mountedRef = useRef(true)
  const connectInFlightRef = useRef(false)
  const resetLocalStateInFlightRef = useRef(false)
  const connectCooldownUntilRef = useRef(0)
  const tabLockOwnerRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  const tabLockAddressRef = useRef<string | null>(null)
  const tabLockHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const resolvedIdentityByWalletRef = useRef<
    Map<string, { identityAddress: string; isCanonicalSmartWallet: boolean }>
  >(new Map())
  const cswOwnerIndexCache = useRef<Map<string, number | null>>(new Map())
  const identityAddressRef = useRef<string | null>(null)

  const stopTabLockHeartbeat = useCallback((): void => {
    if (tabLockHeartbeatRef.current) {
      clearInterval(tabLockHeartbeatRef.current)
      tabLockHeartbeatRef.current = null
    }
  }, [])

  const writeTabLock = useCallback((address: string): void => {
    if (typeof window === 'undefined') return
    const payload: XmtpTabLockRecord = {
      owner: tabLockOwnerRef.current,
      ts: Date.now(),
      address,
    }
    try {
      window.localStorage.setItem(tabLockStorageKey(), JSON.stringify(payload))
      tabLockAddressRef.current = address
    } catch {
      // ignore storage errors
    }
  }, [])

  const releaseTabLock = useCallback((): void => {
    if (typeof window === 'undefined') return
    const existing = readTabLockRecord()
    if (!existing) return
    if (existing.owner !== tabLockOwnerRef.current) return
    try {
      window.localStorage.removeItem(tabLockStorageKey())
    } catch {
      // ignore storage errors
    }
    tabLockAddressRef.current = null
  }, [])

  const acquireTabLock = useCallback((address: string): { ok: true } | { ok: false; holder: XmtpTabLockRecord | null } => {
    if (typeof window === 'undefined') return { ok: true }
    const existing = readTabLockRecord()
    const selfOwner = tabLockOwnerRef.current
    const canTake =
      !existing ||
      isTabLockStale(existing) ||
      existing.owner === selfOwner
    if (!canTake) {
      return { ok: false, holder: existing }
    }
    writeTabLock(address)
    const confirmed = readTabLockRecord()
    if (confirmed && confirmed.owner === selfOwner) {
      return { ok: true }
    }
    return { ok: false, holder: confirmed }
  }, [writeTabLock])

  const startTabLockHeartbeat = useCallback((address: string): void => {
    stopTabLockHeartbeat()
    writeTabLock(address)
    tabLockHeartbeatRef.current = setInterval(() => {
      const existing = readTabLockRecord()
      if (!existing || existing.owner !== tabLockOwnerRef.current) {
        stopTabLockHeartbeat()
        return
      }
      writeTabLock(address)
    }, XMTP_TAB_LOCK_HEARTBEAT_MS)
  }, [stopTabLockHeartbeat, writeTabLock])

  // ------- cleanup -------
  const cleanup = useCallback(async () => {
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
    identityAddressRef.current = null
    stopTabLockHeartbeat()
    releaseTabLock()
  }, [releaseTabLock, stopTabLockHeartbeat])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      void cleanup()
    }
  }, [cleanup])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onUnload = () => {
      stopTabLockHeartbeat()
      releaseTabLock()
    }
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('pagehide', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('pagehide', onUnload)
    }
  }, [releaseTabLock, stopTabLockHeartbeat])

  // Reset when wallet changes
  useEffect(() => {
    if (!isConnected) {
      void cleanup()
      setStatus('idle')
      setError(null)
      setIdentityAddress(null)
      setConversations([])
      conversationsRef.current = []
      identityAddressRef.current = null
      setInboxId(null)
      setInstallationLimitInboxId(null)
      setLocalStateResetRequired(false)
    }
  }, [isConnected, address, cleanup])

  const markLocalStateInvalid = useCallback((errorMessage: string): void => {
    try { convoStreamRef.current?.end() } catch {}
    try { msgStreamRef.current?.end() } catch {}
    for (const s of perConvoStreamsRef.current.values()) {
      try { s.end() } catch {}
    }
    perConvoStreamsRef.current.clear()
    perConvoCbRef.current.clear()
    try { clientRef.current?.close() } catch {}
    clientRef.current = null
    setStatus('error')
    setError(
      'XMTP local messaging state is out of sync with the network. Reset local messaging state, then reconnect.',
    )
    setInstallationLimitInboxId(null)
    setLocalStateResetRequired(true)
    setConversations([])
    conversationsRef.current = []
    identityAddressRef.current = null
    stopTabLockHeartbeat()
    releaseTabLock()
    console.warn('[xmtp] local state reset required:', errorMessage)
  }, [releaseTabLock, stopTabLockHeartbeat])

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
        if (typeof last.content === 'string') {
          lastMessageText = parseWireContent(last.content).content
        }
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
  const resolveXmtpIdentityAddress = useCallback(async (
    connectedAddress: string,
    modeOverride?: 'EOA' | 'SMART_WALLET' | null,
  ): Promise<{
    identityAddress: string
    isCanonicalSmartWallet: boolean
  }> => {
    const connected = normalizeEvmAddress(connectedAddress)
    if (!connected) return { identityAddress: connectedAddress.toLowerCase(), isCanonicalSmartWallet: false }

    const cacheKey = `${connected}:${modeOverride ?? 'auto'}`
    const cached = resolvedIdentityByWalletRef.current.get(cacheKey)
    if (cached) return cached

    const enforceCanonicalForConnectedSigner = shouldApplyCanonicalEnforcement({
      signerAddress: connected,
    })
    if (modeOverride === 'EOA' && !enforceCanonicalForConnectedSigner) {
      const resolved = { identityAddress: connected, isCanonicalSmartWallet: false }
      resolvedIdentityByWalletRef.current.set(cacheKey, resolved)
      return resolved
    }
    if (modeOverride === 'EOA' && enforceCanonicalForConnectedSigner) {
      console.warn('[xmtp] canonical policy ignored EOA identity override for enforced signer', {
        connected,
      })
    }

    const accountContextSmartAddress =
      normalizeEvmAddress(
        accountContext.activeAccountType === 'SMART_WALLET'
          ? accountContext.activeAccount ?? accountContext.cswAddress ?? null
          : accountContext.cswAddress ?? null,
      ) ?? null

    let waitlistCanonicalAddress: string | null = null
    let preferredSelection = resolveModePreferredIdentity({
      connectedAddress: connected,
      modeOverride,
      accountContextSmartAddress,
      waitlistCanonicalAddress: null,
    })

    let preferred = preferredSelection.preferredAddress
    let isCanonicalSmartWallet = preferredSelection.isSmartWalletIdentity
    let policyApplies = enforceCanonicalForConnectedSigner
    let waitlistResolved = false
    try {
      const res = await apiFetch('/api/waitlist/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const json = (await res.json().catch(() => null)) as ApiEnvelope<WaitlistMeData | null> | null
      const row = res.ok && json?.success ? (json.data ?? null) : null
      waitlistResolved = Boolean(res.ok && json?.success)
      const canonical = pickCanonicalSmartWalletAddress(row)
      waitlistCanonicalAddress = canonical

      preferredSelection = resolveModePreferredIdentity({
        connectedAddress: connected,
        modeOverride,
        accountContextSmartAddress,
        waitlistCanonicalAddress: canonical,
      })
      preferred = preferredSelection.preferredAddress
      isCanonicalSmartWallet = preferredSelection.isSmartWalletIdentity

      policyApplies = shouldApplyCanonicalEnforcement({
        canonicalAddress: canonical,
        signerAddress: connected,
      })
    } catch {
      waitlistResolved = false
    }

    const requiresAuthBackedIdentity = shouldRequireAuthBackedXmtpIdentity({
      connectedAddress: connected,
      modeOverride,
      accountContextSmartAddress,
      waitlistCanonicalAddress,
      enforceCanonicalForConnectedSigner: policyApplies,
    })

    if (!waitlistResolved && requiresAuthBackedIdentity) {
      let authAddress: string | null = null
      try {
        const authRes = await apiFetch('/api/auth/me', {
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
        const authJson = (await authRes.json().catch(() => null)) as ApiEnvelope<AuthMeData> | null
        authAddress =
          authRes.ok && authJson?.success
            ? normalizeEvmAddress(authJson.data?.address ?? null)
            : null
      } catch {
        authAddress = null
      }

      if (!authAddress) {
        throw new Error(
          'XMTP smart-wallet messaging requires an active 4626 session. Reconnect wallet, sign in again, and retry.',
        )
      }

      const expectedAuthAddress = normalizeEvmAddress(policyApplies ? TARGET_CANONICAL_CSW_ADDRESS : preferred)
      if (expectedAuthAddress && authAddress !== expectedAuthAddress) {
        throw new Error(
          'XMTP session identity does not match the smart wallet selected for messaging. Reconnect wallet, sign in again, and retry.',
        )
      }
    }

    if (policyApplies) {
      if (preferred !== TARGET_CANONICAL_CSW_ADDRESS) {
        console.warn('[xmtp] canonical policy overriding identity resolution to target CSW', {
          connected,
          resolvedBeforeOverride: preferred,
        })
      }
      preferred = TARGET_CANONICAL_CSW_ADDRESS
      isCanonicalSmartWallet = true
    }

    const preserveSmartModeIdentity = modeOverride === 'SMART_WALLET' && isCanonicalSmartWallet

    if (preferred !== connected && publicClient) {
      try {
        const isOwner = (await publicClient.readContract({
          address: preferred as `0x${string}`,
          abi: COINBASE_SMART_WALLET_OWNER_CHECK_ABI,
          functionName: 'isOwnerAddress',
          args: [connected as `0x${string}`],
        })) as boolean
        if (!isOwner) {
          if (policyApplies) {
            throw new Error('Connected signer is not an owner of the canonical CSW identity')
          }
          if (!preserveSmartModeIdentity) {
            preferred = connected
            isCanonicalSmartWallet = false
          } else {
            console.warn(
              '[xmtp] owner check reported non-owner in SMART_WALLET mode; preserving smart identity to avoid EOA fallback churn',
              { connected, preferred, waitlistCanonicalAddress, accountContextSmartAddress },
            )
          }
        }
      } catch {
        if (policyApplies) {
          throw new Error('Unable to verify canonical CSW owner relationship for XMTP identity')
        }
        if (!preserveSmartModeIdentity) {
          preferred = connected
          isCanonicalSmartWallet = false
        } else {
          console.warn(
            '[xmtp] owner check unavailable in SMART_WALLET mode; preserving smart identity to avoid EOA fallback churn',
            { connected, preferred, waitlistCanonicalAddress, accountContextSmartAddress },
          )
        }
      }
    }

    if (isCanonicalSmartWallet && !isTargetCanonicalCsw(preferred) && policyApplies) {
      console.warn('[xmtp] canonical policy detected non-target smart wallet identity', {
        preferred,
      })
    }

    const resolved = { identityAddress: preferred, isCanonicalSmartWallet }
    resolvedIdentityByWalletRef.current.set(cacheKey, resolved)
    return resolved
  }, [accountContext.activeAccount, accountContext.activeAccountType, accountContext.cswAddress, publicClient])

  const connect = useCallback(async (intent: ConnectIntent = 'auto') => {
    if (!address || !walletClient) return
    if (clientRef.current) return // already connected
    if (connectInFlightRef.current) return
    const now = Date.now()
    if (connectCooldownUntilRef.current > now) {
      const retryIn = Math.max(1, Math.ceil((connectCooldownUntilRef.current - now) / 1000))
      if (mountedRef.current) {
        setStatus('error')
        setError(`XMTP reconnect is cooling down. Retry in ${retryIn}s.`)
      }
      return
    }

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
    let tabLockAcquired = false
    let xmtpIdentityAddress = String(address).toLowerCase()
    try {
      setError(null)
      setInstallationLimitInboxId(null)
      setLocalStateResetRequired(false)
      const resolved = await resolveXmtpIdentityAddress(address, xmtpModeOverride)
      xmtpIdentityAddress = resolved.identityAddress
      const normalizedIdentity = normalizeEvmAddress(xmtpIdentityAddress) ?? xmtpIdentityAddress.toLowerCase()
      const lockResult = acquireTabLock(normalizedIdentity)
      if (!lockResult.ok) {
        setStatus('error')
        setError(
          'Messaging is active in another tab/window for this browser profile. ' +
            'Close the other chat tab or wait for its lock to expire, then retry.',
        )
        return
      }
      tabLockAcquired = true
      identityAddressRef.current = normalizedIdentity
      if (mountedRef.current) setIdentityAddress(normalizedIdentity)
      xmtpDebug('[xmtp] Using identity for connect:', xmtpIdentityAddress)

      const identifier = {
        identifier: xmtpIdentityAddress as `0x${string}`,
        identifierKind: IdentifierKind.Ethereum,
      }
      const installationAlreadyProvisioned = readInstallationProvisioned(xmtpIdentityAddress)
      const baseOptions = {
        env: XMTP_ENV as any,
        appVersion: XMTP_APP_VERSION,
        loggingLevel: XMTP_VERBOSE_LOGS ? LogLevel.Info : XMTP_DEFAULT_LOG_LEVEL,
        structuredLogging: XMTP_VERBOSE_LOGS,
        performanceLogging: false,
      }

      type SignerSelection = {
        signer: Signer
        scwSigner: Signer
        eoaSigner: Signer
      }

      let signerSelectionPromise: Promise<SignerSelection> | null = null
      const getSignerSelection = async (): Promise<SignerSelection> => {
        if (signerSelectionPromise) return signerSelectionPromise
        signerSelectionPromise = (async () => {
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
            modeOverride: xmtpModeOverride ?? undefined,
          })

          const signMessageFn = async (message: string) => {
            const s = await walletClient.signMessage({ message })
            return hexToBytes(s)
          }

          // For SCW signers backed by Coinbase Smart Wallet:
          // 1. Detect if walletClient.signMessage returns a raw 65-byte EOA signature
          // 2. If so, compute hashMessage(message) and sign the CSW's replaySafeHash
          //    via signTypedData (EIP-712) to produce a signature ecrecover can verify
          // 3. Wrap in the tuple-struct SignatureWrapper the CSW expects
          const scwSignMessageFn = async (message: string) => {
            const s = await walletClient.signMessage({ message })
            const sigBytes = hexToBytes(s)
            if (sigBytes.length !== 65 || !publicClient) return sigBytes
            let signerAddr: string
            try {
              signerAddr = await recoverMessageAddress({ message, signature: s as `0x${string}` })
            } catch { return sigBytes }
            if (signerAddr.toLowerCase() === xmtpIdentityAddress.toLowerCase()) return sigBytes
            const ck = `${xmtpIdentityAddress}:${signerAddr.toLowerCase()}`
            let idx = cswOwnerIndexCache.current.get(ck)
            if (idx === undefined) {
              idx = await findCswOwnerIndex(publicClient, xmtpIdentityAddress, signerAddr)
              cswOwnerIndexCache.current.set(ck, idx)
            }
            if (idx === null) {
              console.warn('[xmtp] Could not resolve CSW owner index for', signerAddr)
              return sigBytes
            }
            const msgHash = hashMessage(message)
            try {
              const typedSig = await walletClient.signTypedData({
                domain: {
                  name: 'Coinbase Smart Wallet',
                  version: '1',
                  chainId: Number(signerDecision.scwChainId),
                  verifyingContract: xmtpIdentityAddress as `0x${string}`,
                },
                types: CSW_EIP712_TYPES,
                primaryType: 'CoinbaseSmartWalletMessage' as const,
                message: { hash: msgHash },
              })
              xmtpDebug('[xmtp] CSW EIP-712 replaySafeHash signed; wrapping with ownerIndex', idx)
              return wrapCswSignature(idx, hexToBytes(typedSig))
            } catch (e) {
              console.warn('[xmtp] signTypedData failed; falling back to personal_sign wrapping', e)
              return wrapCswSignature(idx, sigBytes)
            }
          }

          const scwSigner: Signer = {
            type: 'SCW',
            getIdentifier: () => ({
              identifier: xmtpIdentityAddress as `0x${string}`,
              identifierKind: IdentifierKind.Ethereum,
            }),
            signMessage: scwSignMessageFn,
            getChainId: () => BigInt(signerDecision.scwChainId),
          }
          const eoaSigner: Signer = {
            type: 'EOA',
            getIdentifier: () => ({
              identifier: xmtpIdentityAddress as `0x${string}`,
              identifierKind: IdentifierKind.Ethereum,
            }),
            signMessage: signMessageFn,
          }
          const signer: Signer = signerDecision.signerType === 'SCW' ? scwSigner : eoaSigner

          return { signer, scwSigner, eoaSigner }
        })()
        return signerSelectionPromise
      }

      const registerRestoredInstallation = async (client: Client, activeSigner: Signer): Promise<void> => {
        const alreadyRegistered = await client.isRegistered()
        if (alreadyRegistered) return

        const { signatureText, signatureRequestId } = await client.unsafe_createInboxSignatureText()
        if (!signatureText || !signatureRequestId) return

        const signature = await activeSigner.signMessage(signatureText)
        const safeSigner = await toSafeSigner(activeSigner, signature)
        await client.unsafe_applySignatureRequest(safeSigner, signatureRequestId)
      }

      // Shared setup: sync conversations, start streams, mark connected.
      const setupConversations = async (client: Client) => {
        await client.conversations.sync()
        const convos = await client.conversations.list()
        const summaries = await Promise.all(convos.map(buildConvoSummary))
        summaries.sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))
        let normalizedSummaries: ChatConversation[] = []
        for (let i = summaries.length - 1; i >= 0; i -= 1) {
          normalizedSummaries = upsertConversationSummary(normalizedSummaries, summaries[i]!)
        }
        conversationsRef.current = normalizedSummaries
        if (mountedRef.current) setConversations(normalizedSummaries)
        const convoStream = await client.conversations.stream({
          onValue: async (convo: any) => {
            if (!mountedRef.current) return
            const summary = await buildConvoSummary(convo)
            setConversations((prev) => {
              const next = upsertConversationSummary(prev, summary)
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
              const updated: ChatConversation = { ...prev[idx]! }
              updated.lastMessageText = chatMsg.content
              updated.lastMessageAt = msg.sentAt
              if (!chatMsg.isSelf) updated.unreadCount = (updated.unreadCount ?? 0) + 1
              const next = [...prev]
              next.splice(idx, 1)
              const reordered: ChatConversation[] = [updated, ...next]
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
          setError(null)
          setInstallationLimitInboxId(null)
          setLocalStateResetRequired(false)
        }
        startTabLockHeartbeat(xmtpIdentityAddress)
        writeInstallationProvisioned(xmtpIdentityAddress)

        // Auto-create a DM conversation with the Keepr agent so it appears
        // in the user's chat list.  We do NOT send any message on behalf of
        // the user — the agent will greet them when they send their first message.
        const agentAddr = (import.meta.env.VITE_AGENT_XMTP_ADDRESS ?? '').trim()
        if (agentAddr && /^0x[a-fA-F0-9]{40}$/.test(agentAddr)) {
          void (async () => {
            try {
              const alreadyExists = normalizedSummaries.some(
                (c) => c.peerAddress?.toLowerCase() === agentAddr.toLowerCase(),
              )
              if (alreadyExists) return // DM already exists
              const dm = await client.conversations.createDmWithIdentifier({
                identifier: agentAddr as `0x${string}`,
                identifierKind: IdentifierKind.Ethereum,
              })
              xmtpDebug('[xmtp] Created DM with agent (no message sent)', agentAddr)
              // Add to conversation list so it appears immediately
              const summary = await buildConvoSummary(dm as any)
              if (mountedRef.current) {
                setConversations((prev) => {
                  const next = upsertConversationSummary(prev, summary)
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
        let restoreFailureMessage: string | null = null
        let restoreFailureKind: 'installation_limit' | 'opfs_lock' | null = null

        // Attempt 1: try with the stored encryption key
        try {
          xmtpDebug('[xmtp] OPFS database found — attempting Client.build restore…')
          buildClient = await Client.build(identifier, {
            ...baseOptions,
            dbEncryptionKey: encKeyBytes,
          })
          if (buildClient?.inboxId) {
            buildSucceeded = true
            xmtpDebug(
              '[xmtp] Client.build succeeded — reusing installation',
              buildClient.installationId,
            )
          } else {
            xmtpDebug('[xmtp] Client.build returned no inboxId')
            try { buildClient?.close() } catch {}
            buildClient = null
          }
        } catch (buildErr) {
          const buildMsg = buildErr instanceof Error ? buildErr.message : String(buildErr)
          console.warn('[xmtp] Client.build failed with stored key:', buildMsg)
          restoreFailureMessage = buildMsg
          if (isInstallationLimitError(buildMsg)) restoreFailureKind = 'installation_limit'
          else if (isOpfsAccessHandleError(buildMsg)) restoreFailureKind = 'opfs_lock'
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
            xmtpDebug('[xmtp] Retrying Client.build without dbEncryptionKey…')
            buildClient = await Client.build(identifier, { ...baseOptions })
            if (buildClient?.inboxId) {
              buildSucceeded = true
              restoreFailureMessage = null
              restoreFailureKind = null
              xmtpDebug(
                '[xmtp] Client.build succeeded (no key) — reusing installation',
                buildClient.installationId,
              )
            } else {
              try { buildClient?.close() } catch {}
              buildClient = null
            }
          } catch (buildErr2) {
            const buildMsg2 = buildErr2 instanceof Error ? buildErr2.message : String(buildErr2)
            console.warn('[xmtp] Client.build without key also failed:', buildErr2)
            restoreFailureMessage = buildMsg2
            if (isInstallationLimitError(buildMsg2)) restoreFailureKind = 'installation_limit'
            else if (isOpfsAccessHandleError(buildMsg2)) restoreFailureKind = 'opfs_lock'
            closeClientSafe(buildClient)
            buildClient = null
            closeClientSafe(clientRef.current)
            clientRef.current = null
            await new Promise((r) => setTimeout(r, 200))
          }
        }

        // If an OPFS DB already exists, never auto-create a new installation.
        // This guarantees we reuse an existing installation or fail explicitly
        // instead of churning through new registrations/revocations.
        if (!buildSucceeded) {
          if (restoreFailureKind === 'installation_limit') {
            const limitInboxId = extractInstallationLimitInboxId(restoreFailureMessage ?? '')
            if (limitInboxId) setInstallationLimitInboxId(limitInboxId)
            setStatus('error')
            setError(
              'XMTP restore found an existing local database but could not reopen it before hitting the 10/10 installation cap. ' +
              'Refusing to auto-create another installation. Close other 4626 chat tabs/windows and retry, or use Reset XMTP installations if needed.',
            )
            return
          }

          if (restoreFailureKind === 'opfs_lock') {
            setStatus('error')
            setError(
              'XMTP local database is currently locked by another tab/window. Close other 4626 chat tabs and retry.',
            )
            return
          }

          setStatus('error')
          setError(
            'XMTP found an existing local database but could not restore the previous installation. ' +
            'Refusing to create a new installation to avoid churn. Retry after closing other tabs/windows.',
          )
          return
        }
      } else {
        xmtpDebug('[xmtp] No OPFS database found — first use, will create new installation')
        if (installationAlreadyProvisioned) {
          setStatus('error')
          setLocalStateResetRequired(true)
          setError(
            'XMTP installation was previously provisioned for this wallet, but no local XMTP database was found. ' +
            'Refusing to auto-create a new installation to avoid revoke/grant churn. ' +
            'If you intentionally want a fresh installation on this browser, use "Reset local messaging state".',
          )
          return
        }
        if (intent !== 'user') {
          setStatus('idle')
          setError(
            'Messaging is not enabled on this browser yet. Use "Connect Messaging" to create your first XMTP installation.',
          )
          return
        }
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

          if (isLocalXmtpStateInvalidError(syncMsg)) {
            markLocalStateInvalid(syncMsg)
            return
          }

          if (isUninitialized) {
            // Critical anti-churn path: register the restored installation in-place.
            // Do NOT fall through to Client.create here — that would burn a new
            // installation each retry and quickly hit 10/10.
            xmtpDebug(
              '[xmtp] Uninitialized identity on restored installation — attempting in-place register (no new installation)…',
            )
            try {
              const signerSelection = await getSignerSelection()
              let registrationSigner = signerSelection.signer
              try {
                await registerRestoredInstallation(buildClient, registrationSigner)
                writeStoredSignerType(xmtpIdentityAddress, registrationSigner.type)
              } catch (registerErr) {
                const registerMsg = registerErr instanceof Error ? registerErr.message : String(registerErr)
                if (registrationSigner.type === 'EOA' && isWrongChainIdError(registerMsg)) {
                  console.warn(
                    '[xmtp] Wrong chain id while registering restored installation with EOA; retrying SCW on Base (8453)…',
                  )
                  registrationSigner = signerSelection.scwSigner
                  await registerRestoredInstallation(buildClient, registrationSigner)
                  writeStoredSignerType(xmtpIdentityAddress, 'SCW')
                } else if (
                  registrationSigner.type === 'SCW' &&
                  isScwSignatureValidationError(registerMsg)
                ) {
                  console.warn(
                    '[xmtp] SCW signature validation failed while registering restored installation; retrying EOA…',
                  )
                  registrationSigner = signerSelection.eoaSigner
                  await registerRestoredInstallation(buildClient, registrationSigner)
                  writeStoredSignerType(xmtpIdentityAddress, 'EOA')
                } else {
                  throw registerErr
                }
              }

              await setupConversations(buildClient)
              return
            } catch (registerErr) {
              const regMsg = registerErr instanceof Error ? registerErr.message : String(registerErr)
              console.error('[xmtp] In-place registration for restored installation failed:', registerErr)
              try { buildClient.close() } catch {}
              clientRef.current = null

              if (regMsg.toLowerCase().includes('uninitialized')) {
                setStatus('error')
                setLocalStateResetRequired(true)
                setError(
                  'XMTP restored local state but identity registration failed. ' +
                  'Refusing to auto-create a replacement installation to avoid revoke/grant churn. ' +
                  'Use "Reset local messaging state" only if you intentionally want a fresh installation.',
                )
                return
              } else {
                setStatus('error')
                setError(
                  'XMTP restored your local installation but identity registration failed. ' +
                  'Refusing to create a new installation to avoid churn. Retry after reconnecting wallet, or use Reset XMTP installations.',
                )
                return
              }
            }
          } else {
            // Transient error (network timeout, server error, etc.).
            // Retry once — do NOT fall through to Client.create.
            xmtpDebug('[xmtp] Retrying setupConversations once…')
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

      const signerSelection = await getSignerSelection()
      const { signer, scwSigner, eoaSigner } = signerSelection
      if (signer.type === 'SCW') writeStoredSignerType(xmtpIdentityAddress, 'SCW')
      else writeStoredSignerType(xmtpIdentityAddress, 'EOA')

      xmtpDebug('[xmtp] No reusable local installation found — falling through to Client.create (will require wallet signature)')

      if (installationAlreadyProvisioned) {
        setStatus('error')
        setLocalStateResetRequired(true)
        setError(
          'XMTP could not restore a previously provisioned local installation. ' +
          'Refusing to auto-create a new installation to avoid revoke/grant churn. ' +
          'Use "Reset local messaging state" if you intentionally want to recreate this browser installation.',
        )
        return
      }
      if (intent !== 'user') {
        setStatus('idle')
        setError(
          'Messaging is not enabled on this browser yet. Use "Connect Messaging" to create your first XMTP installation.',
        )
        return
      }

      // Helper: attempt Client.create without auto-revoking installations.
      // Revoke operations consume finite inbox update budget (max 256 lifetime),
      // so we only allow revocation through explicit user-triggered resetInstallations().
      const tryCreate = async (activeSigner: Signer, dbKey: Uint8Array): Promise<Client> => {
        try {
          return await Client.create(activeSigner, { ...baseOptions, dbEncryptionKey: dbKey })
        } catch (createErr) {
          const errMsg = createErr instanceof Error ? createErr.message : String(createErr)
          if (!isInstallationLimitError(errMsg)) throw createErr
          throw new Error(
            `${errMsg} Automatic XMTP installation revocation is disabled to protect the inbox update budget. Use "Reset XMTP installations" to revoke manually if needed.`,
          )
        }
      }

      // NOTE: the Browser SDK does NOT use dbEncryptionKey for encryption
      // (per XMTP docs), so generating a fresh key on failure would not help
      // and would only risk burning another installation slot.  We try once
      // with the stored key and let tryCreate handle 10/10 auto-revocation.
      let client: Client
      try {
        client = await tryCreate(signer, encKeyBytes)
      } catch (createErr) {
        const errMsg = createErr instanceof Error ? createErr.message : String(createErr)
        // Some inboxes were originally registered as SCW on Base (8453).
        // If we attempt an EOA update, XMTP reports "Wrong chain id ... signing from 0".
        if (signer.type === 'EOA' && isWrongChainIdError(errMsg)) {
          console.warn('[xmtp] Wrong chain id while using EOA signer; retrying with SCW signer on Base (8453)…')
          writeStoredSignerType(xmtpIdentityAddress, 'SCW')
          client = await tryCreate(scwSigner, encKeyBytes)
        } else if (
          signer.type === 'SCW' &&
          isScwSignatureValidationError(errMsg)
        ) {
          // Recover from stale/incorrect SCW classification (for EOAs this
          // can fail with provider-level EIP-1271 validation errors.
          console.warn('[xmtp] SCW signature validation failed; retrying with EOA signer…')
          writeStoredSignerType(xmtpIdentityAddress, 'EOA')
          client = await tryCreate(eoaSigner, encKeyBytes)
        } else {
          throw createErr
        }
      }

      if (!mountedRef.current) {
        client.close()
        return
      }

      clientRef.current = client
      setInboxId(client.inboxId ?? null)
      try {
        await setupConversations(client)
      } catch (setupErr) {
        const setupMsg = setupErr instanceof Error ? setupErr.message : String(setupErr)
        if (isLocalXmtpStateInvalidError(setupMsg)) {
          markLocalStateInvalid(setupMsg)
          return
        }
        throw setupErr
      }

      // NOTE: we intentionally do NOT call revokeAllOtherInstallations() here,
      // and we do not auto-revoke on 10/10 during connect.
      // Each revocation consumes 1 of the inbox's 256 lifetime updates, so
      // revocation is only allowed via manual resetInstallations().
    } catch (e) {
      connectCooldownUntilRef.current = Date.now() + XMTP_CONNECT_FAILURE_COOLDOWN_MS
      console.error('[xmtp] connect error:', e)
      if (mountedRef.current) {
        const msg = e instanceof Error ? e.message : 'Failed to connect to XMTP'
        if (isOpfsAccessHandleError(msg)) {
          setStatus('error')
          setError(
            'XMTP local storage is locked by another active tab/window. ' +
              'Close other 4626 tabs/windows using chat, then retry.',
          )
          return
        }
        if (isLocalXmtpStateInvalidError(msg)) {
          markLocalStateInvalid(msg)
          return
        }
        setIdentityAddress(null)
        identityAddressRef.current = null
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
      if (!clientRef.current && tabLockAcquired) {
        stopTabLockHeartbeat()
        releaseTabLock()
      }
    }
  }, [address, connector, walletClient, publicClient, resolveXmtpIdentityAddress, buildConvoSummary, xmtpModeOverride, markLocalStateInvalid, acquireTabLock, startTabLockHeartbeat, releaseTabLock, stopTabLockHeartbeat])

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

    const resolved = await resolveXmtpIdentityAddress(address, xmtpModeOverride)
    const xmtpIdentityAddress = resolved.identityAddress

    // Use the same signer shape we use for normal Client.create.
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
      modeOverride: xmtpModeOverride ?? undefined,
    })

    const resetScwSignMessageFn = async (message: string) => {
      const s = await walletClient.signMessage({ message })
      const sigBytes = hexToBytes(s)
      if (sigBytes.length !== 65 || !publicClient) return sigBytes
      let signerAddr: string
      try {
        signerAddr = await recoverMessageAddress({ message, signature: s as `0x${string}` })
      } catch { return sigBytes }
      if (signerAddr.toLowerCase() === xmtpIdentityAddress.toLowerCase()) return sigBytes
      const ck = `${xmtpIdentityAddress}:${signerAddr.toLowerCase()}`
      let idx = cswOwnerIndexCache.current.get(ck)
      if (idx === undefined) {
        idx = await findCswOwnerIndex(publicClient, xmtpIdentityAddress, signerAddr)
        cswOwnerIndexCache.current.set(ck, idx)
      }
      if (idx === null) return sigBytes
      const msgHash = hashMessage(message)
      try {
        const typedSig = await walletClient.signTypedData({
          domain: {
            name: 'Coinbase Smart Wallet',
            version: '1',
            chainId: Number(signerDecision.scwChainId),
            verifyingContract: xmtpIdentityAddress as `0x${string}`,
          },
          types: CSW_EIP712_TYPES,
          primaryType: 'CoinbaseSmartWalletMessage' as const,
          message: { hash: msgHash },
        })
        return wrapCswSignature(idx, hexToBytes(typedSig))
      } catch {
        return wrapCswSignature(idx, sigBytes)
      }
    }

    const scwSigner: Signer = {
      type: 'SCW',
      getIdentifier: () => ({
        identifier: xmtpIdentityAddress,
        identifierKind: IdentifierKind.Ethereum,
      }),
      signMessage: resetScwSignMessageFn,
      getChainId: () => BigInt(CANONICAL_SCW_CHAIN_ID),
    }
    const eoaSigner: Signer = {
      type: 'EOA',
      getIdentifier: () => ({
        identifier: xmtpIdentityAddress,
        identifierKind: IdentifierKind.Ethereum,
      }),
      signMessage: signMessageFn,
    }
    const signer: Signer = signerDecision.signerType === 'SCW' ? scwSigner : eoaSigner

    setStatus('connecting')
    try {
      const states = (await (Client as any).fetchInboxStates([targetInboxId], XMTP_ENV as any)) as any[]
      const state = Array.isArray(states) ? states[0] : null
      const recoveryIdentityRaw = String(state?.recoveryIdentity ?? '').trim()
      const recoveryIdentity = recoveryIdentityRaw.toLowerCase()
      if (recoveryIdentity.startsWith('0x') && recoveryIdentity.length === 42) {
        const xmtpIdentityLower = xmtpIdentityAddress.toLowerCase()
        if (recoveryIdentity !== xmtpIdentityLower) {
          throw new Error(
            `Only the recovery identity can revoke installations for this inbox. ` +
              `Recovery is ${recoveryIdentityRaw}; connected identity is ${xmtpIdentityAddress}.`,
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

      try {
        await (Client as any).revokeInstallations(signer, targetInboxId, toRevoke, XMTP_ENV as any)
      } catch (revokeErr) {
        const errMsg = revokeErr instanceof Error ? revokeErr.message : String(revokeErr)
        if (signer.type === 'EOA' && isWrongChainIdError(errMsg)) {
          console.warn('[xmtp] Wrong chain id during reset with EOA signer; retrying with SCW signer on Base (8453)…')
          writeStoredSignerType(xmtpIdentityAddress, 'SCW')
          await (Client as any).revokeInstallations(scwSigner, targetInboxId, toRevoke, XMTP_ENV as any)
        } else if (
          signer.type === 'SCW' &&
          isScwSignatureValidationError(errMsg)
        ) {
          console.warn('[xmtp] SCW signature validation failed during reset; retrying with EOA signer…')
          writeStoredSignerType(xmtpIdentityAddress, 'EOA')
          await (Client as any).revokeInstallations(eoaSigner, targetInboxId, toRevoke, XMTP_ENV as any)
        } else {
          throw revokeErr
        }
      }

      setInstallationLimitInboxId(null)
      setError(null)
      await connect('user')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to reset XMTP installations'
      setStatus('error')
      setError(msg)
      throw err
    }
  }, [address, walletClient, installationLimitInboxId, publicClient, connect, connector, xmtpModeOverride, resolveXmtpIdentityAddress])

  const resetLocalState = useCallback(async () => {
    if (!address || !walletClient) throw new Error('Connect wallet first.')
    if (resetLocalStateInFlightRef.current) {
      throw new Error('Local XMTP reset already in progress. Please wait.')
    }
    resetLocalStateInFlightRef.current = true
    try {
      const targetIdentity = identityAddressRef.current ?? identityAddress ?? address

      setStatus('connecting')
      setError(null)
      setInstallationLimitInboxId(null)
      setLocalStateResetRequired(false)
      connectCooldownUntilRef.current = 0
      connectInFlightRef.current = false

      await cleanup()

      const deleted = await deleteXmtpOpfsDatabaseFilesWithRetry()
      xmtpDebug(`[xmtp] Reset local XMTP state, deleted ${deleted} OPFS file(s)`)
      // Only clear local installation/signer state after OPFS cleanup succeeds.
      // This preserves restoration markers if cleanup is blocked by lock errors.
      clearAutoConnect(targetIdentity)
      clearStoredSignerType(targetIdentity)
      clearStoredEncKeyHex(targetIdentity)
      clearInstallationProvisioned(targetIdentity)

      await connect('user')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear local XMTP state'
      const isOpfsLock = isOpfsAccessHandleError(msg)
      setStatus('error')
      setError(
        isOpfsLock
          ? 'Could not clear local XMTP state because OPFS is locked by another active XMTP client. ' +
            'Close other 4626 tabs/windows (and other XMTP sessions in this browser), then retry reset.'
          : `Could not clear local XMTP state: ${msg}`,
      )
      setLocalStateResetRequired(true)
      throw err
    } finally {
      resetLocalStateInFlightRef.current = false
    }
  }, [address, walletClient, identityAddress, connect, cleanup])

  // ------- disconnect -------
  const disconnect = useCallback(() => {
    void cleanup()
    setStatus('idle')
    setError(null)
    setLocalStateResetRequired(false)
    setIdentityAddress(null)
    setConversations([])
    conversationsRef.current = []
    identityAddressRef.current = null
    setInboxId(null)
  }, [cleanup])

  // ------- decode message helper -------
  function decodedToChat(msg: DecodedMessage, selfInboxId: string): ChatMessage {
    if (isActions(msg)) {
      const payload = msg.content
      const buttons = Array.isArray(payload?.actions)
        ? payload.actions
            .map((entry) => ({
              id: String(entry?.id ?? '').trim(),
              label: String(entry?.label ?? '').trim(),
              style: entry?.style as ChatMessageActionButton['style'] | undefined,
            }))
            .filter((entry) => entry.id && entry.label)
        : []
      return {
        id: msg.id,
        conversationId: msg.conversationId,
        senderInboxId: msg.senderInboxId,
        content: String(payload?.description ?? 'Choose an action'),
        contentType: 'text',
        actions: {
          promptId: String(payload?.id ?? msg.id),
          description: String(payload?.description ?? 'Choose an action'),
          buttons,
        },
        replyToId: null,
        status: 'sent',
        error: null,
        sentAt: msg.sentAt,
        isSelf: msg.senderInboxId === selfInboxId,
      }
    }

    if (isWalletSendCalls(msg)) {
      const payload = msg.content
      const calls = Array.isArray(payload?.calls)
        ? payload.calls.map((call) => ({
            to: String(call?.to ?? ''),
            data: String(call?.data ?? ''),
            metadata: call?.metadata,
          }))
        : []
      const description =
        calls[0]?.metadata?.description ?? 'Confirm this transaction in Base App.'
      return {
        id: msg.id,
        conversationId: msg.conversationId,
        senderInboxId: msg.senderInboxId,
        content: description,
        contentType: 'text',
        walletSendCalls: {
          from: String(payload?.from ?? ''),
          chainId: String(payload?.chainId ?? ''),
          calls,
        },
        replyToId: null,
        status: 'sent',
        error: null,
        sentAt: msg.sentAt,
        isSelf: msg.senderInboxId === selfInboxId,
      }
    }

    if (isTextReply(msg)) {
      const replyPayload = msg.content
      const replyText = typeof replyPayload?.content === 'string' ? replyPayload.content : ''
      const parsed = parseWireContent(replyText)
      return {
        id: msg.id,
        conversationId: msg.conversationId,
        senderInboxId: msg.senderInboxId,
        content: parsed.content,
        contentType: parsed.contentType,
        richPreview: parsed.richPreview,
        replyToId: String(replyPayload?.referenceId ?? '').trim() || parsed.replyToId,
        status: 'sent',
        error: null,
        sentAt: msg.sentAt,
        isSelf: msg.senderInboxId === selfInboxId,
      }
    }

    if (isReaction(msg)) {
      const reaction = msg.content
      return {
        id: msg.id,
        conversationId: msg.conversationId,
        senderInboxId: msg.senderInboxId,
        content: String(reaction?.content ?? '👍'),
        contentType: 'text',
        replyToId: String(reaction?.reference ?? '').trim() || null,
        reactionEmoji: String(reaction?.content ?? '👍'),
        status: 'sent',
        error: null,
        sentAt: msg.sentAt,
        isSelf: msg.senderInboxId === selfInboxId,
      }
    }

    const parsed = parseWireContent(
      typeof msg.content === 'string' ? msg.content : (msg.fallback ?? '[unsupported]'),
    )
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      senderInboxId: msg.senderInboxId,
      content: parsed.content,
      contentType: parsed.contentType,
      richPreview: parsed.richPreview,
      replyToId: parsed.replyToId,
      actions: parsed.actions ?? null,
      walletSendCalls: parsed.walletSendCalls ?? null,
      reactionEmoji: parsed.reactionEmoji ?? null,
      status: 'sent',
      error: null,
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
      return msgs.map((m) => decodedToChat(m, client.inboxId!))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (isLocalXmtpStateInvalidError(msg)) {
        markLocalStateInvalid(msg)
      } else {
        console.error('[xmtp] loadMessages error:', e)
      }
      return []
    }
  }, [markLocalStateInvalid])

  // ------- send message -------
  const sendMessage = useCallback(async (
    conversationId: string,
    text: string,
    options?: SendChatMessageOptions,
  ): Promise<ChatMessage> => {
    const client = clientRef.current
    const trimmed = text.trim()
    if (!client || !trimmed) {
      throw new Error('not_connected')
    }
    const replyToId = options?.replyToId?.trim() || null
    const replyToSenderInboxId = options?.replyToSenderInboxId?.trim() || null
    const wireContent = encodeWireContent(trimmed, options)
    const optimisticParsed = parseWireContent(wireContent)
    try {
      const convo = await client.conversations.getConversationById(conversationId)
      if (!convo) throw new Error('conversation_not_found')
      let sent: unknown
      if (replyToId && replyToSenderInboxId) {
        sent = await convo.sendReply({
          reference: replyToId,
          referenceInboxId: replyToSenderInboxId,
          content: await encodeText(trimmed),
        })
      } else {
        sent = await convo.sendText(wireContent)
      }
      const sentRecord =
        sent && typeof sent === 'object'
          ? (sent as { sentAt?: unknown; id?: unknown })
          : null
      const sentAt =
        sentRecord?.sentAt instanceof Date
          ? sentRecord.sentAt
          : new Date()
      const sentId =
        typeof sentRecord?.id === 'string'
          ? sentRecord.id
          : `local-ack-${Date.now()}`
      return {
        id: sentId,
        conversationId,
        senderInboxId: client.inboxId ?? 'self',
        content: optimisticParsed.content,
        contentType: optimisticParsed.contentType,
        richPreview: optimisticParsed.richPreview,
        replyToId: replyToId ?? optimisticParsed.replyToId,
        actions: null,
        walletSendCalls: null,
        reactionEmoji: null,
        status: 'sent',
        error: null,
        sentAt,
        isSelf: true,
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (isLocalXmtpStateInvalidError(msg)) {
        markLocalStateInvalid(msg)
        throw new Error(
          'XMTP local messaging state is out of sync. Reset local messaging state, then reconnect.',
        )
      }
      console.error('[xmtp] sendMessage error:', e)
      throw e
    }
  }, [markLocalStateInvalid])

  const sendIntent = useCallback(async (
    conversationId: string,
    params: { promptId: string; actionId: string },
  ): Promise<void> => {
    const client = clientRef.current
    if (!client) throw new Error('not_connected')
    const promptId = String(params.promptId ?? '').trim()
    const actionId = String(params.actionId ?? '').trim()
    if (!promptId || !actionId) throw new Error('invalid_intent')
    const convo = await client.conversations.getConversationById(conversationId)
    if (!convo) throw new Error('conversation_not_found')
    await convo.sendIntent({ id: promptId, actionId })
  }, [])

  // ------- start DM -------
  const startDm = useCallback(async (
    peerAddress: `0x${string}`,
    options?: StartDmOptions,
  ): Promise<StartDmResult> => {
    const normalizedPeerAddress = (normalizeEvmAddress(peerAddress) ?? peerAddress.toLowerCase()) as `0x${string}`
    const normalizedInputAddress = normalizeEvmAddress(options?.inputAddress ?? null) as `0x${string}` | null
    const canonicalizedFromAddress =
      normalizedInputAddress && normalizedInputAddress !== normalizedPeerAddress
        ? normalizedInputAddress
        : null

    if (shouldBlockSelfDm({ peerAddress, identityAddress: identityAddressRef.current })) {
      return {
        ok: false,
        reason: 'self_recipient',
        message: 'Use Akita to chat about your wallet.',
      }
    }

    const client = clientRef.current
    if (!client) {
      return {
        ok: false,
        reason: 'not_connected',
        message: 'Messaging client not connected.',
      }
    }
    try {
      let effectivePeerAddress = normalizedPeerAddress
      let usedOriginalAddressFallback = false
      const preflightCanMessage = await canMessageAddressOnCurrentEnv(normalizedPeerAddress)
      if (preflightCanMessage === false) {
        const originalCanMessage = canonicalizedFromAddress
          ? await canMessageAddressOnCurrentEnv(canonicalizedFromAddress)
          : null
        if (canonicalizedFromAddress && shouldFallbackToOriginalXmtpRecipient({
          canonicalizedFromAddress,
          peerAddress: normalizedPeerAddress,
          peerCanMessage: preflightCanMessage,
          originalCanMessage,
        })) {
          effectivePeerAddress = canonicalizedFromAddress
          usedOriginalAddressFallback = true
        } else {
          return {
            ok: false,
            reason: canonicalizedFromAddress
              ? 'canonical_recipient_not_registered'
              : 'recipient_not_registered',
            message: buildNotRegisteredDmMessage({
              peerAddress: normalizedPeerAddress,
              canonicalizedFromAddress,
              env: XMTP_ENV,
            }),
          }
        }
      }
      await client.conversations.sync().catch(() => undefined)
      const dm = await client.conversations.createDmWithIdentifier({
        identifier: effectivePeerAddress,
        identifierKind: IdentifierKind.Ethereum,
      })
      const summary = await buildConvoSummary(dm as any)
      const summaryWithHints: ChatConversation = {
        ...summary,
        name: options?.nameHint?.trim() || summary.name,
        imageUrl: options?.imageUrl?.trim() || summary.imageUrl,
      }
      setConversations((prev) => {
        const next = upsertConversationSummary(prev, summaryWithHints)
        conversationsRef.current = next
        return next
      })
      return {
        ok: true,
        conversationId: dm.id,
        peerAddress: effectivePeerAddress,
        usedOriginalAddressFallback,
      }
    } catch (e) {
      console.error('[xmtp] startDm error:', e)
      const errMsg = e instanceof Error && e.message ? e.message : 'Could not start conversation'
      if (isXmtpEnvironmentMismatchError(errMsg)) {
        return {
          ok: false,
          reason: 'environment_mismatch',
          message: `Recipient appears to be on a different XMTP environment. This app is using ${formatXmtpEnvLabel(XMTP_ENV)}.`,
        }
      }
      if (isXmtpNotRegisteredError(errMsg)) {
        return {
          ok: false,
          reason: canonicalizedFromAddress
            ? 'canonical_recipient_not_registered'
            : 'recipient_not_registered',
          message: buildNotRegisteredDmMessage({
            peerAddress: normalizedPeerAddress,
            canonicalizedFromAddress,
            env: XMTP_ENV,
          }),
        }
      }
      return {
        ok: false,
        reason: 'create_failed',
        message: errMsg,
      }
    }
  }, [buildConvoSummary])

  const startDmByInbox = useCallback(async (
    peerInboxId: string,
    options?: StartDmOptions,
  ): Promise<string | null> => {
    const client = clientRef.current
    const normalizedPeerInboxId = peerInboxId.trim()
    if (!client || !normalizedPeerInboxId) return null
    try {
      await client.conversations.sync().catch(() => undefined)
      const dm = await client.conversations.createDm(normalizedPeerInboxId)
      const summary = await buildConvoSummary(dm as any)
      const summaryWithHints: ChatConversation = {
        ...summary,
        name: options?.nameHint?.trim() || summary.name,
        imageUrl: options?.imageUrl?.trim() || summary.imageUrl,
      }
      setConversations((prev) => {
        const next = upsertConversationSummary(prev, summaryWithHints)
        conversationsRef.current = next
        return next
      })
      return dm.id
    } catch (e) {
      console.error('[xmtp] startDmByInbox error:', e)
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
        identityAddress,
        inboxId,
        installationLimitInboxId,
        localStateResetRequired,
        connect,
        resetInstallations,
        resetLocalState,
        disconnect,
        conversations,
        loadMessages,
        sendMessage,
        sendIntent,
        startDm,
        startDmByInbox,
        subscribeToMessages,
        resolveInboxAddress,
      }}
    >
      {children}
    </XmtpContext.Provider>
  )
}
