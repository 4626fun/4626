/**
 * Typed feature flag registry for 4626.
 *
 * Every flag is a callable function (`flag()` returns the resolved value).
 * Flags are grouped by category to enforce trust-boundary rules:
 *
 * - `security`     — auth/wallet/origin gating. Never remote-evaluable.
 * - `operational`  — deploy, host mode, swap provider. Never remote-evaluable.
 * - `ui`           — product surfaces safe for future remote targeting.
 * - `debug`        — telemetry and verbose logging toggles.
 *
 * This module follows the Vercel Flags SDK "flags as code" pattern so that
 * call sites import flag functions, not env var strings. Switching a flag
 * from env-backed to a remote provider only changes the definition here.
 */

import { getRemoteFlag } from '@/lib/flags/remoteFlags'

export type { HostMode } from '@/lib/env/host'
type HostMode = import('@/lib/env/host').HostMode

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isTruthyEnv(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

function isFalsyEnv(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase()
  return s === '0' || s === 'false' || s === 'no' || s === 'off'
}

/**
 * Lightweight host-mode resolution that mirrors `@/lib/host#getHostMode()`
 * without importing host.ts. This avoids triggering host.ts module-level
 * constants (`MARKETING_ORIGIN`, `APP_ORIGIN`) which access
 * `window.location.origin` at import time — breaking tests that stub
 * `window` without a complete `location` object.
 */
const MARKETING_HOSTNAMES = ['4626.fun', 'www.4626.fun']

function resolveHostMode(): HostMode {
  if (typeof window === 'undefined') return 'app'
  const override = String(import.meta.env.VITE_HOST_MODE_OVERRIDE ?? '').trim().toLowerCase()
  if (override === 'app' || override === 'marketing') return override
  const hostname = window.location?.hostname ?? ''
  return MARKETING_HOSTNAMES.includes(hostname.toLowerCase().trim()) ? 'marketing' : 'app'
}

// ---------------------------------------------------------------------------
// Flag category & definition types
// ---------------------------------------------------------------------------

export type FlagCategory = 'security' | 'operational' | 'ui' | 'debug'

export interface FlagDefinition<T> {
  key: string
  description: string
  category: FlagCategory
  defaultValue: T
  options?: Array<{ value: T; label?: string }>
  /** Resolve the current flag value. */
  decide: () => T
}

export interface FeatureFlag<T> {
  (): T
  definition: FlagDefinition<T>
}

function defineFlag<T>(def: FlagDefinition<T>): FeatureFlag<T> {
  const fn = (() => def.decide()) as FeatureFlag<T>
  fn.definition = def
  return fn
}

// ---------------------------------------------------------------------------
// Privy internals (lifted from the original flags.ts; kept private)
// ---------------------------------------------------------------------------

const DEFAULT_PRIVY_APP_ID = 'cmk411efm034jl50cs618o8cy'
const DEFAULT_PRIVY_ALLOWED_ORIGINS = new Set<string>([
  'https://4626.fun',
  'https://app.4626.fun',
  'http://localhost:5173',
  'http://localhost:5174',
])

function normalizeOrigin(raw: string): string {
  const input = String(raw ?? '').trim()
  if (!input) return ''
  try {
    return new URL(input).origin.toLowerCase()
  } catch {
    return ''
  }
}

function isLoopbackOrigin(raw: string): boolean {
  const origin = normalizeOrigin(raw)
  if (!origin) return false
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]'
  } catch {
    return false
  }
}

function getCurrentOrigin(): string | null {
  if (typeof window === 'undefined') return null
  return normalizeOrigin(window.location.origin)
}

function getPrivyAllowedOrigins(): Set<string> {
  const raw = String(import.meta.env.VITE_PRIVY_ALLOWED_ORIGINS ?? '').trim()
  if (!raw) return new Set(DEFAULT_PRIVY_ALLOWED_ORIGINS)
  const list = raw
    .split(/[\s,]+/g)
    .map((v) => normalizeOrigin(v))
    .filter(Boolean)
  return new Set(list.length > 0 ? list : Array.from(DEFAULT_PRIVY_ALLOWED_ORIGINS))
}

function isPrivyOriginAllowed(): boolean {
  const origin = getCurrentOrigin()
  if (!origin) return true
  if (getPrivyAllowedOrigins().has(origin)) return true
  return false
}

export function isPrivyHostModeAllowed(mode: HostMode): boolean {
  return mode === 'marketing' || mode === 'app'
}

// ---------------------------------------------------------------------------
// Security flags (never remote)
// ---------------------------------------------------------------------------

