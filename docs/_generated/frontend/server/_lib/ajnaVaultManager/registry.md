[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/ajnaVaultManager/registry

# server/\_lib/ajnaVaultManager/registry

## Type Aliases

### AjnaAutomationStatus

> **AjnaAutomationStatus** = `"dry_run"` \| `"live"` \| `"paused"` \| `"halted"`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L7)

***

### AjnaVaultRegistryRow

> **AjnaVaultRegistryRow** = `object`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L9)

#### Properties

##### ajnaAuth

> **ajnaAuth**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L15)

##### ajnaPool

> **ajnaPool**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L16)

##### automationStatus

> **automationStatus**: [`AjnaAutomationStatus`](#ajnaautomationstatus)

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L22)

##### bufferRatioBps

> **bufferRatioBps**: `number` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L18)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L10)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L27)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L11)

##### creatorVault

> **creatorVault**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L12)

##### innerAjnaVault

> **innerAjnaVault**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L14)

##### lastError

> **lastError**: `string` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L25)

##### lastRunAt

> **lastRunAt**: `string` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L23)

##### lastSuccessTx

> **lastSuccessTx**: `Hex` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L24)

##### maxAssetsPerMove

> **maxAssetsPerMove**: `bigint` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L21)

##### maxBucketStep

> **maxBucketStep**: `number`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L20)

##### metadata

> **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L26)

##### minBucketIndex

> **minBucketIndex**: `number` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L19)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L17)

##### strategyAdapter

> **strategyAdapter**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L13)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L28)

***

### UpsertAjnaVaultRegistryParams

> **UpsertAjnaVaultRegistryParams** = `object`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L31)

#### Properties

##### ajnaAuth

> **ajnaAuth**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L37)

##### ajnaPool

> **ajnaPool**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L38)

##### bufferRatioBps

> **bufferRatioBps**: `number` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L40)

##### chainId

> **chainId**: `number`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L32)

##### creatorToken

> **creatorToken**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L33)

##### creatorVault

> **creatorVault**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L34)

##### innerAjnaVault

> **innerAjnaVault**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L36)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L42)

##### minBucketIndex

> **minBucketIndex**: `number` \| `null`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L41)

##### ownerAddress

> **ownerAddress**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L39)

##### strategyAdapter

> **strategyAdapter**: `Address`

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L35)

## Functions

### getAjnaVaultRegistryEntry()

> **getAjnaVaultRegistryEntry**(`params`): `Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:232](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L232)

#### Parameters

##### params

###### chainId

`number`

###### creatorToken

`string`

###### strategyAdapter

`string`

#### Returns

`Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

***

### listAjnaVaultRegistryEntries()

> **listAjnaVaultRegistryEntries**(`params?`): `Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow)[]\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:205](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L205)

#### Parameters

##### params?

###### chainId?

`number`

###### limit?

`number`

###### statuses?

[`AjnaAutomationStatus`](#ajnaautomationstatus)[]

#### Returns

`Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow)[]\>

***

### recordAjnaVaultManagerRun()

> **recordAjnaVaultManagerRun**(`params`): `Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:251](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L251)

#### Parameters

##### params

###### chainId

`number`

###### creatorToken

`string`

###### error?

`string` \| `null`

###### metadataPatch?

`Record`\<`string`, `unknown`\>

###### strategyAdapter

`string`

###### txHash?

`` `0x${string}` `` \| `null`

#### Returns

`Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

***

### setAjnaVaultAutomationStatus()

> **setAjnaVaultAutomationStatus**(`params`): `Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:283](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L283)

#### Parameters

##### params

###### automationStatus

[`AjnaAutomationStatus`](#ajnaautomationstatus)

###### chainId

`number`

###### creatorToken

`string`

###### metadataPatch?

`Record`\<`string`, `unknown`\>

###### strategyAdapter

`string`

#### Returns

`Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

***

### updateAjnaVaultAutomationConfig()

> **updateAjnaVaultAutomationConfig**(`params`): `Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:307](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L307)

#### Parameters

##### params

###### automationStatus?

[`AjnaAutomationStatus`](#ajnaautomationstatus)

###### chainId

`number`

###### creatorToken

`string`

###### maxAssetsPerMove?

`bigint` \| `null`

###### maxBucketStep?

`number` \| `null`

###### metadataPatch?

`Record`\<`string`, `unknown`\>

###### strategyAdapter

`string`

#### Returns

`Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

***

### upsertAjnaVaultRegistryEntry()

> **upsertAjnaVaultRegistryEntry**(`params`): `Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>

Defined in: [server/\_lib/ajnaVaultManager/registry.ts:155](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/ajnaVaultManager/registry.ts#L155)

#### Parameters

##### params

[`UpsertAjnaVaultRegistryParams`](#upsertajnavaultregistryparams)

#### Returns

`Promise`\<[`AjnaVaultRegistryRow`](#ajnavaultregistryrow) \| `null`\>
