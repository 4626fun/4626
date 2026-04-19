[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/waitlistEntry

# src/lib/auth/waitlistEntry

## Variables

### WAITLIST\_REFERRAL\_CLICK\_SESSION\_KEY

> `const` **WAITLIST\_REFERRAL\_CLICK\_SESSION\_KEY**: `"cv:waitlist:referral_click_session"` = `'cv:waitlist:referral_click_session'`

Defined in: [src/lib/auth/waitlistEntry.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L7)

***

### WAITLIST\_REFERRAL\_CODE\_STORAGE\_KEY

> `const` **WAITLIST\_REFERRAL\_CODE\_STORAGE\_KEY**: `"cv:waitlist:referral_code"` = `'cv:waitlist:referral_code'`

Defined in: [src/lib/auth/waitlistEntry.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L6)

## Functions

### buildCanonicalMarketingWaitlistUrl()

> **buildCanonicalMarketingWaitlistUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L17)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### buildWaitlistEntryPath()

> **buildWaitlistEntryPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:66](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L66)

#### Returns

`string`

***

### buildWaitlistEntryUrl()

> **buildWaitlistEntryUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L70)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### buildWaitlistReferralPath()

> **buildWaitlistReferralPath**(`referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L38)

#### Parameters

##### referralCode

`string`

#### Returns

`string`

***

### buildWaitlistReferralUrl()

> **buildWaitlistReferralUrl**(`baseUrl`, `referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L43)

#### Parameters

##### baseUrl

`string`

##### referralCode

`string`

#### Returns

`string`

***

### clearStoredWaitlistReferralCode()

> **clearStoredWaitlistReferralCode**(): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:103](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L103)

#### Returns

`void`

***

### getCanonicalMarketingWaitlistPath()

> **getCanonicalMarketingWaitlistPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L13)

#### Returns

`string`

***

### getMarketingWaitlistEntryUrl()

> **getMarketingWaitlistEntryUrl**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L79)

#### Returns

`string`

***

### getMarketingWaitlistReferralUrl()

> **getMarketingWaitlistReferralUrl**(`referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L48)

#### Parameters

##### referralCode

`string`

#### Returns

`string`

***

### getPrivyCapableWaitlistEntryUrl()

> **getPrivyCapableWaitlistEntryUrl**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L75)

#### Returns

`string`

***

### isMarketingWaitlistEntryLocation()

> **isMarketingWaitlistEntryLocation**(`location`): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L61)

#### Parameters

##### location

`WaitlistEntryLocation`

#### Returns

`boolean`

***

### normalizeWaitlistReferralCode()

> **normalizeWaitlistReferralCode**(`value`): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L28)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### readStoredWaitlistReferralCode()

> **readStoredWaitlistReferralCode**(): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L83)

#### Returns

`string` \| `null`

***

### readWaitlistEntryReferralCode()

> **readWaitlistEntryReferralCode**(`location`): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L52)

#### Parameters

##### location

`WaitlistEntryLocation`

#### Returns

`string` \| `null`

***

### storeWaitlistReferralCode()

> **storeWaitlistReferralCode**(`referralCode`): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L92)

#### Parameters

##### referralCode

`string` | `null` | `undefined`

#### Returns

`void`