export const privyEnabledFlag = defineFlag<boolean>({
  key: 'privy-enabled',
  description: 'Master Privy client enablement — requires VITE_PRIVY_ENABLED + origin + host mode checks.',
  category: 'security',
  defaultValue: false,
  options: [{ value: false, label: 'Disabled' }, { value: true, label: 'Enabled' }],
  decide() {
    if (!isTruthyEnv(import.meta.env.VITE_PRIVY_ENABLED)) return false
    if (!resolvePrivyAppId()) return false
    if (!isPrivyOriginAllowed()) return false
    if (typeof window !== 'undefined' && !isPrivyHostModeAllowed(resolveHostMode())) return false
    return true
  },
})

export const zoraMigrationVerifyImplFlag = defineFlag<boolean>({
  key: 'zora-migration-verify-implementation',
  description: 'Verify Zora coin implementation address against allowlist before migration.',
  category: 'security',
  defaultValue: true,
  options: [{ value: false, label: 'Skip verification' }, { value: true, label: 'Verify' }],
  decide() {
    const raw = String(import.meta.env.VITE_ZORA_MIGRATION_VERIFY_IMPLEMENTATION ?? '').trim().toLowerCase()
    if (!raw) return true
    return !isFalsyEnv(raw)
  },
})

// ---------------------------------------------------------------------------
// Operational flags (never remote)
// ---------------------------------------------------------------------------

export const hostModeFlag = defineFlag<HostMode>({
  key: 'host-mode',
  description: 'Active host mode — marketing (4626.fun) or app (app.4626.fun / localhost).',
  category: 'operational',
  defaultValue: 'app',
  options: [{ value: 'app', label: 'App' }, { value: 'marketing', label: 'Marketing' }],
  decide() {
    return resolveHostMode()
  },
})

export const publicSiteModeFlag = defineFlag<boolean>({
  key: 'public-site-mode',
  description: 'When true, the app runs in read-only public/waitlist mode.',
  category: 'operational',
  defaultValue: false,
  options: [{ value: false, label: 'Normal' }, { value: true, label: 'Public' }],
  decide() {
    return isTruthyEnv(import.meta.env.VITE_PUBLIC_SITE_MODE)
  },
})

export const swapProviderFlag = defineFlag<string>({
  key: 'swap-provider',
  description: 'Active swap backend (uniswap, cdp, etc.).',
  category: 'operational',
  defaultValue: 'uniswap',
  decide() {
    const raw = String(import.meta.env.VITE_SWAP_PROVIDER ?? '').trim().toLowerCase()
    return raw || 'uniswap'
  },
})

export const injectedConnectorFlag = defineFlag<boolean>({
  key: 'injected-connector',
  description: 'Enable the browser-injected wallet connector in wagmi config.',
  category: 'operational',
  defaultValue: true,
  options: [{ value: false, label: 'Disabled' }, { value: true, label: 'Enabled' }],
  decide() {
    return !isFalsyEnv(import.meta.env.VITE_ENABLE_INJECTED_CONNECTOR ?? '1')
  },
})

/** Pairs with server `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1`. */
export const waitlistSubAccountFlowFlag = defineFlag<boolean>({
  key: 'waitlist-subaccount-flow',
  description:
    'Track C2 — show the Base App sub-account connect step in waitlist/account setup. Pairs with server WAITLIST_SUBACCOUNT_FLOW_ENABLED.',
  category: 'operational',
  defaultValue: false,
  options: [{ value: false, label: 'Disabled' }, { value: true, label: 'Enabled' }],
  decide() {
    return isTruthyEnv(import.meta.env.VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED)
  },
})

// ---------------------------------------------------------------------------
// UI / product flags (candidates for remote targeting later)
// ---------------------------------------------------------------------------

export const lensGroveFlag = defineFlag<boolean>({
  key: 'lens-grove',
  description: 'Show Lens Grove upload controls in profile and coin-manage surfaces.',
  category: 'ui',
  defaultValue: true,
  options: [{ value: false, label: 'Hidden' }, { value: true, label: 'Shown' }],
  decide() {
    const remote = getRemoteFlag<boolean>('lens-grove')
    if (remote !== undefined) return remote

    const raw = String(import.meta.env.VITE_ENABLE_LENS_GROVE ?? '').trim().toLowerCase()
    if (!raw) return true
    return isTruthyEnv(raw)
  },
})

// ---------------------------------------------------------------------------
// Debug flags
// ---------------------------------------------------------------------------

