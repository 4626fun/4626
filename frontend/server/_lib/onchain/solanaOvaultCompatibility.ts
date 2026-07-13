export type SolanaAssetMintOrigin = 'existing' | 'new'

export function normalizeSolanaAssetMintOrigin(
  value: unknown,
  fallback: SolanaAssetMintOrigin = 'new',
): SolanaAssetMintOrigin {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (normalized === 'existing') return 'existing'
  if (normalized === 'new') return 'new'
  return fallback
}
