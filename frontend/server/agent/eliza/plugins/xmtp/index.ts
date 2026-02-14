/**
 * ElizaOS XMTP Plugin
 *
 * Connects an ElizaOS agent to the XMTP messaging network.
 * Incoming messages are converted to ElizaOS Memory objects and
 * processed through the agent's action/evaluator pipeline.
 * Replies are sent back through XMTP.
 */

import type { Plugin, IAgentRuntime, Memory, Content, UUID } from '@elizaos/core'
import { createHash, randomUUID } from 'node:crypto'
import * as fs from 'node:fs'
import { XmtpService } from './service.js'
import { resolveXmtpDbDirectory } from '../../../../_lib/xmtpDbDirectory.js'
import type { XmtpConfig, XmtpMessage } from './service.js'

export { XmtpService } from './service.js'
export type { XmtpConfig, XmtpMessage } from './service.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUUID(): UUID {
  return randomUUID() as UUID
}

function xmtpRoomId(conversationId: string): UUID {
  // Deterministic room ID from XMTP conversation ID (SHA-256 based).
  return formatAsUUID(sha256Hex32(conversationId))
}

function sha256Hex32(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 32)
}

function formatAsUUID(hex32: string): UUID {
  const h = hex32.padEnd(32, '0')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}` as UUID
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

let xmtpServiceInstance: XmtpService | null = null

/**
 * Get the shared XMTP service instance.
 * Available after the plugin is initialized.
 */
export function getXmtpService(): XmtpService | null {
  return xmtpServiceInstance
}

export const xmtpPlugin: Plugin = {
  name: '@creatorvault/plugin-xmtp',
  description: 'XMTP messaging connector for CreatorVault agents',

  async init(config: Record<string, string>, runtime: IAgentRuntime) {
    const privateKey = runtime.getSetting('XMTP_AGENT_PRIVATE_KEY') ?? config.XMTP_AGENT_PRIVATE_KEY
    if (!privateKey) {
      console.warn('[plugin-xmtp] XMTP_AGENT_PRIVATE_KEY not set — plugin disabled')
      return
    }

    const env = (runtime.getSetting('XMTP_ENV') ?? config.XMTP_ENV ?? 'production') as 'production' | 'dev' | 'local'

    // Persist the local database so the SDK reuses the same installation
    // across restarts instead of registering a new one each time.
    const dbDir = resolveXmtpDbDirectory()
    fs.mkdirSync(dbDir, { recursive: true, mode: 0o700 })
    const dbPath = (inboxId: string) => `${dbDir}/plugin-xmtp-${env}-${inboxId}.db3`

    const settingEncKey = runtime.getSetting('XMTP_DB_ENCRYPTION_KEY')
    const rawEncKey = (
      (typeof settingEncKey === 'string' && settingEncKey.trim() ? settingEncKey : undefined) ??
      config.XMTP_DB_ENCRYPTION_KEY ??
      process.env.XMTP_DB_ENCRYPTION_KEY ??
      ''
    ).trim()
    const dbEncryptionKey = rawEncKey
      ? ((rawEncKey.startsWith('0x') ? rawEncKey : `0x${rawEncKey}`) as `0x${string}`)
      : undefined

    const xmtpConfig: XmtpConfig = {
      privateKey: privateKey as `0x${string}`,
      env,
      dbPath,
      dbEncryptionKey,
    }

    const service = new XmtpService(xmtpConfig)
    xmtpServiceInstance = service

    // Wire incoming XMTP messages into the ElizaOS runtime
    service.setMessageHandler(async (msg: XmtpMessage): Promise<string | null> => {
      try {
        const roomId = xmtpRoomId(msg.conversationId)
        const entityId = msg.senderAddress
          ? formatAsUUID(sha256Hex32(msg.senderAddress))
          : generateUUID()

        // Create a Memory object from the XMTP message
        const memory: Memory = {
          id: generateUUID(),
          entityId,
          agentId: runtime.agentId,
          roomId,
          content: {
            text: msg.content,
            source: 'xmtp',
            metadata: {
              conversationId: msg.conversationId,
              conversationType: msg.conversationType,
              senderInboxId: msg.senderInboxId,
              senderAddress: msg.senderAddress,
            },
          } as Content,
          createdAt: msg.sentAt.getTime(),
        }

        // Store the message in memory
        await runtime.createMemory(memory, 'messages')

        // Compose the agent state and generate a response
        const state = await runtime.composeState(memory)

        // Process actions — the callback captures the reply text
        let replyText: string | null = null
        await runtime.processActions(memory, [memory], state, async (responseContent: Content) => {
          if (responseContent?.text) {
            replyText = responseContent.text
          }
          return [memory]
        })

        return replyText
      } catch (err) {
        console.error('[plugin-xmtp] Error processing message:', err)
        return null
      }
    })

    // Start the XMTP service
    await service.start()
    console.log(`[plugin-xmtp] Initialized — agent address: ${service.address}`)
  },

  // Provider that exposes XMTP context to the LLM
  providers: [
    {
      name: 'xmtp-context',
      description: 'Provides XMTP messaging context',
      async get(runtime: IAgentRuntime, message: Memory) {
        const meta = (message.content as any)?.metadata
        if (!meta?.conversationId) {
          return { text: '' }
        }

        const parts = [
          `Platform: XMTP (decentralized messaging)`,
          `Conversation type: ${meta.conversationType ?? 'unknown'}`,
          meta.senderAddress ? `Sender wallet: ${meta.senderAddress}` : null,
        ].filter(Boolean)

        return {
          text: parts.join('\n'),
          values: {
            xmtpConversationId: meta.conversationId,
            xmtpConversationType: meta.conversationType,
            xmtpSenderAddress: meta.senderAddress,
          },
        }
      },
    },
  ],
}

export default xmtpPlugin
