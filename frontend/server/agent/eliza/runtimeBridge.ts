import { createHash, randomUUID } from 'node:crypto'
import type { IAgentRuntime, Memory, Plugin } from '@elizaos/core'

import { getDb } from '../../_lib/postgres.js'
import { buildRuntimeSessionContext } from '../../_lib/session.js'
import { logger } from '../../_lib/logger.js'

type InboundMessage = {
  conversationId: string
  conversationType: string
  senderAddress: string | null
  content: string
}

type RankedAction = {
  action: any
  score: number
  reason: string
}

type RuntimeBridge = {
  runtime: IAgentRuntime
  createInboundMemory: (msg: InboundMessage) => Memory
  createOutboundMemory: (conversationId: string, conversationType: string, content: string) => Memory
  composeState: (memory: Memory) => Promise<Record<string, unknown>>
  rankActions: (text: string, memory: Memory) => Promise<RankedAction[]>
  getDebugState: () => { trackedConversations: number; conversationIds: string[] }
}

const AGENT_MEMORY_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS agent_message_memory (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    entity_id TEXT,
    role TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    conversation_type TEXT,
    sender_address TEXT,
    content TEXT NOT NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`

const AGENT_MEMORY_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS agent_message_memory_conversation_created_idx
    ON agent_message_memory (conversation_id, created_at DESC);
`

const AGENT_MEMORY_RLS_SQL = `
  ALTER TABLE agent_message_memory ENABLE ROW LEVEL SECURITY;
`

const AGENT_MEMORY_POLICY_SQL = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'agent_message_memory'
        AND policyname = 'agent_message_memory_deny_all'
    ) THEN
      CREATE POLICY agent_message_memory_deny_all
        ON agent_message_memory
        FOR ALL
        TO public
        USING (false)
        WITH CHECK (false);
    END IF;
  END
  $$;
