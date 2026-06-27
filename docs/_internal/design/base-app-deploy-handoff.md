# Base App deploy handoff (Phase 2 design)

Status: design-only — not implemented in product UI.

## Problem

Population **(b)** users hold assets in a Base App / passkey-controlled parent Coinbase Smart Wallet (CSW). Third-party browser dapps cannot complete `addOwnerAddress` on that wallet (Coinbase/Base middleware blocks owner mutations). Deploy v2 requires a temporary deploy-session Privy owner on the **parent CSW**, so the in-browser Deploy page cannot succeed for (b) today.

Population **(c)** (Zora CSW + connectable EOA owner) remains the first-class self-serve deploy path after waitlist Step 2 (`legacy-owner-install`).

## Options

### Option A — (c)-only deploy (current product default)

- Deploy UI gates (b) and (d) with explicit copy.
- Base App users can complete **Connect Base App** (sub-account track) for **swaps only** when `VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` / `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1`.
- Vault deploy for (b) is operator-assisted or deferred until a native Base handoff exists.

**Pros:** Honest, no fake prolinks, minimal security surface.  
**Cons:** (b) creators cannot self-serve deploy.

### Option B — Base-native deploy handoff (future)

Finish vault deploy inside Base App (or a Coinbase-approved prepared-call flow) where passkey/session signing is first-party:

1. User starts deploy on `app.4626.fun` → preflight + strategy payment stay on 4626.
2. Handoff deep-link opens Base App with prepared calls for phase batches (or a reduced signing set).
3. Server deploy-session owner install runs only where Privy/server delegation is already allowed — not from arbitrary browser origins.

**Pros:** Unblocks (b) without weakening CSW owner-mutation policy.  
**Cons:** Requires Base/Coinbase partnership surface; duplicate UX for batch review.

## Recommendation

Ship **Option A** now (Phase 0 + Phase 1). Spec Option B with Base team before building deploy-specific sub-account or Relay owner paths for parent CSW.

## Related docs

- `docs/_internal/ACCOUNT_MODEL.md` — populations (a)–(d)
- `docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md` — why browser owner mutations are retired
- `docs/_internal/design/sub-accounts-baseapp-design.md` — sub-account swap lane
- `frontend/src/lib/deploy/deployEligibility.ts` — deploy gating helper
