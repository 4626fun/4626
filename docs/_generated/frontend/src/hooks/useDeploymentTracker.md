[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useDeploymentTracker

# src/hooks/useDeploymentTracker

## Interfaces

### DeploymentRecord

Defined in: [src/hooks/useDeploymentTracker.ts:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L8)

Deployment record stored in localStorage.
Tracks a single deployment per owner address per deployment version.

#### Properties

##### contracts

> **contracts**: `object`

Defined in: [src/hooks/useDeploymentTracker.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L18)

Deployed contract addresses

###### burnStream?

> `optional` **burnStream**: `` `0x${string}` ``

###### ccaStrategy?

> `optional` **ccaStrategy**: `` `0x${string}` ``

###### gaugeController?

> `optional` **gaugeController**: `` `0x${string}` ``

###### oracle?

> `optional` **oracle**: `` `0x${string}` ``

###### payoutRouter?

> `optional` **payoutRouter**: `` `0x${string}` ``

###### shareOFT

> **shareOFT**: `` `0x${string}` ``

###### vault

> **vault**: `` `0x${string}` ``

###### wrapper

> **wrapper**: `` `0x${string}` ``

##### creatorToken

> **creatorToken**: `` `0x${string}` ``

Defined in: [src/hooks/useDeploymentTracker.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L10)

The creator token (Zora coin) address deployed for

##### deployedAt

> **deployedAt**: `number`

Defined in: [src/hooks/useDeploymentTracker.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L16)

Unix timestamp (ms) when deployment completed

##### owner

> **owner**: `` `0x${string}` ``

Defined in: [src/hooks/useDeploymentTracker.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L12)

The owner address (canonical Coinbase Smart Wallet)

##### txHashes?

> `optional` **txHashes**: `object`

Defined in: [src/hooks/useDeploymentTracker.ts:29](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L29)

Transaction hashes for each phase

###### phase1?

> `optional` **phase1**: `string`

###### phase2?

> `optional` **phase2**: `string`

###### phase3?

> `optional` **phase3**: `string`

###### phase4?

> `optional` **phase4**: `string`

##### version

> **version**: `string`

Defined in: [src/hooks/useDeploymentTracker.ts:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L14)

Deployment version from VITE_DEPLOYMENT_VERSION

## Functions

### getDeploymentForOwnerVersion()

> **getDeploymentForOwnerVersion**(`owner`, `version`): [`DeploymentRecord`](#deploymentrecord) \| `null`

Defined in: [src/hooks/useDeploymentTracker.ts:65](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L65)

Retrieves deployment for a specific owner and version.

#### Parameters

##### owner

`` `0x${string}` ``

##### version

`string`

#### Returns

[`DeploymentRecord`](#deploymentrecord) \| `null`

***

### getDeploymentsForOwner()

> **getDeploymentsForOwner**(`owner`): [`DeploymentRecord`](#deploymentrecord)[]

Defined in: [src/hooks/useDeploymentTracker.ts:50](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L50)

Retrieves all deployments for a given owner across all versions.

#### Parameters

##### owner

`` `0x${string}` ``

#### Returns

[`DeploymentRecord`](#deploymentrecord)[]

***

### getDeploymentVersion()

> **getDeploymentVersion**(): `string`

Defined in: [src/hooks/useDeploymentTracker.ts:185](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L185)

Utility to get the current deployment version from env.

#### Returns

`string`

***

### useDeploymentTracker()

> **useDeploymentTracker**(`owner`, `version`): `object`

Defined in: [src/hooks/useDeploymentTracker.ts:125](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/hooks/useDeploymentTracker.ts#L125)

Hook to track deployments per owner address per version.
Enforces 1 deployment per owner per VITE_DEPLOYMENT_VERSION.

#### Parameters

##### owner

`` `0x${string}` `` | `null`

##### version

`string`

#### Returns

##### allDeployments

> **allDeployments**: [`DeploymentRecord`](#deploymentrecord)[]

All deployments for this owner across all versions

##### clearCurrentDeployment()

> **clearCurrentDeployment**: () => `void`

Clear deployment record for current owner+version

###### Returns

`void`

##### existingDeployment

> **existingDeployment**: [`DeploymentRecord`](#deploymentrecord) \| `null`

The existing deployment record (if any)

##### hasDeployed

> **hasDeployed**: `boolean`

Whether the owner has already deployed in this version

##### recordDeployment()

> **recordDeployment**: (`params`) => [`DeploymentRecord`](#deploymentrecord) \| `null`

Record a new deployment

###### Parameters

###### params

###### contracts

\{ `burnStream?`: `` `0x${string}` ``; `ccaStrategy?`: `` `0x${string}` ``; `gaugeController?`: `` `0x${string}` ``; `oracle?`: `` `0x${string}` ``; `payoutRouter?`: `` `0x${string}` ``; `shareOFT`: `` `0x${string}` ``; `vault`: `` `0x${string}` ``; `wrapper`: `` `0x${string}` ``; \}

###### contracts.burnStream?

`` `0x${string}` ``

###### contracts.ccaStrategy?

`` `0x${string}` ``

###### contracts.gaugeController?

`` `0x${string}` ``

###### contracts.oracle?

`` `0x${string}` ``

###### contracts.payoutRouter?

`` `0x${string}` ``

###### contracts.shareOFT

`` `0x${string}` ``

###### contracts.vault

`` `0x${string}` ``

###### contracts.wrapper

`` `0x${string}` ``

###### creatorToken

`` `0x${string}` ``

###### txHashes?

\{ `phase1?`: `string`; `phase2?`: `string`; `phase3?`: `string`; `phase4?`: `string`; \}

###### txHashes.phase1?

`string`

###### txHashes.phase2?

`string`

###### txHashes.phase3?

`string`

###### txHashes.phase4?

`string`

###### Returns

[`DeploymentRecord`](#deploymentrecord) \| `null`
