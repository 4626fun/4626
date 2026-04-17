[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/status/InfraReadinessBadges

# src/features/status/InfraReadinessBadges

## Type Aliases

### BadgeState

> **BadgeState** = `"loading"` \| `"ok"` \| `"degraded"` \| `"offline"`

Defined in: [src/features/status/InfraReadinessBadges.tsx:42](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L42)

***

### HealthResponse

> **HealthResponse** = `object`

Defined in: [src/features/status/InfraReadinessBadges.tsx:34](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L34)

#### Properties

##### db

> **db**: `DbHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:38](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L38)

##### ok

> **ok**: `boolean`

Defined in: [src/features/status/InfraReadinessBadges.tsx:35](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L35)

##### paymaster

> **paymaster**: `PaymasterHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:37](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L37)

##### siwe

> **siwe**: `SiweHealth`

Defined in: [src/features/status/InfraReadinessBadges.tsx:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L39)

##### time

> **time**: `string`

Defined in: [src/features/status/InfraReadinessBadges.tsx:36](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L36)

## Functions

### deriveBadges()

> **deriveBadges**(`health`): `object`

Defined in: [src/features/status/InfraReadinessBadges.tsx:110](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L110)

Map each health sub-object to a badge state. Errors = offline, configured
but not ok = degraded, not configured = degraded (informational), ok = ok.

#### Parameters

##### health

[`HealthResponse`](#healthresponse) | `null` | `undefined`

#### Returns

`object`

##### db

> **db**: `object`

###### db.note

> **note**: `string` = `'Checking…'`

###### db.state

> **state**: [`BadgeState`](#badgestate)

##### paymaster

> **paymaster**: `object`

###### paymaster.note

> **note**: `string` = `'Checking…'`

###### paymaster.state

> **state**: [`BadgeState`](#badgestate)

##### siwe

> **siwe**: `object`

###### siwe.note

> **note**: `string` = `'Checking…'`

###### siwe.state

> **state**: [`BadgeState`](#badgestate)

***

### InfraReadinessBadges()

> **InfraReadinessBadges**(`__namedParameters`): `Element`

Defined in: [src/features/status/InfraReadinessBadges.tsx:165](https://github.com/wenakita/4626/blob/main/frontend/src/features/status/InfraReadinessBadges.tsx#L165)

#### Parameters

##### \_\_namedParameters

`InfraReadinessBadgesProps`

#### Returns

`Element`
