[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/portfolio/FirstActionsNudge

# src/features/portfolio/FirstActionsNudge

## Variables

### PORTFOLIO\_FIRST\_ACTIONS\_DISMISS\_KEY

> `const` **PORTFOLIO\_FIRST\_ACTIONS\_DISMISS\_KEY**: `"cv:portfolio:first-actions-dismissed"` = `'cv:portfolio:first-actions-dismissed'`

Defined in: [src/features/portfolio/FirstActionsNudge.tsx:14](https://github.com/wenakita/4626/blob/main/frontend/src/features/portfolio/FirstActionsNudge.tsx#L14)

First-run nudge shown on /portfolio. Helps users who just entered the app
find the two or three highest-value starting actions. Dismissible, and the
dismissal persists in localStorage so it only appears once.

Keeps all state client-local (no backend). When localStorage is unavailable,
falls back to in-memory state for the session.

## Functions

### PortfolioFirstActionsNudge()

> **PortfolioFirstActionsNudge**(`__namedParameters`): `Element` \| `null`

Defined in: [src/features/portfolio/FirstActionsNudge.tsx:68](https://github.com/wenakita/4626/blob/main/frontend/src/features/portfolio/FirstActionsNudge.tsx#L68)

#### Parameters

##### \_\_namedParameters

`FirstActionsNudgeProps`

#### Returns

`Element` \| `null`

***

### resetPortfolioFirstActionsNudge()

> **resetPortfolioFirstActionsNudge**(): `void`

Defined in: [src/features/portfolio/FirstActionsNudge.tsx:134](https://github.com/wenakita/4626/blob/main/frontend/src/features/portfolio/FirstActionsNudge.tsx#L134)

Exposed for cases where the help menu wants to re-show the nudge.

#### Returns

`void`
