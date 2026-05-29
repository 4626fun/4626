[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/dailyBrief

# server/\_lib/alfaclub/dailyBrief

## Type Aliases

### AlfaClubBriefContextResult

> **AlfaClubBriefContextResult** = \{ `ok`: `false`; `reason`: `string`; `snapshotTs`: `string` \| `null`; \} \| \{ `formatInput`: [`AlfaClubDailyBriefFormatInput`](#alfaclubdailybriefformatinput); `ok`: `true`; `previousSnapshotTs`: `string` \| `null`; `snapshotTs`: `string`; \}

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:893](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L893)

***

### AlfaClubDailyBriefFormatInput

> **AlfaClubDailyBriefFormatInput** = `object`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:841](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L841)

#### Properties

##### compact

> **compact**: `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:852](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L852)

##### creatorsTracked

> **creatorsTracked**: `number`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:846](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L846)

##### currentRows

> **currentRows**: [`MetricsSnapshotRow`](publicationLedger.md#metricssnapshotrow)[]

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:844](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L844)

##### labels

> **labels**: `CreatorLabelMap`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:853](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L853)

##### majorRows

> **majorRows**: `number`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:851](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L851)

##### marketRows

> **marketRows**: `MarketRow`[]

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:848](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L848)

##### moverRows

> **moverRows**: `number`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:850](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L850)

##### previousRows

> **previousRows**: [`MetricsSnapshotRow`](publicationLedger.md#metricssnapshotrow)[]

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:845](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L845)

##### previousSnapshotTs

> **previousSnapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:843](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L843)

##### recentPublications

> **recentPublications**: [`PublicationRecord`](publicationLedger.md#publicationrecord)[]

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:847](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L847)

##### roomIds

> **roomIds**: `Map`\<`string`, `string`\>

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:854](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L854)

##### snapshotTs

> **snapshotTs**: `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:842](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L842)

##### topRows

> **topRows**: `number`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:849](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L849)

***

### AlfaClubDailyBriefResult

> **AlfaClubDailyBriefResult** = `object`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L75)

#### Properties

##### lane

> **lane**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L83)

##### messageText

> **messageText**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L84)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L76)

##### previousSnapshotTs

> **previousSnapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:79](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L79)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L77)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L82)

##### sent

> **sent**: `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:80](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L80)

##### skippedDuplicate

> **skippedDuplicate**: `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L81)

##### snapshotTs

> **snapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:78](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L78)

## Functions

### buildAlfaClubBriefContext()

> **buildAlfaClubBriefContext**(`params?`): `Promise`\<[`AlfaClubBriefContextResult`](#alfaclubbriefcontextresult)\>

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:902](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L902)

#### Parameters

##### params?

###### compact?

`boolean`

###### fetchMarkets?

`boolean`

###### majorRows?

`number`

###### moverRows?

`number`

###### topRows?

`number`

#### Returns

`Promise`\<[`AlfaClubBriefContextResult`](#alfaclubbriefcontextresult)\>

***

### formatAlfaClubDailyBrief()

> **formatAlfaClubDailyBrief**(`input`): `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:967](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L967)

#### Parameters

##### input

[`AlfaClubDailyBriefFormatInput`](#alfaclubdailybriefformatinput)

#### Returns

`string`

***

### formatAlfaClubLeaderboardChat()

> **formatAlfaClubLeaderboardChat**(`input`, `disclaimer?`): `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:857](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L857)

#### Parameters

##### input

[`AlfaClubDailyBriefFormatInput`](#alfaclubdailybriefformatinput)

##### disclaimer?

`string`

#### Returns

`string`

***

### formatIndexedScopeLine()

> **formatIndexedScopeLine**(`params`): `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:404](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L404)

#### Parameters

##### params

###### activeCreators24h

`number`

###### creatorsTracked

`number`

###### newCreators

`number`

###### rankedCount

`number`

#### Returns

`string`

***

### isDailyBriefRoomSameAsBridgeRoom()

> **isDailyBriefRoomSameAsBridgeRoom**(`briefRoomId`): `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L102)

#### Parameters

##### briefRoomId

`string`

#### Returns

`boolean`

***

### readAlfaClubDailyBriefFlags()

> **readAlfaClubDailyBriefFlags**(): `DailyBriefFlags`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L106)

#### Returns

`DailyBriefFlags`

***

### readAlfaClubDailyBriefSeparateFromBridge()

> **readAlfaClubDailyBriefSeparateFromBridge**(): `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L98)

When true, cron/manual post skips if digest room equals the command bridge room.

#### Returns

`boolean`

***

### resolveAlfaClubBridgeRoomId()

> **resolveAlfaClubBridgeRoomId**(): `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L87)

#### Returns

`string`

***

### resolveDailyBriefRoomId()

> **resolveDailyBriefRoomId**(): `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L91)

#### Returns

`string`

***

### runAlfaClubDailyBrief()

> **runAlfaClubDailyBrief**(`params`): `Promise`\<[`AlfaClubDailyBriefResult`](#alfaclubdailybriefresult)\>

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:998](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/dailyBrief.ts#L998)

#### Parameters

##### params

###### flags?

`DailyBriefFlags`

#### Returns

`Promise`\<[`AlfaClubDailyBriefResult`](#alfaclubdailybriefresult)\>
