/** Best-effort pre-sign refresh when the wallet client exposes `refreshSession`. */
export async function refreshWalletClientSession(walletClient: unknown): Promise<void> {
  const refreshSession = (walletClient as { refreshSession?: () => Promise<unknown> } | null)?.refreshSession
  if (typeof refreshSession !== 'function') return
  await refreshSession().catch(() => null)
}
