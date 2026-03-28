[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/waitlistEntry

# src/lib/auth/waitlistEntry

## Type Aliases

### WaitlistEntryReason

> **WaitlistEntryReason** = `"needs-session"` \| `"needs-acceptance"`

Defined in: [src/lib/auth/waitlistEntry.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L3)

## Functions

### buildCanonicalMarketingWaitlistUrl()

> **buildCanonicalMarketingWaitlistUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L16)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### buildWaitlistEntryPath()

> **buildWaitlistEntryPath**(`reason`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L28)

#### Parameters

##### reason

[`WaitlistEntryReason`](#waitlistentryreason)

#### Returns

`string`

***

### buildWaitlistEntryUrl()

> **buildWaitlistEntryUrl**(`baseUrl`, `reason`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L33)

#### Parameters

##### baseUrl

`string`

##### reason

[`WaitlistEntryReason`](#waitlistentryreason)

#### Returns

`string`

***

### getCanonicalMarketingWaitlistPath()

> **getCanonicalMarketingWaitlistPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L12)

#### Returns

`string`

***

### getMarketingWaitlistEntryUrl()

> **getMarketingWaitlistEntryUrl**(`reason`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L42)

#### Parameters

##### reason

[`WaitlistEntryReason`](#waitlistentryreason)

#### Returns

`string`

***

### getPrivyCapableWaitlistEntryUrl()

> **getPrivyCapableWaitlistEntryUrl**(`reason`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L38)

#### Parameters

##### reason

[`WaitlistEntryReason`](#waitlistentryreason)

#### Returns

`string`

***

### isMarketingWaitlistEntryLocation()

> **isMarketingWaitlistEntryLocation**(`location`): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L21)

#### Parameters

##### location

`WaitlistEntryLocation`

#### Returns

`boolean`
