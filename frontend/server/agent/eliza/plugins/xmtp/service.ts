/**
 * XMTP Service for ElizaOS
 *
 * Manages XMTP agent lifecycle — connects with creator wallet keys,
 * streams incoming messages, and provides a send interface.
 */

import { Agent, createUser, createSigner, filter, getInstallationInfo } from '@xmtp/agent-sdk'
import type { MessageContext, ConversationContext } from '@xmtp/agent-sdk'
import type { Plugin } from '@elizaos/core'
import { createHash } from 'node:crypto'
import { AgentError } from '../../_errors.js'

const ETHEREUM_IDENTIFIER_KIND = 0

function getEthereumAddressFromInboxState(state: any): string | null {
  const identifiers = Array.isArray(state?.identifiers) ? state.identifiers : []
  for (const id of identifiers) {
    const kind = id?.identifierKind
    const identifier = typeof id?.identifier === 'string' ? id.identifier : ''
    if ((kind === ETHEREUM_IDENTIFIER_KIND || kind === 'Ethereum') && /^0x[a-fA-F0-9]{40}$/.test(identifier)) {
      return identifier.toLowerCase()
    }
  }
  return null
}

function readEnvDbEncryptionKey(): `0x${string}` | undefined {
  const plaintextOnlyRaw = String(process.env.XMTP_DB_PLAINTEXT_ONLY ?? '').trim().toLowerCase()
  if (
    plaintextOnlyRaw === '1' ||
    plaintextOnlyRaw === 'true' ||
    plaintextOnlyRaw === 'yes' ||
    plaintextOnlyRaw === 'on'
  ) {
    return undefined
  }
  const raw = (process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
  if (!raw) return undefined
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function normalizeMessageId(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return raw.toLowerCase()
}

export function deriveInboundMessageDedupeKey(input: {
  conversationId: string
  senderInboxId: string
  content: string
  sentAtMs?: number | null
  messageId?: string | null
}): string {
  const conversationId = String(input.conversationId ?? '').trim()
  const senderInboxId = String(input.senderInboxId ?? '').trim().toLowerCase()
  const messageId = normalizeMessageId(input.messageId)
  if (messageId) {
    return `xmtp:${conversationId}:${messageId}`
  }
  const sentAtMs =
    Number.isFinite(input.sentAtMs) && Number(input.sentAtMs) > 0
      ? Math.floor(Number(input.sentAtMs))
      : 0
  const contentHash = createHash('sha256')
    .update(String(input.content ?? ''), 'utf8')
    .digest('hex')
  return `xmtp:fallback:${conversationId}:${senderInboxId}:${sentAtMs}:${contentHash}`
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'unknown_error'
  if (typeof error === 'string' && error.trim()) return error
  return 'unknown_error'
}

function normalizeHexSignature(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const normalized = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!/^[a-fA-F0-9]{64,}$/.test(normalized)) return null
  return normalized.toLowerCase()
}

async function signConversationKeyMaterial(
  signer: any,
  conversationId: string,
): Promise<string | null> {
  if (!signer || typeof signer !== 'object') return null
  const payload = `4626:xmtp:archive:key:v1:${conversationId}`
  const signMessage = (signer as any).signMessage
  if (typeof signMessage !== 'function') return null
  const attempts = [
    () => signMessage(payload),
    () => signMessage({ message: payload }),
    () => signMessage({ text: payload }),
    () => signMessage({ data: payload }),
    () => signMessage(Buffer.from(payload, 'utf8')),
  ]
  for (const trySign of attempts) {
    try {
      const signature = await Promise.resolve(trySign())
      const normalized = normalizeHexSignature(signature)
      if (normalized) return normalized
    } catch {
      // Try the next signer shape.
    }
  }
  return null
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof AgentError) {
    if (error.retryable) return true
    return error.code === 'UPSTREAM_TIMEOUT' || error.code === 'DEPENDENCY_UNAVAILABLE' || error.code === 'RATE_LIMITED'
  }
  const lower = readErrorMessage(error).toLowerCase()
  return (
    lower.includes('timeout') ||
    lower.includes('tempor') ||
    lower.includes('429') ||
    lower.includes('503') ||
    lower.includes('network')
  )
}

