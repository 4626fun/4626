[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agentControl/trustZones

# server/\_lib/agentControl/trustZones

## Type Aliases

### KeeprTrustZone

> **KeeprTrustZone** = `"financial_execution"` \| `"market_maintenance"` \| `"queue_messaging_monitoring"`

Defined in: [server/\_lib/agentControl/trustZones.ts:3](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L3)

## Variables

### KEEPR\_TRUST\_ZONE\_HEADER

> `const` **KEEPR\_TRUST\_ZONE\_HEADER**: `"x-keepr-trust-zone"` = `'x-keepr-trust-zone'`

Defined in: [server/\_lib/agentControl/trustZones.ts:8](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L8)

***

### KEEPR\_TRUST\_ZONE\_KEY\_HEADER

> `const` **KEEPR\_TRUST\_ZONE\_KEY\_HEADER**: `"x-keepr-zone-key"` = `'x-keepr-zone-key'`

Defined in: [server/\_lib/agentControl/trustZones.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L9)

## Functions

### formatTrustZoneDisabledError()

> **formatTrustZoneDisabledError**(`zone`): `string`

Defined in: [server/\_lib/agentControl/trustZones.ts:122](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L122)

#### Parameters

##### zone

[`KeeprTrustZone`](#keeprtrustzone)

#### Returns

`string`

***

### formatTrustZoneError()

> **formatTrustZoneError**(`zone`): `string`

Defined in: [server/\_lib/agentControl/trustZones.ts:118](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L118)

#### Parameters

##### zone

[`KeeprTrustZone`](#keeprtrustzone)

#### Returns

`string`

***

### getKeeprTrustZoneEnvKey()

> **getKeeprTrustZoneEnvKey**(`zone`): `string`

Defined in: [server/\_lib/agentControl/trustZones.ts:62](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L62)

#### Parameters

##### zone

[`KeeprTrustZone`](#keeprtrustzone)

#### Returns

`string`

***

### getKeeprTrustZoneKillSwitchEnvKey()

> **getKeeprTrustZoneKillSwitchEnvKey**(`zone`): `string`

Defined in: [server/\_lib/agentControl/trustZones.ts:66](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L66)

#### Parameters

##### zone

[`KeeprTrustZone`](#keeprtrustzone)

#### Returns

`string`

***

### isActionTypeInTrustZone()

> **isActionTypeInTrustZone**(`actionType`, `zone`): `boolean`

Defined in: [server/\_lib/agentControl/trustZones.ts:104](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L104)

#### Parameters

##### actionType

`string` | `null` | `undefined`

##### zone

[`KeeprTrustZone`](#keeprtrustzone)

#### Returns

`boolean`

***

### isKeeprTrustZoneWriteEnabled()

> **isKeeprTrustZoneWriteEnabled**(`zone`, `env`): `boolean`

Defined in: [server/\_lib/agentControl/trustZones.ts:126](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L126)

#### Parameters

##### zone

[`KeeprTrustZone`](#keeprtrustzone)

##### env

`Record`\<`string`, `string` \| `undefined`\>

#### Returns

`boolean`

***

### parseKeeprTrustZone()

> **parseKeeprTrustZone**(`value`): [`KeeprTrustZone`](#keeprtrustzone) \| `null`

Defined in: [server/\_lib/agentControl/trustZones.ts:55](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L55)

#### Parameters

##### value

`unknown`

#### Returns

[`KeeprTrustZone`](#keeprtrustzone) \| `null`

***

### readRequestedKeeprTrustZone()

> **readRequestedKeeprTrustZone**(`value`): [`KeeprTrustZone`](#keeprtrustzone) \| `null`

Defined in: [server/\_lib/agentControl/trustZones.ts:111](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L111)

#### Parameters

##### value

`string` | `string`[] | `undefined`

#### Returns

[`KeeprTrustZone`](#keeprtrustzone) \| `null`

***

### resolveKeeprEffectiveActionType()

> **resolveKeeprEffectiveActionType**(`actionType`, `actionPayload?`): `string` \| `null`

Defined in: [server/\_lib/agentControl/trustZones.ts:89](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L89)

#### Parameters

##### actionType

`string` | `null` | `undefined`

##### actionPayload?

`Record`\<`string`, `unknown`\> | `null`

#### Returns

`string` \| `null`

***

### resolveKeeprTrustZone()

> **resolveKeeprTrustZone**(`actionType`): [`KeeprTrustZone`](#keeprtrustzone)

Defined in: [server/\_lib/agentControl/trustZones.ts:70](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L70)

#### Parameters

##### actionType

`string` | `null` | `undefined`

#### Returns

[`KeeprTrustZone`](#keeprtrustzone)

***

### sanitizeZoneHeaderValue()

> **sanitizeZoneHeaderValue**(`value`): `string`

Defined in: [server/\_lib/agentControl/trustZones.ts:135](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/agentControl/trustZones.ts#L135)

#### Parameters

##### value

`unknown`

#### Returns

`string`
