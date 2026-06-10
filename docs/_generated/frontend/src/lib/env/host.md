[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/env/host

# src/lib/env/host

## Type Aliases

### HostMode

> **HostMode** = `"app"` \| `"marketing"`

Defined in: [src/lib/env/host.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L1)

## Variables

### APP\_ORIGIN

> `const` **APP\_ORIGIN**: `string`

Defined in: [src/lib/env/host.ts:176](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L176)

Canonical app domain origin (post-acceptance).

***

### CONFIGURED\_APP\_ORIGIN

> `const` **CONFIGURED\_APP\_ORIGIN**: `string`

Defined in: [src/lib/env/host.ts:137](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L137)

***

### CONFIGURED\_MARKETING\_ORIGIN

> `const` **CONFIGURED\_MARKETING\_ORIGIN**: `string`

Defined in: [src/lib/env/host.ts:134](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L134)

***

### MARKETING\_ORIGIN

> `const` **MARKETING\_ORIGIN**: `string`

Defined in: [src/lib/env/host.ts:173](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L173)

Canonical marketing/waitlist domain origin.

***

### WAITLIST\_REFERRAL\_BASE\_URL

> `const` **WAITLIST\_REFERRAL\_BASE\_URL**: `string`

Defined in: [src/lib/env/host.ts:182](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L182)

Optional explicit base URL for waitlist referral links.
When set, waitlist share links are built from this origin instead of MARKETING_ORIGIN.

## Functions

### getAppBaseUrl()

> **getAppBaseUrl**(): `string`

Defined in: [src/lib/env/host.ts:219](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L219)

Base URL for the app (explore, deploy, vault, admin).

When on marketing domain, returns app.4626.fun so links point to the app.
When on app domain, returns current origin.

#### Returns

`string`

***

### getHostMode()

> **getHostMode**(): [`HostMode`](#hostmode)

Defined in: [src/lib/env/host.ts:205](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L205)

Host mode detection.

- 4626.fun (or www.4626.fun) = marketing (waitlist landing)
- app.4626.fun (or localhost) = app

#### Returns

[`HostMode`](#hostmode)

***

### getMarketingBaseUrl()

> **getMarketingBaseUrl**(): `string`

Defined in: [src/lib/env/host.ts:240](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L240)

Base URL for the marketing/waitlist site.

When on marketing domain, returns current origin.
When on app domain, returns 4626.fun.

#### Returns

`string`

***

### getSubAccountAppDomain()

> **getSubAccountAppDomain**(): `string`

Defined in: [src/lib/env/host.ts:260](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L260)

Base Account sub-accounts are scoped to the marketing app domain
(`4626.fun`), not the app subdomain. Use this origin for
`wallet_getSubAccounts` / provisioning on both hosts.

#### Returns

`string`

***

### getWaitlistReferralBaseUrl()

> **getWaitlistReferralBaseUrl**(): `string`

Defined in: [src/lib/env/host.ts:249](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L249)

Base URL used for user-facing waitlist referral links.

#### Returns

`string`

***

### isCurrentWindowUrl()

> **isCurrentWindowUrl**(`target`): `boolean`

Defined in: [src/lib/env/host.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L117)

#### Parameters

##### target

`string`

#### Returns

`boolean`

***

### resolveAuthRedirectOrigin()

> **resolveAuthRedirectOrigin**(`input`): `string`

Defined in: [src/lib/env/host.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L97)

#### Parameters

##### input

`AuthRedirectOriginResolutionInput`

#### Returns

`string`

***

### resolveDisallowedLoopbackRedirectUrl()

> **resolveDisallowedLoopbackRedirectUrl**(`input`): `string` \| `null`

Defined in: [src/lib/env/host.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L77)

#### Parameters

##### input

`LoopbackRedirectResolutionInput`

#### Returns

`string` \| `null`

***

### resolveLoopbackOriginForCurrentWindow()

> **resolveLoopbackOriginForCurrentWindow**(`input`): `string`

Defined in: [src/lib/env/host.ts:48](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L48)

Keep local dev redirects on the active loopback origin when only the port is stale.
This avoids cross-origin bounces like localhost:5173 -> localhost:5174 when only one
Vite server is running.

#### Parameters

##### input

`LoopbackOriginResolutionInput`

#### Returns

`string`

***

### resolveMarketingToAppBaseUrl()

> **resolveMarketingToAppBaseUrl**(`input`): `string`

Defined in: [src/lib/env/host.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/env/host.ts#L145)

When rendering the marketing host, never route users to loopback app origins.
This protects against accidentally shipping VITE_APP_ORIGIN=localhost in a
public build while preserving local-dev behavior.

#### Parameters

##### input

`MarketingToAppBaseUrlResolutionInput`

#### Returns

`string`
