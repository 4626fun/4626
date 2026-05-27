[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/vaults/\_active

# api/\_handlers/vaults/\_active

## Interfaces

### VaultAutomationConfig

Defined in: [api/\_handlers/vaults/\_active.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L14)

#### Properties

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [api/\_handlers/vaults/\_active.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L15)

##### automationScope?

> `optional` **automationScope**: `string`

Defined in: [api/\_handlers/vaults/\_active.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L16)

***

### VaultConfig

Defined in: [api/\_handlers/vaults/\_active.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L19)

#### Properties

##### automation

> **automation**: [`VaultAutomationConfig`](#vaultautomationconfig)

Defined in: [api/\_handlers/vaults/\_active.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L33)

##### burnStreamAddress?

> `optional` **burnStreamAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L28)

##### ccaStrategyAddress?

> `optional` **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L23)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/vaults/\_active.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L21)

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L22)

##### gaugeControllerAddress?

> `optional` **gaugeControllerAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L27)

##### graduatedAt?

> `optional` **graduatedAt**: `string` \| `null`

Defined in: [api/\_handlers/vaults/\_active.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L30)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/vaults/\_active.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L29)

##### oracleAddress?

> `optional` **oracleAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L25)

##### settledAt?

> `optional` **settledAt**: `string` \| `null`

Defined in: [api/\_handlers/vaults/\_active.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L31)

##### settlementStage?

> `optional` **settlementStage**: `string` \| `null`

Defined in: [api/\_handlers/vaults/\_active.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L32)

##### shareOFTAddress?

> `optional` **shareOFTAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L24)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L20)

##### vrfHubAddress?

> `optional` **vrfHubAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_active.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L26)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/vaults/\_active.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_active.ts#L40)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
