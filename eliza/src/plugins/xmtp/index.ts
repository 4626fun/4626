/**
 * ElizaOS XMTP Plugin
 *
 * Connects an ElizaOS agent to the XMTP messaging network.
 * Incoming messages are converted to ElizaOS Memory objects and
 * processed through the agent's action/evaluator pipeline.
 * Replies are sent back through XMTP.
 */

import type { Plugin, IAgentRuntime, Memory, Content, UUID } from '@elizaos/core'
import { XmtpService } from './service.js'
import type { XmtpConfig, XmtpMessage } from './service.js'

export { XmtpService } from './service.js'
export type { XmtpConfig, XmtpMessage } from './service.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateUUID(): UUID {
  return crypto.randomUUID() as UUID
}

function xmtpRoomId(conversationId: string): UUID {
  // Deterministic room ID from XMTP conversation ID
  // Use a simple hash-to-UUID approach
  const hash = simpleHash(conversationId)
  return formatAsUUID(hash)
}

function simpleHash(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0
  }
  // Pad to 32 hex chars
  const hex = Math.abs(h).toString(16).padStart(8, '0')
  return (hex + hex + hex + hex).slice(0, 32)
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

    const xmtpConfig: XmtpConfig = {
      privateKey: privateKey as `0x${string}`,
      env,
    }

    const service = new XmtpService(xmtpConfig)
    xmtpServiceInstance = service

    // Wire incoming XMTP messages into the ElizaOS runtime
    service.setMessageHandler(async (msg: XmtpMessage): Promise<string | null> => {
      try {
        const roomId = xmtpRoomId(msg.conversationId)
        const entityId = msg.senderAddress
          ? formatAsUUID(simpleHash(msg.senderAddress))
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
