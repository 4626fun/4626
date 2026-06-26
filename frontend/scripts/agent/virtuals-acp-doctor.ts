import {
  checkVirtualsAcpRuntimeReadiness,
  isVirtualsComputePreferredForAcp,
  listConfiguredLlmProviderEnvKeys,
} from '../../server/agents/eliza/plugins/virtuals/readiness.js'

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

function mask(value: string): string {
  if (!value) return '(empty)'
  if (value.length <= 10) return value
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function buildChecks(readiness: Awaited<ReturnType<typeof checkVirtualsAcpRuntimeReadiness>>): Check[] {
  const checks: Check[] = [
    {
      label: 'ACP bridge enabled',
      ok: envBool('VIRTUALS_ACP_ENABLED', false),
      detail: envBool('VIRTUALS_ACP_ENABLED', false)
        ? 'VIRTUALS_ACP_ENABLED=1'
        : 'set VIRTUALS_ACP_ENABLED=1',
    },
    {
      label: 'Agent wallet address',
      ok: /^0x[a-fA-F0-9]{40}$/.test(env('VIRTUALS_ACP_WALLET_ADDRESS')),
      detail: mask(env('VIRTUALS_ACP_WALLET_ADDRESS')),
    },
    {
      label: 'Privy wallet id',
      ok: env('VIRTUALS_ACP_WALLET_ID').length > 0,
      detail: mask(env('VIRTUALS_ACP_WALLET_ID')),
    },
    {
      label: 'Session signer private key',
      ok: env('VIRTUALS_ACP_SIGNER_PRIVATE_KEY').length > 0,
      detail: env('VIRTUALS_ACP_SIGNER_PRIVATE_KEY') ? '(set)' : '(missing)',
    },
    {
      label: 'Virtuals compute API key',
      ok: env('VIRTUALS_API_KEY').length > 0,
      detail: env('VIRTUALS_API_KEY') ? mask(env('VIRTUALS_API_KEY')) : 'set VIRTUALS_API_KEY from agent Compute settings',
    },
    {
      label: 'VirtualsCompute first for ACP lane',
      ok: isVirtualsComputePreferredForAcp(),
      detail: env('ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY') ||
        'VirtualsCompute,Groq,OpenAI,Anthropic,OpenRouter (default)',
    },
    {
      label: 'Configured LLM provider env keys',
      ok: listConfiguredLlmProviderEnvKeys().length > 0 || !envBool('VIRTUALS_ACP_AUTO_LLM', true),
      detail:
        listConfiguredLlmProviderEnvKeys().join(', ') ||
        (envBool('VIRTUALS_ACP_AUTO_LLM', true) ? '(none — required when AUTO_LLM=1)' : '(not required in observe-only mode)'),
    },
    {
      label: 'Observe-only rollout mode',
      ok: true,
      detail: envBool('VIRTUALS_ACP_AUTO_LLM', true)
        ? 'AUTO_LLM=1 (tool decisions enabled)'
        : 'AUTO_LLM=0 (recommended for first deploy)',
    },
    {
      label: 'Fund tool policy',
      ok: !envBool('VIRTUALS_ACP_AUTO_FUND', false),
      detail: envBool('VIRTUALS_ACP_AUTO_FUND', false)
        ? 'AUTO_FUND=1 (fund tool exposed to LLM — use with care)'
        : 'AUTO_FUND=0 (fund tool hidden — recommended)',
    },
  ]

  if (readiness.ok) {
    checks.push({
      label: 'Eliza LLM providers resolved',
      ok: readiness.llmProviders.length > 0 || !readiness.config.autoLlmEnabled,
      detail: readiness.llmProviders.join(', ') || '(none — ok in observe-only mode)',
    })
    if (readiness.computePing) {
      checks.push({
        label: 'Virtuals compute ping',
        ok: readiness.computePing.ok,
        detail: readiness.computePing.ok
          ? `${readiness.computePing.model}: ${readiness.computePing.content.slice(0, 80)}`
          : readiness.computePing.error,
      })
    }
  } else {
    checks.push({
      label: 'Runtime readiness',
      ok: false,
      detail: readiness.reason,
    })
  }

  return checks
}

async function main(): Promise<void> {
  const pingCompute = !process.argv.includes('--no-ping')
  const readiness = await checkVirtualsAcpRuntimeReadiness({ pingCompute })
  const checks = buildChecks(readiness)

  console.log('\n[virtuals-acp-doctor] Virtuals ACP + compute readiness\n')
  for (const check of checks) {
    const mark = check.ok ? 'ok' : 'FAIL'
    console.log(`  [${mark}] ${check.label}: ${check.detail}`)
  }

  const failed = checks.filter((check) => !check.ok)
  if (failed.length > 0) {
    console.log('\n[virtuals-acp-doctor] Fix the FAIL items above, then run:')
    console.log('  pnpm -C frontend agent:virtuals:preflight')
    console.log('  pnpm -C frontend agent:virtuals')
    process.exitCode = 1
    return
  }

  console.log('\n[virtuals-acp-doctor] Ready. Suggested rollout:')
  console.log('  1. Railway: dedicated service, AGENT_PROCESS=virtuals, secrets as runtime vars')
  console.log('  2. Start observe-only: VIRTUALS_ACP_AUTO_LLM=0')
  console.log('  3. Enable decisions after logs look healthy: VIRTUALS_ACP_AUTO_LLM=1')
}

void main().catch((error) => {
  console.error('[virtuals-acp-doctor] fatal:', error)
  process.exit(1)
})
