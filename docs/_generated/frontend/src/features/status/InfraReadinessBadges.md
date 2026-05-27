[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/status/InfraReadinessBadges

# src/features/status/InfraReadinessBadges

## Type Aliases

### BadgeState

> **BadgeState** = `"loading"` \| `"ok"` \| `"degraded"` \| `"offline"` \| `"error"`

Defined in: [src/features/status/InfraReadinessBadges.tsx:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L44)

***

### HealthResponse

> **HealthResponse** = `object`

Defined in: [src/features/status/InfraReadinessBadges.tsx:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L36)

#### Properties

##### db

> **db**: `DbHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L40)

##### ok

> **ok**: `boolean`

Defined in: [src/features/status/InfraReadinessBadges.tsx:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L37)

##### paymaster

> **paymaster**: `PaymasterHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L39)

##### siwe

> **siwe**: `SiweHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L41)

##### time

> **time**: `string`

Defined in: [src/features/status/InfraReadinessBadges.tsx:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L38)

## Functions

### deriveBadges()

> **deriveBadges**(`health`, `errored`): `object`

Defined in: [src/features/status/InfraReadinessBadges.tsx:121](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L121)

Map each health sub-object to a badge state. Errors = offline, configured
but not ok = degraded, not configured = degraded (informational), ok = ok.

When `errored` is true the three pills surface an error state rather than
staying in a perpetual "Checking…" — this matters when /api/health itself
is unreachable (outage) rather than returning a populated failure payload.

#### Parameters

##### health

[`HealthResponse`](#healthresponse) | `null` | `undefined`

##### errored

`boolean` = `false`

#### Returns

`object`

##### db

> **db**: `object`

###### db.note

> **note**: `string` = `'Health check failed'`

###### db.state

> **state**: [`BadgeState`](#badgestate)

##### paymaster

> **paymaster**: `object`

###### paymaster.note

> **note**: `string` = `'Health check failed'`

###### paymaster.state

> **state**: [`BadgeState`](#badgestate)

##### siwe

> **siwe**: `object`

###### siwe.note

> **note**: `string` = `'Health check failed'`

###### siwe.state

> **state**: [`BadgeState`](#badgestate)

***

### InfraReadinessBadges()

> **InfraReadinessBadges**(`__namedParameters`): `Element`

Defined in: [src/features/status/InfraReadinessBadges.tsx:183](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/status/InfraReadinessBadges.tsx#L183)

#### Parameters

##### \_\_namedParameters

`InfraReadinessBadgesProps`

#### Returns

`Element`
