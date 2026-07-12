/**
 * Pure helpers for BribeDepot4626 claim preview (pro-rata by finalized gauge weights).
 */

export function previewBribeClaim(params: {
  totalBribes: bigint
  userWeight: bigint
  vaultWeight: bigint
}): bigint {
  const { totalBribes, userWeight, vaultWeight } = params
  if (totalBribes === 0n || userWeight === 0n || vaultWeight === 0n) return 0n
  return (totalBribes * userWeight) / vaultWeight
}

export function shortAddress(addr: string, left = 6, right = 4): string {
  if (!addr || addr.length < left + right + 2) return addr
  return `${addr.slice(0, left)}…${addr.slice(-right)}`
}
