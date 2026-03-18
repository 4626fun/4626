import { logger } from '../_lib/logger.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'
import { toAgentError } from '../agent/eliza/_errors.js'
import { getActionRetryBudget } from '../agent/eliza/_runtimePolicy.js'
import { withRetry, withTimeout } from '../agent/eliza/_retry.js'
import { buildContinuityContextBlock } from '../agent/eliza/_stateHelpers.js'
import { resolveCharacterRuntimeConfig } from '../agent/eliza/character.js'
import { getElizaLlmService } from '../agent/eliza/llm.js'
import { createRuntimeBridge } from '../agent/eliza/runtimeBridge.js'
import { parsePositiveNumber } from '../agent/eliza/_rateLimit.js'
import { formatNumberedCommandFallback } from '../_lib/chatCommandFallback.js'

const llmService = getElizaLlmService()
const CHAT_MEMORY_AGENT_KEY = 'keepr-ai-chat'

const ACTION_TIMEOUT_MS = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_ACTION_TIMEOUT_MS, 30_000))
const ACTION_MAX_CANDIDATES = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_ACTION_MAX_CANDIDATES, 2))
const ACTION_MAX_RETRIES = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_ACTION_MAX_RETRIES, 2))
const EXTERNAL_MAX_RETRIES = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_EXTERNAL_MAX_RETRIES, 2))
const MAX_INBOUND_MESSAGE_CHARS = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_MAX_INBOUND_CHARS, 4_000))
const LLM_COOLDOWN_MS = Math.floor(parsePositiveNumber(
  (globalThis as any).process?.env?.ELIZA_LLM_COOLDOWN_MS, 10_000))

const groupCooldowns = new Map<string, number>()

function canCallLlm(groupId: string): boolean {
  const last = groupCooldowns.get(groupId)
  if (!last) return true
  return Date.now() - last >= LLM_COOLDOWN_MS
}

