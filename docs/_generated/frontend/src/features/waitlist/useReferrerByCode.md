[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useReferrerByCode

# src/features/waitlist/useReferrerByCode

## Type Aliases

### ReferrerDisplay

> **ReferrerDisplay** = `object`

Defined in: [src/features/waitlist/useReferrerByCode.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useReferrerByCode.ts#L7)

#### Properties

##### display

> **display**: `string`

Defined in: [src/features/waitlist/useReferrerByCode.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useReferrerByCode.ts#L8)

##### pointsTotal

> **pointsTotal**: `number`

Defined in: [src/features/waitlist/useReferrerByCode.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useReferrerByCode.ts#L9)

##### rank

> **rank**: `number` \| `null`

Defined in: [src/features/waitlist/useReferrerByCode.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useReferrerByCode.ts#L10)

## Functions

### useReferrerByCode()

> **useReferrerByCode**(`rawCode`): `UseQueryResult`\<[`ReferrerDisplay`](#referrerdisplay) \| `null`, `Error`\>

Defined in: [src/features/waitlist/useReferrerByCode.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/useReferrerByCode.ts#L30)

Resolve a referral code to the referrer's public display name + signal.
Returns `null` for unknown codes or when the code is empty/invalid so the
caller can cleanly branch on "show a personalized banner vs not".

Uses the same `normalizeWaitlistReferralCode` rules as the rest of the
waitlist flow, and hits the public `/api/waitlist/referrer` endpoint.

#### Parameters

##### rawCode

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`ReferrerDisplay`](#referrerdisplay) \| `null`, `Error`\>