async function withRetry<T>(input: {
  operationName: string
  maxAttempts: number
  baseDelayMs: number
  run: () => Promise<T>
}): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= input.maxAttempts; attempt += 1) {
    try {
      return await input.run()
    } catch (error) {
      lastError = error
      const retryable = isRetryableError(error)
      console.warn(
        `[xmtp-service] ${input.operationName} attempt ${attempt}/${input.maxAttempts} failed (retryable=${retryable}): ${readErrorMessage(error)}`,
      )
      if (!retryable || attempt >= input.maxAttempts) break
      const waitMs = input.baseDelayMs * Math.pow(2, attempt - 1)
      await sleep(waitMs)
    }
  }
  const lastMessage = readErrorMessage(lastError)
  const retryable = isRetryableError(lastError)
  throw new AgentError(
    'UPSTREAM_ERROR',
    `${input.operationName}_failed_after_retries: ${lastMessage}`,
    {
      retryable,
      details: {
        maxAttempts: input.maxAttempts,
        lastError: lastMessage,
      },
      cause: lastError,
    },
  )
}

const INBOUND_DEDUPE_TTL_MS = Math.max(
  30_000,
  parsePositiveInt(process.env.ELIZA_XMTP_INBOUND_DEDUPE_TTL_MS, 6 * 60 * 60 * 1000),
)
const INBOUND_DEDUPE_MAX_KEYS = Math.max(
  1_000,
  parsePositiveInt(process.env.ELIZA_XMTP_INBOUND_DEDUPE_MAX_KEYS, 50_000),
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type XmtpConfig = {
  /** Hex-encoded private key for the XMTP agent identity (EOA mode) */
  privateKey?: `0x${string}`
  /** Custom signer (CSW mode — passed directly to Agent.create) */
  signer?: any
  /** XMTP network: 'production' | 'dev' | 'local' */
  env?: 'production' | 'dev' | 'local'
  /**
   * Stable path (or factory) for the XMTP local database.
   * If provided, the SDK reuses the same installation across restarts
   * instead of creating a new one each time.
   *
   * Can be a string (absolute path to the .db3 file), a function
   * `(inboxId: string) => string`, or `null` for in-memory.
   */
  dbPath?: string | null | ((inboxId: string) => string)
  /**
   * Hex-encoded encryption key for the XMTP local database (0x-prefixed, 32 bytes).
   * Required by the SDK to encrypt/decrypt the persisted .db3 files.
   * Must be the same key across restarts so the DB can be reopened.
   *
   * Generate with: `openssl rand -hex 32` (then prefix with 0x).
   */
  dbEncryptionKey?: `0x${string}`
  /**
   * If true, revoke all other installations for this inbox after
   * connecting. Use this to recover from the 10/10 installation limit.
   * Defaults to false.
   */
  revokeOtherInstallations?: boolean
}

export type XmtpMessage = {
  conversationId: string
  conversationType: 'dm' | 'group'
  recipientAddress: string | null
  senderInboxId: string
  senderAddress: string | null
  messageId: string
  content: string
  sentAt: Date
  sentAtMs: number
  isSelf: boolean
  conversationArchiveKey?: string | null
  source: 'xmtp'
  sourceHint: 'unknown' | 'zora_likely' | 'app_likely'
  contentType: string | null
  codec: string | null
  clientHint: string | null
  parseStatus: 'ok' | 'non_text_coerced'
}

export type OnMessageCallback = (msg: XmtpMessage) => Promise<string | null>

type XmtpLifecycleState = 'idle' | 'starting' | 'running' | 'stopped' | 'error'

function normalizeInboundText(content: unknown): {
  text: string | null
  parseStatus: 'ok' | 'non_text_coerced'
} {
  if (typeof content === 'string') {
    return {
      text: content,
      parseStatus: 'ok',
    }
  }
  if (content == null) {
    return {
      text: null,
      parseStatus: 'non_text_coerced',
    }
  }
  try {
    const normalized = JSON.stringify(content)
    if (typeof normalized !== 'string' || !normalized.trim()) {
      return { text: null, parseStatus: 'non_text_coerced' }
    }
    return {
      text: normalized.slice(0, 8_000),
      parseStatus: 'non_text_coerced',
    }
  } catch {
    return {
      text: String(content).trim() ? String(content).slice(0, 8_000) : null,
      parseStatus: 'non_text_coerced',
    }
  }
}

function pickFirstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return null
}

