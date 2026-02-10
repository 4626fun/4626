/**
 * CreatorVault ElizaOS Agent
 *
 * Entry point that creates an ElizaOS agent runtime with:
 * - XMTP connector plugin (message streaming)
 * - Keepr plugin (vault actions)
 * - CreatorVault character (personality)
 *
 * Usage:
 *   # With all env vars set:
 *   pnpm dev
 *
 *   # Or directly:
 *   XMTP_AGENT_PRIVATE_KEY=0x... DATABASE_URL=... tsx src/index.ts
 *
 * Required env vars:
 *   XMTP_AGENT_PRIVATE_KEY  — Hex-encoded private key for the XMTP agent
 *   DATABASE_URL             — Postgres connection string (Supabase)
 *
 * Optional env vars:
 *   XMTP_ENV                — 'production' | 'dev' (default: production)
 *   GROQ_API_KEY            — Groq LLM provider
 *   OPENAI_API_KEY          — OpenAI LLM provider
 *   ANTHROPIC_API_KEY       — Anthropic LLM provider
 *   GOOGLE_AI_API_KEY       — Google Gemini provider
 *   OPENROUTER_API_KEY      — OpenRouter provider
 */

import { xmtpPlugin, getXmtpService } from './plugins/xmtp/index.js'
import { keeprPlugin } from './plugins/keepr/index.js'
import { lensPlugin } from './plugins/lens/index.js'
import { walletIntelPlugin } from './plugins/walletIntel/index.js'
import { reputationPlugin } from './plugins/reputation/index.js'
import { creatorVaultCharacter } from './character.js'

// ---------------------------------------------------------------------------
// Minimal runtime bridge
// ---------------------------------------------------------------------------
// ElizaOS's full runtime requires @elizaos/core which needs bun + Node 23+.
// For compatibility with our existing stack (Node 22, pnpm), we use a
// lightweight bridge that:
//   1. Initializes the XMTP plugin (message streaming)
//   2. Routes incoming messages through our action handlers
//   3. Falls back to LLM for conversational replies
//
// When migrating to full ElizaOS, replace this with AgentRuntime.
// ---------------------------------------------------------------------------

type LlmProvider = {
  name: string
  envKey: string
  apiUrl: string
  model: string
  transformBody?: (messages: any[]) => any
  extractContent?: (json: any) => string | null
}

export { lensPlugin, walletIntelPlugin, reputationPlugin }

const PROVIDERS: LlmProvider[] = [
  {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
  },
  {
    name: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
  },
  {
    name: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-haiku-20241022',
    transformBody: (messages) => ({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      system: messages.find((m: any) => m.role === 'system')?.content ?? '',
      messages: messages.filter((m: any) => m.role !== 'system'),
    }),
    extractContent: (json) => json?.content?.[0]?.text ?? null,
  },
  {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct',
  },
]

function resolveProvider(): LlmProvider | null {
  for (const p of PROVIDERS) {
    if ((process.env[p.envKey] ?? '').trim()) return p
  }
  return null
}

