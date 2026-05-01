[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/radar

# server/\_lib/alfaclub/radar

## Type Aliases

### AlfaClubRadarDispatchResult

> **AlfaClubRadarDispatchResult** = `object`

Defined in: [server/\_lib/alfaclub/radar.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L31)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L40)

##### highlighted

> **highlighted**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L38)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L32)

##### previousSnapshotTs

> **previousSnapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L35)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/alfaclub/radar.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L33)

##### sent

> **sent**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L36)

##### skippedDuplicate

> **skippedDuplicate**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L37)

##### snapshotTs

> **snapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L34)

##### topRows

> **topRows**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L39)

***

### AlfaClubRadarFlags

> **AlfaClubRadarFlags** = `object`

Defined in: [server/\_lib/alfaclub/radar.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L18)

#### Properties

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L20)

##### forceSend

> **forceSend**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L28)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L19)

##### minRankMove

> **minRankMove**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L26)

##### minScoreDelta

> **minScoreDelta**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L27)

##### moversN

> **moversN**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L25)

##### telegramBotToken

> **telegramBotToken**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L21)

##### telegramChatId

> **telegramChatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L22)

##### telegramThreadId

> **telegramThreadId**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L23)

##### topN

> **topN**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L24)

***

### SnapshotDelta

> **SnapshotDelta** = `object`

Defined in: [server/\_lib/alfaclub/radar.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L43)

#### Properties

##### current

> **current**: [`MetricsSnapshotRow`](publicationLedger.md#metricssnapshotrow)

Defined in: [server/\_lib/alfaclub/radar.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L44)

##### isNew

> **isNew**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L51)

##### pnlDelta

> **pnlDelta**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L50)

##### previous

> **previous**: [`MetricsSnapshotRow`](publicationLedger.md#metricssnapshotrow) \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L45)

##### rankDelta

> **rankDelta**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L46)

##### scoreDelta

> **scoreDelta**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L47)

##### stakedDelta

> **stakedDelta**: `bigint` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L49)

##### supplyDelta

> **supplyDelta**: `bigint` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L48)

## Functions

### buildAlfaClubRadarText()

> **buildAlfaClubRadarText**(`params`): `object`

Defined in: [server/\_lib/alfaclub/radar.ts:279](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L279)

#### Parameters

##### params

###### deltas

[`SnapshotDelta`](#snapshotdelta)[]

###### flags

[`AlfaClubRadarFlags`](#alfaclubradarflags)

###### previousSnapshotTs

`string` \| `null`

###### snapshotTs

`string`

#### Returns

`object`

##### highlighted

> **highlighted**: `number`

##### text

> **text**: `string`

##### topRows

> **topRows**: `number`

***

### readAlfaClubRadarFlags()

> **readAlfaClubRadarFlags**(): [`AlfaClubRadarFlags`](#alfaclubradarflags)

Defined in: [server/\_lib/alfaclub/radar.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L91)

#### Returns

[`AlfaClubRadarFlags`](#alfaclubradarflags)

***

### runAlfaClubRadar()

> **runAlfaClubRadar**(`opts`): `Promise`\<[`AlfaClubRadarDispatchResult`](#alfaclubradardispatchresult)\>

Defined in: [server/\_lib/alfaclub/radar.ts:366](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L366)

#### Parameters

##### opts

###### flags?

[`AlfaClubRadarFlags`](#alfaclubradarflags)

###### sendTelegram?

(`params`) => `Promise`\<`void`\>

#### Returns

`Promise`\<[`AlfaClubRadarDispatchResult`](#alfaclubradardispatchresult)\>
