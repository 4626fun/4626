/**
 * In-app webview / wallet-browser detection.
 *
 * Why this exists: Coinbase Wallet's in-app browser on Android (verified May 4
 * 2026 against build SM-S916U / Android 16 / Chrome 147 webview) signs
 * `eth_signTypedData_v4` with a session key that is NOT an owner of the
 * connected canonical Coinbase Smart Wallet, while wrapping the signature
 * inside an ABI-encoded SignatureWrapper claiming `ownerIndex: 2`.  Because
 * the recovered ECDSA address never matches the on-chain owner, every
 * `eth_sendTransaction` and `wallet_sendCalls` from the in-app browser fails
 * preflight inside the wallet with the misleading user-facing message
 * "Error generating transaction — make sure you have enough funds".
 *
 * `wallet_prepareCalls` also fails — but for a different reason: the in-app
 * browser blocks the popup that the Coinbase Wallet SDK opens against
 * keys.coinbase.com, so the request never reaches the signer endpoint and
 * the wallet returns `ProviderRpcError(1000, "Failed to fetch RPC request")`.
 *
 * Outcome: any flow that needs an owner-bearing signature (owner installs,
 * userOp submission via the EntryPoint, etc.) cannot be completed inside
 * Coinbase Wallet's in-app browser today.  The user MUST open the page in
 * an external browser (Chrome / Safari) so the canonical passkey lane via
 * keys.coinbase.com can run.
 *
 * This module only does detection.  Surfaces (the AddOwner page, future
 * surfaces) own the UX of telling the user to open in Chrome.
 */

/**
 * Snapshot of the host environment we collect once per page render.  Pure
 * data; no React hooks here so it's safe to call from anywhere.
 */
export type InAppEnvironment = {
  /** True iff `window` and `window.ethereum` are available. */
  hasInjectedEthereum: boolean
  /** True for the Coinbase Wallet in-app browser (Android + iOS). */
  isCoinbaseInApp: boolean
  /** True for the Base App / Toshi in-app browser. */
  isBaseAppInApp: boolean
  /**
   * True for any wallet-managed in-app browser.  Catch-all for unknown
   * webviews that look enough like a wallet to warrant routing the user
   * out to a real browser.
   */
  isAnyWalletInApp: boolean
  /** Lower-cased userAgent string for telemetry / debug copy. */
  userAgent: string
}

/**
 * Inspects `window` and the injected provider.  Returns `null` during SSR
 * or when no `window` object is available.
 */
export function detectInAppEnvironment(): InAppEnvironment | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    ethereum?: {
      isCoinbaseWallet?: boolean
      isCoinbaseBrowser?: boolean
      isToshi?: boolean
      isBaseApp?: boolean
    }
  }
  const eth = w.ethereum ?? null
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const uaLower = ua.toLowerCase()

  const cbFlag = Boolean(eth?.isCoinbaseWallet) && Boolean(eth?.isCoinbaseBrowser)
  // Some Android Coinbase Wallet builds set isCoinbaseBrowser only; userAgent
  // contains "wv" (webview) marker.  Combine signals.
  const isCoinbaseInApp =
    cbFlag ||
    (Boolean(eth?.isCoinbaseBrowser) && uaLower.includes('wv')) ||
    /coinbasewallet/.test(uaLower)

  const isBaseAppInApp =
    Boolean(eth?.isToshi) ||
    Boolean(eth?.isBaseApp) ||
    /toshi|baseapp/.test(uaLower)

  return {
    hasInjectedEthereum: Boolean(eth),
    isCoinbaseInApp,
    isBaseAppInApp,
    isAnyWalletInApp: isCoinbaseInApp || isBaseAppInApp,
    userAgent: ua,
  }
}

/**
 * Returns a `https://` URL the user can tap to open the current page in the
 * device default browser, escaping the wallet's in-app webview.
 *
 * Coinbase Wallet's in-app browser respects standard `target="_blank"` only
 * when the link uses a custom intent or universal link.  The most reliable
 * cross-platform escape is to render an `<a href>` with the absolute URL
 * and `rel="noopener noreferrer external"` — the user sees a "Open in
 * external browser" affordance in the wallet's own overflow menu.  Newer
 * Android Coinbase Wallet builds also honour `intent://` URLs with the
 * `S.browser_fallback_url` extra; we prefer the simple absolute URL because
 * it works on iOS too.
 */
export function externalBrowserUrlFor(path: string): string {
  // We always send users to the canonical apex domain to keep the URL
  // stable (`app.4626.fun` and `4626.fun` alias the same Vercel deployment;
  // the apex is shorter to render).
  const base = 'https://4626.fun'
  if (!path) return base
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}
