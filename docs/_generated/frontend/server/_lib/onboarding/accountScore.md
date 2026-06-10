[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onboarding/accountScore

# server/\_lib/onboarding/accountScore

## Type Aliases

### NormalizedAccountScore

> **NormalizedAccountScore** = `object`

Defined in: [server/\_lib/onboarding/accountScore.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/accountScore.ts#L18)

#### Properties

##### points

> **points**: `number`

Defined in: [server/\_lib/onboarding/accountScore.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/accountScore.ts#L20)

Canonical public points total (waitlist, leaderboard, tray, lottery).

##### tier

> **tier**: `number`

Defined in: [server/\_lib/onboarding/accountScore.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/accountScore.ts#L21)

## Functions

### buildAccountScoreFromBreakdown()

> **buildAccountScoreFromBreakdown**(`breakdown`): [`NormalizedAccountScore`](#normalizedaccountscore)

Defined in: [server/\_lib/onboarding/accountScore.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/accountScore.ts#L35)

#### Parameters

##### breakdown

[`WaitlistPointsBreakdown`](waitlistScoring.md#waitlistpointsbreakdown)

#### Returns

[`NormalizedAccountScore`](#normalizedaccountscore)

***

### normalizeAccountScore()

> **normalizeAccountScore**(`input`): [`NormalizedAccountScore`](#normalizedaccountscore)

Defined in: [server/\_lib/onboarding/accountScore.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/accountScore.ts#L24)

#### Parameters

##### input

###### points?

`unknown`

###### tier?

`unknown`

#### Returns

[`NormalizedAccountScore`](#normalizedaccountscore)

***

### normalizeNonNegativeInt()

> **normalizeNonNegativeInt**(`value`): `number`

Defined in: [server/\_lib/onboarding/accountScore.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/accountScore.ts#L12)

#### Parameters

##### value

`unknown`

#### Returns

`number`

***

### waitlistTierFromPoints()

> **waitlistTierFromPoints**(`points`): `number`

Defined in: [server/\_lib/onboarding/accountScore.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onboarding/accountScore.ts#L4)

Mirrors client `tierFromPoints` in `waitlistTiers.ts`.

#### Parameters

##### points

`number`

#### Returns

`number`