export const debugLogsFlag = defineFlag<boolean>({
  key: 'debug-logs',
  description: 'Verbose console logging across logger, deploy, AA, and swap modules.',
  category: 'debug',
  defaultValue: false,
  options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  decide() {
    return isTruthyEnv(import.meta.env.VITE_DEBUG_LOGS)
  },
})

export const xmtpDebugFlag = defineFlag<boolean>({
  key: 'xmtp-debug',
  description: 'Enable XMTP client debug logging.',
  category: 'debug',
  defaultValue: false,
  options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  decide() {
    return isTruthyEnv(import.meta.env.VITE_XMTP_DEBUG)
  },
})

export const useropTelemetryFlag = defineFlag<boolean>({
  key: 'userop-telemetry',
  description: 'Emit ERC-4337 UserOp telemetry events.',
  category: 'debug',
  defaultValue: false,
  options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  decide() {
    return isTruthyEnv(import.meta.env.VITE_USEROP_TELEMETRY)
  },
})

export const directCswAddOwnerSendCallsFlag = defineFlag<boolean>({
  key: 'direct-csw-add-owner-send-calls',
  description:
    'Try Method D direct wallet_sendCalls addOwnerAddress before Relay on non–Base-App-WebView surfaces.',
  category: 'ui',
  defaultValue: false,
  options: [{ value: false, label: 'Relay primary' }, { value: true, label: 'Direct first' }],
  decide() {
    const remote = getRemoteFlag<boolean>('direct-csw-add-owner-send-calls')
    if (remote !== undefined) return remote
    return isTruthyEnv(import.meta.env.VITE_DIRECT_CSW_ADD_OWNER_SEND_CALLS)
  },
})

export const privyAnalyticsFlag = defineFlag<boolean>({
  key: 'privy-analytics',
  description: 'Enable Privy browser analytics (disabled by default to reduce client-side noise).',
  category: 'debug',
  defaultValue: false,
  options: [{ value: false, label: 'Off' }, { value: true, label: 'On' }],
  decide() {
    if (isTruthyEnv(import.meta.env.VITE_PRIVY_DISABLE_ANALYTICS)) return false
    return isTruthyEnv(import.meta.env.VITE_PRIVY_ENABLE_ANALYTICS)
  },
})

// ---------------------------------------------------------------------------
// Privy config accessors (kept public for provider setup)
// ---------------------------------------------------------------------------

export function resolvePrivyAppId(): string | null {
  const appId = String(import.meta.env.VITE_PRIVY_APP_ID ?? '').trim()
  if (appId.length > 0) return appId
  return DEFAULT_PRIVY_APP_ID
}

export function resolvePrivyClientId(): string | null {
  const clientId = String(import.meta.env.VITE_PRIVY_CLIENT_ID ?? '').trim()
  if (!clientId) return null
  // Local dev should prefer app-id auth unless explicitly forced. This avoids
  // custom-domain client configs that reject localhost frame ancestors.
  if (typeof window !== 'undefined' && isLoopbackOrigin(window.location.origin)) {
    if (!isTruthyEnv(import.meta.env.VITE_PRIVY_CLIENT_ID_ON_LOOPBACK)) return null
  }
  return clientId
}

export function resolvePrivyApiUrl(): string | null {
  const raw = String(import.meta.env.VITE_PRIVY_API_URL ?? '').trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:') return null
    return parsed.origin
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Registry — all flags in one place for Toolbar / discovery
// ---------------------------------------------------------------------------

export const allFlags: FeatureFlag<unknown>[] = [
  privyEnabledFlag,
  zoraMigrationVerifyImplFlag,
  hostModeFlag,
  publicSiteModeFlag,
  swapProviderFlag,
  injectedConnectorFlag,
  waitlistSubAccountFlowFlag,
  lensGroveFlag,
  directCswAddOwnerSendCallsFlag,
  debugLogsFlag,
  xmtpDebugFlag,
  useropTelemetryFlag,
  privyAnalyticsFlag,
]

/** Snapshot every flag's current value, keyed by flag key. */
export function resolveAllFlagValues(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const flag of allFlags) {
    out[flag.definition.key] = flag()
  }
  return out
}

/** Build the FlagDefinitionsType shape expected by flags/react FlagDefinitions. */
export function buildFlagDefinitions(): Record<
  string,
  { options: Array<{ value: unknown }>; description: string }
> {
  const out: Record<string, { options: Array<{ value: unknown }>; description: string }> = {}
  for (const flag of allFlags) {
    const d = flag.definition
    out[d.key] = {
      options: d.options ?? [{ value: d.defaultValue }],
      description: d.description,
    }
  }
  return out
}
