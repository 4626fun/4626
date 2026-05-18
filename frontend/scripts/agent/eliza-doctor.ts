import path from 'node:path'
import { hasDedicatedMount, resolveXmtpDbDirectory } from '../../server/_lib/messaging/xmtpDbDirectory.js'

type StartupMode = 'multi-agent' | 'single-agent-csw' | 'single-agent-eoa' | 'standby-only' | 'unconfigured'

type Check = {
  label: string
  ok: boolean
  detail: string
}

function env(name: string): string {
  return String(process.env[name] ?? '').trim()
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = env(name).toLowerCase()
  if (!raw) return fallback
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true
  if (['0', 'false', 'no', 'off'].includes(raw)) return false
  return fallback
}

function has(name: string): boolean {
  return env(name).length > 0
}

function isRailwayRuntime(): boolean {
  return Object.entries(process.env).some(([key, value]) => key.startsWith('RAILWAY_') && String(value ?? '').trim())
}

function mask(value: string): string {
  if (!value) return '(empty)'
  if (value.length <= 10) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function normalizeMode(): StartupMode {
  const consumeXmtp = envBool('AGENT_CONSUME_XMTP', env('AGENT_RUNTIME_ROLE').toLowerCase() !== 'standby')
  const hasMultiAgent = has('DATABASE_URL') || has('POSTGRES_URL')
  const hasDbKey = has('XMTP_AGENT_KEY_ENCRYPTION_KEY')
  const hasCsw = has('XMTP_AGENT_CSW_ADDRESS') && has('XMTP_AGENT_PRIVY_WALLET_ID')
  const hasEoa = has('XMTP_AGENT_PRIVATE_KEY')

  if (!consumeXmtp) return 'standby-only'
  if (hasMultiAgent && hasDbKey) return 'multi-agent'
  if (hasCsw) return 'single-agent-csw'
  if (hasEoa) return 'single-agent-eoa'
  return 'unconfigured'
}

function configuredLlmProviders(): string[] {
  const providers: Array<[string, string]> = [
    ['Groq', 'GROQ_API_KEY'],
    ['OpenAI', 'OPENAI_API_KEY'],
    ['Anthropic', 'ANTHROPIC_API_KEY'],
    ['OpenRouter', 'OPENROUTER_API_KEY'],
  ]
  return providers.filter(([, key]) => has(key)).map(([name]) => name)
}

function configuredChannels(): string[] {
  const channels = ['XMTP']
  if (envBool('ELIZA_CHANNEL_TELEGRAM_ENABLED', false)) channels.push('Telegram')
  if (envBool('ELIZA_CHANNEL_DISCORD_ENABLED', false)) channels.push('Discord')
  if (envBool('ELIZA_CHANNEL_TWITTER_ENABLED', false)) channels.push('Twitter/X')
  return channels
}

function buildChecks(mode: StartupMode): Check[] {
  const consumeXmtp = envBool('AGENT_CONSUME_XMTP', env('AGENT_RUNTIME_ROLE').toLowerCase() !== 'standby')
  const dbConfigured = has('DATABASE_URL') || has('POSTGRES_URL')
  const configuredXmtpDbDir = env('XMTP_DB_DIRECTORY')
  const effectiveXmtpDbDir = resolveXmtpDbDirectory()
  const displayedXmtpDbDir = configuredXmtpDbDir || effectiveXmtpDbDir
  const hasDedicatedXmtpMount = hasDedicatedMount(effectiveXmtpDbDir)
  const runningOnRailway = isRailwayRuntime()
  const productionPrimaryBlocked =
    consumeXmtp &&
    env('AGENT_RUNTIME_ROLE').toLowerCase() !== 'standby' &&
    (env('XMTP_ENV') || 'production') === 'production' &&
    !runningOnRailway &&
    !envBool('ELIZA_ALLOW_OFF_RAILWAY_PRIMARY', false)

  return [
    {
      label: 'Active runtime entrypoint',
      ok: true,
      detail: 'frontend/server/agents/eliza/index.ts',
    },
    {
      label: 'Deployment target',
      ok: true,
      detail: runningOnRailway ? 'Railway runtime detected' : 'Not running on Railway in this shell',
    },
    {
      label: 'XMTP consume mode',
      ok: consumeXmtp || mode === 'standby-only',
      detail: consumeXmtp ? 'This runtime will connect to XMTP.' : 'Standby mode only: health checks and config inspection, no XMTP consumer.',
    },
    {
      label: 'Startup mode resolved',
      ok: mode !== 'unconfigured',
      detail: mode,
    },
    {
      label: 'Production primary safety guard',
      ok: !productionPrimaryBlocked,
      detail: productionPrimaryBlocked
        ? 'production primary boot will be blocked off Railway unless ELIZA_ALLOW_OFF_RAILWAY_PRIMARY=true'
        : 'compatible with current env',
    },
    {
      label: 'XMTP DB directory',
      ok: !configuredXmtpDbDir || path.resolve(configuredXmtpDbDir) === path.resolve(effectiveXmtpDbDir),
      detail:
        configuredXmtpDbDir && path.resolve(configuredXmtpDbDir) !== path.resolve(effectiveXmtpDbDir)
          ? `configured=${configuredXmtpDbDir}, effective=${effectiveXmtpDbDir}`
          : displayedXmtpDbDir,
    },
    {
      label: 'Dedicated XMTP volume mount',
      ok: !runningOnRailway || !consumeXmtp || hasDedicatedXmtpMount,
      detail:
        !runningOnRailway || !consumeXmtp
          ? 'not required in this shell'
          : hasDedicatedXmtpMount
            ? `mounted at ${effectiveXmtpDbDir}`
            : `no dedicated mount detected for ${effectiveXmtpDbDir}`,
    },
    {
      label: 'XMTP DB encryption key',
      ok: has('XMTP_DB_ENCRYPTION_KEY') || envBool('XMTP_DB_PLAINTEXT_ONLY', false) || mode === 'standby-only',
      detail: has('XMTP_DB_ENCRYPTION_KEY')
        ? `configured (${mask(env('XMTP_DB_ENCRYPTION_KEY'))})`
        : envBool('XMTP_DB_PLAINTEXT_ONLY', false)
          ? 'plaintext mode explicitly enabled'
          : 'not configured',
    },
    {
      label: 'Postgres availability',
      ok: !consumeXmtp || mode !== 'multi-agent' || dbConfigured,
      detail: dbConfigured ? 'DATABASE_URL/POSTGRES_URL configured' : 'not configured',
    },
    {
      label: 'Multi-agent key decryption',
      ok: mode !== 'multi-agent' || has('XMTP_AGENT_KEY_ENCRYPTION_KEY'),
      detail: has('XMTP_AGENT_KEY_ENCRYPTION_KEY') ? 'configured' : 'missing',
    },
    {
      label: 'CSW signer config',
      ok: mode !== 'single-agent-csw' || (has('XMTP_AGENT_CSW_ADDRESS') && has('XMTP_AGENT_PRIVY_WALLET_ID')),
      detail:
        has('XMTP_AGENT_CSW_ADDRESS') || has('XMTP_AGENT_PRIVY_WALLET_ID')
          ? `address=${mask(env('XMTP_AGENT_CSW_ADDRESS'))}, walletId=${mask(env('XMTP_AGENT_PRIVY_WALLET_ID'))}`
          : 'not configured',
    },
    {
      label: 'EOA fallback config',
      ok: mode !== 'single-agent-eoa' || has('XMTP_AGENT_PRIVATE_KEY'),
      detail: has('XMTP_AGENT_PRIVATE_KEY') ? `configured (${mask(env('XMTP_AGENT_PRIVATE_KEY'))})` : 'not configured',
    },
    {
      label: 'LLM fallback providers',
      ok: configuredLlmProviders().length > 0 || mode === 'standby-only',
      detail: configuredLlmProviders().length > 0 ? configuredLlmProviders().join(', ') : 'none configured',
    },
  ]
}

function startupRecipe(mode: StartupMode): string[] {
  switch (mode) {
    case 'standby-only':
      return [
        'Safe local inspection only: AGENT_RUNTIME_ROLE=standby AGENT_CONSUME_XMTP=false pnpm -C frontend agent:start',
        'This proves the runtime boots and exposes /healthz and /readyz without consuming XMTP. It is not meant to be a second deployment target.',
      ]
    case 'single-agent-eoa':
      return [
        'Local dev XMTP agent: set XMTP_AGENT_PRIVATE_KEY, XMTP_DB_ENCRYPTION_KEY, one LLM key, then run pnpm -C frontend agent:start',
        'This is the smallest true end-to-end path, but it uses a raw EOA and is explicitly dev-only in this repo.',
      ]
    case 'single-agent-csw':
      return [
        'Railway primary path: keep XMTP_AGENT_CSW_ADDRESS, XMTP_AGENT_PRIVY_WALLET_ID, Privy server creds, XMTP_DB_ENCRYPTION_KEY, and an LLM key on Railway, then deploy there.',
        'This is the canonical single-agent setup in 4626: CSW identity on XMTP, Privy as delegated signer.',
      ]
    case 'multi-agent':
      return [
        'Orchestrator path: set DATABASE_URL/POSTGRES_URL + XMTP_AGENT_KEY_ENCRYPTION_KEY + XMTP_DB_ENCRYPTION_KEY + an LLM key, then run pnpm -C frontend agent:start',
        'This loads creator agents from Postgres, decrypts per-agent signer material, and starts one XMTP consumer per configured creator agent.',
      ]
    default:
      return [
        'No runnable XMTP mode is configured yet.',
        'Choose one of: single-agent-csw, single-agent-eoa, or multi-agent.',
      ]
  }
}

function printSection(title: string, lines: string[]): void {
  console.log(`\n${title}`)
  for (const line of lines) console.log(`- ${line}`)
}

function main(): void {
  const runtimeRole = env('AGENT_RUNTIME_ROLE') || 'primary'
  const consumeXmtp = envBool('AGENT_CONSUME_XMTP', runtimeRole.toLowerCase() !== 'standby')
  const mode = normalizeMode()
  const checks = buildChecks(mode)

  console.log('4626 Eliza Doctor')
  console.log('=================')
  console.log(`Runtime role: ${runtimeRole}`)
  console.log(`Consume XMTP: ${consumeXmtp ? 'yes' : 'no'}`)
  console.log(`Resolved mode: ${mode}`)
  console.log(`Railway runtime: ${isRailwayRuntime() ? 'yes' : 'no'}`)
  console.log(`Startup command: pnpm -C frontend agent:start`)

  printSection('Where ElizaOS Actually Fits', [
    'ElizaOS is the orchestration layer inside frontend/server/agents/eliza.',
    'It does plugin/action/provider routing, memory/state composition, and LLM fallback.',
    'It is not the wallet/auth layer. Privy, CSW identity, Vercel routes, and contracts remain separate systems.',
  ])
  printSection('Operating Model', [
    'This repo assumes one Railway primary XMTP consumer.',
    'Standby mode is kept only for local inspection and smoke checks.',
  ])

  printSection('Active End-to-End Flow', [
    'XMTP ingress arrives through frontend/server/agents/eliza/plugins/xmtp/service.ts.',
    'frontend/server/agents/eliza/index.ts normalizes the message, rate-limits it, and hands it to the runtime bridge.',
    'frontend/server/agents/eliza/runtimeBridge.ts uses @elizaos/core shapes for memory, state, plugins, and action ranking.',
    'Plugins in frontend/server/agents/eliza/plugins/* delegate into the existing 4626 production handlers.',
    'If no action claims the message, frontend/server/agents/eliza/llm.ts generates the fallback response.',
  ])

  printSection('Enabled Channels', [configuredChannels().join(', ')])
  printSection('Core Plugins', [
    'keepr, lens, walletIntel, reputation, kpr, zora, uniswap, knowledge',
  ])

  console.log('\nChecks')
  console.log('------')
  for (const check of checks) {
    console.log(`${check.ok ? '[ok]' : '[missing]'} ${check.label}: ${check.detail}`)
  }

  printSection('Recommended Next Step', startupRecipe(mode))

  if (mode === 'unconfigured') {
    printSection('Minimum Config To Learn It Safely', [
      'Standby only: AGENT_RUNTIME_ROLE=standby and AGENT_CONSUME_XMTP=false',
      'Then run pnpm -C frontend agent:eliza:doctor and pnpm -C frontend agent:eliza:standby:smoke',
      'When ready for true message flow, graduate to single-agent-csw or single-agent-eoa.',
    ])
  }
}

main()
