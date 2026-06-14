export type HermitCreativeTier = 'fast_default' | 'creative_premium'

export type HermitCreativeRoute = 'gmeow' | 'meme' | 'hermit_copy' | 'hermit_announce' | 'hermit_quest' | 'hermit_tone'

export type HermitDraftMode = 'copy' | 'announce' | 'quest' | 'tone'

export type HermitCreativePolicy = {
  route: HermitCreativeRoute
  tier: HermitCreativeTier
  timeoutMs: number
  maxOutputTokens: number
  retryCount: number
  targetModelHint: string | null
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_FAST_MODEL_HINT = 'openai/gpt-4.1-mini'
const DEFAULT_PREMIUM_MODEL_HINT = 'nousresearch/hermes-4-70b'

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readClampedInt(params: {
  key: string
  fallback: number
  min: number
  max: number
}): number {
  const raw = asTrimmed(process.env[params.key])
  if (!raw) return params.fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return params.fallback
  return Math.min(Math.max(parsed, params.min), params.max)
}

function readModelHint(tier: HermitCreativeTier): string {
  if (tier === 'creative_premium') {
    return asTrimmed(process.env.HERMIT_CREATIVE_PREMIUM_MODEL_HINT) || DEFAULT_PREMIUM_MODEL_HINT
  }
  return asTrimmed(process.env.HERMIT_CREATIVE_FAST_MODEL_HINT) || DEFAULT_FAST_MODEL_HINT
}

/** Documents env keys such as HERMIT_HERMIT_ANNOUNCE_TIMEOUT_MS for a route. */
export function creativePolicyEnvKey(
  route: HermitCreativeRoute,
  field: 'TIMEOUT_MS' | 'MAX_OUTPUT_TOKENS' | 'RETRY_COUNT',
): string {
  return `HERMIT_${route.toUpperCase()}_${field}`
}

function resolveTier(route: HermitCreativeRoute): HermitCreativeTier {
  switch (route) {
    case 'gmeow':
    case 'hermit_tone':
      return 'fast_default'
    case 'meme':
    case 'hermit_copy':
    case 'hermit_announce':
    case 'hermit_quest':
      return 'creative_premium'
    default: {
      const exhaustive: never = route
      return exhaustive
    }
  }
}

function defaultRetryCount(route: HermitCreativeRoute): number {
  switch (route) {
    case 'gmeow':
    case 'hermit_tone':
      return 0
    case 'meme':
    case 'hermit_copy':
    case 'hermit_announce':
    case 'hermit_quest':
      return 1
    default: {
      const exhaustive: never = route
      return exhaustive
    }
  }
}

function defaultTimeoutMs(route: HermitCreativeRoute): number {
  switch (route) {
    case 'gmeow':
      return 3_500
    case 'hermit_tone':
      return 4_000
    case 'hermit_copy':
      return 6_000
    case 'meme':
      return 10_000
    case 'hermit_announce':
      return 9_000
    case 'hermit_quest':
      return 11_000
    default: {
      const exhaustive: never = route
      return exhaustive
    }
  }
}

function defaultMaxOutputTokens(route: HermitCreativeRoute): number {
  switch (route) {
    case 'gmeow':
      return 120
    case 'hermit_tone':
      return 160
    case 'hermit_copy':
      return 260
    case 'meme':
      return 320
    case 'hermit_announce':
      return 420
    case 'hermit_quest':
      return 520
    default: {
      const exhaustive: never = route
      return exhaustive
    }
  }
}

function resolveRouteFromHermitMode(mode: HermitDraftMode): HermitCreativeRoute {
  switch (mode) {
    case 'copy':
      return 'hermit_copy'
    case 'announce':
      return 'hermit_announce'
    case 'quest':
      return 'hermit_quest'
    case 'tone':
      return 'hermit_tone'
    default: {
      const exhaustive: never = mode
      return exhaustive
    }
  }
}

export function resolveHermitCreativePolicy(params: {
  command: '/gmeow' | '/meme' | '/hermit'
  hermitMode?: HermitDraftMode
}): HermitCreativePolicy {
  const route: HermitCreativeRoute =
    params.command === '/gmeow'
      ? 'gmeow'
      : params.command === '/meme'
        ? 'meme'
        : resolveRouteFromHermitMode(params.hermitMode ?? 'copy')
  const tier = resolveTier(route)
  const globalTimeout = readClampedInt({
    key: 'HERMIT_AGENT_HTTP_TIMEOUT_MS',
    fallback: DEFAULT_TIMEOUT_MS,
    min: 1_000,
    max: 120_000,
  })
  const routeTimeout = readClampedInt({
    key: creativePolicyEnvKey(route, 'TIMEOUT_MS'),
    fallback: defaultTimeoutMs(route),
    min: 1_000,
    max: 120_000,
  })
  const routeMaxOutputTokens = readClampedInt({
    key: creativePolicyEnvKey(route, 'MAX_OUTPUT_TOKENS'),
    fallback: defaultMaxOutputTokens(route),
    min: 32,
    max: 4_000,
  })
  const retryCount = readClampedInt({
    key: creativePolicyEnvKey(route, 'RETRY_COUNT'),
    fallback: defaultRetryCount(route),
    min: 0,
    max: 2,
  })

  return {
    route,
    tier,
    timeoutMs: Math.min(routeTimeout, globalTimeout),
    maxOutputTokens: routeMaxOutputTokens,
    retryCount,
    targetModelHint: readModelHint(tier),
  }
}
