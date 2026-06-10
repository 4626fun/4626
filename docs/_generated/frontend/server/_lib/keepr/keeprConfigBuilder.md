[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/keepr/keeprConfigBuilder

# server/\_lib/keepr/keeprConfigBuilder

## Classes

### KeeprConfigBuildError

Defined in: [server/\_lib/keepr/keeprConfigBuilder.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprConfigBuilder.ts#L13)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new KeeprConfigBuildError**(`message`, `code`): [`KeeprConfigBuildError`](#keeprconfigbuilderror)

Defined in: [server/\_lib/keepr/keeprConfigBuilder.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprConfigBuilder.ts#L16)

###### Parameters

###### message

`string`

###### code

`string` = `'keepr_config_build_failed'`

###### Returns

[`KeeprConfigBuildError`](#keeprconfigbuilderror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/keepr/keeprConfigBuilder.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprConfigBuilder.ts#L14)

## Functions

### buildKeeprConfig()

> **buildKeeprConfig**(`params`): [`KeeprConfigV1`](keeprRegistry.md#keeprconfigv1)

Defined in: [server/\_lib/keepr/keeprConfigBuilder.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprConfigBuilder.ts#L22)

#### Parameters

##### params

###### agentInboxId?

`string` \| `null`

###### artifacts

`Record`\<`string`, `unknown`\>

###### chainId

`number`

###### creatorAddress

`` `0x${string}` ``

###### groupId

`string`

###### strategyVariant

`string` \| `null` \| `undefined`

###### vaultAddress

`` `0x${string}` ``

#### Returns

[`KeeprConfigV1`](keeprRegistry.md#keeprconfigv1)

***

### normalizeKeeprAddress()

> **normalizeKeeprAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/keepr/keeprConfigBuilder.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprConfigBuilder.ts#L4)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### readKeeprString()

> **readKeeprString**(`value`): `string`

Defined in: [server/\_lib/keepr/keeprConfigBuilder.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keepr/keeprConfigBuilder.ts#L9)

#### Parameters

##### value

`unknown`

#### Returns

`string`
