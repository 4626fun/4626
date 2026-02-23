# FAQ + Status Marketing Canonicalization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `https://4626.fun/status` the canonical Status page (public read-only) and update `/faq/how-it-works` to link users back to `/faq`, while improving the Status "Verify a vault" flow with an AKITA example.

**Architecture:** Treat `/status` as marketing-canonical by removing it from the marketing→app redirect list and wrapping the route in `MarketingOnlyRoute` so app→marketing redirects happen automatically. Update page-level UI/copy in `Status.tsx` and `FaqHowItWorks.tsx` without changing API behavior.

**Tech Stack:** Vite, React Router, TypeScript, TanStack Query, wagmi, Vercel serverless handlers.

---

### Task 1: Make `/status` marketing-canonical

**Files:**
- Modify: `frontend/src/lib/appOnlyPaths.ts`
- Modify: `frontend/src/App.tsx`

**Step 1: Update app-only path list**

- Remove `/status` from `APP_ONLY_PATHS`.
- Keep other app-only routes unchanged.

**Step 2: Update the router to serve Status publicly**

- Move the `/status` route into the public routes section under `Layout`.
- Wrap in `MarketingOnlyRoute` so `app.4626.fun/status` redirects to `4626.fun/status`.

**Step 3: Run typecheck**

Run: `pnpm -C frontend typecheck`
Expected: PASS

**Step 4: Manual smoke test**

- Open `https://4626.fun/status` (should render)
- Open `https://app.4626.fun/status` (should redirect to `https://4626.fun/status`)

---

### Task 2: Update Status "Verify a vault" UX + AKITA example

**Files:**
- Modify: `frontend/src/pages/Status.tsx`

**Step 1: Adjust "Use AKITA example" behavior**

- Change the button to only fill the input field with `AKITA.vault`.
- Do not set `?vault=` until the user clicks "Run checks".

**Step 2: Ensure shareable report behavior matches copy**

- Only show the "shareable" address row + Basescan link after a vault param exists (after Run checks).

**Step 3: Run lint**

Run: `pnpm -C frontend lint`
Expected: PASS

**Step 4: Manual smoke test**

On `https://4626.fun/status`:

- Click "Use AKITA example"
- Confirm input becomes `0xA015954E2606d08967Aee3787456bB3A86a46A42`
- Click "Run checks"
- Confirm URL becomes `/status?vault=0xA015954E2606d08967Aee3787456bB3A86a46A42`
- Confirm "View on Basescan" link appears
- Confirm the vault report renders checks OR displays the API error (including "Vault is not readable (or not a CreatorOVault)")

---

### Task 3: Replace `/faq/how-it-works` bottom CTA

**Files:**
- Modify: `frontend/src/pages/FaqHowItWorks.tsx`

**Step 1: Replace the "What to verify" card**

- Remove the existing Status verification copy.
- Add a CTA card linking to `/faq`.

**Step 2: Manual smoke test**

- Open `https://4626.fun/faq/how-it-works`
- Confirm the CTA navigates to `https://4626.fun/faq`

---

### Task 4: Final verification pass

**Step 1: Run build**

Run: `pnpm -C frontend build`
Expected: PASS

**Step 2: Confirm no accidental SEO regression**

- Status page still injects `meta[name="robots"]=noindex, nofollow`
- Status page canonical remains `https://4626.fun/status`

