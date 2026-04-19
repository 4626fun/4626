[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/useMyReferralCode

# src/features/waitlist/useMyReferralCode

## Type Aliases

### WaitlistPositionLite

> **WaitlistPositionLite** = `object`

Defined in: [src/features/waitlist/useMyReferralCode.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useMyReferralCode.ts#L11)

Shape mirrored from the `WaitlistPositionResponse` on the server
(`frontend/api/_handlers/waitlist/_position.ts`). Only includes fields this
hook needs — additional fields from the endpoint are ignored.

#### Properties

##### referralCode

> **referralCode**: `string` \| `null`

Defined in: [src/features/waitlist/useMyReferralCode.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useMyReferralCode.ts#L13)

##### referrals

> **referrals**: `object`

Defined in: [src/features/waitlist/useMyReferralCode.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useMyReferralCode.ts#L14)

###### pendingCap

> **pendingCap**: `number`

###### pendingCount

> **pendingCount**: `number`

###### pendingCountCapped

> **pendingCountCapped**: `number`

###### qualifiedCount

> **qualifiedCount**: `number`

##### signupId

> **signupId**: `number`

Defined in: [src/features/waitlist/useMyReferralCode.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useMyReferralCode.ts#L12)

## Functions

### useMyReferralCode()

> **useMyReferralCode**(`email`): `UseQueryResult`\<[`WaitlistPositionLite`](#waitlistpositionlite) \| `null`, `Error`\>

Defined in: [src/features/waitlist/useMyReferralCode.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useMyReferralCode.ts#L46)

Returns the authenticated user's referral code + referral counts.
Returns `null` when the user has no email, isn't authorized for that
profile, or the backend returns no row. This is intentionally a soft
failure — the UI should hide share affordances rather than error.

#### Parameters

##### email

`string` | `null` | `undefined`

#### Returns

`UseQueryResult`\<[`WaitlistPositionLite`](#waitlistpositionlite) \| `null`, `Error`\>
