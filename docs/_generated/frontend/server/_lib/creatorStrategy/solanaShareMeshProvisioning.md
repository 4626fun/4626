[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/solanaShareMeshProvisioning

# server/\_lib/creatorStrategy/solanaShareMeshProvisioning

## Type Aliases

### SolanaShareMeshProvisioningEnqueueResult

> **SolanaShareMeshProvisioningEnqueueResult** = `object`

Defined in: [server/\_lib/creatorStrategy/solanaShareMeshProvisioning.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/solanaShareMeshProvisioning.ts#L11)

#### Properties

##### enqueued

> **enqueued**: `boolean`

Defined in: [server/\_lib/creatorStrategy/solanaShareMeshProvisioning.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/solanaShareMeshProvisioning.ts#L12)

##### jobId

> **jobId**: `number` \| `null`

Defined in: [server/\_lib/creatorStrategy/solanaShareMeshProvisioning.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/solanaShareMeshProvisioning.ts#L13)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/creatorStrategy/solanaShareMeshProvisioning.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/solanaShareMeshProvisioning.ts#L14)

## Functions

### creatorHasSolanaShareMeshEntitlement()

> **creatorHasSolanaShareMeshEntitlement**(`creatorToken`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/creatorStrategy/solanaShareMeshProvisioning.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/solanaShareMeshProvisioning.ts#L33)

#### Parameters

##### creatorToken

`string`

#### Returns

`Promise`\<`boolean`\>

***

### enqueueSolanaShareMeshProvisioning()

> **enqueueSolanaShareMeshProvisioning**(`params`): `Promise`\<[`SolanaShareMeshProvisioningEnqueueResult`](#solanasharemeshprovisioningenqueueresult)\>

Defined in: [server/\_lib/creatorStrategy/solanaShareMeshProvisioning.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/solanaShareMeshProvisioning.ts#L43)

#### Parameters

##### params

###### activationId

`number`

###### creatorToken

`string`

###### deploySessionId?

`string` \| `null`

###### paymentSource

`string`

###### trigger

`"payment"` \| `"post_deploy"`

###### vaultAddress?

`string` \| `null`

#### Returns

`Promise`\<[`SolanaShareMeshProvisioningEnqueueResult`](#solanasharemeshprovisioningenqueueresult)\>
