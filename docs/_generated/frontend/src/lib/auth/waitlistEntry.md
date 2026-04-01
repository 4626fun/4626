[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/auth/waitlistEntry

# src/lib/auth/waitlistEntry

## Variables

### WAITLIST\_AUTH\_ARMED\_KEY

> `const` **WAITLIST\_AUTH\_ARMED\_KEY**: `"cv:waitlist:auth_armed"` = `'cv:waitlist:auth_armed'`

Defined in: [src/lib/auth/waitlistEntry.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L6)

***

### WAITLIST\_AUTH\_AUTO\_START\_KEY

> `const` **WAITLIST\_AUTH\_AUTO\_START\_KEY**: `"cv:waitlist:auth_auto_start"` = `'cv:waitlist:auth_auto_start'`

Defined in: [src/lib/auth/waitlistEntry.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L7)

***

### WAITLIST\_REFERRAL\_CLICK\_SESSION\_KEY

> `const` **WAITLIST\_REFERRAL\_CLICK\_SESSION\_KEY**: `"cv:waitlist:referral_click_session"` = `'cv:waitlist:referral_click_session'`

Defined in: [src/lib/auth/waitlistEntry.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L9)

***

### WAITLIST\_REFERRAL\_CODE\_STORAGE\_KEY

> `const` **WAITLIST\_REFERRAL\_CODE\_STORAGE\_KEY**: `"cv:waitlist:referral_code"` = `'cv:waitlist:referral_code'`

Defined in: [src/lib/auth/waitlistEntry.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L8)

## Functions

### buildCanonicalMarketingWaitlistUrl()

> **buildCanonicalMarketingWaitlistUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L19)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### buildWaitlistEntryPath()

> **buildWaitlistEntryPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L68)

#### Returns

`string`

***

### buildWaitlistEntryUrl()

> **buildWaitlistEntryUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L72)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### buildWaitlistReferralPath()

> **buildWaitlistReferralPath**(`referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:40](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L40)

#### Parameters

##### referralCode

`string`

#### Returns

`string`

***

### buildWaitlistReferralUrl()

> **buildWaitlistReferralUrl**(`baseUrl`, `referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L45)

#### Parameters

##### baseUrl

`string`

##### referralCode

`string`

#### Returns

`string`

***

### clearStoredWaitlistAuthState()

> **clearStoredWaitlistAuthState**(): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:135](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L135)

#### Returns

`void`

***

### clearStoredWaitlistReferralCode()

> **clearStoredWaitlistReferralCode**(): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L165)

#### Returns

`void`

***

### consumeStoredWaitlistAuthArmed()

> **consumeStoredWaitlistAuthArmed**(): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L94)

#### Returns

`boolean`

***

### consumeStoredWaitlistAuthAutoStart()

> **consumeStoredWaitlistAuthAutoStart**(): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:124](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L124)

#### Returns

`boolean`

***

### getCanonicalMarketingWaitlistPath()

> **getCanonicalMarketingWaitlistPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L15)

#### Returns

`string`

***

### getMarketingWaitlistEntryUrl()

> **getMarketingWaitlistEntryUrl**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L81)

#### Returns

`string`

***

### getMarketingWaitlistReferralUrl()

> **getMarketingWaitlistReferralUrl**(`referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L50)

#### Parameters

##### referralCode

`string`

#### Returns

`string`

***

### getPrivyCapableWaitlistEntryUrl()

> **getPrivyCapableWaitlistEntryUrl**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L77)

#### Returns

`string`

***

### isMarketingWaitlistEntryLocation()

> **isMarketingWaitlistEntryLocation**(`location`): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L63)

#### Parameters

##### location

`WaitlistEntryLocation`

#### Returns

`boolean`

***

### normalizeWaitlistReferralCode()

> **normalizeWaitlistReferralCode**(`value`): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L30)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### readStoredWaitlistAuthArmed()

> **readStoredWaitlistAuthArmed**(): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L85)

#### Returns

`boolean`

***

### readStoredWaitlistReferralCode()

> **readStoredWaitlistReferralCode**(): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L145)

#### Returns

`string` \| `null`

***

### readWaitlistEntryReferralCode()

> **readWaitlistEntryReferralCode**(`location`): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L54)

#### Parameters

##### location

`WaitlistEntryLocation`

#### Returns

`string` \| `null`

***

### requestStoredWaitlistAuthAutoStart()

> **requestStoredWaitlistAuthAutoStart**(): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L115)

#### Returns

`void`

***

### storeWaitlistReferralCode()

> **storeWaitlistReferralCode**(`referralCode`): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:154](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L154)

#### Parameters

##### referralCode

`string` | `null` | `undefined`

#### Returns

`void`

***

### writeStoredWaitlistAuthArmed()

> **writeStoredWaitlistAuthArmed**(`value`): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/lib/auth/waitlistEntry.ts#L105)

#### Parameters

##### value

`boolean`

#### Returns

`void`
