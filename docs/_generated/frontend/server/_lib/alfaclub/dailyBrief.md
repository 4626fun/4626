[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/dailyBrief

# server/\_lib/alfaclub/dailyBrief

## Type Aliases

### AlfaClubDailyBriefResult

> **AlfaClubDailyBriefResult** = `object`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L63)

#### Properties

##### lane

> **lane**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L71)

##### messageText

> **messageText**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L72)

##### ok

> **ok**: `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:64](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L64)

##### previousSnapshotTs

> **previousSnapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L67)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L65)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:70](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L70)

##### sent

> **sent**: `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L68)

##### skippedDuplicate

> **skippedDuplicate**: `boolean`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L69)

##### snapshotTs

> **snapshotTs**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L66)

## Functions

### readAlfaClubDailyBriefFlags()

> **readAlfaClubDailyBriefFlags**(): `DailyBriefFlags`

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L75)

#### Returns

`DailyBriefFlags`

***

### runAlfaClubDailyBrief()

> **runAlfaClubDailyBrief**(`params`): `Promise`\<[`AlfaClubDailyBriefResult`](#alfaclubdailybriefresult)\>

Defined in: [server/\_lib/alfaclub/dailyBrief.ts:534](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/dailyBrief.ts#L534)

#### Parameters

##### params

###### flags?

`DailyBriefFlags`

#### Returns

`Promise`\<[`AlfaClubDailyBriefResult`](#alfaclubdailybriefresult)\>
