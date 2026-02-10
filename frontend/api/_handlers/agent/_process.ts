/**
 * POST /api/agent/process
 *
 * Vercel cron-compatible one-shot message processor.
 * Loads creator agents, syncs conversations, processes recent unhandled
 * messages, sends replies, then exits.
 *
 * Designed to be called by Vercel Cron (every 1 minute) or manually.
 * Requires: CRON_SECRET (to prevent unauthorized invocations).
 *
 * vercel.json:
 *   { "crons": [{ "path": "/api/agent/process", "schedule": "* * * * *" }] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Agent, createUser, createSigner } from '@xmtp/agent-sdk'
import type { Address } from 'viem'

import { isDbConfigured, getDb } from '../../../server/_lib/postgres.js'
import { decryptPrivateKey, ensureCreatorXmtpAgentsSchema } from '../../../server/_lib/creatorXmtpAgents.js'
import { createPrivyScwSigner } from '../../../server/_lib/privyXmtpSigner.js'
import { handleKeeprCommand } from '../../../server/keepr/commands.js'
import { logger } from '../../../server/_lib/logger.js'

declare const process: { env: Record<string, string | undefined> }

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

const XMTP_ENV = ((process.env.XMTP_ENV ?? 'production').trim()) as 'production' | 'dev' | 'local'
const XMTP_DB_ENCRYPTION_KEY = (() => {
  const raw = (process.env.XMTP_DB_ENCRYPTION_KEY ?? '').trim()
  if (!raw) return undefined
  return (raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`
})()
const MAX_AGENTS = Number(process.env.MAX_AGENTS ?? '10') // Lower limit for serverless
const MAX_MESSAGES_PER_AGENT = 20 // Process at most N messages per invocation
export const MAX_MESSAGES_PER_CONVERSATION = 50
export const DEFAULT_CHECKPOINT_WINDOW_MS = 120_000
const EXECUTION_TIMEOUT_MS = 55_000 // Leave 5s buffer for Vercel's 60s limit

const ETHEREUM_IDENTIFIER_KIND = 0

export function getCheckpointMs(lastProcessedAt: unknown, nowMs = Date.now()): number {
  if (lastProcessedAt) {
    const parsed = new Date(lastProcessedAt as any).getTime()
    if (Number.isFinite(parsed)) return parsed
  }
  return nowMs - DEFAULT_CHECKPOINT_WINDOW_MS
}

export function getMessageQueryOptions(lastProcessedMs: number): {
  sentAfterNs: bigint
  limit: number
  direction: number
} {
  const ms = Math.max(0, Math.floor(lastProcessedMs))
  return {
    sentAfterNs: BigInt(ms) * 1_000_000n,
    limit: MAX_MESSAGES_PER_CONVERSATION,
    direction: 0, // SortDirection.Ascending in @xmtp/node-bindings.
  }
}

export function getEthereumAddressFromInboxState(state: any): string | null {
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

export function mergeCheckpointMs(previousMs: number, candidateMs: number): number {
  return Math.max(previousMs, candidateMs)
}

function isAuthorized(req: VercelRequest): boolean {
  // Vercel Cron sets the Authorization header with the CRON_SECRET
  const cronSecret = (process.env.CRON_SECRET ?? '').trim()
  if (!cronSecret) return false // Require CRON_SECRET to be configured

  const authHeader = (req.headers.authorization ?? '').trim()
  if (authHeader === `Bearer ${cronSecret}`) return true

  // Also check query param for manual testing
  const querySecret = typeof req.query?.secret === 'string' ? req.query.secret : ''
  return querySecret === cronSecret
}

function isCommandLike(text: string): boolean {
  const t = text.trim().toLowerCase()
  return (
    t.startsWith('/') ||
    t.startsWith('keepr') ||
    t.startsWith('fc ') ||
    t.startsWith('send ') ||
    t.startsWith('@keepr') ||
    t.startsWith('@bot')
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Use POST' } satisfies ApiEnvelope<never>)
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, error: 'DB not configured' } satisfies ApiEnvelope<never>)
  }

  const encKey = (process.env.XMTP_AGENT_KEY_ENCRYPTION_KEY ?? '').trim()
  if (!encKey) {
    return res.status(503).json({ success: false, error: 'XMTP_AGENT_KEY_ENCRYPTION_KEY not configured' } satisfies ApiEnvelope<never>)
  }

  const startTime = Date.now()
  let totalProcessed = 0
  let totalReplied = 0
  let agentsProcessed = 0

  try {
    const db = await getDb()
    if (!db) {
      return res.status(503).json({ success: false, error: 'DB connection failed' } satisfies ApiEnvelope<never>)
    }
    await ensureCreatorXmtpAgentsSchema(db as any)

    // Load agents
    const agentRows = await db.sql`
      SELECT
        creator_address,
        xmtp_agent_address,
        agent_type,
        privy_wallet_id,
        csw_address,
        last_processed_message_at,
        encrypted_private_key_b64,
        encrypted_private_key_iv_b64,
        encrypted_private_key_tag_b64
      FROM creator_xmtp_agents
      WHERE listed_publicly = TRUE
      ORDER BY updated_at DESC
      LIMIT ${MAX_AGENTS};
    `

    if (!agentRows.rows?.length) {
      return res.status(200).json({
        success: true,
        data: { agents: 0, processed: 0, replied: 0 },
      } satisfies ApiEnvelope<any>)
    }

    for (const row of agentRows.rows) {
      // Check time budget
      if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) {
        logger.warn('[agent/process] Time budget exceeded, stopping early')
        break
      }

      const creatorAddress = String(row.creator_address).toLowerCase()
      let agent: Agent | null = null

      try {
        const agentType = String(row.agent_type ?? 'eoa').toLowerCase()
        const privyWalletId = row.privy_wallet_id ? String(row.privy_wallet_id).trim() : null
        const cswAddress = row.csw_address ? String(row.csw_address).toLowerCase() : null
        let signer: any

        if (agentType === 'csw' && privyWalletId && cswAddress) {
          // CSW agent: sign via Privy wallet API
          signer = createPrivyScwSigner({
            walletId: privyWalletId,
            cswAddress: cswAddress as `0x${string}`,
            chainId: 8453,
          })
        } else {
          // EOA agent: decrypt private key
          const privKey = decryptPrivateKey({
            ciphertextB64: String(row.encrypted_private_key_b64),
            ivB64: String(row.encrypted_private_key_iv_b64),
            tagB64: String(row.encrypted_private_key_tag_b64),
            aad: `creator:${creatorAddress}`,
          })
          const user = createUser(privKey)
          signer = createSigner(user)
        }

        agent = await Agent.create(signer, {
          env: XMTP_ENV,
          ...(XMTP_DB_ENCRYPTION_KEY ? { dbEncryptionKey: XMTP_DB_ENCRYPTION_KEY } : {}),
        } as any)

        const client = agent.client

        // Sync conversations
        await client.conversations.sync()
        const conversations = await client.conversations.list()

        const lastProcessed = getCheckpointMs(row.last_processed_message_at)
        let newestTimestamp = lastProcessed
        let messagesThisAgent = 0

        for (const convo of conversations) {
          if (messagesThisAgent >= MAX_MESSAGES_PER_AGENT) break
          if (Date.now() - startTime > EXECUTION_TIMEOUT_MS) break

          try {
            await convo.sync()
            // Query only recent messages to bound serverless work.
            const messages = await convo.messages(getMessageQueryOptions(lastProcessed))

            for (const msg of messages) {
              // Only process messages newer than our last checkpoint
              const msgTs = msg.sentAt?.getTime() ?? 0
              if (msgTs <= lastProcessed) continue
              // Skip self messages
              if (msg.senderInboxId === client.inboxId) continue

              const content = typeof msg.content === 'string' ? msg.content : (msg.fallback ?? '')
              if (!content || !isCommandLike(content)) continue

              // Resolve sender address
              let senderAddr: string | null = null
              try {
                const states = await client.preferences.fetchInboxStates([msg.senderInboxId])
                senderAddr = getEthereumAddressFromInboxState(states?.[0])
              } catch {}

              if (!senderAddr) continue

              logger.info('[agent/process] Processing', {
                creator: creatorAddress.slice(0, 10),
                sender: senderAddr.slice(0, 10),
                text: content.slice(0, 60),
              })

              const result = await handleKeeprCommand({
                groupId: convo.id,
                senderWallet: senderAddr.toLowerCase() as Address,
                text: content.trim(),
              })

              if (result.response) {
                await convo.sendText(result.response)
                totalReplied++
              }

              totalProcessed++
              messagesThisAgent++

              newestTimestamp = mergeCheckpointMs(newestTimestamp, msgTs)
            }
          } catch (err) {
            logger.error('[agent/process] Conversation error', {
              creator: creatorAddress.slice(0, 10),
              convo: convo.id.slice(0, 16),
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        const checkpointToPersist = mergeCheckpointMs(lastProcessed, newestTimestamp)
        if (checkpointToPersist > lastProcessed) {
          const newestIso = new Date(checkpointToPersist).toISOString()
          await db.sql`
            UPDATE creator_xmtp_agents
            SET
              last_processed_message_at = GREATEST(
                COALESCE(last_processed_message_at, TO_TIMESTAMP(0)),
                ${newestIso}::timestamptz
              ),
              updated_at = NOW()
            WHERE LOWER(creator_address) = ${creatorAddress};
          `
        }
        agentsProcessed++
      } catch (err) {
        logger.error('[agent/process] Agent error', {
          creator: creatorAddress.slice(0, 10),
          error: err instanceof Error ? err.message : String(err),
        })
      } finally {
        try { await agent?.stop() } catch {}
      }
    }

    const elapsed = Date.now() - startTime
    logger.info('[agent/process] Complete', { agentsProcessed, totalProcessed, totalReplied, elapsed })

    return res.status(200).json({
      success: true,
      data: {
        agents: agentsProcessed,
        processed: totalProcessed,
        replied: totalReplied,
        elapsedMs: elapsed,
      },
    } satisfies ApiEnvelope<any>)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Processing failed'
    logger.error('[agent/process] Fatal error', { error: message })
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
