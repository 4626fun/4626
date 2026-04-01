[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/host

# src/lib/host

## Type Aliases

### HostMode

> **HostMode** = `"app"` \| `"marketing"`

Defined in: [src/lib/host.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L1)

## Variables

### APP\_ORIGIN

> `const` **APP\_ORIGIN**: `string`

Defined in: [src/lib/host.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L53)

Canonical app domain origin (post-acceptance).

***

### MARKETING\_ORIGIN

> `const` **MARKETING\_ORIGIN**: `string`

Defined in: [src/lib/host.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L49)

Canonical marketing/waitlist domain origin.

***

### WAITLIST\_REFERRAL\_BASE\_URL

> `const` **WAITLIST\_REFERRAL\_BASE\_URL**: `string`

Defined in: [src/lib/host.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L60)

Optional explicit base URL for waitlist referral links.
When set, waitlist share links are built from this origin instead of MARKETING_ORIGIN.

## Functions

### getAppBaseUrl()

> **getAppBaseUrl**(): `string`

Defined in: [src/lib/host.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L97)

Base URL for the app (explore, deploy, vault, admin).

When on marketing domain, returns v1.4626.fun so links point to the app.
When on app domain, returns current origin.

#### Returns

`string`

***

### getHostMode()

> **getHostMode**(): [`HostMode`](#hostmode)

Defined in: [src/lib/host.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L83)

Host mode detection.

- 4626.fun (or www.4626.fun) = marketing (waitlist landing)
- v1.4626.fun (or localhost) = app

#### Returns

[`HostMode`](#hostmode)

***

### getMarketingBaseUrl()

> **getMarketingBaseUrl**(): `string`

Defined in: [src/lib/host.ts:109](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L109)

Base URL for the marketing/waitlist site.

When on marketing domain, returns current origin.
When on app domain, returns 4626.fun.

#### Returns

`string`

***

### getWaitlistReferralBaseUrl()

> **getWaitlistReferralBaseUrl**(): `string`

Defined in: [src/lib/host.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L118)

Base URL used for user-facing waitlist referral links.

#### Returns

`string`

***

### resolveLoopbackOriginForCurrentWindow()

> **resolveLoopbackOriginForCurrentWindow**(`input`): `string`

Defined in: [src/lib/host.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/host.ts#L18)

Keep local dev redirects on the active loopback origin when only the port is stale.
This avoids cross-origin bounces like localhost:5173 -> localhost:5174 when only one
Vite server is running.

#### Parameters

##### input

`LoopbackOriginResolutionInput`

#### Returns

`string`
