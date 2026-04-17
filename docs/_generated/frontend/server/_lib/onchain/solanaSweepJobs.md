[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/onchain/solanaSweepJobs

# server/\_lib/onchain/solanaSweepJobs

## Functions

### enqueueSolanaSweepJob()

> **enqueueSolanaSweepJob**(`params`): `Promise`\<`SolanaSweepJobRow`\>

Defined in: [server/\_lib/onchain/solanaSweepJobs.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaSweepJobs.ts#L126)

#### Parameters

##### params

###### canonicalWallet

`string`

###### db

`Db`

###### minLamports?

`string` \| `number` \| `bigint`

###### operationalWallet

`string`

###### profileId

`number`

#### Returns

`Promise`\<`SolanaSweepJobRow`\>

***

### ensureSolanaSweepJobsSchema()

> **ensureSolanaSweepJobsSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/\_lib/onchain/solanaSweepJobs.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaSweepJobs.ts#L87)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### processSolanaSweepJobs()

> **processSolanaSweepJobs**(`params`): `Promise`\<\{ `blocked`: `number`; `failed`: `number`; `jobIds`: `number`[]; `processed`: `number`; `retried`: `number`; `succeeded`: `number`; \}\>

Defined in: [server/\_lib/onchain/solanaSweepJobs.ts:248](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/onchain/solanaSweepJobs.ts#L248)

#### Parameters

##### params

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<\{ `blocked`: `number`; `failed`: `number`; `jobIds`: `number`[]; `processed`: `number`; `retried`: `number`; `succeeded`: `number`; \}\>
