# Waitlist Wallet Snapshot and Account Experience (Design)

## Context

Users on the waitlist completion modal need immediate confidence about wallet identity and activation setup. The existing modal emphasizes verification and referrals but does not surface the connected owner wallet and canonical Coinbase Smart Wallet together in one clear, actionable snapshot.

The `/account` surface already contains rich data and management controls, but the information hierarchy is dense and less visually intentional than needed for fast comprehension.

## Approved Product Decisions

- `/account` must be available on both domains:
  - `4626.fun/account`
  - `app.4626.fun/account`
- Unauthenticated users who hit `/account` should be redirected to waitlist entry.
- Advanced controls remain visible on the account page (not hidden behind an advanced-only route).

## Goals

1. Add a wallet snapshot section to waitlist done modal with:
   - Connected owner wallet (EOA)
   - Canonical Zora Coinbase Smart Wallet
   - Account links (current host and explicit app host)
2. Improve account page visual hierarchy for:
   - Wallet architecture understanding
   - Creator coin discovery
   - Associated social/account references
3. Preserve current business logic and permission checks.

## Non-goals

- Changing allowlist/session gating logic semantics.
- Removing power-user operations (owner revoke, embedded export, Solana role controls).
- Altering wallet authority model or canonical wallet derivation.

## UX Direction

### Waitlist Done Modal

- Add a **Wallet Snapshot** card directly below pre-provisioning status.
- Use selective semantic markers:
  - `◉` Connected Owner Wallet
  - `⬢` Canonical Smart Wallet
- Keep copy concise, confidence-oriented, and non-technical.
- Include links:
  - Current host account page (`/account`)
  - Explicit app account (`https://app.4626.fun/account`)

### Account Page

- Introduce a top-level “control plane” summary with programmatic signals:
  - Connected owner wallet
  - Canonical smart wallet
  - Creator coin status
  - Access status
- Keep all existing controls, but group them into clearer visual cards:
  - Identity + Wallet Architecture
  - Creator Profile + Coin
  - Access + Operational controls
- Apply theme-consistent color coding:
  - Blue: canonical/system-of-record
  - Emerald: verified/healthy
  - Amber: pending/action required
  - Rose: destructive actions

## Routing/Host Behavior

- Allow `/account` and `/settings` to render on marketing host by removing them from app-only host redirect list.
- Keep session and acceptance guards unchanged.

## Verification Plan

- Typecheck and targeted tests:
  - `pnpm vitest run src/lib/appOnlyPaths.test.ts` (new test)
  - `pnpm vitest run src/lib/uniswap/tradingApi.test.ts` (safety spot-check)
  - `pnpm typecheck`
- Lint check on touched files via `ReadLints`.
- Manual sanity:
  - Waitlist done modal renders connected + canonical wallets.
  - Links open correct account paths on both domains.
  - `/account` accessible on both hosts when authenticated; redirects to waitlist when not.

