// Pure helpers extracted from src/lib/xmtp/provider.tsx.
// No React, no XMTP client instantiation, no module-level singleton state.
// Safe for unit testing in isolation.

import { ConsentEntityType, ConsentState } from '@xmtp/browser-sdk'
import { getAddress, isAddress } from 'viem'

// Re-declared locally to avoid a circular import with provider.tsx.
// Keep in sync with provider.tsx exports.
type ChatMessageContentType = 'text' | 'json' | 'code'

// ---------------------------------------------------------------------------
// Address + byte utilities
// ---------------------------------------------------------------------------

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(h.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function normalizeEvmAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || !isAddress(raw)) return null
  return getAddress(raw).toLowerCase()
}

// ---------------------------------------------------------------------------
// Wire content parsing (chat text <-> typed content / replies)
// ---------------------------------------------------------------------------

export type ParsedWireContent = {
  content: string
  contentType: ChatMessageContentType
  richPreview?: string
  replyToId: string | null
  actions?: {
    promptId: string
    description: string
    buttons: Array<{ id: string; label: string; style?: 'primary' | 'secondary' | 'danger' }>
  } | null
  reactionEmoji?: string | null
}

const REPLY_PREFIX_RE = /^\[reply:([a-zA-Z0-9._:-]{1,160})\]\s*/i
const JSON_CODE_FENCE_RE = /^```json\s*([\s\S]*?)\s*```$/i
const GENERIC_CODE_FENCE_RE = /^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```$/i

export function parseWireContent(raw: string): ParsedWireContent {
  const initial = String(raw ?? '')
  const replyMatch = initial.match(REPLY_PREFIX_RE)
  const replyToId = replyMatch?.[1] ? replyMatch[1] : null
  const content = replyMatch ? initial.slice(replyMatch[0].length).trim() : initial.trim()

  const jsonFenceMatch = content.match(JSON_CODE_FENCE_RE)
  if (jsonFenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonFenceMatch[1]) as unknown
      if (parsed && typeof parsed === 'object') {
        return {
          content,
          contentType: 'json',
          richPreview: JSON.stringify(parsed, null, 2),
          replyToId,
        }
      }
    } catch {
      // Fallback to plain text when JSON is invalid.
    }
  }

  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const parsed = JSON.parse(content) as unknown
      if (parsed && typeof parsed === 'object') {
        return {
          content,
          contentType: 'json',
          richPreview: JSON.stringify(parsed, null, 2),
          replyToId,
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  const codeFenceMatch = content.match(GENERIC_CODE_FENCE_RE)
  if (codeFenceMatch?.[1]) {
    return {
      content: codeFenceMatch[1].trim(),
      contentType: 'code',
      replyToId,
    }
  }

  return {
    content,
    contentType: 'text',
    replyToId,
    actions: null,
    reactionEmoji: null,
  }
}

export type SendChatMessageOptions = {
  replyToId?: string | null
  /** Inbox id of the message being replied to (required for native XMTP replies). */
  replyToSenderInboxId?: string | null
}

/** Legacy wire prefix — prefer native XMTP Reply when both clients support it. */
export function encodeWireContent(text: string, options?: SendChatMessageOptions): string {
  const body = text.trim()
  const replyToId = options?.replyToId?.trim()
  if (!replyToId) return body
  return `[reply:${replyToId}] ${body}`
}

export type XmtpEnvLabel = 'production' | 'dev' | 'local'

export function formatXmtpEnvLabel(env: XmtpEnvLabel): string {
  if (env === 'production') return 'production'
  if (env === 'dev') return 'dev'
  return 'local'
}

export function extractInstallationLimitInboxId(message: string): string | null {
  const msg = String(message || '')
  // Example:
  // "Cannot register a new installation because the InboxID <hex> has already registered 10/10 installations..."
  const m = msg.match(/InboxID\s+([0-9a-fA-F]{64})/)
  return m?.[1] ? m[1].toLowerCase() : null
}

export function isXmtpNotRegisteredError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('address not registered on xmtp') ||
    m.includes('notfound.inboxidforaddress') ||
    m.includes('inboxidforaddress')
  )
}

export function isXmtpEnvironmentMismatchError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('different xmtp network environment') ||
    (m.includes('xmtp') && m.includes('environment') && (m.includes('production') || m.includes('dev') || m.includes('local')))
  )
}

export function isInstallationLimitError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return m.includes('registered 10/10 installations') || m.includes('10/10 installations')
}

export function isWrongChainIdError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return m.includes('wrong chain id') || (m.includes('initially added with') && m.includes('signing from 0'))
}

export function isScwSignatureValidationError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('smart contract wallet signature is invalid') ||
    (m.includes('signature') && m.includes('validation failed'))
  )
}

export function isOpfsAccessHandleError(message: string): boolean {
  const m = String(message || '').toLowerCase()
  return (
    m.includes('createsyncaccesshandle') ||
    m.includes('nomodificationallowederror') ||
    m.includes('failed to initialize opfs') ||
    m.includes('active xmtp clients or opfs instances')
  )
}

/** Local OPFS install no longer validates against the XMTP network inbox. */
export function isLocalXmtpStateInvalidError(message: string): boolean {
  const m = String(message || '')
  return (
    /InboxValidationFailed/i.test(m) ||
    /synced \d+ messages?, \d+ failed \d+ succeeded/i.test(m)
  )
}

// ---------------------------------------------------------------------------
// canMessage result parsing
// ---------------------------------------------------------------------------

export function readCanMessageBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (!value || typeof value !== 'object') return null
  const maybeFlag = (value as { canMessage?: unknown }).canMessage
  return typeof maybeFlag === 'boolean' ? maybeFlag : null
}

export function extractCanMessageResult(result: unknown, address: `0x${string}`): boolean | null {
  const normalizedTarget = normalizeEvmAddress(address)
  if (!normalizedTarget) return null

  if (result instanceof Map) {
    for (const [key, value] of result.entries()) {
      const keyAddress = normalizeEvmAddress(
        typeof key === 'string'
          ? key
          : (key as { identifier?: unknown; address?: unknown } | null)?.identifier ??
              (key as { identifier?: unknown; address?: unknown } | null)?.address ??
              null,
      )
      if (!keyAddress || keyAddress !== normalizedTarget) continue
      const parsed = readCanMessageBoolean(value)
      if (parsed !== null) return parsed
    }
    return null
  }

  if (Array.isArray(result)) {
    if (result.length === 1) {
      const singleParsed = readCanMessageBoolean(result[0])
      if (singleParsed !== null) return singleParsed
    }
    for (const entry of result) {
      if (!entry || typeof entry !== 'object') continue
      const maybeEntry = entry as { identifier?: unknown; address?: unknown; canMessage?: unknown }
      const entryAddress = normalizeEvmAddress(maybeEntry.identifier ?? maybeEntry.address)
      if (!entryAddress || entryAddress !== normalizedTarget) continue
      const parsed = readCanMessageBoolean(maybeEntry)
      if (parsed !== null) return parsed
    }
    return null
  }

  if (result && typeof result === 'object') {
    const entries = Object.entries(result as Record<string, unknown>)
    for (const [key, value] of entries) {
      const normalizedKey = normalizeEvmAddress(key)
      if (!normalizedKey || normalizedKey !== normalizedTarget) continue
      const parsed = readCanMessageBoolean(value)
      if (parsed !== null) return parsed
    }
  }

  return null
}

export function shouldFallbackToOriginalXmtpRecipient(params: {
  canonicalizedFromAddress: `0x${string}` | null
  peerAddress: `0x${string}`
  peerCanMessage: boolean | null
  originalCanMessage: boolean | null
}): boolean {
  if (params.peerCanMessage !== false) return false
  if (params.originalCanMessage !== true) return false
  const original = normalizeEvmAddress(params.canonicalizedFromAddress)
  const peer = normalizeEvmAddress(params.peerAddress)
  if (!original || !peer) return false
  return original !== peer
}

// ---------------------------------------------------------------------------
// DM failure copy
// ---------------------------------------------------------------------------

export function buildNotRegisteredDmMessage(params: {
  peerAddress: `0x${string}`
  canonicalizedFromAddress: `0x${string}` | null
  env: XmtpEnvLabel
}): string {
  const envLabel = formatXmtpEnvLabel(params.env)
  if (params.canonicalizedFromAddress && params.canonicalizedFromAddress !== params.peerAddress) {
    return `Resolved canonical wallet ${truncateAddress(params.peerAddress)} is not registered on XMTP (${envLabel}). Original address ${truncateAddress(params.canonicalizedFromAddress)} maps here in 4626; make sure that canonical wallet has XMTP on the same environment.`
  }
  return `Address ${truncateAddress(params.peerAddress)} is not registered on XMTP (${envLabel}). Ask the recipient to open an XMTP-enabled app on the same environment, then retry.`
}

// ---------------------------------------------------------------------------
// Conversation lookup (shared with waitlist group sync recovery)
// ---------------------------------------------------------------------------

export function conversationIdsEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase()
}

export type ConversationLike = {
  id: string
  sync?: () => Promise<unknown>
  consentState?: () => Promise<ConsentState>
  updateConsentState?: (state: ConsentState) => Promise<unknown>
}

export type ListConversationsOptionsLike = {
  consentStates?: ConsentState[]
}

export type ConversationsApiLike = {
  sync: () => Promise<unknown>
  syncAll?: (consentStates?: ConsentState[]) => Promise<unknown>
  getConversationById: (id: string) => Promise<ConversationLike | null>
  list: (options?: ListConversationsOptionsLike) => Promise<ConversationLike[]>
  listGroups?: (options?: ListConversationsOptionsLike) => Promise<ConversationLike[]>
}

export type PreferencesApiLike = {
  setConsentStates?: (
    records: Array<{ entityType: ConsentEntityType; entity: string; state: ConsentState }>,
  ) => Promise<unknown>
}

/** Consent states included when pulling server-side group memberships into a fresh browser install. */
export const GROUP_MEMBERSHIP_CONSENT_SYNC_STATES = [
  ConsentState.Unknown,
  ConsentState.Allowed,
] as const

export function groupMembershipListOptions(): ListConversationsOptionsLike {
  return { consentStates: [...GROUP_MEMBERSHIP_CONSENT_SYNC_STATES] }
}

export async function allowGroupConsentById(
  preferencesApi: PreferencesApiLike | null | undefined,
  groupId: string,
): Promise<void> {
  const normalizedId = groupId.trim()
  if (!normalizedId || typeof preferencesApi?.setConsentStates !== 'function') return
  try {
    await preferencesApi.setConsentStates([
      {
        entityType: ConsentEntityType.GroupId,
        entity: normalizedId,
        state: ConsentState.Allowed,
      },
    ])
  } catch {
    // best effort
  }
}

async function syncConversationIfSupported(convo: ConversationLike): Promise<void> {
  if (typeof convo.sync === 'function') {
    await convo.sync().catch(() => undefined)
  }
}

export async function allowConversationIfUnknown(convo: ConversationLike): Promise<void> {
  if (typeof convo.consentState !== 'function' || typeof convo.updateConsentState !== 'function') {
    return
  }
  try {
    const state = await convo.consentState()
    if (state === ConsentState.Unknown) {
      await convo.updateConsentState(ConsentState.Allowed)
    }
  } catch {
    // best effort
  }
}

export async function syncConversationsForGroupDiscovery(
  conversationsApi: ConversationsApiLike,
): Promise<void> {
  if (typeof conversationsApi.syncAll === 'function') {
    try {
      await conversationsApi.syncAll([...GROUP_MEMBERSHIP_CONSENT_SYNC_STATES])
      return
    } catch {
      // fall through to lightweight sync
    }
  }
  try {
    await conversationsApi.sync()
  } catch {
    // best effort
  }
}

async function findConversationInLists(
  conversationsApi: ConversationsApiLike,
  normalizedId: string,
): Promise<ConversationLike | null> {
  const listOptions = groupMembershipListOptions()
  const sources: Array<() => Promise<ConversationLike[]>> = [
    () => conversationsApi.list(listOptions),
    ...(typeof conversationsApi.listGroups === 'function'
      ? [() => conversationsApi.listGroups!(listOptions)]
      : []),
  ]

  for (const load of sources) {
    try {
      const convos = await load()
      const match = convos.find((convo) => conversationIdsEqual(convo.id, normalizedId)) ?? null
      if (match) return match
    } catch {
      // continue
    }
  }

  return null
}

async function finalizeResolvedConversation(convo: ConversationLike): Promise<ConversationLike> {
  await syncConversationIfSupported(convo)
  await allowConversationIfUnknown(convo)
  return convo
}

export async function resolveConversationById(
  conversationsApi: ConversationsApiLike,
  conversationId: string,
  options?: { preferencesApi?: PreferencesApiLike | null },
): Promise<ConversationLike | null> {
  const normalizedId = conversationId.trim()
  if (!normalizedId) return null

  await allowGroupConsentById(options?.preferencesApi, normalizedId)

  const tryGet = async (): Promise<ConversationLike | null> => {
    try {
      const convo = await conversationsApi.getConversationById(normalizedId)
      if (!convo) return null
      return finalizeResolvedConversation(convo)
    } catch {
      return null
    }
  }

  const direct = await tryGet()
  if (direct) return direct

  await syncConversationsForGroupDiscovery(conversationsApi)

  const afterSync = await tryGet()
  if (afterSync) return afterSync

  const fromList = await findConversationInLists(conversationsApi, normalizedId)
  if (fromList) {
    return finalizeResolvedConversation(fromList)
  }

  return null
}

export async function resolveConversationByIdWithSyncRetries(
  conversationsApi: ConversationsApiLike,
  conversationId: string,
  options?: { rounds?: number; delayMs?: number; preferencesApi?: PreferencesApiLike | null },
): Promise<ConversationLike | null> {
  const rounds = Math.max(1, options?.rounds ?? 3)
  const delayMs = Math.max(0, options?.delayMs ?? 400)

  for (let round = 0; round < rounds; round += 1) {
    const resolved = await resolveConversationById(conversationsApi, conversationId, {
      preferencesApi: options?.preferencesApi,
    })
    if (resolved) return resolved
    if (round + 1 >= rounds) break
    await syncConversationsForGroupDiscovery(conversationsApi)
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return null
}
