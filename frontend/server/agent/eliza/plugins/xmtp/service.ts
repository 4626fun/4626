/**
 * XMTP Service for ElizaOS
 *
 * Manages XMTP agent lifecycle — connects with creator wallet keys,
 * streams incoming messages, and provides a send interface.
 */

import { Agent, createUser, createSigner, filter, getInstallationInfo } from '@xmtp/agent-sdk'
import type { MessageContext, ConversationContext } from '@xmtp/agent-sdk'
import type { Plugin } from '@elizaos/core'

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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class XmtpService {
  private agent: Agent | null = null
  private onMessage: OnMessageCallback | null = null
  private config: XmtpConfig

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
    return this.agent !== null
  }

  /** Start the XMTP agent and begin streaming messages */
  async start(): Promise<void> {
    if (this.agent) return

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

    // Persist the local database so the SDK reuses the same installation
    // across restarts instead of registering a new one each time.
    if (this.config.dbPath !== undefined) {
      createOpts.dbPath = this.config.dbPath
    }

    // Encrypt the local database so it can be safely reopened across restarts.
    if (this.config.dbEncryptionKey) {
      createOpts.dbEncryptionKey = this.config.dbEncryptionKey
    }

    this.agent = await Agent.create(signer, createOpts as any)

    // Revoke stale installations if requested (recovers from 10/10 limit)
    if (this.config.revokeOtherInstallations) {
      try {
        console.log('[xmtp-service] Revoking all other installations…')
        await this.agent.client.revokeAllOtherInstallations()
        console.log('[xmtp-service] Stale installations revoked')
      } catch (err) {
        console.error('[xmtp-service] Failed to revoke installations:', err)
      }
    }

    // Post-create guard: if we're near the 10-installation limit, proactively
    // revoke all other installations to prevent future 10/10 errors.
    try {
      const info = await getInstallationInfo(this.agent.client)
      if (info.totalInstallations >= 8) {
        console.warn(
          `[xmtp-service] Inbox has ${info.totalInstallations}/10 installations — auto-revoking others to prevent limit`,
        )
        await this.agent.client.revokeAllOtherInstallations()
        console.log('[xmtp-service] Proactive revocation complete')
      }
    } catch (err) {
      console.warn('[xmtp-service] Post-create installation check failed (non-fatal):', err)
    }

    // Handle text messages
    this.agent.on('text', (ctx) => void this.handleIncoming(ctx))
    this.agent.on('markdown', (ctx) => void this.handleIncoming(ctx))

    this.agent.on('unhandledError', (error) => {
      console.error('[xmtp-service] Unhandled error:', error)
    })

    await this.agent.start()
    console.log(`[xmtp-service] Agent started: ${this.agent.address}`)
  }

  /** Stop the XMTP agent */
  async stop(): Promise<void> {
    if (!this.agent) return
    try {
      await this.agent.stop()
    } catch {}
    this.agent = null
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
