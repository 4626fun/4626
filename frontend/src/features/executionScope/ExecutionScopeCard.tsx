import { ExternalLink } from 'lucide-react'

import { CopyableAddress } from '@/components/account/CopyableAddress'
import { useExecutionScope, type ExecutionScopeStatus } from './useExecutionScope'

/**
 * `/accounts` "Execution scopes" card.
 *
 * Surfaces the Arch B sub-account that the 4626 backend uses to execute
 * in-chat commands (`/coin buy`, `/coin sell`, `/keepr send`,
 * `/coin trend reserve`) on behalf of the creator. The sub-account is
 * funded by the parent CSW via a signed SpendPermission with per-tx +
 * per-period caps enforced by the SpendPermissionManager contract.
 *
 * This PR ships the read-only surface only. Revoke and re-provision
 * actions land in PR 2 (see `docs/design/sub-account-lifecycle-spec.md`).
 *
 * Design rationale: execution scopes are a TECHNICAL concept (an
 * app-scoped spend budget), not an IDENTITY concept. Keeping them on
 * `/accounts` and off the nav header preserves the "who am I" focus of
 * the header identity card while giving users an auditable surface for
 * bot-initiated spending consent.
 */
export function ExecutionScopeCard() {
  const scope = useExecutionScope()

  if (scope.status === 'unauthenticated') return null
  if (scope.status === 'loading') return <SkeletonCard />
  if (scope.status === 'error') {
    return (
      <CardShell>
        <Header title="4626.fun in-chat commands" subtitle="Status unavailable right now." />
        <p className="mt-3 text-xs text-zinc-500">
          We couldn't load your execution scope. Refresh the page or retry in a minute.
        </p>
      </CardShell>
    )
  }

  if (scope.status === 'not_provisioned') {
    return (
      <CardShell>
        <Header
          title="4626.fun in-chat commands"
          subtitle="Not enabled. In-chat trading (/coin buy, /keepr send) is disabled for your account."
        />
        <p className="mt-3 text-xs text-zinc-500">
          Enabling creates a capped spend scope on your Coinbase Smart Wallet so 4626 can execute
          in-chat commands without per-transaction popups. Caps are enforced by the{' '}
          <code className="text-zinc-400">SpendPermissionManager</code> contract on Base. You can
          revoke at any time.
        </p>
        <p className="mt-3 text-[11px] text-zinc-600">
          Self-service provisioning lands in the next release. Until then, contact support to enable.
        </p>
      </CardShell>
    )
  }

  const data = scope.data
  if (!data || !data.subAccount) {
    // Shouldn't happen given deriveStatus, but TS needs the narrowing.
    return null
  }
  const sub = data.subAccount
  const sp = sub.spendPermission

  const allowanceEth = formatEth(sp.allowanceWei)
  const perTxEth = data.caps ? formatEth(data.caps.perTxCapWei) : null
  const spentEth = sp.currentPeriod ? formatEth(sp.currentPeriod.spendWei) : null
  const remainingEth = sp.currentPeriod ? formatEth(sp.currentPeriod.remainingWei) : null
  const periodLabel = formatPeriod(sp.periodSeconds)
  const endAtLabel = formatDate(sp.endAt)
  const windowResetLabel = sp.currentPeriod ? formatDate(new Date(sp.currentPeriod.endUnix * 1000).toISOString()) : null

  return (
    <CardShell>
      <Header
        title="4626.fun in-chat commands"
        subtitle={subtitleForStatus(scope.status)}
        status={scope.status}
      />

      <div className="mt-4 space-y-3 text-sm">
        <Row label="Sub-account">
          <CopyableAddress address={sub.address} />
          <a
            href={`https://basescan.org/address/${sub.address}`}
            target="_blank"
            rel="noreferrer"
            className="ml-2 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
          >
            Basescan <ExternalLink className="h-3 w-3" />
          </a>
        </Row>

        <Row label="Funded by">
          <span className="text-xs text-zinc-400">Your CSW via signed SpendPermission</span>
          <CopyableAddress address={sub.parentCsw} variant="muted" className="ml-2" />
        </Row>

        <Row label="Caps">
          <span className="text-xs text-zinc-300">
            {perTxEth ? `${perTxEth} ETH / tx · ` : null}
            {allowanceEth} ETH / {periodLabel}
          </span>
        </Row>

        {sp.currentPeriod ? (
          <Row label="This window">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-300">
                {spentEth} ETH used · {remainingEth} ETH remaining
              </span>
              <UsageBar spendWei={sp.currentPeriod.spendWei} allowanceWei={sp.allowanceWei} />
              {windowResetLabel ? (
                <span className="text-[10px] text-zinc-600">Resets {windowResetLabel}</span>
              ) : null}
            </div>
          </Row>
        ) : (
          <Row label="This window">
            <span className="text-xs text-zinc-500">Usage temporarily unavailable.</span>
          </Row>
        )}

        <Row label="Permission">
          <span className="text-xs text-zinc-300">
            {labelForStatus(scope.status)} · expires {endAtLabel}
          </span>
        </Row>
      </div>

      {scope.status === 'active' ? (
        <p className="mt-4 text-[11px] text-zinc-600">
          Revoke + re-provision actions ship in the next release. Until then, contact support to
          stop in-chat spending.
        </p>
      ) : scope.status === 'revoked' ? (
        <p className="mt-4 text-[11px] text-amber-300/80">
          This spend permission has been revoked. In-chat commands will refuse with{' '}
          <code>spend_permission_revoked</code>. Contact support to re-provision.
        </p>
      ) : scope.status === 'expired' ? (
        <p className="mt-4 text-[11px] text-amber-300/80">
          The spend permission window ended. Re-provisioning is required before the next in-chat
          command can execute.
        </p>
      ) : null}
    </CardShell>
  )
}

