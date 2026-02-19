import { logger } from '../_lib/logger.js'
import type { KeeprVaultRow } from '../_lib/keeprRegistry.js'

declare const process: { env: Record<string, string | undefined> }

// ---------------------------------------------------------------------------
// Provider registry — checked in priority order, first configured key wins.
// All providers use OpenAI-compatible chat completions format.
// ---------------------------------------------------------------------------
type LlmProvider = {
  name: string
  envKey: string
  apiUrl: string
  model: string
  /** Optional extra headers (e.g. Anthropic version header) */
  extraHeaders?: Record<string, string>
  /** Transform request body if the provider deviates from OpenAI format */
  transformBody?: (body: Record<string, any>) => Record<string, any>
  /** Extract content from the response if it deviates from OpenAI format */
  extractContent?: (data: any) => string
}

const PROVIDERS: LlmProvider[] = [
  // 1. Groq — default (free tier, fast inference, OpenAI-compatible)
  {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  // 2. OpenAI
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  // 3. Anthropic (uses a slightly different format)
  {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
    transformBody: (body) => ({
      model: body.model,
      max_tokens: body.max_tokens,
      system: body.messages[0]?.content ?? '',
      messages: body.messages.slice(1).map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    }),
    extractContent: (data) => {
      const blocks = data?.content ?? []
      return blocks
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('')
    },
  },
  // 4. Google Gemini (OpenAI-compatible endpoint)
  {
    name: 'Google Gemini',
    envKey: 'GOOGLE_AI_API_KEY',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.0-flash',
  },
  // 5. OpenRouter (aggregator — one key, many models)
  {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct',
  },
]

const MAX_TOKENS = 200
const TEMPERATURE = 0.7

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------
type ResolvedProvider = LlmProvider & { apiKey: string }

function resolveProvider(): ResolvedProvider | null {
  for (const p of PROVIDERS) {
    const key = (process.env[p.envKey] ?? '').trim()
    if (key) return { ...p, apiKey: key }
  }
  return null
}

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

function recordLlmCall(groupId: string) {
  groupCooldowns.set(groupId, Date.now())
}

function parseBooleanFlag(raw: string | undefined): boolean {
  const normalized = String(raw ?? '').trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function getWeb4ContextLines(): string[] {
  const enabled = parseBooleanFlag(process.env.WEB4_CONWAY_ENABLED)
  const web4Url = String(process.env.WEB4_URL ?? 'https://web4.ai/').trim()
  const docsUrl = String(process.env.WEB4_CONWAY_DOCS_URL ?? 'https://docs.conway.tech/').trim()
  const cloudUrl = String(process.env.WEB4_CONWAY_CLOUD_URL ?? 'https://app.conway.tech/').trim()
  const openx402Url = String(process.env.WEB4_OPENX402_URL ?? 'https://openx402.ai/').trim()
  const x402Support = parseBooleanFlag(process.env.ERC8004_X402_SUPPORT)

  return [
    '',
    'Web4 / Conway integration:',
    `- Enabled: ${enabled ? 'yes' : 'no'}`,
    `- x402 support flag: ${x402Support ? 'yes' : 'no'}`,
    `- Web4: ${web4Url}`,
    `- Conway docs: ${docsUrl}`,
    `- Conway Cloud: ${cloudUrl}`,
    `- openx402: ${openx402Url}`,
    '- Use `/web4 status` for exact runtime integration status in chat.',
  ]
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(vault: KeeprVaultRow | null): string {
  const base = [
    'You are a helpful CreatorVault assistant in an XMTP group chat.',
    'Keep responses concise (2-3 sentences max).',
    'Be factual and helpful. Do NOT make financial guarantees or investment recommendations.',
    'Do NOT hallucinate features that do not exist.',
    'If you are unsure, say so.',
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
      '- /web4 status — Web4/Conway integration status',
    )
  }

  base.push(...getWeb4ContextLines())

  return base.join('\n')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an LLM response for a user message in a group chat.
 *
 * Provider priority: GROQ_API_KEY → OPENAI_API_KEY → ANTHROPIC_API_KEY
 *   → GOOGLE_AI_API_KEY → OPENROUTER_API_KEY
 *
 * Returns `{ ok: false, response: '' }` silently when no provider is
 * configured, rate-limited, or on error — the caller treats that as "no reply".
 */
export async function generateLlmResponse(params: {
  groupId: string
  senderWallet: string
  text: string
  vault: KeeprVaultRow | null
}): Promise<{ ok: true; response: string } | { ok: false; response: string }> {
  const provider = resolveProvider()
  if (!provider) {
    return { ok: false, response: '' }
  }

  if (!canCallLlm(params.groupId)) {
    return { ok: false, response: 'AI is rate-limited. Try again in a few seconds.' }
  }

  try {
    recordLlmCall(params.groupId)

    const messages = [
      { role: 'system', content: buildSystemPrompt(params.vault) },
      {
        role: 'user',
        content: `[${params.senderWallet.slice(0, 6)}...${params.senderWallet.slice(-4)}]: ${params.text}`,
      },
    ]

    let requestBody: Record<string, any> = {
      model: provider.model,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }

    if (provider.transformBody) {
      requestBody = provider.transformBody(requestBody)
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(provider.name === 'Anthropic'
        ? { 'x-api-key': provider.apiKey }
        : { Authorization: `Bearer ${provider.apiKey}` }),
      ...(provider.extraHeaders ?? {}),
    }

    const res = await fetch(provider.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!res.ok) {
      const text = await res.text()
      logger.error(`[ai/chat] ${provider.name} error`, { status: res.status, body: text.slice(0, 300) })
      return { ok: false, response: '' }
    }

    const data = (await res.json()) as any

    const content = provider.extractContent
      ? provider.extractContent(data)
      : (data?.choices?.[0]?.message?.content ?? '')

    if (!content.trim()) {
      return { ok: false, response: '' }
    }

    logger.info(`[ai/chat] ${provider.name} response`, { groupId: params.groupId, model: provider.model })
    return { ok: true, response: content.trim() }
  } catch (err) {
    logger.error(`[ai/chat] ${provider.name} call failed`, err)
    return { ok: false, response: '' }
  }
}
