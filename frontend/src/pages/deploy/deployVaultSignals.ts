export function isProviderCollisionErrorMessage(input: string | null | undefined): boolean {
  const lower = String(input ?? '').toLowerCase()
  if (!lower) return false
  return (
    lower.includes('cannot redefine property: ethereum') ||
    (lower.includes('cannot set property ethereum') && lower.includes('only a getter')) ||
    lower.includes('metamask encountered an error setting the global ethereum provider') ||
    lower.includes('failed to add embedded wallet connector: wallet proxy not initialized')
  )
}

export function buildShareVanitySkipLogKey(params: {
  batcher: string | null | undefined
  suffix: string | null | undefined
  reason?: string
}): string {
  const reason = params.reason ?? 'phase1_salt_overrides_not_supported'
  return `${String(params.batcher ?? '').toLowerCase()}:${String(params.suffix ?? '').toLowerCase()}:${reason}`
}

export function shouldEmitShareVanitySkipLog(params: {
  lastKey: string | null
  nextKey: string
}): boolean {
  return params.lastKey !== params.nextKey
}

