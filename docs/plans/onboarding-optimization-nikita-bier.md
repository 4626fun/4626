---
title: Onboarding Optimization Audit
sidebar_position: 1
---

# 4626.fu Onboarding Optimization Audit ("Nikita Bier" style)

## TL;DR
- Your onboarding asks users to process too much before they get a fast win.
- The product currently has **three separate onboarding surfaces** (global tour modal, waitlist verification flow, creator quickstart modal), which creates cognitive overhead and hidden drop-off points.
- The single biggest unlock: **collapse onboarding into one goal-driven path** with a visible progress meter and one immediate payoff loop (social proof + referral momentum).

---

## What the current flow appears to be

1. **Global modal tour** appears once per browser (`cv:onboarding:v1`) with 3 generic steps.
2. If user isn’t accepted/allowlisted, route access sends them to `/waitlist`.
3. Waitlist flow is effectively a **verify → done** funnel with wallet verification, creator ownership checks, optional email, and referral state.
4. After onboarding is dismissed and if creator-authenticated, a **quickstart modal** can trigger additional setup and tx requirements.

This means users can experience: intro tour → waitlist onboarding → quickstart onboarding.

---

## Biggest conversion leaks (priority order)

### 1) Too many onboarding moments (stacked modals)
Users are asked to understand the product multiple times in separate contexts. This fragments intent and increases abandonment.

**Fix:** Merge into one intent-driven entry path:
- "I want to invest"
- "I want to launch"
- "I’m exploring"

Then map each path to one linear checklist.

### 2) Weak first-win timing
The current first meaningful payoff is delayed by verification + waitlist state. Growth products win when users feel progress in <15 seconds.

**Fix:** Give immediate reward states before full completion:
- show estimated rank preview immediately,
- show projected upside from referral actions,
- pre-fill/share referral assets instantly once wallet is connected.

### 3) Verification complexity is front-loaded
Wallet + ownership logic is accurate but heavy for cold users. Heavy gating before motivation kills top-of-funnel.

**Fix:** Progressive disclosure:
- Step 1: connect wallet and reserve spot.
- Step 2: verify ownership only if user selects creator path or attempts creator-only actions.

### 4) Messaging is product-feature-first, not outcome-first
Onboarding copy explains what the app does; it should communicate what the user gets immediately.

**Fix:** Reframe copy around outcomes:
- "Get priority access to launch your vault"
- "Move up the queue by inviting 3 creators"
- "Unlock deploy instantly when approved"

### 5) Missing explicit instrumentation layer
I don’t see onboarding analytics hooks in the core flow components. You can’t optimize what you can’t see.

**Fix:** Add event tracking at each state transition:
- modal_shown / dismissed
- wallet_connected
- ownership_check_pass / fail
- waitlist_submitted
- referral_link_copied
- deploy_cta_clicked

---

## What I would do in the next 14 days

### Phase 1 (Days 1–3): Unify and simplify
- Replace generic 3-slide intro with a **single-screen intent picker**.
- Keep waitlist flow at 2 steps, but defer advanced checks unless user enters creator branch.
- Add a persistent top progress bar: `Connect → Reserve Spot → Boost Rank → Deploy`.

### Phase 2 (Days 4–7): Add growth loops
- On done state, make referral action primary and leaderboard/social proof directly visible.
- Add one-tap share packages (X/Farcaster text prebuilt by persona).
- Show "X invites needed to reach next approval band".

### Phase 3 (Days 8–14): Run experiments
Run fast A/B tests:
1. **Single-screen intent picker** vs current 3-step modal.
2. **Wallet-only reserve** vs full ownership gate before submit.
3. **Referral CTA above fold** vs below fold.
4. **Outcome copy** vs feature copy.

North-star metric: `D1 onboarding completion to meaningful action` (wallet connected + waitlist submitted + referral action).

---

## Concrete UX changes to ship first

1. **Kill the "tour" for returning serious users**
   - If user is on waitlist/deploy-intent route, bypass generic modal.
2. **Make rank momentum tangible**
   - Show live "you moved +N" feedback after each referral action.
3. **Shorten error language**
   - Replace technical wording with action-first prompts ("Switch to payout wallet to continue").
4. **Auto-continue everywhere possible**
   - Reduce "Next" clicks where backend already knows enough to proceed.

---

## KPI dashboard I’d watch daily
- Visit → wallet connected
- Wallet connected → waitlist submit
- Submit → referral copy/share
- Referral share → qualified conversion
- Done step → deploy CTA click
- Time-to-first-win (seconds)
- Drop-off by device + acquisition source

If these aren’t visible in one dashboard, optimization will stall.

---

## Final take
You don’t need more onboarding screens. You need a tighter **motivation loop**:
1) immediate progress,
2) visible status,
3) one clear next action,
4) social/reward feedback.

Compress the flow, make wins obvious, and instrument everything. That’s where the conversion lift is.
