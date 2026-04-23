# C-03 (4626-374): Privy wallet policy fail-closed in production

**Status:** Closed — already enforced in code
**Linear:** 4626-374
**Sprint:** 7 (verification-only closure)

## Finding

From `docs/audits/4626/reconciliation/C-03-second-pass-P1-reconciliation.md` row 16:

> "Privy wallet policy enforcement disabled in production — Fix: fail
> closed in production when `PRIVY_WALLET_POLICY_ID` is unset."

## Verification

`frontend/server/_lib/wallet/privyWalletApi.ts::requirePrivyPolicyId`
throws `Error('PRIVY_WALLET_POLICY_ID missing in production')` whenever
`NODE_ENV === 'production'` *or* the Vercel platform env is set and the
policy id is empty:

```ts
function requirePrivyPolicyId(): string | null {
  const id = getPrivyPolicyId()
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const isProd = nodeEnv === 'production' || Boolean((process.env.VERCEL ?? '').trim())
  if (isProd && !id) {
    throw new Error('PRIVY_WALLET_POLICY_ID missing in production')
  }
  return id
}
```

The throw bubbles out of `createAgentWallet` / `signAgentTransaction`
before any wallet creation or signing request is sent, so the control
is fail-closed: a misconfigured production deployment cannot silently
operate with an unpolicied Privy session key.

The behaviour is covered by `frontend/api/__tests__/privyWalletApiPolicy.test.ts`:

- `"fails closed in production when PRIVY_WALLET_POLICY_ID is missing"`
- `"attaches policy ids when present"`

## Residual risk

- Non-production environments still allow unpolicied Privy sessions
  (by design; staging key quorums often run without policy for
  iteration). Operators should enable policies for any long-lived
  non-prod environment.
- The `VERCEL` env check treats any Vercel deployment (including
  preview) as production for policy purposes. Previews that legitimately
  need to run without a policy must set `PRIVY_WALLET_POLICY_ID` to a
  non-restrictive staging policy id.

Fixes: 4626-374 (C-03 P1 #16)
