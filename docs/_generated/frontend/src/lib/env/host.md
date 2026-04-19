[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/env/host

# src/lib/env/host

## Type Aliases

### HostMode

> **HostMode** = `"app"` \| `"marketing"`

Defined in: [src/lib/env/host.ts:1](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L1)

## Variables

### APP\_ORIGIN

> `const` **APP\_ORIGIN**: `string`

Defined in: [src/lib/env/host.ts:62](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L62)

Canonical app domain origin (post-acceptance).

***

### MARKETING\_ORIGIN

> `const` **MARKETING\_ORIGIN**: `string`

Defined in: [src/lib/env/host.ts:58](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L58)

Canonical marketing/waitlist domain origin.

***

### WAITLIST\_REFERRAL\_BASE\_URL

> `const` **WAITLIST\_REFERRAL\_BASE\_URL**: `string`

Defined in: [src/lib/env/host.ts:69](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L69)

Optional explicit base URL for waitlist referral links.
When set, waitlist share links are built from this origin instead of MARKETING_ORIGIN.

## Functions

### getAppBaseUrl()

> **getAppBaseUrl**(): `string`

Defined in: [src/lib/env/host.ts:106](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L106)

Base URL for the app (explore, deploy, vault, admin).

When on marketing domain, returns app.4626.fun so links point to the app.
When on app domain, returns current origin.

#### Returns

`string`

***

### getHostMode()

> **getHostMode**(): [`HostMode`](#hostmode)

Defined in: [src/lib/env/host.ts:92](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L92)

Host mode detection.

- 4626.fun (or www.4626.fun) = marketing (waitlist landing)
- app.4626.fun (or localhost) = app

#### Returns

[`HostMode`](#hostmode)

***

### getMarketingBaseUrl()

> **getMarketingBaseUrl**(): `string`

Defined in: [src/lib/env/host.ts:118](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L118)

Base URL for the marketing/waitlist site.

When on marketing domain, returns current origin.
When on app domain, returns 4626.fun.

#### Returns

`string`

***

### getWaitlistReferralBaseUrl()

> **getWaitlistReferralBaseUrl**(): `string`

Defined in: [src/lib/env/host.ts:127](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L127)

Base URL used for user-facing waitlist referral links.

#### Returns

`string`

***

### isCurrentWindowUrl()

> **isCurrentWindowUrl**(`target`): `boolean`

Defined in: [src/lib/env/host.ts:40](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L40)

#### Parameters

##### target

`string`

#### Returns

`boolean`

***

### resolveLoopbackOriginForCurrentWindow()

> **resolveLoopbackOriginForCurrentWindow**(`input`): `string`

Defined in: [src/lib/env/host.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/env/host.ts#L18)

Keep local dev redirects on the active loopback origin when only the port is stale.
This avoids cross-origin bounces like localhost:5173 -> localhost:5174 when only one
Vite server is running.

#### Parameters

##### input

`LoopbackOriginResolutionInput`

#### Returns

`string`
