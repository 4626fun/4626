// Best-effort snapshot of what a wallet provider thinks the connected session
// is, used by the CSW signature probe to surface Base App sub-account
// substitution before a probe sign even runs.
//
// Coinbase Wallet SDK in sub-account mode (see `createSubAccountSigner.ts` in
// cb-sdk) returns the sub-account address from `eth_accounts`, not the parent
// CSW. The popup then signs with the sub-account's per-session key — a key
// that is never on-chain. That mismatch is the root cause of the red verdict
// users see in the probe; reading `eth_accounts` directly off the connector's
// provider lets us state it plainly *before* the user clicks sign.
//
// All RPCs are best-effort (Promise.allSettled). A failed call surfaces as a
// `yellow` warningState so the existing probe flow is never blocked by a
// snapshot read.
//
// This module is pure: caller passes the provider request fn (and optional
// wagmi address + target CSW). Tests mock the request fn directly.

export type WalletSessionWarningState = 'green' | 'amber' | 'yellow'

export type WalletSessionSnapshot = {
  // Raw RPC results. Null when the call failed or returned nothing usable.
  ethAccountsAddress: `0x${string}` | null
  ethChainIdHex: `0x${string}` | null
  walletCapabilities: Record<string, unknown> | null
  // Echo of the wagmi-side address we were asked to compare against. Lets the
  // UI render "wagmi useAccount(): 0x…" alongside `eth_accounts[0]` even when
  // they agree.
  wagmiAddress: `0x${string}` | null
  // Echo of the configured CSW address (the one the probe is targeting). If
  // ethAccountsAddress !== cswAddress, the provider is operating on something
  // else (typically a Base App sub-account session key).
  cswAddress: `0x${string}` | null
  // Tri-state outcome:
  //   green  — eth_accounts[0] === wagmiAddress === cswAddress
  //   amber  — eth_accounts[0] !== cswAddress (sub-account substitution)
  //   yellow — at least one read failed; we can't say
  warningState: WalletSessionWarningState
  // Human-readable summary of `warningState`. Surfaced verbatim in the UI.
  message: string
  // Per-RPC error strings, for the JSON dump appended to bug reports.
  errors: {
    ethAccounts: string | null
    ethChainId: string | null
    walletCapabilities: string | null
  }
}

export type WalletSessionRequestFn = (args: {
  method: string
  params?: unknown[]
}) => Promise<unknown>

export type CaptureWalletSessionSnapshotInput = {
  // Provider request fn. Typically the wagmi connector's `getProvider().request`,
  // but any object exposing `request({ method, params })` works.
  request: WalletSessionRequestFn | null | undefined
  // Address from wagmi `useAccount()`. Used only for display; not used to derive
  // warningState (we always trust eth_accounts as the authority for what the
  // provider thinks).
  wagmiAddress: `0x${string}` | null | undefined
  // The CSW the probe is targeting. The whole point of the comparison is
  // "is the provider operating on this CSW?" — null means we can't compare.
  cswAddress: `0x${string}` | null | undefined
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err ?? 'unknown error')
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return null
  return value.toLowerCase() as `0x${string}`
}

function normalizeChainIdHex(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string') return null
  if (!/^0x[0-9a-fA-F]+$/.test(value)) return null
  return value.toLowerCase() as `0x${string}`
}

function pickFirstAccount(value: unknown): `0x${string}` | null {
  if (!Array.isArray(value)) return null
  const first = value[0]
  return normalizeAddress(first)
}

// Lowercase-equality helper. Address comparisons in this module are always
// case-insensitive — `eth_accounts` and `useAccount()` differ on checksum case
// across providers and we don't want that to flip the warning state.
function eqAddress(a: `0x${string}` | null, b: `0x${string}` | null): boolean {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

export async function captureWalletSessionSnapshot(
  input: CaptureWalletSessionSnapshotInput,
): Promise<WalletSessionSnapshot> {
  const cswAddress = normalizeAddress(input.cswAddress ?? null)
  const wagmiAddress = normalizeAddress(input.wagmiAddress ?? null)

  if (!input.request) {
    return {
      ethAccountsAddress: null,
      ethChainIdHex: null,
      walletCapabilities: null,
      wagmiAddress,
      cswAddress,
      warningState: 'yellow',
      message:
        'No wallet provider request() available — cannot read eth_accounts. Connect a wallet first.',
      errors: {
        ethAccounts: 'no provider request fn',
        ethChainId: 'no provider request fn',
        walletCapabilities: 'no provider request fn',
      },
    }
  }

  const req = input.request
  const [accountsRes, chainIdRes, capsRes] = await Promise.allSettled([
    req({ method: 'eth_accounts' }),
    req({ method: 'eth_chainId' }),
    // wallet_getCapabilities is widely unsupported (EIP-5792); never assume
    // success. Most connectors throw "method not supported".
    req({ method: 'wallet_getCapabilities' }),
  ])

  const ethAccountsAddress =
    accountsRes.status === 'fulfilled' ? pickFirstAccount(accountsRes.value) : null
  const ethChainIdHex =
    chainIdRes.status === 'fulfilled' ? normalizeChainIdHex(chainIdRes.value) : null
  const walletCapabilities =
    capsRes.status === 'fulfilled' && capsRes.value && typeof capsRes.value === 'object'
      ? (capsRes.value as Record<string, unknown>)
      : null

  const errors = {
    ethAccounts:
      accountsRes.status === 'rejected'
        ? describeError(accountsRes.reason)
        : ethAccountsAddress === null
          ? 'eth_accounts returned no address'
          : null,
    ethChainId:
      chainIdRes.status === 'rejected'
        ? describeError(chainIdRes.reason)
        : ethChainIdHex === null
          ? 'eth_chainId returned no chain id'
          : null,
    walletCapabilities:
      capsRes.status === 'rejected' ? describeError(capsRes.reason) : null,
  }

  // Decide the warning state. eth_accounts is the source of truth: if it failed
  // outright we go yellow. If it returned an address that doesn't match the CSW
  // the user wired up, that's the sub-account substitution case — amber.
  let warningState: WalletSessionWarningState
  let message: string

  if (!ethAccountsAddress) {
    warningState = 'yellow'
    message =
      'Could not read eth_accounts from the connected provider. Snapshot is incomplete; the probe will still run.'
  } else if (!cswAddress) {
    warningState = 'yellow'
    message = `Provider reports eth_accounts[0]=${ethAccountsAddress}. No CSW address configured to compare against.`
  } else if (eqAddress(ethAccountsAddress, cswAddress)) {
    warningState = 'green'
    message = `Provider is operating on the CSW directly (${cswAddress}). The popup will sign as the CSW.`
  } else {
    warningState = 'amber'
    message =
      `Provider is reporting a sub-account address (${ethAccountsAddress}), not the CSW (${cswAddress}). ` +
      'The popup will sign with the sub-account’s ephemeral session key — that key is never on-chain ' +
      'and the resulting signature will be rejected by ERC-1271 and the bundler. Use the EOA-owner ' +
      'submission lane.'
  }

  return {
    ethAccountsAddress,
    ethChainIdHex,
    walletCapabilities,
    wagmiAddress,
    cswAddress,
    warningState,
    message,
    errors,
  }
}
