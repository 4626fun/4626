# M-02 / 4626-408 — Pending unpaid activations bypass strategy paywall

## Severity
MEDIUM · Category: Authorization / Paywall bypass

## Finding (from Codex audit 2026-04-23)
`hasLiveActivationForFeature` in
`frontend/server/_lib/creatorStrategy/activations.ts` accepts any row whose
`status` is `pending` OR `active` as an entitlement. A `pending` row is
inserted when a Stripe checkout session (or x402 attempt) is created, BEFORE
the payment has cleared and `payment_verified_at` has been populated by the
webhook. That window grants feature access for free — indefinitely if the user
abandons the checkout.

## Fix
Add `payment_verified_at IS NOT NULL` to the entitlement predicate:

```sql
WHERE creator_token = ${creatorKey}
  AND feature_key = ${featureKey}
  AND status IN ('pending', 'active')
  AND payment_verified_at IS NOT NULL
```

`active` rows are always written by the Stripe webhook with
`payment_verified_at` set (see `upsertActivationFromStripeWebhook`), so the
happy path is unaffected. The only rows dropped are `pending` rows that never
completed payment — exactly the bypass vector.

## Files changed
- `frontend/server/_lib/creatorStrategy/activations.ts` (+15 / -4)

## Acceptance
1. A row in state `pending` with `payment_verified_at = NULL` must NOT grant
   the feature.
2. A row in state `pending` with `payment_verified_at` set (x402 settled but
   provisioner has not flipped to `active` yet) must grant the feature.
3. A row in state `active` with `payment_verified_at` set (normal happy path)
   must grant the feature.
4. Refunded / failed / provisioner-failed rows (any status outside
   `pending`/`active`) must not grant the feature.

## Rollback
Revert this PR. No DB migration, no env changes.

## References
- Call sites of `hasLiveActivationForFeature` gate access in `creator/strategy`
  handlers and agent feature flags.
- Codex finding id: row 2 of `codex-security-findings-2026-04-23T18-31-56.185Z.csv`
