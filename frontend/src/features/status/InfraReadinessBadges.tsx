import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleAlert, CircleSlash, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/api/apiBase'
import type { ApiEnvelope } from '@/lib/api/apiEnvelope'

/**
 * Public-facing, read-only infrastructure readiness badges shown at the top
 * of /status. Reads the unauthenticated /api/health endpoint which already
 * probes paymaster + database + SIWE secret, and summarizes the response as
 * three color-coded pills so anyone (not just admins) can see whether
 * transactions and session issuance are currently reachable.
 */

type PaymasterHealth = {
  endpointConfigured: boolean
  ok: boolean
  error: string | null
}

type DbHealth = {
  configured: boolean
  ok: boolean
  latencyMs: number | null
  error: string | null
}

type SiweHealth = {
  authSessionSecretConfigured: boolean
  ok: boolean
  error: string | null
}

type HealthResponse = {
  ok: boolean
  time: string
  paymaster: PaymasterHealth
  db: DbHealth
  siwe: SiweHealth
}

type BadgeState = 'loading' | 'ok' | 'degraded' | 'offline' | 'error'

async function fetchInfraHealth(): Promise<HealthResponse> {
  const res = await apiFetch('/api/health')
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  // /api/health returns ApiEnvelope<HealthResponse>; unwrap the payload so
  // consumers see the inner health shape directly.
  const json = (await res.json()) as ApiEnvelope<HealthResponse>
  if (!json.success || !json.data) {
    throw new Error(typeof json.error === 'string' && json.error ? json.error : 'Health check failed')
  }
  return json.data
}

function toneClasses(state: BadgeState): string {
  switch (state) {
    case 'ok':
      return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
    case 'degraded':
      return 'border-amber-500/20 bg-amber-500/5 text-amber-200'
    case 'offline':
    case 'error':
      return 'border-red-500/20 bg-red-500/5 text-red-200'
    case 'loading':
    default:
      return 'border-zinc-900/60 bg-zinc-900/30 text-zinc-400'
  }
}

function stateIcon(state: BadgeState) {
  switch (state) {
    case 'ok':
      return <CheckCircle2 className="w-3.5 h-3.5" />
    case 'degraded':
      return <CircleAlert className="w-3.5 h-3.5" />
    case 'offline':
    case 'error':
      return <CircleSlash className="w-3.5 h-3.5" />
    case 'loading':
    default:
      return <Loader2 className="w-3.5 h-3.5 animate-spin" />
  }
}

function Pill(props: { label: string; state: BadgeState; note: string }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${toneClasses(props.state)}`}
      title={props.note}
    >
      {stateIcon(props.state)}
      <span className="font-medium">{props.label}</span>
      <span className="opacity-70">· {props.note}</span>
    </div>
  )
}

function formatTime(iso: string | undefined | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/**
 * Map each health sub-object to a badge state. Errors = offline, configured
 * but not ok = degraded, not configured = degraded (informational), ok = ok.
 *
 * When `errored` is true the three pills surface an error state rather than
 * staying in a perpetual "Checking…" — this matters when /api/health itself
 * is unreachable (outage) rather than returning a populated failure payload.
 */
function deriveBadges(health: HealthResponse | null | undefined, errored = false) {
  if (errored) {
    return {
      paymaster: { state: 'error' as BadgeState, note: 'Health check failed' },
      db: { state: 'error' as BadgeState, note: 'Health check failed' },
      siwe: { state: 'error' as BadgeState, note: 'Health check failed' },
    }
  }
  if (!health) {
    return {
      paymaster: { state: 'loading' as BadgeState, note: 'Checking…' },
      db: { state: 'loading' as BadgeState, note: 'Checking…' },
      siwe: { state: 'loading' as BadgeState, note: 'Checking…' },
    }
  }

  const paymasterState: BadgeState = !health.paymaster.endpointConfigured
    ? 'degraded'
    : health.paymaster.ok
      ? 'ok'
      : 'offline'
  const paymasterNote = !health.paymaster.endpointConfigured
    ? 'Not configured'
    : health.paymaster.ok
      ? 'Reachable'
      : 'Unreachable'

  const dbState: BadgeState = !health.db.configured
    ? 'degraded'
    : health.db.ok
      ? 'ok'
      : 'offline'
  const dbNote = !health.db.configured
    ? 'Not configured'
    : health.db.ok
      ? health.db.latencyMs !== null
        ? `${health.db.latencyMs}ms`
        : 'Reachable'
      : 'Unreachable'

  const siweState: BadgeState = !health.siwe.authSessionSecretConfigured
    ? 'degraded'
    : health.siwe.ok
      ? 'ok'
      : 'offline'
  const siweNote = !health.siwe.authSessionSecretConfigured
    ? 'Missing secret'
    : health.siwe.ok
      ? 'Ready'
      : 'Error'

  return {
    paymaster: { state: paymasterState, note: paymasterNote },
    db: { state: dbState, note: dbNote },
    siwe: { state: siweState, note: siweNote },
  }
}

type InfraReadinessBadgesProps = {
  className?: string
}

export function InfraReadinessBadges({ className = '' }: InfraReadinessBadgesProps) {
  const query = useQuery({
    queryKey: ['status', 'infraHealth'],
    queryFn: fetchInfraHealth,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    // Retry on transient failures so a single network blip doesn't lock the
    // UI into the error state, but surface persistent outages after that.
    retry: 1,
  })

  const badges = useMemo(
    () => deriveBadges(query.data ?? null, query.isError),
    [query.data, query.isError],
  )
  const checkedAt = formatTime(query.data?.time)

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Pill label="Paymaster" state={badges.paymaster.state} note={badges.paymaster.note} />
      <Pill label="Database" state={badges.db.state} note={badges.db.note} />
      <Pill label="Sessions" state={badges.siwe.state} note={badges.siwe.note} />
      {checkedAt ? (
        <span className="text-[10px] text-zinc-600">checked {checkedAt}</span>
      ) : null}
    </div>
  )
}

// Exported for tests.
export { deriveBadges }
export type { HealthResponse, BadgeState }
