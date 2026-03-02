/**
 * XMTP Service for ElizaOS
 *
 * Manages XMTP agent lifecycle — connects with creator wallet keys,
 * streams incoming messages, and provides a send interface.
 */

import { Agent, createUser, createSigner, filter, getInstallationInfo } from '@xmtp/agent-sdk'
import type { MessageContext, ConversationContext } from '@xmtp/agent-sdk'
import type { Plugin } from '@elizaos/core'
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
      const message = error instanceof Error ? error.message : String(error)
      const lower = message.toLowerCase()
      const retryable =
        lower.includes('timeout') ||
        lower.includes('tempor') ||
        lower.includes('429') ||
        lower.includes('503') ||
        lower.includes('network')
      if (!retryable || attempt >= input.maxAttempts) break
      const waitMs = input.baseDelayMs * Math.pow(2, attempt - 1)
      await sleep(waitMs)
    }
  }
  throw new AgentError(
    'UPSTREAM_ERROR',
    `${input.operationName}_failed_after_retries`,
    {
      retryable: true,
      details: {
        maxAttempts: input.maxAttempts,
      },
      cause: lastError,
    },
  )
}

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
  senderInboxId: string
  senderAddress: string | null
  content: string
  sentAt: Date
  isSelf: boolean
}

export type OnMessageCallback = (msg: XmtpMessage) => Promise<string | null>

type XmtpLifecycleState = 'idle' | 'starting' | 'running' | 'stopped' | 'error'

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class XmtpService {
  private agent: Agent | null = null
  private onMessage: OnMessageCallback | null = null
  private config: XmtpConfig
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

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async handleIncoming(ctx: MessageContext<string>): Promise<void> {
    try {
      if (!this.agent) return
      if (filter.fromSelf(ctx.message, ctx.client)) return

      const content = ctx.message.content
      if (!content || typeof content !== 'string') return

      const conversationId = ctx.conversation.id
      const senderInboxId = ctx.message.senderInboxId
      const conversationType = ctx.isDm() ? 'dm' : 'group'

      // Resolve sender address
      const senderAddress = await this.resolveInboxAddress(senderInboxId)

      const msg: XmtpMessage = {
        conversationId,
        conversationType,
        senderInboxId,
        senderAddress,
        content,
        sentAt: ctx.message.sentAt ?? new Date(),
        isSelf: false,
      }

      if (this.onMessage) {
        this.lastMessageAtMs = Date.now()
        const reply = await this.onMessage(msg)
        if (reply) {
          await ctx.conversation.sendText(reply)
        }
      }
    } catch (err) {
      console.error('[xmtp-service] Message handler error:', err)
    }
  }
}
