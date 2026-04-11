[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/referrals

# server/\_lib/referrals

## Functions

### dedupeReferralCodeCandidates()

> **dedupeReferralCodeCandidates**(`values`): `string`[]

Defined in: [server/\_lib/referrals.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/referrals.ts#L29)

#### Parameters

##### values

(`string` \| `null` \| `undefined`)[]

#### Returns

`string`[]

***

### ensureReferralsSchema()

> **ensureReferralsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/referrals.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/referrals.ts#L68)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### getClientIp()

> **getClientIp**(`req`): `string`

Defined in: [server/\_lib/referrals.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/referrals.ts#L41)

#### Parameters

##### req

###### headers?

`Record`\<`string`, `any`\>

#### Returns

`string`

***

### getUserAgent()

> **getUserAgent**(`req`): `string`

Defined in: [server/\_lib/referrals.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/referrals.ts#L55)

#### Parameters

##### req

###### headers?

`Record`\<`string`, `any`\>

#### Returns

`string`

***

### hashForAttribution()

> **hashForAttribution**(`value`): `string` \| `null`

Defined in: [server/\_lib/referrals.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/referrals.ts#L60)

#### Parameters

##### value

`string`

#### Returns

`string` \| `null`

***

### normalizeReferralCode()

> **normalizeReferralCode**(`input`): `string`

Defined in: [server/\_lib/referrals.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/referrals.ts#L10)

#### Parameters

##### input

`string`

#### Returns

`string`

***

### referralCodeFromEmail()

> **referralCodeFromEmail**(`email`): `string` \| `null`

Defined in: [server/\_lib/referrals.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/referrals.ts#L21)

#### Parameters

##### email

`string` | `null` | `undefined`

#### Returns

`string` \| `null`