function deriveSourceHint(params: {
  contentType: string | null
  codec: string | null
  clientHint: string | null
}): 'unknown' | 'zora_likely' | 'app_likely' {
  const fingerprint = [params.contentType, params.codec, params.clientHint]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
    .toLowerCase()
  if (!fingerprint) return 'unknown'
  if (fingerprint.includes('zora')) return 'zora_likely'
  if (fingerprint.includes('4626') || fingerprint.includes('keepr')) return 'app_likely'
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class XmtpService {
  private agent: Agent | null = null
  private onMessage: OnMessageCallback | null = null
  private config: XmtpConfig
  private signerForArchive: any = null
  private conversationArchiveKeyCache = new Map<string, string>()
  private readonly seenInboundMessages = new Map<string, number>()
  private readonly inboundDedupeTtlMs = INBOUND_DEDUPE_TTL_MS
  private readonly inboundDedupeMaxKeys = INBOUND_DEDUPE_MAX_KEYS
  private lifecycleState: XmtpLifecycleState = 'idle'
  private lastStartedAtMs: number | null = null
  private lastMessageAtMs: number | null = null
  private lastError: string | null = null

  constructor(config: XmtpConfig) {
    this.config = config
  }

  /** Register a callback that receives messages and returns an optional reply */
  setMessageHandler(handler: OnMessageCallback) {
    this.onMessage = handler
  }

  get address(): string | undefined {
    return this.agent?.address
  }

  get isRunning(): boolean {
    return this.lifecycleState === 'running' && this.agent !== null
  }

  getHealth(): {
    state: XmtpLifecycleState
    running: boolean
    address: string | null
    lastStartedAtMs: number | null
    lastMessageAtMs: number | null
    lastError: string | null
  } {
    return {
      state: this.lifecycleState,
      running: this.isRunning,
      address: this.agent?.address ?? null,
      lastStartedAtMs: this.lastStartedAtMs,
      lastMessageAtMs: this.lastMessageAtMs,
      lastError: this.lastError,
    }
  }

  /** Start the XMTP agent and begin streaming messages */
  async start(): Promise<void> {
    if (this.lifecycleState === 'starting' || this.lifecycleState === 'running') return

    let signer: any

    if (this.config.signer) {
      // CSW mode: use the pre-built signer (e.g. from Privy SCW signer)
      signer = this.config.signer
    } else if (this.config.privateKey) {
      // EOA mode: derive signer from private key
      const user = createUser(this.config.privateKey)
      signer = createSigner(user)
    } else {
      throw new Error('Either privateKey or signer must be provided')
    }
    this.signerForArchive = signer

    const createOpts: Record<string, unknown> = {
      env: this.config.env ?? 'production',
    }
    const startMaxAttempts = parsePositiveInt(process.env.ELIZA_XMTP_START_MAX_RETRIES, 3)
    const startRetryBaseMs = parsePositiveInt(process.env.ELIZA_XMTP_START_RETRY_BASE_MS, 1_000)

    // Persist the local database so the SDK reuses the same installation
    // across restarts instead of registering a new one each time.
    if (this.config.dbPath !== undefined) {
      createOpts.dbPath = this.config.dbPath
    }

    // Encrypt the local database so it can be safely reopened across restarts.
    if (this.config.dbEncryptionKey) {
      createOpts.dbEncryptionKey = this.config.dbEncryptionKey
    }

    this.lifecycleState = 'starting'
    this.lastError = null
    let effectiveDbEncryptionKey = this.config.dbEncryptionKey
    let createdAgent: Agent | null = null

    try {
      createdAgent = await withRetry({
        operationName: 'xmtp_agent_create',
        maxAttempts: startMaxAttempts,
        baseDelayMs: startRetryBaseMs,
        run: async () => {
          try {
            return await Agent.create(signer, createOpts as any)
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            const retryKey = !effectiveDbEncryptionKey ? readEnvDbEncryptionKey() : undefined
            const isUnsupportedFormat = message.toLowerCase().includes('unsupported file format')
            if (!retryKey || !isUnsupportedFormat) throw err

            // Unsupported format usually means we opened an encrypted DB without
            // its key. Switch directly to the env key fallback to avoid another
            // full open timeout with identical options.
            effectiveDbEncryptionKey = retryKey
            return await Agent.create(
              signer,
              {
                ...createOpts,
                dbEncryptionKey: retryKey,
              } as any,
            )
          }
        },
      })

      // Log installation info for persistence debugging
      try {
        const info = await getInstallationInfo(createdAgent.client)
        console.log(
          `[xmtp-service] Connected: ${createdAgent.address} | ` +
          `installations: ${info.totalInstallations}/10 | ` +
          `dbPath: ${typeof createOpts.dbPath === 'function' ? '(function)' : createOpts.dbPath ?? 'default'} | ` +
          `dbEncrypted: ${!!effectiveDbEncryptionKey}`,
        )
      } catch {
        // Non-fatal — some SDK versions may not expose getInstallationInfo
      }

      // Revoke stale installations if requested (recovers from 10/10 limit)
      if (this.config.revokeOtherInstallations) {
        try {
          console.log('[xmtp-service] Revoking all other installations…')
          await createdAgent.client.revokeAllOtherInstallations()
          console.log('[xmtp-service] Stale installations revoked')
        } catch (err) {
          console.error('[xmtp-service] Failed to revoke installations:', err)
        }
      }

      // Post-create guard: if we're near the 10-installation limit, proactively
      // revoke all other installations to prevent future 10/10 errors.
      try {
        const info = await getInstallationInfo(createdAgent.client)
        if (info.totalInstallations >= 8) {
          console.warn(
            `[xmtp-service] Inbox has ${info.totalInstallations}/10 installations — auto-revoking others to prevent limit`,
          )
          await createdAgent.client.revokeAllOtherInstallations()
          console.log('[xmtp-service] Proactive revocation complete')
        }
      } catch (err) {
        console.warn('[xmtp-service] Post-create installation check failed (non-fatal):', err)
      }

      // Handle text messages
      createdAgent.on('text', (ctx) => void this.handleIncoming(ctx))
      createdAgent.on('markdown', (ctx) => void this.handleIncoming(ctx))

      createdAgent.on('unhandledError', (error) => {
        console.error('[xmtp-service] Unhandled error:', error)
      })

      await withRetry({
        operationName: 'xmtp_agent_start',
        maxAttempts: startMaxAttempts,
        baseDelayMs: startRetryBaseMs,
        run: async () => {
          await createdAgent!.start()
        },
      })

      this.agent = createdAgent
      this.lifecycleState = 'running'
      this.lastStartedAtMs = Date.now()
      this.lastError = null
      console.log(`[xmtp-service] Agent started: ${this.agent.address}`)
    } catch (error) {
      if (createdAgent) {
        try {
          await createdAgent.stop()
        } catch {}
      }
      this.agent = null
      this.signerForArchive = null
      this.conversationArchiveKeyCache.clear()
      this.seenInboundMessages.clear()
      this.lifecycleState = 'error'
      this.lastError = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  /** Stop the XMTP agent */
  async stop(): Promise<void> {
    if (!this.agent) return
    try {
      await this.agent.stop()
    } catch {}
    this.agent = null
    this.signerForArchive = null
    this.conversationArchiveKeyCache.clear()
    this.seenInboundMessages.clear()
    this.lifecycleState = 'stopped'
    console.log('[xmtp-service] Agent stopped')
  }

  /** Send a text message to a conversation */
  async sendToConversation(conversationId: string, text: string): Promise<void> {
    if (!this.agent) throw new Error('XMTP agent not started')
    const ctx = await this.agent.getConversationContext(conversationId)
    if (!ctx) throw new Error(`Conversation ${conversationId} not found`)
    await ctx.conversation.sendText(text)
  }

  /** Create a DM with an address */
  async createDm(address: string): Promise<string> {
    if (!this.agent) throw new Error('XMTP agent not started')
    const dm = await this.agent.createDmWithAddress(address as `0x${string}`)
    return dm.id
  }

  /** Resolve an inbox ID to an Ethereum address */
  async resolveInboxAddress(inboxId: string): Promise<string | null> {
    if (!this.agent) return null
    try {
      const client = this.agent.client
      const states = await client.preferences.fetchInboxStates([inboxId])
      return getEthereumAddressFromInboxState(states?.[0])
    } catch {
      return null
    }
  }

  /**
   * Derive a stable, conversation-scoped archive key from the XMTP signer.
   * This avoids using app-level env secrets for Grove archive encryption.
   */
  async deriveConversationArchiveKey(conversationId: string): Promise<string | null> {
    const key = String(conversationId ?? '').trim()
    if (!key) return null
    const cached = this.conversationArchiveKeyCache.get(key)
    if (cached) return cached
    const signature = await signConversationKeyMaterial(this.signerForArchive, key)
    if (!signature) return null
    const digest = createHash('sha256').update(signature, 'utf8').digest('hex')
    const derived = `0x${digest}`
    this.conversationArchiveKeyCache.set(key, derived)
    return derived
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private pruneInboundDedupe(nowMs: number): void {
    const cutoff = nowMs - this.inboundDedupeTtlMs
    for (const [key, seenAtMs] of this.seenInboundMessages.entries()) {
      if (seenAtMs < cutoff) {
        this.seenInboundMessages.delete(key)
      }
    }
    while (this.seenInboundMessages.size > this.inboundDedupeMaxKeys) {
      const oldestKey = this.seenInboundMessages.keys().next().value
      if (!oldestKey) break
      this.seenInboundMessages.delete(oldestKey)
    }
  }

  private markInboundMessageSeen(dedupeKey: string, nowMs = Date.now()): boolean {
    this.pruneInboundDedupe(nowMs)
    const existing = this.seenInboundMessages.get(dedupeKey)
    if (typeof existing === 'number' && nowMs - existing <= this.inboundDedupeTtlMs) {
      // Refresh insertion order for the LRU-like cap.
      this.seenInboundMessages.delete(dedupeKey)
      this.seenInboundMessages.set(dedupeKey, existing)
      return true
    }
    this.seenInboundMessages.set(dedupeKey, nowMs)
    this.pruneInboundDedupe(nowMs)
    return false
  }

  private async handleIncoming(ctx: MessageContext<string>): Promise<void> {
    let claimedDedupeKey: string | null = null
    let shouldRetainDedupe = false
    try {
      if (!this.agent) return
      if (filter.fromSelf(ctx.message, ctx.client)) return

      const normalizedContent = normalizeInboundText((ctx.message as any).content)
      const content = normalizedContent.text
      if (!content) return

      const conversationId = ctx.conversation.id
      const senderInboxId = ctx.message.senderInboxId
      const conversationType = ctx.isDm() ? 'dm' : 'group'
      const sentAt = ctx.message.sentAt ?? new Date()
      const sentAtMs = sentAt.getTime()
      const rawMessage = ctx.message as any
      const contentType = pickFirstString([
        rawMessage?.contentType?.typeId,
        rawMessage?.contentType?.authorityId,
        rawMessage?.contentType?.name,
      ])
      const codec = pickFirstString([
        rawMessage?.contentCodec?.contentType?.typeId,
        rawMessage?.contentCodec?.constructor?.name,
      ])
      const clientHint = pickFirstString([
        rawMessage?.senderInstallationId,
        rawMessage?.metadata?.client,
        rawMessage?.metadata?.source,
      ])
      const sourceHint = deriveSourceHint({
        contentType,
        codec,
        clientHint,
      })
      const messageId =
        normalizeMessageId((ctx.message as any).id ?? (ctx.message as any).messageId) ??
        `fallback:${createHash('sha256')
          .update(`${conversationId}|${senderInboxId}|${sentAtMs}|${content}`, 'utf8')
          .digest('hex')}`
      const dedupeKey = deriveInboundMessageDedupeKey({
        conversationId,
        senderInboxId,
        content,
        sentAtMs,
        messageId,
      })
      if (this.markInboundMessageSeen(dedupeKey, Date.now())) {
        console.warn(`[xmtp-service] Duplicate inbound message dropped (${dedupeKey.slice(0, 28)}...)`)
        return
      }
      claimedDedupeKey = dedupeKey
      const conversationArchiveKey = await this.deriveConversationArchiveKey(conversationId)

      // Resolve sender address
      const senderAddress = await this.resolveInboxAddress(senderInboxId)

      const msg: XmtpMessage = {
        conversationId,
        conversationType,
        recipientAddress: this.agent?.address?.toLowerCase() ?? null,
        senderInboxId,
        senderAddress,
        messageId,
        content,
        sentAt,
        sentAtMs,
        isSelf: false,
        conversationArchiveKey,
        source: 'xmtp',
        sourceHint,
        contentType,
        codec,
        clientHint,
        parseStatus: normalizedContent.parseStatus,
      }

      if (this.onMessage) {
        this.lastMessageAtMs = Date.now()
        const reply = await this.onMessage(msg)
        if (reply) {
          await ctx.conversation.sendText(reply)
        }
      }
      shouldRetainDedupe = true
    } catch (err) {
      console.error('[xmtp-service] Message handler error:', err)
    } finally {
      if (!shouldRetainDedupe && claimedDedupeKey) {
        // Allow transient handler failures to be retried by a later redelivery.
        this.seenInboundMessages.delete(claimedDedupeKey)
      }
    }
  }
}
