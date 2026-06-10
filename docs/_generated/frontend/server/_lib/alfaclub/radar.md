[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/radar

# server/\_lib/alfaclub/radar

## Type Aliases

### AlfaClubRadarDispatchResult

> **AlfaClubRadarDispatchResult** = `object`

Defined in: [server/\_lib/alfaclub/radar.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L36)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L45)

##### highlighted

> **highlighted**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L43)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L37)

##### previousSnapshotTs

> **previousSnapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L40)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/alfaclub/radar.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L38)

##### sent

> **sent**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L41)

##### skippedDuplicate

> **skippedDuplicate**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L42)

##### snapshotTs

> **snapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L39)

##### topRows

> **topRows**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L44)

***

### AlfaClubRadarFlags

> **AlfaClubRadarFlags** = `object`

Defined in: [server/\_lib/alfaclub/radar.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L23)

#### Properties

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L25)

##### forceSend

> **forceSend**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L33)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L24)

##### minRankMove

> **minRankMove**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L31)

##### minScoreDelta

> **minScoreDelta**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L32)

##### moversN

> **moversN**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L30)

##### telegramBotToken

> **telegramBotToken**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L26)

##### telegramChatId

> **telegramChatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L27)

##### telegramThreadId

> **telegramThreadId**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L28)

##### topN

> **topN**: `number`

Defined in: [server/\_lib/alfaclub/radar.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L29)

***

### SnapshotDelta

> **SnapshotDelta** = `object`

Defined in: [server/\_lib/alfaclub/radar.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L48)

#### Properties

##### current

> **current**: [`MetricsSnapshotRow`](publicationLedger.md#metricssnapshotrow)

Defined in: [server/\_lib/alfaclub/radar.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L49)

##### isNew

> **isNew**: `boolean`

Defined in: [server/\_lib/alfaclub/radar.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L56)

##### pnlDelta

> **pnlDelta**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L55)

##### previous

> **previous**: [`MetricsSnapshotRow`](publicationLedger.md#metricssnapshotrow) \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L50)

##### rankDelta

> **rankDelta**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L51)

##### scoreDelta

> **scoreDelta**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L52)

##### stakedDelta

> **stakedDelta**: `bigint` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L54)

##### supplyDelta

> **supplyDelta**: `bigint` \| `null`

Defined in: [server/\_lib/alfaclub/radar.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L53)

## Functions

### buildAlfaClubRadarText()

> **buildAlfaClubRadarText**(`params`): `object`

Defined in: [server/\_lib/alfaclub/radar.ts:369](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L369)

#### Parameters

##### params

###### deltas

[`SnapshotDelta`](#snapshotdelta)[]

###### flags

[`AlfaClubRadarFlags`](#alfaclubradarflags)

###### labels

`CreatorLabelMap`

###### previousSnapshotTs

`string` \| `null`

###### roomIds

`Map`\<`string`, `string`\>

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

Defined in: [server/\_lib/alfaclub/radar.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L98)

#### Returns

[`AlfaClubRadarFlags`](#alfaclubradarflags)

***

### runAlfaClubRadar()

> **runAlfaClubRadar**(`opts`): `Promise`\<[`AlfaClubRadarDispatchResult`](#alfaclubradardispatchresult)\>

Defined in: [server/\_lib/alfaclub/radar.ts:520](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/radar.ts#L520)

#### Parameters

##### opts

###### flags?

[`AlfaClubRadarFlags`](#alfaclubradarflags)

###### sendTelegram?

(`params`) => `Promise`\<`void`\>

#### Returns

`Promise`\<[`AlfaClubRadarDispatchResult`](#alfaclubradardispatchresult)\>
