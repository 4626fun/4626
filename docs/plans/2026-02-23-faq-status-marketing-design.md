# FAQ Navigation + Marketing Status Route (Design)

## Context

4626.fun is a Vite + React Router SPA deployed on Vercel. The app has two host modes:

- **marketing**: `4626.fun` and `www.4626.fun`
- **app**: `app.4626.fun` (and local dev)

Routing behavior is split across:

- `frontend/src/RootRouter.tsx`: redirects marketing → app for "app-only" paths
- `frontend/src/App.tsx`: `MarketingOnlyRoute` redirects app → marketing for marketing-only routes
- `frontend/src/lib/appOnlyPaths.ts`: list of app-only prefixes

## Problems

1) The FAQ route exists (`/faq`) and the How-It-Works FAQ route exists (`/faq/how-it-works`), but the How-It-Works page ends with a "What to verify" block that is no longer the desired call-to-action.

2) The Status page is currently treated as app-only and acceptance-gated. We want `https://4626.fun/status` to be the canonical URL and accessible publicly (read-only checks), with `https://app.4626.fun/status` redirecting over.

3) The Status "Verify a vault" section needs a clearer, shareable flow and a concrete AKITA example address:

- `0xA015954E2606d08967Aee3787456bB3A86a46A42`

## Goals

- Replace the "What to verify" section on `/faq/how-it-works` with a prominent navigation CTA to `/faq`.
- Serve `/status` on `4626.fun` (marketing-canonical) and redirect from `app.4626.fun/status` → `4626.fun/status`.
- Make `/status` public (no session / no waitlist acceptance required) for read-only checks.
- Update Status "Verify a vault" UI to:
  - keep the description ("Paste a vault address to generate a shareable report.")
  - keep "Use AKITA example" but change it to *only fill the input*
  - require an explicit "Run checks" click to generate the shareable `?vault=` URL
  - show the Basescan link + report output after "Run checks"
- Maintain SEO safety for the diagnostic Status page:
  - `noindex, nofollow`
  - canonical remains `https://4626.fun/status`

## Non-goals

- Changing or expanding the Status API checks (`/api/status/*`) logic.
- Adding new navigation items to the marketing navbar.
- Making Status indexable (it must remain noindex).

## Proposed Changes

### FAQ How-It-Works CTA

File: `frontend/src/pages/FaqHowItWorks.tsx`

- Remove the existing "What to verify" card.
- Add a CTA card (same "surface" styling) that links to `/faq`.

### Move `/status` to marketing domain

Files:

- `frontend/src/lib/appOnlyPaths.ts`
  - Remove `/status` so marketing host does not auto-redirect to `app.4626.fun`.

- `frontend/src/App.tsx`
  - Move the `/status` route out of the acceptance-gated section.
  - Wrap it in `MarketingOnlyRoute` in the public routes section so app host redirects to marketing host.

### Status "Verify a vault" UX

File: `frontend/src/pages/status/Status.tsx`

- Adjust the "Use AKITA example" button:
  - fills the input only (does not set `?vault=` automatically)
- Only show the "shareable" address row + Basescan link after `?vault=` is present (i.e. after Run checks).
- Keep error rendering so the API response (including "Vault is not readable (or not a CreatorOVault)") is surfaced verbatim.

## Testing / Validation (manual)

- Visit `https://4626.fun/status` and confirm the page renders.
- Visit `https://app.4626.fun/status` and confirm it redirects to `https://4626.fun/status`.
- On `/status`:
  - Click "Use AKITA example" and confirm only the input changes.
  - Click "Run checks" and confirm the URL becomes `/status?vault=0xA015...`.
  - Confirm "View on Basescan" appears for that address.
  - Confirm the vault report shows either checks or an error message (e.g. "Vault is not readable (or not a CreatorOVault)").
- Visit `https://4626.fun/faq/how-it-works` and confirm the bottom CTA navigates to `https://4626.fun/faq`.
