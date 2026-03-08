type AddressLike = string | null | undefined

function normalizeAddress(value: AddressLike): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) return null
  return raw.toLowerCase()
}

export type AdminWalletRoles = {
  sessionWallet: string | null
  connectedWallet: string | null
  adminWallet: string | null
  executionWallet: string | null
  signingWallet: string | null
  connectedMatchesSession: boolean
}

export function deriveAdminWalletRoles(input: {
  sessionWallet: AddressLike
  connectedWallet: AddressLike
}): AdminWalletRoles {
  const sessionWallet = normalizeAddress(input.sessionWallet)
  const connectedWallet = normalizeAddress(input.connectedWallet)
  const connectedMatchesSession = Boolean(sessionWallet && connectedWallet && sessionWallet === connectedWallet)

  return {
    sessionWallet,
    connectedWallet,
    adminWallet: sessionWallet,
    executionWallet: connectedWallet ?? sessionWallet,
    signingWallet: connectedWallet ?? sessionWallet,
    connectedMatchesSession,
  }
}
