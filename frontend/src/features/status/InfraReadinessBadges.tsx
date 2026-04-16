import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleAlert, CircleSlash, Loader2 } from 'lucide-react'

import { apiFetch } from '@/lib/api/apiBase'

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

type BadgeState = 'loading' | 'ok' | 'degraded' | 'offline'

async function fetchInfraHealth(): Promise<HealthResponse | null> {
  try {
    const res = await apiFetch('/api/health')
    if (!res.ok) return null
    const json = (await res.json()) as HealthResponse
    return json
  } catch {
    return null
  }
}

function toneClasses(state: BadgeState): string {
  switch (state) {
    case 'ok':
      return 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200'
    case 'degraded':
      return 'border-amber-500/20 bg-amber-500/5 text-amber-200'
    case 'offline':
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
 */
function deriveBadges(health: HealthResponse | null | undefined) {
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
  })

  const badges = useMemo(() => deriveBadges(query.data ?? null), [query.data])
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
