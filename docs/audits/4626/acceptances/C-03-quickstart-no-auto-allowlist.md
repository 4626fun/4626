# C-03 (4626-368): Quickstart endpoint is read-only for vault allowlist

**Status:** Closed — already enforced in code
**Linear:** 4626-368
**Sprint:** 7 (verification-only closure)

## Finding

From `docs/audits/4626/reconciliation/C-03-second-pass-P1-reconciliation.md`
row 10:

> "Quickstart endpoint allows self-allowlisting — Fix: remove
> auto-allowlist path in `v1/creators/_quickstart.ts`; gate behind
> admin approval queue."

## Verification

`frontend/api/_handlers/v1/creators/_quickstart.ts::hasApprovedCreatorAccess`
(lines 170–188) only performs a `SELECT` against the `allowlist`
table. There is no `INSERT` or `UPDATE` statement anywhere in the
quickstart handler:

```ts
// Quickstart is strictly read-only for vault allowlist access.
// Approval writes are admin-only via /api/admin/creator-access/approve.
const existing = await db.sql`
  SELECT address
  FROM allowlist
  WHERE (lower(address) = ${addr} OR lower(csw_address) = ${addr})
    AND revoked_at IS NULL
    AND approved_at IS NOT NULL
  LIMIT 1;
`
```

The enforcement point is lines 298–306 of the same handler: if
`hasApprovedCreatorAccess` returns false the endpoint returns a
4xx "Vault allowlist is pending approval" and does not proceed
with any of the downstream registration actions.

Writes to the `allowlist` table are concentrated in
`frontend/api/_handlers/admin/creator-access/` and require admin
auth (`requireAdminApiKey` or keeper-server mTLS), covered by the
regression tests in `frontend/api/__tests__/quickstartAllowlistEnforcement.test.ts`:

- `"rejects unapproved creator addresses"`
- `"does not insert allowlist rows"`
- `"admin approve endpoint is the only write path"`

## Residual risk

- Admin API keys must rotate on compromise. The `ADMIN_API_KEY`
  rotation runbook is tracked separately.
- The quickstart handler still reveals allowlist membership via
  timing (approved vs. pending). This is accepted as it matches
  the UX of the flow (`allowlisted: boolean` is returned in the
  success envelope on purpose).

Fixes: 4626-368 (C-03 P1 #10)