function recordLlmCall(groupId: string): void {
  groupCooldowns.set(groupId, Date.now())
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatRuntimeBridge = ReturnType<typeof createRuntimeBridge>

type ChatRuntimeContext = {
  bridge: ChatRuntimeBridge
  contextProviders: Array<{ name?: string; get: (...args: any[]) => Promise<any> }>
  characterConfig: { systemPrompt: string; preferredModel?: string }
}

// ---------------------------------------------------------------------------
// Lazy singleton runtime context (bridge + providers + character config)
// ---------------------------------------------------------------------------

let runtimeContextPromise: Promise<ChatRuntimeContext> | null = null

async function getChatRuntimeContext(): Promise<ChatRuntimeContext> {
  if (runtimeContextPromise) return runtimeContextPromise
  runtimeContextPromise = (async () => {
    const [
      { keeprPlugin },
      { zoraPlugin },
      { uniswapPlugin },
      { bankrPlugin },
      { lensPlugin },
      { walletIntelPlugin },
      { reputationPlugin },
      { crePlugin },
      { knowledgePlugin },
    ] = await Promise.all([
      import('../agent/eliza/plugins/keepr/index.js'),
      import('../agent/eliza/plugins/zora/index.js'),
      import('../agent/eliza/plugins/uniswap/index.js'),
      import('../agent/eliza/plugins/bankr/index.js'),
      import('../agent/eliza/plugins/lens/index.js'),
      import('../agent/eliza/plugins/walletIntel/index.js'),
      import('../agent/eliza/plugins/reputation/index.js'),
      import('../agent/eliza/plugins/cre/index.js'),
      import('../agent/eliza/plugins/knowledge/index.js'),
    ])
    const characterRuntimeConfig = resolveCharacterRuntimeConfig()
    const plugins = [
      keeprPlugin,
      zoraPlugin,
      uniswapPlugin,
      bankrPlugin,
      lensPlugin,
      walletIntelPlugin,
      reputationPlugin,
      crePlugin,
      knowledgePlugin,
    ]
    const bridge = createRuntimeBridge({
      agentKey: CHAT_MEMORY_AGENT_KEY,
      plugins,
      settings: characterRuntimeConfig.settings,
      character: {
        systemPrompt: characterRuntimeConfig.systemPrompt,
        preferredModel: characterRuntimeConfig.preferredModel,
      },
      history: {
        maxConversations: 500,
        maxMessagesPerConversation: 40,
      },
    })
    const contextProviders = [
      ...(keeprPlugin.providers ?? []),
      ...(knowledgePlugin.providers ?? []),
    ]
    return {
      bridge,
      contextProviders,
      characterConfig: {
        systemPrompt: characterRuntimeConfig.systemPrompt,
        preferredModel: characterRuntimeConfig.preferredModel,
      },
    }
  })().catch((error) => {
    runtimeContextPromise = null
    throw error
  })
  return runtimeContextPromise
}

// ---------------------------------------------------------------------------
// Request normalization helpers (kept from original chat.ts)
// ---------------------------------------------------------------------------

function resolveConversationType(groupId: string): string {
  const normalized = groupId.trim().toLowerCase()
  if (normalized.startsWith('telegram:')) return 'telegram'
  if (normalized.startsWith('discord:')) return 'discord'
  if (normalized.startsWith('xmtp')) return 'xmtp'
  if (normalized.startsWith('web:') || normalized.startsWith('app:') || normalized.startsWith('chat:')) return 'web'
  return 'group'
}

function resolveConversationSource(conversationType: string): string {
  if (conversationType === 'web') return 'web'
  if (conversationType === 'xmtp') return 'xmtp'
  if (conversationType === 'telegram') return 'telegram'
  if (conversationType === 'discord') return 'discord'
  return 'app'
}

function normalizeAiPrompt(text: string): string {
  return String(text ?? '')
    .replace(/^\/?ai\s*/i, '')
    .replace(/^@(keepr|bot)\s*/i, '')
    .trim()
}

function toSenderAddress(senderWallet: string): string | null {
  const normalized = String(senderWallet ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) return null
  return normalized
}

// ---------------------------------------------------------------------------
// generateLlmResponse — thin adapter into the Eliza runtime pipeline
// ---------------------------------------------------------------------------

export async function generateLlmResponse(params: {
  groupId: string
  senderWallet: string
  text: string
  vault: KeeprVaultRow | null
}): Promise<{ ok: true; response: string; handledByRuntime: boolean } | { ok: false; response: string; handledByRuntime: boolean }> {
  const conversationType = resolveConversationType(params.groupId)
  const conversationSource = resolveConversationSource(conversationType)
  const normalizedPrompt = normalizeAiPrompt(params.text)
  const userText = normalizedPrompt || String(params.text ?? '').trim()

  if (!userText) {
    return { ok: false, response: '', handledByRuntime: false }
  }

  if (userText.length > MAX_INBOUND_MESSAGE_CHARS) {
    return {
      ok: false,
      response: `Message too long (${userText.length} chars). Max supported length is ${MAX_INBOUND_MESSAGE_CHARS}.`,
      handledByRuntime: false,
    }
  }

  let ctx: ChatRuntimeContext
  try {
    ctx = await getChatRuntimeContext()
  } catch (error) {
    logger.warn('[ai/chat] eliza runtime context unavailable; returning bounded fallback', {
      groupId: params.groupId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: true,
      response: "The assistant runtime is temporarily unavailable. Please try again shortly.",
      handledByRuntime: false,
    }
  }

  // -----------------------------------------------------------------------
  // 1. Persist inbound memory + compose state
  // -----------------------------------------------------------------------

  const senderAddress = toSenderAddress(params.senderWallet)
  let memory: any
  let state: Record<string, unknown>
  try {
    memory = ctx.bridge.createInboundMemory({
      conversationId: params.groupId,
      conversationType,
      senderAddress,
      source: conversationSource,
      entityKey: senderAddress ?? `web-user:${params.groupId}`,
      content: userText,
    })
    await ctx.bridge.runtime.createMemory(memory, 'messages' as any)
    state = await (ctx.bridge.runtime as any).composeState(memory)
  } catch (error) {
    logger.warn('[ai/chat] eliza runtime memory/state unavailable; returning bounded fallback', {
      groupId: params.groupId,
      error: error instanceof Error ? error.message : String(error),
    })
    return {
      ok: true,
      response: "The assistant runtime is temporarily unavailable. Please try again shortly.",
      handledByRuntime: false,
    }
  }

  // -----------------------------------------------------------------------
  // 2. Action ranking + candidate execution (mirrors handleMessage)
  // -----------------------------------------------------------------------

  try {
    const rankedActions = await ctx.bridge.rankActions(userText, memory)
    const candidates = rankedActions.slice(0, Math.max(1, ACTION_MAX_CANDIDATES))

    for (const candidate of candidates) {
      const actionName = String(candidate.action?.name ?? 'unknown')
      const parts: string[] = []
      try {
        const actionRetryBudget = getActionRetryBudget(actionName, ACTION_MAX_RETRIES)
        await withRetry({
          operation: `action_${actionName.toLowerCase()}`,
          maxRetries: actionRetryBudget,
          run: async () =>
            withTimeout(
              candidate.action.handler(
                ctx.bridge.runtime as any,
                memory,
                state,
                undefined,
                async (content: any) => {
                  if (content?.text) parts.push(String(content.text))
                  return []
                },
              ),
              ACTION_TIMEOUT_MS,
              `action_timeout_${actionName.toLowerCase()}`,
            ),
        })
        const actionReply = parts.join('\n\n').trim()
        if (actionReply) {
          try {
            const outbound = ctx.bridge.createOutboundMemory(
              params.groupId,
              conversationType,
              actionReply,
              { source: conversationSource },
            )
            await ctx.bridge.runtime.createMemory(outbound as any, 'messages' as any)
          } catch (memErr) {
            logger.warn('[ai/chat] action reply memory persistence failed (non-blocking)', {
              groupId: params.groupId,
              error: memErr instanceof Error ? memErr.message : String(memErr),
            })
          }
          logger.info('[ai/chat] action executed', {
            action: actionName,
            score: candidate.score,
            reason: candidate.reason,
          })
          return { ok: true, response: actionReply, handledByRuntime: true }
        }
      } catch (error) {
        const agentError = toAgentError(error, 'ACTION_FAILED', 'Action execution failed')
        logger.warn('[ai/chat] action candidate failed', {
          action: actionName,
          score: candidate.score,
          error: agentError.message,
          code: agentError.code,
        })
      }
    }
  } catch (error) {
    logger.warn('[ai/chat] action ranking failed (continuing to LLM fallback)', {
      groupId: params.groupId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  // -----------------------------------------------------------------------
  // 3. LLM fallback — only for /ai, @keepr, @bot, or plain text
  //    (slash commands that didn't match an action get a command fallback)
  // -----------------------------------------------------------------------

  const lower = userText.toLowerCase()
  const isAi =
    lower.startsWith('/ai') ||
    lower.startsWith('@keepr') ||
    lower.startsWith('@bot') ||
    !userText.startsWith('/')
  if (!isAi) {
    return {
      ok: false,
      response: formatNumberedCommandFallback({ intro: 'I did not recognize that slash command.' }),
      handledByRuntime: true,
    }
  }

  const cleanText = userText
    .replace(/^\/?ai\s*/i, '')
    .replace(/^@keepr\s*/i, '')
    .replace(/^@bot\s*/i, '')
    .trim()
  if (!cleanText) {
    return {
      ok: true,
      response: 'Ask me anything about this vault or DeFi on Base.',
      handledByRuntime: true,
    }
  }

  if (!canCallLlm(params.groupId)) {
    return {
      ok: false,
      response: 'AI is rate-limited. Try again in a few seconds.',
      handledByRuntime: true,
    }
  }

  if (llmService.getAvailableProviders().length === 0) {
    return { ok: false, response: '', handledByRuntime: true }
  }
  recordLlmCall(params.groupId)

  // -----------------------------------------------------------------------
  // 4. Gather context providers (keepr + knowledge) — same as handleMessage
  // -----------------------------------------------------------------------

  let vaultContext = ''
  for (const provider of ctx.contextProviders) {
    try {
      const result = await withRetry({
        operation: `context_provider_${String(provider.name ?? 'unknown').toLowerCase()}`,
        maxRetries: EXTERNAL_MAX_RETRIES,
        run: async () =>
          withTimeout(
            provider.get(ctx.bridge.runtime as any, memory, state),
            5_000,
            `context_provider_timeout_${String(provider.name ?? 'unknown').toLowerCase()}`,
          ),
      })
      if (result?.text) vaultContext += `${String(result.text).trim()}\n`
    } catch (error) {
      logger.warn('[ai/chat] context provider failed', {
        provider: String(provider.name ?? 'unknown'),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  if (senderAddress) {
    vaultContext +=
      '\n[wallet_context]\n' +
      `primary_sender_wallet=${senderAddress}\n` +
      'When the user says "my wallet", "my balance", or "my portfolio", default to this wallet unless they provide another address.\n' +
      '[/wallet_context]\n'
  }

  // -----------------------------------------------------------------------
  // 5. LLM generation with character systemPrompt + continuity context
  // -----------------------------------------------------------------------

  try {
    const continuityBlock = buildContinuityContextBlock(state)
    const correlationId = `keepr-${params.groupId}-${Date.now()}`
    const result = await withRetry({
      operation: 'llm_generate_response',
      maxRetries: EXTERNAL_MAX_RETRIES,
      run: async () => llmService.generateResponse({
        agentKey: params.groupId,
        userMessage: cleanText,
        systemPrompt: `${ctx.characterConfig.systemPrompt}\n\n${continuityBlock}`.trim(),
        vaultContext,
        correlationId,
        preferredModel: ctx.characterConfig.preferredModel,
      }),
    })
    const reply = result.text?.trim()
    if (!reply) {
      return { ok: false, response: '', handledByRuntime: true }
    }

    try {
      const outbound = ctx.bridge.createOutboundMemory(
        params.groupId,
        conversationType,
        reply,
        { source: conversationSource },
      )
      await ctx.bridge.runtime.createMemory(outbound as any, 'messages' as any)
    } catch (memErr) {
      logger.warn('[ai/chat] assistant memory persistence failed (non-blocking)', {
        groupId: params.groupId,
        error: memErr instanceof Error ? memErr.message : String(memErr),
      })
    }

    logger.info('[ai/chat] Eliza runtime response', {
      groupId: params.groupId,
      usedAction: false,
    })
    return { ok: true, response: reply, handledByRuntime: true }
  } catch (error) {
    const agentError = toAgentError(error, 'UPSTREAM_ERROR', 'LLM generation failed')
    if (agentError.code === 'BUDGET_EXCEEDED') {
      return { ok: false, response: 'Daily AI budget limit reached for this agent. Please try again tomorrow.', handledByRuntime: true }
    }
    if (agentError.code === 'RATE_LIMITED') {
      return { ok: false, response: 'AI provider is rate-limited. Please try again shortly.', handledByRuntime: true }
    }
    if (agentError.code === 'UPSTREAM_TIMEOUT') {
      return { ok: false, response: 'AI request timed out. Please retry.', handledByRuntime: true }
    }
    if (agentError.code === 'DEPENDENCY_UNAVAILABLE') {
      return { ok: false, response: 'AI provider is temporarily unavailable. Please retry shortly.', handledByRuntime: true }
    }
    logger.error('[ai/chat] Eliza LLM fallback failed', {
      code: agentError.code,
      message: agentError.message,
    })
    return { ok: false, response: '', handledByRuntime: true }
  }
}
