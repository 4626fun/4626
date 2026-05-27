[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/keepr/keeperRegistryBootstrap

# server/\_lib/keepr/keeperRegistryBootstrap

## Type Aliases

### KeeperRegistryBootstrapResult

> **KeeperRegistryBootstrapResult** = `object`

Defined in: [server/\_lib/keepr/keeperRegistryBootstrap.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/keepr/keeperRegistryBootstrap.ts#L17)

#### Properties

##### ajnaSeeded

> **ajnaSeeded**: `boolean`

Defined in: [server/\_lib/keepr/keeperRegistryBootstrap.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/keepr/keeperRegistryBootstrap.ts#L20)

##### keeprProvisioned

> **keeprProvisioned**: `boolean`

Defined in: [server/\_lib/keepr/keeperRegistryBootstrap.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/keepr/keeperRegistryBootstrap.ts#L19)

##### provision?

> `optional` **provision**: [`ProvisionVaultEconomyResult`](../controlPlane/executors/provisionVaultEconomy.md#provisionvaulteconomyresult)

Defined in: [server/\_lib/keepr/keeperRegistryBootstrap.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/keepr/keeperRegistryBootstrap.ts#L21)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/keepr/keeperRegistryBootstrap.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/keepr/keeperRegistryBootstrap.ts#L18)

##### warnings

> **warnings**: `string`[]

Defined in: [server/\_lib/keepr/keeperRegistryBootstrap.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/keepr/keeperRegistryBootstrap.ts#L22)

## Functions

### ensureKeeperRegistryForVault()

> **ensureKeeperRegistryForVault**(`input`): `Promise`\<[`KeeperRegistryBootstrapResult`](#keeperregistrybootstrapresult)\>

Defined in: [server/\_lib/keepr/keeperRegistryBootstrap.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/keepr/keeperRegistryBootstrap.ts#L93)

#### Parameters

##### input

###### chainId?

`number`

###### creatorAddress?

`string` \| `null`

###### requestedBy?

`string` \| `null`

###### seedAjna?

`boolean`

###### skipProvisionIfExists?

`boolean`

###### source?

`string`

###### strategyVariant?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`KeeperRegistryBootstrapResult`](#keeperregistrybootstrapresult)\>
