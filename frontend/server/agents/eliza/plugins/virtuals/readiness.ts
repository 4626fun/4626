import { readServerEnvVar } from '../../../../_lib/infra/serverEnv.js'
import { getElizaLlmService } from '../../llm.js'
import { checkVirtualsAcpConfig, type VirtualsAcpConfig } from './config.js'
import { pingVirtualsCompute } from './computePing.js'

const LLM_PROVIDER_ENV_KEYS = [
  ['VirtualsCompute', 'VIRTUALS_API_KEY'],
  ['Groq', 'GROQ_API_KEY'],
  ['OpenAI', 'OPENAI_API_KEY'],
  ['Anthropic', 'ANTHROPIC_API_KEY'],
  ['OpenRouter', 'OPENROUTER_API_KEY'],
] as const

export type VirtualsAcpReadinessCheck =
  | {
      ok: true
      config: VirtualsAcpConfig
      llmProviders: string[]
      virtualsComputePreferred: boolean
      computePing?: { ok: true; model: string; content: string } | { ok: false; error: string }
    }
  | { ok: false; reason: string }

function parseProviderPriority(raw: string | undefined, fallback: string[]): string[] {
  const source = String(raw ?? '').trim()
  if (!source) return fallback
  const requested = source
    .split(/[,\s]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
  return requested.length > 0 ? requested : fallback
}

export function listConfiguredLlmProviderEnvKeys(): string[] {
  return LLM_PROVIDER_ENV_KEYS.filter(([, envKey]) => Boolean(readServerEnvVar(envKey))).map(
    ([name]) => name,
  )
}

export function isVirtualsComputePreferredForAcp(): boolean {
  const priority = parseProviderPriority(
    process.env.ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY,
    ['VirtualsCompute', 'Groq', 'OpenAI', 'Anthropic', 'OpenRouter'],
  )
  return priority[0]?.toLowerCase() === 'virtualscompute'
}

export async function checkVirtualsAcpRuntimeReadiness(options?: {
  pingCompute?: boolean
}): Promise<VirtualsAcpReadinessCheck> {
  const configCheck = checkVirtualsAcpConfig()
  if (!configCheck.ok) {
    return { ok: false, reason: configCheck.reason }
  }

  const llmProviders = getElizaLlmService().getAvailableProviders().map((provider) => provider.name)
  if (configCheck.config.autoLlmEnabled && llmProviders.length === 0) {
    return {
      ok: false,
      reason:
        'no LLM providers configured (set VIRTUALS_API_KEY and/or GROQ_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY)',
    }
  }

  const virtualsComputePreferred = isVirtualsComputePreferredForAcp()
  const virtualsApiKey = readServerEnvVar('VIRTUALS_API_KEY')
  const shouldPing =
    options?.pingCompute === true ||
    (options?.pingCompute !== false && Boolean(virtualsApiKey) && configCheck.config.autoLlmEnabled)

  let computePing:
    | { ok: true; model: string; content: string }
    | { ok: false; error: string }
    | undefined

  if (shouldPing && virtualsApiKey) {
    const ping = await pingVirtualsCompute({ apiKey: virtualsApiKey })
    computePing = ping.ok
      ? { ok: true, model: ping.model, content: ping.content }
      : { ok: false, error: ping.error }
    if (virtualsComputePreferred && !ping.ok) {
      return {
        ok: false,
        reason: `VirtualsCompute is first in ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY but ping failed: ${ping.error}`,
      }
    }
  } else if (configCheck.config.autoLlmEnabled && virtualsComputePreferred && !virtualsApiKey) {
    return {
      ok: false,
      reason:
        'VirtualsCompute is first in ELIZA_LLM_VIRTUALS_ACP_PROVIDER_PRIORITY but VIRTUALS_API_KEY is missing',
    }
  }

  return {
    ok: true,
    config: configCheck.config,
    llmProviders,
    virtualsComputePreferred,
    ...(computePing ? { computePing } : {}),
  }
}
