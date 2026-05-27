[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/auth/waitlistEntry

# src/lib/auth/waitlistEntry

## Type Aliases

### WaitlistSetupIntent

> **WaitlistSetupIntent** = `"base-app"` \| `"owner-install"`

Defined in: [src/lib/auth/waitlistEntry.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L100)

## Variables

### WAITLIST\_REFERRAL\_CLICK\_SESSION\_KEY

> `const` **WAITLIST\_REFERRAL\_CLICK\_SESSION\_KEY**: `"cv:waitlist:referral_click_session"` = `'cv:waitlist:referral_click_session'`

Defined in: [src/lib/auth/waitlistEntry.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L8)

***

### WAITLIST\_REFERRAL\_CODE\_STORAGE\_KEY

> `const` **WAITLIST\_REFERRAL\_CODE\_STORAGE\_KEY**: `"cv:waitlist:referral_code"` = `'cv:waitlist:referral_code'`

Defined in: [src/lib/auth/waitlistEntry.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L7)

***

### WAITLIST\_START\_AUTH\_QUERY\_KEY

> `const` **WAITLIST\_START\_AUTH\_QUERY\_KEY**: `"start"` = `'start'`

Defined in: [src/lib/auth/waitlistEntry.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L5)

## Functions

### buildCanonicalMarketingWaitlistUrl()

> **buildCanonicalMarketingWaitlistUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L18)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### buildWaitlistEntryPath()

> **buildWaitlistEntryPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L67)

#### Returns

`string`

***

### buildWaitlistEntryUrl()

> **buildWaitlistEntryUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L87)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### buildWaitlistReferralPath()

> **buildWaitlistReferralPath**(`referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L39)

#### Parameters

##### referralCode

`string`

#### Returns

`string`

***

### buildWaitlistReferralUrl()

> **buildWaitlistReferralUrl**(`baseUrl`, `referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L44)

#### Parameters

##### baseUrl

`string`

##### referralCode

`string`

#### Returns

`string`

***

### buildWaitlistSetupPath()

> **buildWaitlistSetupPath**(`setup`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:111](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L111)

SPA-safe waitlist setup path (marketing host route).

#### Parameters

##### setup

[`WaitlistSetupIntent`](#waitlistsetupintent)

#### Returns

`string`

***

### buildWaitlistSetupUrl()

> **buildWaitlistSetupUrl**(`setup`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:116](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L116)

Canonical marketing-host URL for waitlist setup deep links (`4626.fun`, not `app.4626.fun`).

#### Parameters

##### setup

[`WaitlistSetupIntent`](#waitlistsetupintent)

#### Returns

`string`

***

### buildWaitlistStartAuthPath()

> **buildWaitlistStartAuthPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L78)

#### Returns

`string`

***

### buildWaitlistStartAuthUrl()

> **buildWaitlistStartAuthUrl**(`baseUrl`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:82](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L82)

#### Parameters

##### baseUrl

`string`

#### Returns

`string`

***

### clearStoredWaitlistReferralCode()

> **clearStoredWaitlistReferralCode**(): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:142](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L142)

#### Returns

`void`

***

### getCanonicalMarketingWaitlistPath()

> **getCanonicalMarketingWaitlistPath**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L14)

#### Returns

`string`

***

### getMarketingWaitlistEntryUrl()

> **getMarketingWaitlistEntryUrl**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L96)

#### Returns

`string`

***

### getMarketingWaitlistReferralUrl()

> **getMarketingWaitlistReferralUrl**(`referralCode`): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L49)

#### Parameters

##### referralCode

`string`

#### Returns

`string`

***

### getPrivyCapableWaitlistEntryUrl()

> **getPrivyCapableWaitlistEntryUrl**(): `string`

Defined in: [src/lib/auth/waitlistEntry.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L92)

#### Returns

`string`

***

### isMarketingWaitlistEntryLocation()

> **isMarketingWaitlistEntryLocation**(`location`): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:62](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L62)

#### Parameters

##### location

`WaitlistEntryLocation`

#### Returns

`boolean`

***

### isWaitlistStartAuthSearchParam()

> **isWaitlistStartAuthSearchParam**(`value`): `boolean`

Defined in: [src/lib/auth/waitlistEntry.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L71)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### normalizeWaitlistReferralCode()

> **normalizeWaitlistReferralCode**(`value`): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L29)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### readStoredWaitlistReferralCode()

> **readStoredWaitlistReferralCode**(): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:122](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L122)

#### Returns

`string` \| `null`

***

### readWaitlistEntryReferralCode()

> **readWaitlistEntryReferralCode**(`location`): `string` \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:53](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L53)

#### Parameters

##### location

`WaitlistEntryLocation`

#### Returns

`string` \| `null`

***

### readWaitlistSetupIntent()

> **readWaitlistSetupIntent**(`value`): [`WaitlistSetupIntent`](#waitlistsetupintent) \| `null`

Defined in: [src/lib/auth/waitlistEntry.ts:102](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L102)

#### Parameters

##### value

`string` | `null` | `undefined`

#### Returns

[`WaitlistSetupIntent`](#waitlistsetupintent) \| `null`

***

### storeWaitlistReferralCode()

> **storeWaitlistReferralCode**(`referralCode`): `void`

Defined in: [src/lib/auth/waitlistEntry.ts:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/auth/waitlistEntry.ts#L131)

#### Parameters

##### referralCode

`string` | `null` | `undefined`

#### Returns

`void`
