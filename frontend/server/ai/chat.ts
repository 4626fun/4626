import { logger } from '../_lib/logger.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'
import { toAgentError } from '../agent/eliza/_errors.js'
import { getElizaLlmService } from '../agent/eliza/llm.js'
import { createRuntimeBridge } from '../agent/eliza/runtimeBridge.js'

const llmService = getElizaLlmService()
const CHAT_MEMORY_AGENT_KEY = 'keepr-ai-chat'
const HISTORY_TURN_LIMIT = 10
const HISTORY_CHAR_BUDGET = 1_800
const conversationMemoryBridge = createRuntimeBridge({
  agentKey: CHAT_MEMORY_AGENT_KEY,
  plugins: [],
  history: {
    maxConversations: 500,
    maxMessagesPerConversation: 40,
  },
})

// ---------------------------------------------------------------------------
// Rate limiting – one LLM call per group every 10 s
// ---------------------------------------------------------------------------
const groupCooldowns = new Map<string, number>()
const LLM_COOLDOWN_MS = 10_000

function canCallLlm(groupId: string): boolean {
  const last = groupCooldowns.get(groupId)
  if (!last) return true
  return Date.now() - last >= LLM_COOLDOWN_MS
}

function recordLlmCall(groupId: string): void {
  groupCooldowns.set(groupId, Date.now())
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(vault: KeeprVaultRow | null): string {
  const base = [
    'You are a helpful 4626 assistant in a messaging conversation (Telegram, XMTP, or similar).',
    'Keep responses concise (2-3 sentences max).',
    'Be factual and helpful. Do NOT make financial guarantees or investment recommendations.',
    'Do NOT hallucinate features that do not exist.',
    'If you are unsure, say so.',
    'Use provided conversation history context when available to maintain continuity.',
    'When asked about memory, explain that you can reference prior turns from this conversation context.',
    'Do not claim "I cannot remember previous messages" if conversation history in this thread is available.',
    'Be explicit that continuity may be limited outside this conversation context.',
  ]

  if (vault) {
    base.push(
      '',
      'Vault context:',
      `- Vault address: ${vault.vaultAddress}`,
      `- Chain: Base (${vault.chainId})`,
      `- Creator: ${vault.canonicalOwnerAddress}`,
      `- Creator coin: ${vault.creatorCoinAddress}`,
      `- Gating: ${vault.gatingEnabled ? `enabled (${vault.gatingMode})` : 'disabled'}`,
      `- Min shares: ${vault.minShares ?? 'none'}`,
      '',
      'Commands available in this chat:',
      '- /keepr help — vault commands',
      '- /keepr status — vault info',
      '- /keepr check — share eligibility',
      '- /fc profile <user> — Farcaster lookup',
      '- /fc stats — Farcaster stats',
      '- /send <amount> USDC to <address> — token transfer (ADMIN/OWNER)',
    )
  }

  return base.join('\n')
}

type ConversationTurn = { role: 'user' | 'assistant'; text: string }

function normalizeHistoryText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

function resolveConversationType(groupId: string): string {
  const normalized = groupId.trim().toLowerCase()
  if (normalized.startsWith('telegram:')) return 'telegram'
  if (normalized.startsWith('discord:')) return 'discord'
  if (normalized.startsWith('farcaster:')) return 'farcaster'
  if (normalized.startsWith('xmtp')) return 'xmtp'
  return 'group'
}

function extractRecentTurns(state: Record<string, unknown>): ConversationTurn[] {
  const recent = Array.isArray((state as any)?.recentMessages) ? (state as any).recentMessages : []
  const turns: ConversationTurn[] = []
  for (const entry of recent) {
    const role = String((entry as any)?.role ?? '').trim().toLowerCase()
    const text = normalizeHistoryText((entry as any)?.text)
    if (!text) continue
    if (role === 'assistant') {
      turns.push({ role: 'assistant', text })
      continue
    }
    turns.push({ role: 'user', text })
  }
  return turns
}

function trimTrailingCurrentUserTurn(turns: ConversationTurn[], currentText: string): ConversationTurn[] {
  const normalizedCurrent = normalizeHistoryText(currentText)
  if (!normalizedCurrent || turns.length === 0) return turns
  const last = turns[turns.length - 1]
  if (!last) return turns
  if (last.role === 'user' && normalizeHistoryText(last.text) === normalizedCurrent) {
    return turns.slice(0, -1)
  }
  return turns
}

function buildConversationHistoryContext(turns: ConversationTurn[]): string {
  if (!turns.length) return ''
  const boundedTurns = turns.slice(-HISTORY_TURN_LIMIT)
  const lines: string[] = []
  let usedChars = 0
  for (let i = boundedTurns.length - 1; i >= 0; i -= 1) {
    const turn = boundedTurns[i]
    if (!turn) continue
    const line = `${turn.role}: ${turn.text}`
    if (!line) continue
    const additional = line.length + 1
    if (usedChars + additional > HISTORY_CHAR_BUDGET && lines.length > 0) break
    if (usedChars + additional > HISTORY_CHAR_BUDGET && lines.length === 0) {
      lines.unshift(line.slice(0, Math.max(1, HISTORY_CHAR_BUDGET - 1)).trimEnd() + '…')
      usedChars = HISTORY_CHAR_BUDGET
      break
    }
    lines.unshift(line)
    usedChars += additional
  }
  if (!lines.length) return ''
  return [
    '[conversation_history]',
    'Prior turns from this same conversation. Use them to preserve context and references.',
    ...lines,
    '[/conversation_history]',
  ].join('\n')
}

export async function generateLlmResponse(params: {
  groupId: string
  senderWallet: string
  text: string
  vault: KeeprVaultRow | null
}): Promise<{ ok: true; response: string } | { ok: false; response: string }> {
  if (!canCallLlm(params.groupId)) {
    return { ok: false, response: 'AI is rate-limited. Try again in a few seconds.' }
  }

  if (llmService.getAvailableProviders().length === 0) {
    return { ok: false, response: '' }
  }

  try {
    recordLlmCall(params.groupId)
    const identityHint = `[${params.senderWallet.slice(0, 6)}...${params.senderWallet.slice(-4)}]`
    const conversationType = resolveConversationType(params.groupId)
    let historyContext = ''
    let historyTurns = 0
    let memoryEnabled = true
    try {
      const inbound = conversationMemoryBridge.createInboundMemory({
        conversationId: params.groupId,
        conversationType,
        senderAddress: params.senderWallet,
        content: params.text,
      })
      await conversationMemoryBridge.runtime.createMemory(inbound as any, 'messages' as any)
      const state = await conversationMemoryBridge.composeState(inbound as any)
      const turns = trimTrailingCurrentUserTurn(extractRecentTurns(state), params.text)
      historyTurns = turns.length
      historyContext = buildConversationHistoryContext(turns)
      logger.info('[ai/chat] conversation memory loaded', {
        groupId: params.groupId,
        turns: historyTurns,
      })
    } catch (error) {
      memoryEnabled = false
      logger.warn('[ai/chat] conversation memory unavailable; falling back to stateless prompt', {
        groupId: params.groupId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const result = await llmService.generateResponse({
      agentKey: params.groupId,
      userMessage: `${identityHint}: ${params.text}`,
      systemPrompt: buildSystemPrompt(params.vault),
      vaultContext: historyContext,
      correlationId: `keepr-${params.groupId}-${Date.now()}`,
    })

    if (!result.text?.trim()) {
      return { ok: false, response: '' }
    }

    if (memoryEnabled) {
      try {
        const outbound = conversationMemoryBridge.createOutboundMemory(
          params.groupId,
          conversationType,
          result.text.trim(),
        )
        await conversationMemoryBridge.runtime.createMemory(outbound as any, 'messages' as any)
      } catch (error) {
        logger.warn('[ai/chat] assistant memory persistence failed (non-blocking)', {
          groupId: params.groupId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('[ai/chat] Unified Eliza LLM response', {
      groupId: params.groupId,
      provider: result.provider,
      historyTurns,
    })
    return { ok: true, response: result.text.trim() }
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'LLM generation failed')
    if (agentError.code === 'BUDGET_EXCEEDED') {
      return { ok: false, response: 'Daily AI budget limit reached for this agent. Please try again tomorrow.' }
    }
    if (agentError.code === 'RATE_LIMITED') {
      return { ok: false, response: 'AI provider is rate-limited. Please try again shortly.' }
    }
    if (agentError.code === 'UPSTREAM_TIMEOUT') {
      return { ok: false, response: 'AI request timed out. Please retry.' }
    }
    if (agentError.code === 'DEPENDENCY_UNAVAILABLE') {
      return { ok: false, response: 'AI provider is temporarily unavailable. Please retry shortly.' }
    }
    logger.error('[ai/chat] Unified Eliza LLM call failed', {
      code: agentError.code,
      message: agentError.message,
    })
    return { ok: false, response: '' }
  }
}
