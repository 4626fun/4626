import { AgentPublishStatus, type AgentPublishData } from './AgentPublishStatus'

type VerificationSummary = {
  agentId: number
  discoverabilityReady: boolean
  walletBoundToCanonical: boolean
  tokenUriIsStrictImmutable: boolean
  tokenUriMatchesCanonical: boolean
}

export type AgentOperatorNextAction = {
  id: string
  label: string
  detail: string
}

export type AgentOperatorStatusData = {
  registration: Record<string, unknown>
  publish: AgentPublishData
  discoverability: VerificationSummary
  nextActions: AgentOperatorNextAction[]
  checkedAt: string
}

type BadgeView = {
  label: string
  tone: 'ok' | 'warn'
}

export type AgentOperatorSummaryView = {
  readinessBadge: BadgeView
  walletBadge: BadgeView
  uriBadge: BadgeView
  summaryMessage: string
}

function getBadgeClassName(tone: BadgeView['tone']): string {
  return tone === 'ok'
    ? 'bg-emerald-500/15 text-emerald-300'
    : 'bg-amber-500/15 text-amber-200'
}

export function getAgentOperatorSummaryView(status: AgentOperatorStatusData): AgentOperatorSummaryView {
  const readinessBadge: BadgeView = status.discoverability.discoverabilityReady
    ? { label: 'Scanner-ready', tone: 'ok' }
    : { label: 'Needs follow-through', tone: 'warn' }

  const walletBadge: BadgeView = status.discoverability.walletBoundToCanonical
    ? { label: 'agentWallet verified', tone: 'ok' }
    : { label: 'agentWallet not bound', tone: 'warn' }

  const uriBadge: BadgeView =
    status.discoverability.tokenUriIsStrictImmutable && status.discoverability.tokenUriMatchesCanonical
      ? { label: 'tokenURI canonical', tone: 'ok' }
      : { label: 'tokenURI drift', tone: 'warn' }

  return {
    readinessBadge,
    walletBadge,
    uriBadge,
    summaryMessage:
      status.nextActions.length > 0
        ? `Follow the items below before treating agent ${status.discoverability.agentId} as scanner-ready.`
        : 'All scanner-facing publish and verification checks are aligned.',
  }
}

type AgentOperatorStatusProps = {
  status: AgentOperatorStatusData
  className?: string
}

export function AgentOperatorStatus({ status, className }: AgentOperatorStatusProps) {
  const view = getAgentOperatorSummaryView(status)
  const baseClassName = className ?? 'space-y-3'

  return (
    <div className={baseClassName}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium text-emerald-200">ERC-8004 operator status</div>
          <div className="app-meta-value text-zinc-500">Checked at {status.checkedAt}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${getBadgeClassName(view.readinessBadge.tone)}`}>
            {view.readinessBadge.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${getBadgeClassName(view.walletBadge.tone)}`}>
            {view.walletBadge.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${getBadgeClassName(view.uriBadge.tone)}`}>
            {view.uriBadge.label}
          </span>
        </div>
      </div>

      <AgentPublishStatus publish={status.publish} className="app-meta-value space-y-2" />

      <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 app-meta-value text-zinc-400">
        {view.summaryMessage}
      </div>

      {status.nextActions.length > 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-3 space-y-2">
          <div className="text-[11px] font-medium text-amber-200">Next actions</div>
          {status.nextActions.map((action) => (
            <div key={action.id} className="app-meta-value text-amber-100/90">
              <div className="text-amber-200">{action.label}</div>
              <div>{action.detail}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