`

let memorySchemaEnsured = false

function shortHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32)
}

function formatAsUuid(hex32: string): string {
  const h = hex32.padEnd(32, '0')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function toEntityId(senderAddress: string | null): string {
  if (!senderAddress) return randomUUID()
  return formatAsUuid(shortHash(senderAddress.toLowerCase()))
}

function toRoomId(conversationId: string): string {
  return formatAsUuid(shortHash(conversationId))
}

function asAddress(value: string | null | undefined): `0x${string}` | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw as `0x${string}`
}

async function ensureMemorySchema(): Promise<void> {
  if (memorySchemaEnsured) return
  const db = await getDb()
  if (!db) return
  if (typeof (db as any).query === 'function') {
    await (db as any).query(AGENT_MEMORY_TABLE_SQL)
    try {
      await (db as any).query(AGENT_MEMORY_RLS_SQL)
    } catch {
      // Ignore if RLS cannot be enabled in this runtime.
    }
    try {
      await (db as any).query(AGENT_MEMORY_POLICY_SQL)
    } catch {
      // Ignore if policy creation is unavailable in this runtime.
    }
    await (db as any).query(AGENT_MEMORY_INDEX_SQL)
  } else {
    const tableStmt = [AGENT_MEMORY_TABLE_SQL] as unknown as TemplateStringsArray
    ;(tableStmt as any).raw = [AGENT_MEMORY_TABLE_SQL]
    const rlsStmt = [AGENT_MEMORY_RLS_SQL] as unknown as TemplateStringsArray
    ;(rlsStmt as any).raw = [AGENT_MEMORY_RLS_SQL]
    const policyStmt = [AGENT_MEMORY_POLICY_SQL] as unknown as TemplateStringsArray
    ;(policyStmt as any).raw = [AGENT_MEMORY_POLICY_SQL]
    const indexStmt = [AGENT_MEMORY_INDEX_SQL] as unknown as TemplateStringsArray
    ;(indexStmt as any).raw = [AGENT_MEMORY_INDEX_SQL]
    await (db as any).sql(tableStmt)
    try {
      await (db as any).sql(rlsStmt)
    } catch {
      // Ignore if RLS cannot be enabled in this runtime.
    }
    try {
      await (db as any).sql(policyStmt)
    } catch {
      // Ignore if policy creation is unavailable in this runtime.
    }
    await (db as any).sql(indexStmt)
  }
  memorySchemaEnsured = true
}

function actionScoreFromMessage(actionName: string, text: string): { score: number; reason: string } {
  const normalizedName = actionName.toLowerCase()
  const normalizedText = text.toLowerCase()

  if (normalizedText.startsWith('/cre') && normalizedName.includes('cre')) {
    return { score: 0.95, reason: 'prefix_/cre' }
  }
  if (normalizedText.startsWith('/lens') && normalizedName.includes('lens')) {
    return { score: 0.92, reason: 'prefix_/lens' }
  }
  if (normalizedText.startsWith('/coin') && normalizedName.includes('zora')) {
    return { score: 0.9, reason: 'prefix_/coin' }
  }
  if (normalizedText.startsWith('/uniswap') && normalizedName.includes('uniswap')) {
    return { score: 0.93, reason: 'prefix_/uniswap' }
  }
  if (normalizedText.startsWith('/keepr') && normalizedName.includes('keepr')) {
    return { score: 0.9, reason: 'prefix_/keepr' }
  }
  if (
    (normalizedText.startsWith('/intel') ||
      normalizedText.startsWith('/funder') ||
      normalizedText.startsWith('/portfolio') ||
      normalizedText.startsWith('/labels')) &&
    normalizedName.includes('wallet')
  ) {
    return { score: 0.88, reason: 'wallet_intel_prefix' }
  }
  if (
    (normalizedText.startsWith('/reputation') || normalizedText.startsWith('/feedback')) &&
    normalizedName.includes('reputation')
  ) {
    return { score: 0.87, reason: 'reputation_prefix' }
  }
  if (
    (normalizedText.startsWith('/knowledge') || normalizedText.startsWith('/kb')) &&
    normalizedName.includes('knowledge')
  ) {
    return { score: 0.86, reason: 'knowledge_prefix' }
  }
  return { score: 0.65, reason: 'validated_action' }
}

export function createRuntimeBridge(params: {
  agentKey: string
  plugins: Plugin[]
  settings?: Record<string, string>
  character?: {
    systemPrompt: string
    preferredModel?: string
  }
  history?: {
    maxConversations?: number
    maxMessagesPerConversation?: number
  }
}): RuntimeBridge {
  const inMemoryHistory = new Map<string, Memory[]>()
  const maxConversations = Math.max(1, Math.floor(params.history?.maxConversations ?? 250))
  const maxMessagesPerConversation = Math.max(1, Math.floor(params.history?.maxMessagesPerConversation ?? 30))
  const runtimeAgentId = formatAsUuid(shortHash(`agent:${params.agentKey}`))

  const trimHistoryBuckets = () => {
    while (inMemoryHistory.size > maxConversations) {
      const oldestKey = inMemoryHistory.keys().next().value
      if (!oldestKey) break
      inMemoryHistory.delete(oldestKey)
    }
  }

  const setConversationHistory = (conversationId: string, entries: Memory[]) => {
    inMemoryHistory.delete(conversationId)
    inMemoryHistory.set(conversationId, entries.slice(-maxMessagesPerConversation))
    trimHistoryBuckets()
  }

  const runtime = {
    agentId: runtimeAgentId,
    getSetting: (key: string) => {
      const fromOverride = params.settings?.[key]
      if (typeof fromOverride === 'string') return fromOverride
      const fromEnv = process.env[key]
      return typeof fromEnv === 'string' ? fromEnv : undefined
    },
    createMemory: async (memory: Memory) => {
      await ensureMemorySchema()
      const conversationId = String((memory.content as any)?.metadata?.conversationId ?? memory.roomId ?? 'unknown')
      const existing = inMemoryHistory.get(conversationId) ?? []
      existing.push(memory)
      setConversationHistory(conversationId, existing)

      const db = await getDb()
      if (!db) return memory
      try {
        await db.sql`
          INSERT INTO agent_message_memory (
            id, agent_id, room_id, entity_id, role, conversation_id, conversation_type, sender_address, content, metadata_json
          ) VALUES (
            ${String(memory.id)},
            ${String(memory.agentId ?? runtimeAgentId)},
            ${String(memory.roomId ?? '')},
            ${String(memory.entityId ?? '')},
            ${String((memory.content as any)?.role ?? 'user')},
            ${conversationId},
            ${String((memory.content as any)?.metadata?.conversationType ?? '')},
            ${String((memory.content as any)?.metadata?.senderAddress ?? '')},
            ${String((memory.content as any)?.text ?? '')},
            ${JSON.stringify((memory.content as any)?.metadata ?? {})}::jsonb
          )
          ON CONFLICT (id) DO NOTHING;
        `
      } catch (error) {
        logger.warn('[eliza/runtime] failed to persist memory (non-blocking)', {
          agentKey: params.agentKey,
          conversationId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
      return memory
    },
  } as unknown as IAgentRuntime

  async function hydrateConversationHistoryFromDb(conversationId: string): Promise<Memory[]> {
    const db = await getDb()
    if (!db) return []
    try {
      const result = await db.sql`
        SELECT
          id,
          room_id,
          entity_id,
          role,
          conversation_id,
          conversation_type,
          sender_address,
          content,
          metadata_json,
          created_at
        FROM agent_message_memory
        WHERE agent_id = ${runtimeAgentId}
          AND conversation_id = ${conversationId}
        ORDER BY created_at DESC
        LIMIT 20;
      `
      const rows = ((result.rows ?? []) as any[]).slice().reverse()
      return rows.map((row) => {
        const metadata =
          row?.metadata_json && typeof row.metadata_json === 'object'
            ? row.metadata_json
            : {}
        const createdAtMs = row?.created_at ? new Date(row.created_at).getTime() : Date.now()
        return {
          id: String(row?.id ?? randomUUID()) as any,
          entityId: String(row?.entity_id ?? '') as any,
          agentId: runtimeAgentId as any,
          roomId: String(row?.room_id ?? toRoomId(conversationId)) as any,
          content: {
            text: String(row?.content ?? ''),
            role: String(row?.role ?? 'user'),
            source: 'xmtp',
            metadata: {
              ...metadata,
              conversationId: String(row?.conversation_id ?? conversationId),
              conversationType: String(row?.conversation_type ?? metadata?.conversationType ?? 'unknown'),
              senderAddress: row?.sender_address ? String(row.sender_address) : null,
            },
          } as any,
          createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
        } as Memory
      })
    } catch (error) {
      logger.warn('[eliza/runtime] failed loading persisted history (non-blocking)', {
        agentKey: params.agentKey,
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  async function composeState(memory: Memory): Promise<Record<string, unknown>> {
    const metadata = (memory.content as any)?.metadata ?? {}
    const conversationId = String(metadata.conversationId ?? memory.roomId ?? 'unknown')
    let history = inMemoryHistory.get(conversationId) ?? []
    if (history.length === 0) {
      const restored = await hydrateConversationHistoryFromDb(conversationId)
      if (restored.length > 0) {
        history = restored
        setConversationHistory(conversationId, restored)
      }
    }
    const recentMessages = history.slice(-12).map((entry) => {
      return {
        text: String((entry.content as any)?.text ?? ''),
        role: String((entry.content as any)?.role ?? 'user'),
        createdAt: Number(entry.createdAt ?? Date.now()),
      }
    })
    const senderAddress = asAddress(metadata.senderAddress)
    const session = buildRuntimeSessionContext(senderAddress)
    return {
      agentKey: params.agentKey,
      conversationId,
      conversationType: metadata.conversationType ?? 'unknown',
      recentMessages,
      session,
      character: {
        systemPrompt: params.character?.systemPrompt ?? '',
        preferredModel: params.character?.preferredModel ?? null,
      },
    }
  }

  function clampScore(score: number): number {
    if (!Number.isFinite(score)) return 0
    if (score < 0) return 0
    if (score > 1) return 1
    return score
  }

  async function evaluatorAdjustment(params0: {
    plugin: Plugin
    actionName: string
    memory: Memory
    state: Record<string, unknown>
  }): Promise<{ delta: number; reason: string | null }> {
    const evaluators = Array.isArray((params0.plugin as any)?.evaluators)
      ? ((params0.plugin as any).evaluators as any[])
      : []
    if (evaluators.length === 0) return { delta: 0, reason: null }

    let delta = 0
    let reason: string | null = null

    for (const evaluator of evaluators) {
      try {
        const targets = Array.isArray(evaluator?.actions)
          ? evaluator.actions.map((v: unknown) => String(v).toLowerCase())
          : []
        if (targets.length > 0 && !targets.includes(params0.actionName.toLowerCase())) continue

        if (typeof evaluator?.validate === 'function') {
          const valid = await Promise.race([
            evaluator.validate(runtime as any, params0.memory as any, params0.state as any),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2_000)),
          ])
          if (!valid) continue
        }

        const run = typeof evaluator?.evaluate === 'function'
          ? evaluator.evaluate(runtime as any, params0.memory as any, params0.state as any)
          : typeof evaluator?.handler === 'function'
            ? evaluator.handler(runtime as any, params0.memory as any, params0.state as any)
            : null
        if (!run) continue

        const evaluated = await Promise.race([
          Promise.resolve(run),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2_500)),
        ])

        if (typeof evaluated === 'number' && Number.isFinite(evaluated)) {
          delta += Math.max(-0.25, Math.min(0.25, evaluated))
          reason = String(evaluator?.name ?? 'evaluator')
          continue
        }

        if (evaluated && typeof evaluated === 'object') {
          const maybeScore = Number((evaluated as any).score)
          if (Number.isFinite(maybeScore)) {
            // Treat 0..1 as an absolute confidence and convert to signed boost.
            const signed =
              maybeScore >= 0 && maybeScore <= 1
                ? (maybeScore - 0.5) * 0.4
                : maybeScore
            delta += Math.max(-0.25, Math.min(0.25, signed))
            reason = String((evaluated as any).reason ?? evaluator?.name ?? 'evaluator')
          }
        }
      } catch (error) {
        logger.warn('[eliza/runtime] evaluator failed (non-blocking)', {
          action: params0.actionName,
          evaluator: String((evaluator as any)?.name ?? 'unknown'),
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return { delta, reason }
  }

  async function rankActions(text: string, memory: Memory): Promise<RankedAction[]> {
    const state = await composeState(memory)
    const ranked: RankedAction[] = []
    for (const plugin of params.plugins) {
      for (const action of plugin.actions ?? []) {
        let matches = false
        try {
          const validateResult = await Promise.race([
            action.validate(runtime as any, memory as any),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3_000)),
          ])
          matches = Boolean(validateResult)
        } catch (error) {
          logger.warn('[eliza/runtime] action validate failed', {
            action: String(action?.name ?? 'unknown'),
            error: error instanceof Error ? error.message : String(error),
          })
        }
        if (!matches) continue
        const actionName = String(action?.name ?? 'unknown')
        const { score: baseScore, reason: baseReason } = actionScoreFromMessage(actionName, text)
        const evalAdjust = await evaluatorAdjustment({
          plugin,
          actionName,
          memory,
          state,
        })
        const score = clampScore(baseScore + evalAdjust.delta)
        const reason = evalAdjust.reason ? `${baseReason}+${evalAdjust.reason}` : baseReason
        ranked.push({ action, score, reason })
      }
    }
    ranked.sort((a, b) => b.score - a.score)
    return ranked
  }

  function createInboundMemory(msg: InboundMessage): Memory {
    return {
      id: randomUUID() as any,
      entityId: toEntityId(msg.senderAddress) as any,
      agentId: runtimeAgentId as any,
      roomId: toRoomId(msg.conversationId) as any,
      content: {
        text: msg.content,
        role: 'user',
        source: 'xmtp',
        metadata: {
          conversationId: msg.conversationId,
          conversationType: msg.conversationType,
          senderAddress: msg.senderAddress,
        },
      } as any,
      createdAt: Date.now(),
    } as Memory
  }

  function createOutboundMemory(conversationId: string, conversationType: string, content: string): Memory {
    return {
      id: randomUUID() as any,
      entityId: runtimeAgentId as any,
      agentId: runtimeAgentId as any,
      roomId: toRoomId(conversationId) as any,
      content: {
        text: content,
        role: 'assistant',
        source: 'xmtp',
        metadata: {
          conversationId,
          conversationType,
          senderAddress: null,
        },
      } as any,
      createdAt: Date.now(),
    } as Memory
  }

  return {
    runtime,
    createInboundMemory,
    createOutboundMemory,
    composeState,
    rankActions,
    getDebugState: () => ({
      trackedConversations: inMemoryHistory.size,
      conversationIds: [...inMemoryHistory.keys()],
    }),
  }
}

