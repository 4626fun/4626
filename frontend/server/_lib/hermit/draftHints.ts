import type { HermitCreativeRoute, HermitCreativeTier } from './creativePolicy.js'

export type ParsedDraftHints = {
  lane: string | null
  route: HermitCreativeRoute | null
  tier: HermitCreativeTier | null
  model: string | null
  maxOutputTokens: number | null
  timeoutMs: number | null
}

const VALID_ROUTES: ReadonlySet<string> = new Set([
  'gmeow',
  'meme',
  'hermit_copy',
  'hermit_announce',
  'hermit_quest',
  'hermit_tone',
])

const VALID_TIERS: ReadonlySet<string> = new Set(['fast_default', 'creative_premium'])

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function readClampedInt(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === 'number' ? value : Number.parseInt(asTrimmed(value), 10)
  if (!Number.isFinite(parsed)) return null
  return Math.min(Math.max(Math.floor(parsed), min), max)
}

export function parseDraftHints(body: Record<string, unknown>): ParsedDraftHints | null {
  const raw = body.hints
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const hints = raw as Record<string, unknown>
  const routeRaw = asTrimmed(hints.route)
  const tierRaw = asTrimmed(hints.tier)
  return {
    lane: asTrimmed(hints.lane) || null,
    route: VALID_ROUTES.has(routeRaw) ? (routeRaw as HermitCreativeRoute) : null,
    tier: VALID_TIERS.has(tierRaw) ? (tierRaw as HermitCreativeTier) : null,
    model: asTrimmed(hints.model) || null,
    maxOutputTokens: readClampedInt(hints.maxOutputTokens, 32, 4_000),
    timeoutMs: readClampedInt(hints.timeoutMs, 1_000, 120_000),
  }
}

export function resolveDraftMaxOutputTokens(
  hints: ParsedDraftHints | null,
  envMaxOutputTokens: number,
): number {
  return hints?.maxOutputTokens ?? envMaxOutputTokens
}

export function resolveDraftTimeoutMs(hints: ParsedDraftHints | null, envTimeoutMs: number): number {
  const hintTimeout = hints?.timeoutMs
  if (hintTimeout == null) return envTimeoutMs
  return Math.min(hintTimeout, envTimeoutMs)
}

export function modelHintRequiresCompatiblePath(modelId: string): boolean {
  return modelId.toLowerCase().startsWith('nousresearch/')
}
