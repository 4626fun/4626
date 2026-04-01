[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/cre/vaults/\_active

# api/\_handlers/cre/vaults/\_active

## Interfaces

### VaultAutomationConfig

Defined in: [api/\_handlers/cre/vaults/\_active.ts:23](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L23)

#### Properties

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:24](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L24)

##### automationScope?

> `optional` **automationScope**: `string`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:25](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L25)

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:26](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L26)

##### embeddedEoaAddress?

> `optional` **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:27](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L27)

##### privyWalletId?

> `optional` **privyWalletId**: `string` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:28](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L28)

***

### VaultConfig

Defined in: [api/\_handlers/cre/vaults/\_active.ts:31](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L31)

#### Properties

##### automation

> **automation**: [`VaultAutomationConfig`](#vaultautomationconfig)

Defined in: [api/\_handlers/cre/vaults/\_active.ts:46](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L46)

##### burnStreamAddress?

> `optional` **burnStreamAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:40](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L40)

##### ccaStrategyAddress?

> `optional` **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:36](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L36)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:33](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L33)

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:34](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L34)

##### gaugeControllerAddress?

> `optional` **gaugeControllerAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:39](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L39)

##### graduatedAt?

> `optional` **graduatedAt**: `string` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:43](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L43)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:42](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L42)

##### oracleAddress?

> `optional` **oracleAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:37](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L37)

##### payoutRouterAddress?

> `optional` **payoutRouterAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:41](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L41)

##### settledAt?

> `optional` **settledAt**: `string` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:44](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L44)

##### settlementStage?

> `optional` **settlementStage**: `string` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:45](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L45)

##### shareTokenAddress?

> `optional` **shareTokenAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:35](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L35)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:32](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L32)

##### vrfHubAddress?

> `optional` **vrfHubAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:38](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L38)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/cre/vaults/\_active.ts:56](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L56)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
