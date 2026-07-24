import {
  checkVirtualsAcpRuntimeReadiness,
  isVirtualsComputePreferredForAcp,
  listConfiguredLlmProviderEnvKeys,
} from '../../server/agents/eliza/plugins/virtuals/readiness.js'
import {
  findInvalidExecutableHighRiskTools,
  isValidVirtualsSignerPrivateKey,
  parseExecutableHighRiskTools,
} from '../../server/agents/eliza/plugins/virtuals/config.js'
import { credentialPresence, redactDoctorDetail } from './virtuals-acp-doctor-redaction.js'

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

function configuredCredentials(): string[] {
  return [
    env('VIRTUALS_ACP_WALLET_ADDRESS'),
    env('VIRTUALS_ACP_WALLET_ID'),
    env('VIRTUALS_ACP_SIGNER_PRIVATE_KEY'),
    env('VIRTUALS_API_KEY'),
    env('GROQ_API_KEY'),
    env('OPENAI_API_KEY'),
    env('ANTHROPIC_API_KEY'),
    env('OPENROUTER_API_KEY'),
  ].filter(Boolean)
}

function buildChecks(readiness: Awaited<ReturnType<typeof checkVirtualsAcpRuntimeReadiness>>): Check[] {
  const signerPrivateKey = env('VIRTUALS_ACP_SIGNER_PRIVATE_KEY')
  const executableToolsRaw = env('VIRTUALS_ACP_EXECUTABLE_HIGH_RISK_TOOLS')
  const invalidExecutableTools = findInvalidExecutableHighRiskTools(executableToolsRaw)
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
      detail: credentialPresence(
        env('VIRTUALS_ACP_WALLET_ADDRESS'),
        /^0x[a-fA-F0-9]{40}$/.test(env('VIRTUALS_ACP_WALLET_ADDRESS')),
      ),
    },
    {
      label: 'Privy wallet id',
      ok: env('VIRTUALS_ACP_WALLET_ID').length > 0,
      detail: credentialPresence(env('VIRTUALS_ACP_WALLET_ID')),
    },
    {
      label: 'Session signer private key',
      ok: isValidVirtualsSignerPrivateKey(signerPrivateKey),
      detail: credentialPresence(
        signerPrivateKey,
        isValidVirtualsSignerPrivateKey(signerPrivateKey),
      ),
    },
    {
      label: 'Virtuals compute API key',
      ok: env('VIRTUALS_API_KEY').length > 0,
      detail: env('VIRTUALS_API_KEY') ? '(set)' : 'set VIRTUALS_API_KEY from agent Compute settings',
    },
    {
      label: 'VirtualsCompute first for ACP lane',
      ok: isVirtualsComputePreferredForAcp(),
      detail: env('ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY') ||
        'VirtualsCompute,Groq,OpenAI,Anthropic,OpenRouter (default)',
    },
    {
      label: 'Configured LLM provider env keys',
      ok: listConfiguredLlmProviderEnvKeys().length > 0 || !envBool('VIRTUALS_ACP_AUTO_LLM', false),
      detail:
        listConfiguredLlmProviderEnvKeys().join(', ') ||
        (envBool('VIRTUALS_ACP_AUTO_LLM', false) ? '(none — required when AUTO_LLM=1)' : '(not required in observe-only mode)'),
    },
    {
      label: 'Observe-only rollout mode',
      ok: true,
      detail: envBool('VIRTUALS_ACP_AUTO_LLM', false)
        ? 'AUTO_LLM=1 (tool decisions enabled)'
        : 'AUTO_LLM=0 (recommended for first deploy)',
    },
    {
      label: 'Legacy auto-fund flag',
      ok: !envBool('VIRTUALS_ACP_AUTO_FUND', false),
      detail: envBool('VIRTUALS_ACP_AUTO_FUND', false)
        ? 'AUTO_FUND=1 (deprecated; grants no execution authority)'
        : 'AUTO_FUND=0 (recommended)',
    },
    {
      label: 'High-risk execution allowlist',
      ok: invalidExecutableTools.length === 0,
      detail: invalidExecutableTools.length > 0
        ? `invalid entries: ${invalidExecutableTools.join(', ')}`
        : parseExecutableHighRiskTools(executableToolsRaw).join(', ') ||
          '(empty — proposal-only)',
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
          ? `${readiness.computePing.model}: request succeeded`
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
    console.log(`  [${mark}] ${check.label}: ${redactDoctorDetail(check.detail, configuredCredentials())}`)
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
  console.error(
    '[virtuals-acp-doctor] fatal:',
    redactDoctorDetail(error, configuredCredentials()),
  )
  process.exit(1)
})
