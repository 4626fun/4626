import { ExternalLink } from 'lucide-react'

export type AgentPublishData = {
  uriPolicy: {
    mode: string
    preferredOnchainUri: string
    preferredOnchainUriKind: string
    mirrorUrl: string
    domainVerificationUrl: string
    compatibilityFallbackUrl: string | null
    writeOnchainHint: string
  }
  groveStatus: 'stored' | 'unavailable' | 'skipped'
  grove?: {
    lensUri: string
    gatewayUrl: string
    storageKey: string
    statusUrl: string | null
  }
}

export type AgentPublishStatusView = {
  canonicalUriReady: boolean
  groveStored: boolean
  groveUnavailable: boolean
  groveSkipped: boolean
  canonicalMessage: string
  groveMessage: string
}

export function getAgentPublishStatusView(publish: AgentPublishData): AgentPublishStatusView {
  const canonicalUriReady = Boolean(publish.uriPolicy?.preferredOnchainUri)
  const groveStored = publish.groveStatus === 'stored'
  const groveUnavailable = publish.groveStatus === 'unavailable'
  const groveSkipped = publish.groveStatus === 'skipped'

  return {
    canonicalUriReady,
    groveStored,
    groveUnavailable,
    groveSkipped,
    canonicalMessage: canonicalUriReady
      ? 'Canonical immutable URI ready for onchain write.'
      : 'Canonical immutable URI is not ready yet.',
    groveMessage: groveStored
      ? 'Grove fallback stored successfully.'
      : groveUnavailable
        ? 'Grove fallback is unavailable right now.'
        : 'Grove fallback was skipped for this request.',
  }
}

type AgentPublishStatusProps = {
  publish: AgentPublishData
  onUseGatewayUrl?: (gatewayUrl: string) => void
  className?: string
}

export function AgentPublishStatus({ publish, onUseGatewayUrl, className }: AgentPublishStatusProps) {
  const view = getAgentPublishStatusView(publish)
  const baseClassName = className ?? 'space-y-2'

  return (
    <div className={baseClassName}>
      {publish.uriPolicy?.preferredOnchainUri ? (
        <div className="space-y-1 text-xs text-zinc-500">
          <div className="text-emerald-300/90">{view.canonicalMessage}</div>
          <div>
            Canonical immutable URI:
            <span className="ml-1 font-mono text-zinc-300">{publish.uriPolicy.preferredOnchainUriKind}</span>
          </div>
          <div className="break-all font-mono text-zinc-300">{publish.uriPolicy.preferredOnchainUri}</div>
          <div>
            Public mirror: <span className="text-zinc-300">{publish.uriPolicy.mirrorUrl}</span>
          </div>
        </div>
      ) : null}

      <div className={`text-xs ${view.groveStored ? 'text-emerald-300/90' : view.groveUnavailable ? 'text-amber-300/90' : 'text-zinc-500'}`}>
        {view.groveMessage}
      </div>

      {publish.grove?.lensUri ? (
        <div className="text-xs text-zinc-500">
          Grove storage URI: <span className="font-mono text-zinc-300">{publish.grove.lensUri}</span>
        </div>
      ) : null}

      {publish.grove?.gatewayUrl ? (
        <div className="space-y-1">
          <a
            className="inline-flex items-center gap-1 text-xs text-brand-accent hover:text-brand-primary"
            href={publish.grove.gatewayUrl}
            target="_blank"
            rel="noreferrer"
          >
            View Grove gateway
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="text-xs text-zinc-500">
            Compatibility fallback for scanners that cannot resolve the canonical immutable URI.
          </div>
          {onUseGatewayUrl ? (
            <div>
              <button
                type="button"
                onClick={() => onUseGatewayUrl(publish.grove?.gatewayUrl ?? '')}
                className="text-xs text-zinc-300 hover:text-white transition-colors"
              >
                Use gateway URL anyway (requires allowlist)
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
