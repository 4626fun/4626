# Swap Trade UI Redesign (Design)

## Context

The current `frontend/src/pages/Swap.tsx` page already has a stable swap architecture:

- quote + approval + swap/order are executed via Uniswap Trading API proxy handlers in `frontend/api/_handlers/uniswap/*`
- UI is composed in `frontend/src/components/trade/*`
- token metadata is resolved in `frontend/src/hooks/useTokenIdentity.ts` and `frontend/src/lib/uniswap/swapUtils.ts`

The goal is an aggressive visual redesign that blends:

- Uniswap's polished, premium swap-card ergonomics
- DefiLlama-style dense utility controls and market chips

while preserving behavior and route stability on Base mainnet.

## Approved Direction

- **UI Direction:** Aggressive redesign ("UniLlama Hybrid Pro")
- **Routing/Execution Direction:** Keep current Uniswap Trading API execution path as primary

## Goals

1. Redesign swap/trade card and surrounding presentation to feel like a Uniswap + DefiLlama hybrid.
2. Keep all existing swap execution behavior intact (no router-path breakage).
3. Improve token icon reliability with multi-source fallbacks.
4. Keep current routes and interaction semantics stable.

## Non-goals

- Replacing current swap execution with direct zRouter execution in this phase
- Altering canonical routes (`/swap`, `/trade` redirects, etc.)
- Rebuilding backend trading APIs

## Token Icon Source Strategy

Use a deterministic fallback chain for token logo URLs:

1. Uniswap assets repo path
2. TrustWallet assets repo path
3. z0r0z/assets repo path
4. existing dynamic image (`/api/token/image?...`) where applicable
5. symbol avatar fallback

This keeps logos resilient and avoids hard dependency on one source.

## Router Guidance

For this phase:

- Keep Trading API/Universal Router path as default execution.
- Do not replace production execution with alternate router paths in this phase.

Reasoning:

- The current stack is already integrated with approval + quote freshness + Permit2 + canonical CSW/EOA mode handling.
- Alternate router surfaces introduce separate path semantics and risk to approvals, tx-shape assumptions, and user-op flows.
- Prefer preserving one execution path with strict policy and observability.

## UX/Visual Design

### Layout

- Keep existing page route/component structure.
- Upgrade card shell and controls to higher-contrast, layered dark glass aesthetic.
- Add restrained page atmosphere (subtle radial gradient + soft floating motifs) rather than heavy noise.

### Swap Panel

- Improve top segmented controls and route chip styling.
- Increase token surface hierarchy (stronger amount typography + clearer token selector pills).
- Refine flip button and sticky CTA to feel "exchange-grade".
- Keep current swap/liquidity panel switch behavior unchanged.

### Data Chips and Details

- Keep rate/slippage/network/route chips but restyle to a tighter terminal-like strip.
- Preserve existing details sheet behavior.

### Token Selector

- Move to denser, cleaner list rows with improved selected state.
- Keep current grouping/search semantics.

### Settings

- Keep existing fields (`slippage`, `deadline`) but align visual style with new panel.

## Files In Scope

- `frontend/src/lib/uniswap/swapUtils.ts`
- `frontend/src/lib/uniswap/swapUtils.test.ts`
- `frontend/src/pages/Swap.tsx`
- `frontend/src/components/trade/SwapPanel.tsx`
- `frontend/src/components/trade/TokenAmountSurface.tsx`
- `frontend/src/components/trade/TokenSelectorSheet.tsx`
- `frontend/src/components/trade/InfoStrip.tsx`
- `frontend/src/components/trade/FlipButton.tsx`
- `frontend/src/components/trade/SwapSettingsModal.tsx`
- `frontend/src/index.css`

## Validation

- Run targeted unit tests for `swapUtils`
- Run frontend lint checks for edited files
- Manual sanity:
  - token selection
  - flip action
  - quote refresh/review flow
  - settings sheet
  - sticky CTA
  - icon loading/fallback behavior
