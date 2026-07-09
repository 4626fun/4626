export type PrivyClientStatus = 'disabled' | 'loading' | 'ready'

/**
 * Once Privy reports ready, ignore later `ready: false` flaps.
 * Base App / Coinbase in-app WebViews commonly re-enter loading during
 * injected-provider races; treating those as not-ready remounts waitlist
 * under AppLoadingBootstrapGate and looks like a broken flicker.
 */
export function latchPrivyClientStatus(
  previous: PrivyClientStatus,
  next: PrivyClientStatus,
): PrivyClientStatus {
  if (previous === 'ready') return 'ready'
  return next
}
