[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/deploy/ensureBatcherRegistryAuthorization

# server/\_lib/deploy/ensureBatcherRegistryAuthorization

## Type Aliases

### ForkImpersonationMode

> **ForkImpersonationMode** = `object`

Defined in: [server/\_lib/deploy/ensureBatcherRegistryAuthorization.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts#L56)

#### Properties

##### impersonateMethod

> **impersonateMethod**: `"anvil_impersonateAccount"` \| `"hardhat_impersonateAccount"`

Defined in: [server/\_lib/deploy/ensureBatcherRegistryAuthorization.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts#L58)

##### setBalanceMethod

> **setBalanceMethod**: `"anvil_setBalance"` \| `"hardhat_setBalance"`

Defined in: [server/\_lib/deploy/ensureBatcherRegistryAuthorization.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts#L57)

##### stopMethod

> **stopMethod**: `"anvil_stopImpersonatingAccount"` \| `"hardhat_stopImpersonatingAccount"`

Defined in: [server/\_lib/deploy/ensureBatcherRegistryAuthorization.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts#L59)

## Variables

### BASE\_MAINNET\_CREATOR\_REGISTRY

> `const` **BASE\_MAINNET\_CREATOR\_REGISTRY**: `"0x3f64087dc361Ad52300409E5873b26941D6418B6"`

Defined in: [server/\_lib/deploy/ensureBatcherRegistryAuthorization.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts#L4)

Base mainnet CreatorRegistry — see docs/reference/addresses.md

## Functions

### ensureBatcherRegistryAuthorizationOnFork()

> **ensureBatcherRegistryAuthorizationOnFork**(`params`): `Promise`\<\{ `alreadyAuthorized`: `boolean`; `ensured`: `boolean`; \}\>

Defined in: [server/\_lib/deploy/ensureBatcherRegistryAuthorization.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts#L83)

Greenfield Phase 2 finalize registers creator coin + vault on CreatorRegistry.
The split DeploymentBatcher must be an authorized factory — forge tests set this in
setup, but mainnet may lag until SeedCreatorRegistry / ops wiring runs.

#### Parameters

##### params

###### batcher

`string`

###### forkMode

[`ForkImpersonationMode`](#forkimpersonationmode)

###### forkRequest

(`args`) => `Promise`\<`unknown`\>

###### ownerBalanceHex?

`` `0x${string}` ``

###### publicClient

`ReadContractClient`

###### registry?

`string`

###### waitForTransactionReceipt

(`args`) => `Promise`\<\{ `status`: `string`; \}\>

###### walletClient

`SendTransactionClient`

#### Returns

`Promise`\<\{ `alreadyAuthorized`: `boolean`; `ensured`: `boolean`; \}\>

***

### readBatcherRegistryAuthorized()

> **readBatcherRegistryAuthorized**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/deploy/ensureBatcherRegistryAuthorization.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/ensureBatcherRegistryAuthorization.ts#L62)

#### Parameters

##### params

###### batcher

`string`

###### publicClient

`ReadContractClient`

###### registry?

`string`

#### Returns

`Promise`\<`boolean`\>
