[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/keeperJobs/keeperJobRunner

# server/\_lib/keeperJobs/keeperJobRunner

## Type Aliases

### KeeperJobTickResult

> **KeeperJobTickResult** = `object`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L46)

#### Properties

##### claimed

> **claimed**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L47)

##### releasedExpiredClaims

> **releasedExpiredClaims**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L48)

##### results

> **results**: `KeeperJobRunResult`[]

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L49)

***

### KeeprActionProcessResult

> **KeeprActionProcessResult** = `object`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L72)

#### Properties

##### failed

> **failed**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L75)

##### processed

> **processed**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L73)

##### retried

> **retried**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L76)

##### succeeded

> **succeeded**: `number`

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L74)

## Functions

### processKeeprActions()

> **processKeeprActions**(`input`): `Promise`\<[`KeeprActionProcessResult`](#keepractionprocessresult)\>

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:445](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L445)

#### Parameters

##### input

###### apiKey

`string`

###### baseUrl

`string`

###### limit?

`number` \| `null`

###### retryDelaySeconds?

`number` \| `null`

#### Returns

`Promise`\<[`KeeprActionProcessResult`](#keepractionprocessresult)\>

***

### runKeeperJobTick()

> **runKeeperJobTick**(`input`): `Promise`\<[`KeeperJobTickResult`](#keeperjobtickresult)\>

Defined in: [server/\_lib/keeperJobs/keeperJobRunner.ts:414](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeperJobs/keeperJobRunner.ts#L414)

#### Parameters

##### input

`RunKeeperJobTickInput`

#### Returns

`Promise`\<[`KeeperJobTickResult`](#keeperjobtickresult)\>
