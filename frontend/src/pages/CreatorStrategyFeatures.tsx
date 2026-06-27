import { useParams, useSearchParams, Navigate } from 'react-router-dom'
import { isAddress, type Address } from 'viem'

export function CreatorStrategyFeatures() {
  const params = useParams<{ identifier?: string }>()
  const [search] = useSearchParams()

  const creatorTokenRaw =
    params.identifier ?? search.get('creator') ?? search.get('creatorToken') ?? ''
  const creatorToken: Address | null = isAddress(creatorTokenRaw)
    ? (creatorTokenRaw as Address)
    : null

  if (creatorToken) {
    return <Navigate to={`/deploy/vault?creator=${creatorToken}`} replace />
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-2xl font-light tracking-tight text-white">Creator strategy features</h1>
      <p className="mt-4 text-sm text-zinc-400">
        Vault deploy activation lives on the deploy page. Open{' '}
        <code className="mono text-brand-accent">/deploy/vault?creator=0x…</code> with your creator coin
        address, or start from{' '}
        <a href="/deploy/vault" className="text-brand-primary hover:text-brand-accent">
          /deploy/vault
        </a>
        .
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        Legacy path <code className="mono">/creator/strategy/features?creator=0x…</code> redirects here
        automatically when a creator address is present.
      </p>
    </div>
  )
}
