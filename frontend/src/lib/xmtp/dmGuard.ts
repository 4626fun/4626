export function normalizeDmGuardAddress(value: string | null | undefined): `0x${string}` | null {
  const raw = String(value ?? '').trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase() as `0x${string}`
}

export function shouldBlockSelfDm(params: {
  peerAddress: string | null | undefined
  identityAddress: string | null | undefined
}): boolean {
  void params
  // Self-DMs are allowed so users can message their own identity.
  return false
}
