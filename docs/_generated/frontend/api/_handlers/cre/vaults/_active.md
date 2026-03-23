[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/cre/vaults/\_active

# api/\_handlers/cre/vaults/\_active

## Interfaces

### VaultAutomationConfig

Defined in: [api/\_handlers/cre/vaults/\_active.ts:15](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L15)

#### Properties

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:16](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L16)

##### automationScope?

> `optional` **automationScope**: `string`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:17](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L17)

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:18](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L18)

##### embeddedEoaAddress?

> `optional` **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:19](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L19)

##### privyWalletId?

> `optional` **privyWalletId**: `string` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:20](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L20)

***

### VaultConfig

Defined in: [api/\_handlers/cre/vaults/\_active.ts:23](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L23)

#### Properties

##### automation

> **automation**: [`VaultAutomationConfig`](#vaultautomationconfig)

Defined in: [api/\_handlers/cre/vaults/\_active.ts:36](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L36)

##### burnStreamAddress?

> `optional` **burnStreamAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:32](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L32)

##### ccaStrategyAddress?

> `optional` **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:28](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L28)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:25](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L25)

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:26](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L26)

##### gaugeControllerAddress?

> `optional` **gaugeControllerAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:31](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L31)

##### graduatedAt?

> `optional` **graduatedAt**: `string` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:34](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L34)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:33](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L33)

##### oracleAddress?

> `optional` **oracleAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:29](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L29)

##### settledAt?

> `optional` **settledAt**: `string` \| `null`

Defined in: [api/\_handlers/cre/vaults/\_active.ts:35](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L35)

##### shareTokenAddress?

> `optional` **shareTokenAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:27](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L27)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:24](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L24)

##### vrfHubAddress?

> `optional` **vrfHubAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/cre/vaults/\_active.ts:30](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L30)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/cre/vaults/\_active.ts:46](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/cre/vaults/_active.ts#L46)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>
