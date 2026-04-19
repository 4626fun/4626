import { useAutoProvisionSubAccount } from './useAutoProvisionSubAccount'

/**
 * Side-effect-only mount for the `useAutoProvisionSubAccount` hook.
 *
 * Exists because the hook does all its work via `useEffect` and has no
 * direct render; wrapping it in a component with `null` render is the
 * cleanest way to drop it into `AccountsPage.tsx` without threading
 * the hook's return value anywhere.
 *
 * The hook is intentionally scoped to `/accounts` (not the root app
 * shell) — see the module-level docstring in
 * `useAutoProvisionSubAccount.ts` for rationale.
 */
export function AutoProvisionMount() {
  useAutoProvisionSubAccount()
  return null
}