// ─── Internal primitives ───────────────────────────────────────────────────

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">{children}</section>
  )
}

function Header({
  title,
  subtitle,
  status,
}: {
  title: string
  subtitle: string
  status?: ExecutionScopeStatus
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
          Execution scopes
        </div>
        {status ? <StatusPill status={status} /> : null}
      </div>
      <h3 className="mt-1 text-lg font-medium text-white">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
    </div>
  )
}

function StatusPill({ status }: { status: ExecutionScopeStatus }) {
  const map: Record<ExecutionScopeStatus, { label: string; className: string }> = {
    loading: { label: 'Loading', className: 'bg-white/5 text-zinc-400 border-white/10' },
    unauthenticated: { label: '', className: '' },
    not_provisioned: {
      label: 'Not enabled',
      className: 'bg-zinc-800/40 text-zinc-300 border-zinc-700/50',
    },
    active: {
      label: 'Active',
      className: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30',
    },
    revoked: { label: 'Revoked', className: 'bg-amber-500/10 text-amber-300 border-amber-400/30' },
    expired: { label: 'Expired', className: 'bg-amber-500/10 text-amber-300 border-amber-400/30' },
    error: { label: 'Error', className: 'bg-rose-500/10 text-rose-300 border-rose-400/30' },
  }
  const spec = map[status]
  if (!spec.label) return null
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${spec.className}`}
    >
      {spec.label}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="w-28 shrink-0 text-[10px] uppercase tracking-wider text-zinc-600 font-medium pt-0.5">
        {label}
      </div>
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function UsageBar({
  spendWei,
  allowanceWei,
}: {
  spendWei: string
  allowanceWei: string
}) {
  let pct = 0
  try {
    const spend = Number(BigInt(spendWei) * 1000n) / Number(BigInt(allowanceWei))
    pct = Math.max(0, Math.min(1, spend / 1000))
  } catch {
    pct = 0
  }
  const pctStr = `${Math.round(pct * 100)}%`
  const color = pct > 0.9 ? 'bg-rose-400/80' : pct > 0.6 ? 'bg-amber-300/80' : 'bg-emerald-400/80'
  return (
    <div className="h-1.5 w-full max-w-sm rounded-full bg-white/5 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: pctStr }} />
    </div>
  )
}

function SkeletonCard() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="h-3 w-24 rounded bg-white/5" />
      <div className="mt-3 h-5 w-56 rounded bg-white/10" />
      <div className="mt-2 h-3 w-80 rounded bg-white/5" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-3 w-48 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Formatters ────────────────────────────────────────────────────────────

function formatEth(wei: string): string {
  try {
    const n = Number(BigInt(wei)) / 1e18
    if (!Number.isFinite(n)) return '—'
    if (n === 0) return '0'
    if (n < 0.0001) return n.toExponential(2)
    return n.toFixed(n < 0.01 ? 6 : 4)
  } catch {
    return '—'
  }
}

function formatPeriod(seconds: number): string {
  if (seconds <= 0) return 'period'
  if (seconds === 86_400) return '24h'
  if (seconds === 3_600) return '1h'
  if (seconds === 60) return '1m'
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`
  return `${seconds}s`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return '—'
  }
}

function subtitleForStatus(status: ExecutionScopeStatus): string {
  switch (status) {
    case 'active':
      return 'Enabled. 4626 can execute in-chat commands within your signed caps.'
    case 'revoked':
      return 'This spend permission has been revoked. In-chat commands are refused.'
    case 'expired':
      return 'The spend permission window has ended. Re-provisioning is required.'
    default:
      return ''
  }
}

function labelForStatus(status: ExecutionScopeStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'revoked':
      return 'Revoked'
    case 'expired':
      return 'Expired'
    default:
      return 'Unknown'
  }
}