async function generateLlmResponse(
  userMessage: string,
  systemPrompt: string,
  vaultContext: string,
): Promise<string | null> {
  const provider = resolveProvider()
  if (!provider) return null

  const apiKey = (process.env[provider.envKey] ?? '').trim()
  const messages = [
    { role: 'system', content: `${systemPrompt}\n\n${vaultContext}` },
    { role: 'user', content: userMessage },
  ]

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (provider.name === 'Anthropic') {
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  const body = provider.transformBody
    ? provider.transformBody(messages)
    : { model: provider.model, messages, max_tokens: 512, temperature: 0.7 }

  try {
    const res = await fetch(provider.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const json = (await res.json()) as any
    return provider.extractContent
      ? provider.extractContent(json)
      : json?.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Message router
// ---------------------------------------------------------------------------

async function handleMessage(msg: {
  conversationId: string
  conversationType: string
  senderAddress: string | null
  content: string
}): Promise<string | null> {
  const text = msg.content.trim()
  const lower = text.toLowerCase()

  // Route to all plugin actions (Keepr, Lens, Wallet Intel, Reputation)
  const allActions = [
    ...(keeprPlugin.actions ?? []),
    ...(lensPlugin.actions ?? []),
    ...(walletIntelPlugin.actions ?? []),
    ...(reputationPlugin.actions ?? []),
  ]

  for (const action of allActions) {
    const fakeMemory = {
      content: {
        text,
        metadata: {
          conversationId: msg.conversationId,
          conversationType: msg.conversationType,
          senderAddress: msg.senderAddress,
        },
      },
    } as any

    const matches = await action.validate({} as any, fakeMemory)
    if (matches) {
      const parts: string[] = []
      await action.handler(
        {} as any,
        fakeMemory,
        undefined,
        undefined,
        async (content: any) => {
          if (content?.text) parts.push(content.text)
          return []
        },
      )
      return parts.join('\n\n') || null
    }
  }

  // Check if it looks like an AI request
  const isAi =
    lower.startsWith('/ai') ||
    lower.startsWith('@keepr') ||
    lower.startsWith('@bot')

  if (!isAi) return null // Not a command or AI trigger — ignore

  // Strip the trigger prefix
  const cleanText = text
    .replace(/^\/?ai\s*/i, '')
    .replace(/^@keepr\s*/i, '')
    .replace(/^@bot\s*/i, '')
    .trim()

  if (!cleanText) return 'Ask me anything about this vault or DeFi on Base.'

  // Get vault context
  let vaultContext = ''
  for (const provider of keeprPlugin.providers ?? []) {
    const result = await provider.get(
      {} as any,
      {
        content: {
          text: cleanText,
          metadata: {
            conversationId: msg.conversationId,
            conversationType: msg.conversationType,
          },
        },
      } as any,
      {} as any,
    )
    if (result?.text) vaultContext += result.text + '\n'
  }

  const reply = await generateLlmResponse(
    cleanText,
    creatorVaultCharacter.system,
    vaultContext,
  )

  return reply ?? "I couldn't generate a response right now. Try again later."
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  CreatorVault ElizaOS Agent')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const privateKey = (process.env.XMTP_AGENT_PRIVATE_KEY ?? '').trim()
  if (!privateKey) {
    console.error('XMTP_AGENT_PRIVATE_KEY is required')
    process.exit(1)
  }

  const dbUrl = (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    ''
  ).trim()
  if (!dbUrl) {
    console.warn('No DATABASE_URL set — vault commands will be limited')
  }

  const llmProvider = resolveProvider()
  const plugins = [keeprPlugin, lensPlugin, walletIntelPlugin, reputationPlugin]
  const actionCount = plugins.reduce((n, p) => n + (p.actions?.length ?? 0), 0)
  console.log(`  LLM provider: ${llmProvider?.name ?? 'none (conversational AI disabled)'}`)
  console.log(`  XMTP env: ${process.env.XMTP_ENV ?? 'production'}`)
  console.log(`  Character: ${creatorVaultCharacter.name}`)
  console.log(`  Plugins: ${plugins.map(p => p.name).join(', ')}`)
  console.log(`  Actions: ${actionCount} total`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Initialize XMTP plugin
  const xmtpEnv = (process.env.XMTP_ENV ?? 'production') as 'production' | 'dev' | 'local'

  // We bypass the full ElizaOS runtime init and directly start the service
  const { XmtpService } = await import('./plugins/xmtp/service.js')
  const xmtp = new XmtpService({
    privateKey: privateKey as `0x${string}`,
    env: xmtpEnv,
  })

  xmtp.setMessageHandler(async (msg) => {
    console.log(
      `[${msg.conversationType}] ${msg.senderAddress?.slice(0, 10) ?? msg.senderInboxId.slice(0, 10)}: ${msg.content.slice(0, 80)}`,
    )

    return handleMessage({
      conversationId: msg.conversationId,
      conversationType: msg.conversationType,
      senderAddress: msg.senderAddress,
      content: msg.content,
    })
  })

  await xmtp.start()

  console.log(`\n  Agent address: ${xmtp.address}`)
  console.log(`  Test: https://xmtp.chat/dm/${xmtp.address}`)
  console.log(`\n  Listening for messages... (Ctrl+C to stop)\n`)

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...')
    await xmtp.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown())
  process.on('SIGTERM', () => void shutdown())
}

void main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
