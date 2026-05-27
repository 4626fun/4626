[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/onchain/vaultStrategyOnchain

# server/\_lib/onchain/vaultStrategyOnchain

## Type Aliases

### VaultOnChainArtifacts

> **VaultOnChainArtifacts** = `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:155](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L155)

***

### VaultStrategyScan

> **VaultStrategyScan** = `object`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:141](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L141)

#### Properties

##### ajna

> **ajna**: `object`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:145](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L145)

###### ajnaPool

> **ajnaPool**: `Address` \| `null`

###### auth

> **auth**: `Address` \| `null`

###### bufferRatioBps

> **bufferRatioBps**: `number` \| `null`

###### innerVault

> **innerVault**: `Address` \| `null`

###### minBucketIndex

> **minBucketIndex**: `number` \| `null`

##### bridgeAddress

> **bridgeAddress**: `Address` \| `null`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L152)

##### charmVault

> **charmVault**: `Address` \| `null`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:144](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L144)

##### strategy

> **strategy**: `Address`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:142](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L142)

##### weight

> **weight**: `bigint`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:143](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L143)

## Functions

### applyKnownVaultDefaults()

> **applyKnownVaultDefaults**(`vault`, `artifacts`): [`VaultOnChainArtifacts`](#vaultonchainartifacts)

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:442](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L442)

#### Parameters

##### vault

`string`

##### artifacts

[`VaultOnChainArtifacts`](#vaultonchainartifacts)

#### Returns

[`VaultOnChainArtifacts`](#vaultonchainartifacts)

***

### createVaultStrategyPublicClient()

> **createVaultStrategyPublicClient**(`rpcUrl?`): `object`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:181](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L181)

#### Parameters

##### rpcUrl?

`string`

#### Returns

`object`

***

### enrichVaultArtifactsFromOnChain()

> **enrichVaultArtifactsFromOnChain**(`params`): `Promise`\<\{ `artifacts`: [`VaultOnChainArtifacts`](#vaultonchainartifacts); `warnings`: `string`[]; \}\>

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:467](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L467)

#### Parameters

##### params

###### artifacts?

[`VaultOnChainArtifacts`](#vaultonchainartifacts)

###### chainId?

`number`

###### client?

\{ \}

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `artifacts`: [`VaultOnChainArtifacts`](#vaultonchainartifacts); `warnings`: `string`[]; \}\>

***

### pickAjnaRegistryCandidate()

> **pickAjnaRegistryCandidate**(`strategyDetails`): [`VaultStrategyScan`](#vaultstrategyscan) \| `null`

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:548](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L548)

#### Parameters

##### strategyDetails

[`VaultStrategyScan`](#vaultstrategyscan)[]

#### Returns

[`VaultStrategyScan`](#vaultstrategyscan) \| `null`

***

### readCreatorTokenForVault()

> **readCreatorTokenForVault**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:208](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L208)

#### Parameters

##### params

###### client

\{ \}

###### vault

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### readShareOftForCreatorToken()

> **readShareOftForCreatorToken**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:237](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L237)

#### Parameters

##### params

###### client

\{ \}

###### creatorToken

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### readVaultActiveStrategies()

> **readVaultActiveStrategies**(`params`): `Promise`\<`object`[]\>

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:270](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L270)

#### Parameters

##### params

###### client

\{ \}

###### maxScan?

`number`

###### vault

`string`

#### Returns

`Promise`\<`object`[]\>

***

### readVaultOwner()

> **readVaultOwner**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:255](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L255)

#### Parameters

##### params

###### client

\{ \}

###### vault

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### scanVaultStrategyDetails()

> **scanVaultStrategyDetails**(`params`): `Promise`\<[`VaultStrategyScan`](#vaultstrategyscan)[]\>

Defined in: [server/\_lib/onchain/vaultStrategyOnchain.ts:426](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/onchain/vaultStrategyOnchain.ts#L426)

#### Parameters

##### params

###### client

\{ \}

###### maxScan?

`number`

###### vault

`string`

#### Returns

`Promise`\<[`VaultStrategyScan`](#vaultstrategyscan)[]\>
