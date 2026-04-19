[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/status/InfraReadinessBadges

# src/features/status/InfraReadinessBadges

## Type Aliases

### BadgeState

> **BadgeState** = `"loading"` \| `"ok"` \| `"degraded"` \| `"offline"` \| `"error"`

Defined in: [src/features/status/InfraReadinessBadges.tsx:43](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L43)

***

### HealthResponse

> **HealthResponse** = `object`

Defined in: [src/features/status/InfraReadinessBadges.tsx:35](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L35)

#### Properties

##### db

> **db**: `DbHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:39](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L39)

##### ok

> **ok**: `boolean`

Defined in: [src/features/status/InfraReadinessBadges.tsx:36](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L36)

##### paymaster

> **paymaster**: `PaymasterHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:38](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L38)

##### siwe

> **siwe**: `SiweHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:40](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L40)

##### time

> **time**: `string`

Defined in: [src/features/status/InfraReadinessBadges.tsx:37](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L37)

## Functions

### deriveBadges()

> **deriveBadges**(`health`, `errored`): `object`

Defined in: [src/features/status/InfraReadinessBadges.tsx:120](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L120)

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

Defined in: [src/features/status/InfraReadinessBadges.tsx:182](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/features/status/InfraReadinessBadges.tsx#L182)

#### Parameters

##### \_\_namedParameters

`InfraReadinessBadgesProps`

#### Returns

`Element`
