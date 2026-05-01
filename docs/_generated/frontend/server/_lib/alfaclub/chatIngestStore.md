[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/chatIngestStore

# server/\_lib/alfaclub/chatIngestStore

## Type Aliases

### AlfaClubIngestMessage

> **AlfaClubIngestMessage** = `object`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L4)

#### Properties

##### dateMs

> **dateMs**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L9)

##### messageId

> **messageId**: `string`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L6)

##### rawPayloadText?

> `optional` **rawPayloadText**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L11)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L5)

##### senderAddress

> **senderAddress**: `string`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L7)

##### source

> **source**: `"ws-live"` \| `"history"`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L10)

##### text

> **text**: `string`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L8)

***

### AlfaClubInsertedIngestMessage

> **AlfaClubInsertedIngestMessage** = [`AlfaClubIngestMessage`](#alfaclubingestmessage) & `object`

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L14)

#### Type Declaration

##### dateIso

> **dateIso**: `string` \| `null`

## Functions

### upsertAlfaClubIngestMessages()

> **upsertAlfaClubIngestMessages**(`messages`): `Promise`\<[`AlfaClubInsertedIngestMessage`](#alfaclubinsertedingestmessage)[]\>

Defined in: [server/\_lib/alfaclub/chatIngestStore.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatIngestStore.ts#L27)

#### Parameters

##### messages

[`AlfaClubIngestMessage`](#alfaclubingestmessage)[]

#### Returns

`Promise`\<[`AlfaClubInsertedIngestMessage`](#alfaclubinsertedingestmessage)[]\>
