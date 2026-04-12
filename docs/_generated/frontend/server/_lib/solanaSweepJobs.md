[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/solanaSweepJobs

# server/\_lib/solanaSweepJobs

## Functions

### enqueueSolanaSweepJob()

> **enqueueSolanaSweepJob**(`params`): `Promise`\<`SolanaSweepJobRow`\>

Defined in: [server/\_lib/solanaSweepJobs.ts:126](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaSweepJobs.ts#L126)

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

Defined in: [server/\_lib/solanaSweepJobs.ts:87](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaSweepJobs.ts#L87)

#### Parameters

##### db

`Db`

#### Returns

`Promise`\<`void`\>

***

### processSolanaSweepJobs()

> **processSolanaSweepJobs**(`params`): `Promise`\<\{ `blocked`: `number`; `failed`: `number`; `jobIds`: `number`[]; `processed`: `number`; `retried`: `number`; `succeeded`: `number`; \}\>

Defined in: [server/\_lib/solanaSweepJobs.ts:248](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/solanaSweepJobs.ts#L248)

#### Parameters

##### params

###### db

`Db`

###### limit?

`number`

#### Returns

`Promise`\<\{ `blocked`: `number`; `failed`: `number`; `jobIds`: `number`[]; `processed`: `number`; `retried`: `number`; `succeeded`: `number`; \}\>
