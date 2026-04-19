[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onboarding/referrals

# server/\_lib/onboarding/referrals

## Functions

### dedupeReferralCodeCandidates()

> **dedupeReferralCodeCandidates**(`values`): `string`[]

Defined in: [server/\_lib/onboarding/referrals.ts:29](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/onboarding/referrals.ts#L29)

#### Parameters

##### values

(`string` \| `null` \| `undefined`)[]

#### Returns

`string`[]

***

### ensureReferralsSchema()

> **ensureReferralsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/onboarding/referrals.ts:68](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/onboarding/referrals.ts#L68)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### getClientIp()

> **getClientIp**(`req`): `string`

Defined in: [server/\_lib/onboarding/referrals.ts:41](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/onboarding/referrals.ts#L41)

#### Parameters

##### req

###### headers?

`Record`\<`string`, `any`\>

#### Returns

`string`

***

### getUserAgent()

> **getUserAgent**(`req`): `string`

Defined in: [server/\_lib/onboarding/referrals.ts:55](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/onboarding/referrals.ts#L55)

#### Parameters

##### req

###### headers?

`Record`\<`string`, `any`\>

#### Returns

`string`

***

### hashForAttribution()

> **hashForAttribution**(`value`): `string` \| `null`

Defined in: [server/\_lib/onboarding/referrals.ts:60](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/onboarding/referrals.ts#L60)

#### Parameters

##### value

`string`

#### Returns

`string` \| `null`

***

### normalizeReferralCode()

> **normalizeReferralCode**(`input`): `string`

Defined in: [server/\_lib/onboarding/referrals.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/onboarding/referrals.ts#L10)

#### Parameters

##### input

`string`

#### Returns

`string`

***

### referralCodeFromEmail()

> **referralCodeFromEmail**(`email`): `string` \| `null`

Defined in: [server/\_lib/onboarding/referrals.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/onboarding/referrals.ts#L21)

#### Parameters

##### email

`string` | `null` | `undefined`

#### Returns

`string` \| `null`
