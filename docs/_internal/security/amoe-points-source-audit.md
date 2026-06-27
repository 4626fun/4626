# AMOE points-source audit

**Date:** 2026-04-27
**Question:** Under Option B2 (unified points + AMOE/paid drawing parity), does any
paid action credit AMOE-redeemable points?
**TL;DR:** Yes — at least three sources are paid-action-equivalent and currently
fold into AMOE balance via `readUnifiedPointsForSignup` /
`consumeAmoeCreditsForEntry` in
`frontend/server/_lib/lottery/lotteryAmoe.ts:241-264, 425-460`.

## Finding 1 — `has_creator_coin` (80 points per coin)

**File:** `frontend/server/_lib/identity/accountsIdentity.ts:914-922`
**Trigger:** Resolving a Zora profile that owns a creator coin.
**Compliance read:** *Paid action equivalent.* Owning a creator coin requires
having minted/bought/received it on Zora. Even if the user obtained the coin
free, owning it represents capital allocation. State AGs treat "you must hold
token X" as consideration. Awarding AMOE-redeemable points for holding is the
classic "AMOE-in-name-only" pattern.

## Finding 2 — `link_zora` / `link_external_eoa` and other `link_*` events (variable points)

**File:** `frontend/server/_lib/identity/accountsIdentity.ts:827-835, 1013-1082`
**Trigger:** Linking a Zora cross-app account or external EOA wallet.
**Compliance read:** *Borderline.* Linking itself is free, but the EOA being
linked typically holds tokens that cost money to acquire. The simpler defense is
to argue link events are identity proofs, not value proofs. The cleaner posture
is to keep these but exclude them from AMOE-redeemable balance.

## Finding 3 — `resolve_csw` (10 points)

**File:** `frontend/server/_lib/identity/accountsIdentity.ts:904-911`
**Trigger:** Resolving the user's canonical Coinbase Smart Wallet.
**Compliance read:** *Probably fine.* CSW resolution is a free identity check
and the points are tiny (10). Defensible to keep AMOE-redeemable.

## Finding 4 — `referral_passthrough` (mirrors 50% of any referee award)

**File:** `frontend/server/_lib/onboarding/waitlistPoints.ts:355-365`
**Trigger:** Any time a referee earns points, the referrer gets 50% of that
amount as a passthrough.
**Compliance read:** *Tainted by source.* If a referee earns `has_creator_coin`
points (paid action), the referrer's `referral_passthrough` row is also paid-
action-derived. Plaintiff lawyers will argue a points-laundering pattern: pay
to hold a coin, refer a friend who does the same, both get AMOE-eligible
points. The fix is to either remove `referral_passthrough` from the AMOE
weighting CASE, or to filter passthroughs by upstream source at insert time.

## Categorization for the AMOE weighting CASE

Reading `lotteryAmoe.ts:241-264` (the `readUnifiedPointsForSignup` weighting),
here is each branch with a compliance verdict:

| Source pattern | Current weight | Is paid-action? | AMOE-eligible under B2? |
|---|---|---|---|
| `amoe_entry_spend` | 1.00× | n/a (debit) | yes (must remain) |
| `amoe_twitter_daily` | 1.00× | no | yes |
| `amoe_checkin` (via `amoeWaitlistPoints.ts`) | not in CASE — falls through to ELSE 0.30× | no | yes |
| `waitlist_signup` | 1.00× | no (free signup) | yes |
| `csw_link` | 1.00× | no (free identity) | yes |
| `referral_signup` / `referral_csw_link` / `referral_qualified` | 0.60× | depends on referee — borderline | exclude (deprecated anyway) |
| `referral_passthrough` | falls to ELSE 0.30× | **TAINTED** — mirrors 50% of any referee earn including paid actions | **must exclude or filter** |
| `social_*` (`social_x`, `social_zora`, etc.) | 0.50× | no (free social linking) | yes |
| `bonus_*` / `task` | 0.30× | no (free engagement bonuses) | yes |
| `agent_feedback` / `agent_reputation` | 0.40× | no (free product feedback) | yes |
| `lens_identity` | 0.40× | no (free identity proof) | yes |
| `grove_proof` | 0.40× | no (free) | yes |
| `link_email` / `link_google` / `link_apple` / `link_telegram` / `link_tiktok` | 0.60× | no (free social/auth link) | yes |
| `link_twitter` | 0.60× | no | yes |
| `link_external_eoa` | 0.60× | borderline (EOA usually has token holdings) | **exclude to be safe** |
| `link_zora` | 0.60× | borderline | **exclude to be safe** |
| `resolve_csw` | 0.60× | no | yes |
| `has_creator_coin` | 0.60× | **YES** — owning a creator coin | **must exclude** |
| ELSE | 0.30× | unknown future sources | needs explicit allowlist |

## Recommendation

Bifurcate the points ledger into **two SQL views** instead of one weighting
CASE:

1. **`points_total_balance` view** — the existing weighted CASE. Used for
   leaderboard, tier progression, all UI surfaces showing "your points." Stays
   exactly as it is today.
2. **`points_amoe_eligible_balance` view** — a STRICT allowlist of free-only
   sources. Only these contribute to the balance that
   `consumeAmoeCreditsForEntry` checks. The list:
   - `amoe_twitter_daily`, `amoe_checkin`, `amoe_entry_spend`
   - `waitlist_signup`, `csw_link`, `resolve_csw`
   - `social_*`, `bonus_*`, `task`
   - `agent_feedback`, `agent_reputation`, `lens_identity`, `grove_proof`
   - `link_email`, `link_google`, `link_apple`, `link_telegram`, `link_tiktok`,
     `link_twitter`
   - **Excluded:** `has_creator_coin`, `link_external_eoa`, `link_zora`,
     `referral_passthrough`, `referral_*` (deprecated)

This is the database-level enforcement of Option B's wall: "points and lottery
don't touch each other" becomes "all your points show in the UI, but only the
free-action-derived subset can buy AMOE entries."

## Implementation impact

- New migration: `points_amoe_eligible_balance` view (or materialized view, if
  performance demands).
- `consumeAmoeCreditsForEntry` reads from the new view, not the inline CASE.
- `readUnifiedPointsForSignup` is still used for non-AMOE balance; the inline
  CASE there can stay.
- Tests: regression case that planting `has_creator_coin` points doesn't grow
  AMOE balance.

## What the user sees

Today: one points number, used for everything.
After: still one points number for tier/leaderboard. AMOE submit screen shows a
*subset* — "AMOE-eligible: N points" — with a tooltip explaining the difference.
This is a UX lift, not just a backend change.
