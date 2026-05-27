[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/waitlist/canonicalAccountScore

# src/lib/waitlist/canonicalAccountScore

## Type Aliases

### PublicPointsDisplay

> **PublicPointsDisplay** = `object`

Defined in: [src/lib/waitlist/canonicalAccountScore.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/canonicalAccountScore.ts#L4)

#### Properties

##### points

> **points**: `number`

Defined in: [src/lib/waitlist/canonicalAccountScore.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/canonicalAccountScore.ts#L5)

##### tier

> **tier**: `number`

Defined in: [src/lib/waitlist/canonicalAccountScore.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/canonicalAccountScore.ts#L6)

## Functions

### resolvePublicPointsDisplay()

> **resolvePublicPointsDisplay**(`input`): [`PublicPointsDisplay`](#publicpointsdisplay)

Defined in: [src/lib/waitlist/canonicalAccountScore.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/waitlist/canonicalAccountScore.ts#L16)

One public points total for tray, waitlist tiers, and account setup (leaderboard score).

#### Parameters

##### input

###### positionTotal?

`number` \| `null`

Fallback from `/api/accounts/me/points` (tray) before `/api/accounts/me` score hydrates.

###### score?

[`AccountScore`](../../features/accountSetup/types.md#accountscore) \| `null`

#### Returns

[`PublicPointsDisplay`](#publicpointsdisplay)
