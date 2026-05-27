[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/vaults/\_activeProtected

# api/\_handlers/vaults/\_activeProtected

## Interfaces

### VaultAutomationConfig

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L24)

#### Properties

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L25)

##### automationScope?

> `optional` **automationScope**: `string`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L26)

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L27)

##### embeddedEoaAddress?

> `optional` **embeddedEoaAddress**: `` `0x${string}` `` \| `null`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L28)

##### privyWalletId?

> `optional` **privyWalletId**: `string` \| `null`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L29)

***

### VaultConfig

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L32)

#### Properties

##### automation

> **automation**: [`VaultAutomationConfig`](#vaultautomationconfig)

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:47](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L47)

##### burnStreamAddress?

> `optional` **burnStreamAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L41)

##### ccaStrategyAddress?

> `optional` **ccaStrategyAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L37)

##### chainId

> **chainId**: `number`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L34)

##### creatorCoinAddress

> **creatorCoinAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L35)

##### gaugeControllerAddress?

> `optional` **gaugeControllerAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L40)

##### graduatedAt?

> `optional` **graduatedAt**: `string` \| `null`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L44)

##### groupId

> **groupId**: `string`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L43)

##### oracleAddress?

> `optional` **oracleAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L38)

##### payoutRouterAddress?

> `optional` **payoutRouterAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L42)

##### settledAt?

> `optional` **settledAt**: `string` \| `null`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L45)

##### settlementStage?

> `optional` **settlementStage**: `string` \| `null`

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L46)

##### shareTokenAddress?

> `optional` **shareTokenAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L36)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L33)

##### vrfHubAddress?

> `optional` **vrfHubAddress**: `` `0x${string}` ``

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L39)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/vaults/\_activeProtected.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/vaults/_activeProtected.ts#L57)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
