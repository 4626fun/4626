[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/chatBridge

# server/\_lib/alfaclub/chatBridge

## Type Aliases

### AlfaClubChatBridgeFlags

> **AlfaClubChatBridgeFlags** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L89)

#### Properties

##### apiBaseUrl

> **apiBaseUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L95)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L91)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:97](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L97)

##### historyLimit

> **historyLimit**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:99](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L99)

##### ingestJwt

> **ingestJwt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L94)

##### jwt

> **jwt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L93)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L90)

##### pollIntervalMs

> **pollIntervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L98)

##### requestTimeoutMs

> **requestTimeoutMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L101)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L92)

##### sendTimeoutMs

> **sendTimeoutMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L100)

##### telegramRelayBotToken

> **telegramRelayBotToken**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L105)

##### telegramRelayChatId

> **telegramRelayChatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L106)

##### telegramRelayEnabled

> **telegramRelayEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L104)

##### telegramRelayThreadId

> **telegramRelayThreadId**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L107)

##### websocketUrl

> **websocketUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L96)

##### wsIngestAllRoomsEnabled

> **wsIngestAllRoomsEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L103)

##### wsLiveFallbackEnabled

> **wsLiveFallbackEnabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L102)

***

### AlfaClubChatBridgeSkipReason

> **AlfaClubChatBridgeSkipReason** = `"kill_switch"` \| `"disabled"` \| `"env_missing"` \| `"already_running"`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L128)

***

### AlfaClubChatBridgeTickResult

> **AlfaClubChatBridgeTickResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:134](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L134)

#### Properties

##### errors

> **errors**: `object`[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:141](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L141)

###### error

> **error**: `string`

###### messageId

> **messageId**: `string`

##### fetched

> **fetched**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:137](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L137)

##### processed

> **processed**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:139](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L139)

##### replied

> **replied**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:140](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L140)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L136)

##### seeded

> **seeded**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:135](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L135)

##### unseen

> **unseen**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:138](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L138)

***

### AlfaClubCommandMessage

> **AlfaClubCommandMessage** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:110](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L110)

#### Properties

##### date

> **date**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:112](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L112)

##### id

> **id**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L111)

##### sender

> **sender**: `` `0x${string}` ``

Defined in: [server/\_lib/alfaclub/chatBridge.ts:113](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L113)

##### text

> **text**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L114)

***

### AlfaClubMessageAttachment

> **AlfaClubMessageAttachment** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:69](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L69)

#### Properties

##### dims?

> `optional` **dims**: \[`number`, `number`\]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L71)

##### duration?

> `optional` **duration**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:77](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L77)

##### filename?

> `optional` **filename**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L73)

##### mime\_type?

> `optional` **mime\_type**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:74](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L74)

##### preview?

> `optional` **preview**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:76](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L76)

##### size?

> `optional` **size**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L75)

##### type

> **type**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L72)

##### url

> **url**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:70](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L70)

***

### RunAlfaClubChatBridgeTickOnceResult

> **RunAlfaClubChatBridgeTickOnceResult** = \{ `data`: [`AlfaClubChatBridgeTickResult`](#alfaclubchatbridgetickresult); `intervalMs`: `number`; `ok`: `true`; `roomId`: `string`; \} \| \{ `intervalMs`: `number`; `ok`: `false`; `reason`: [`AlfaClubChatBridgeSkipReason`](#alfaclubchatbridgeskipreason); `roomId`: `string` \| `null`; \}

Defined in: [server/\_lib/alfaclub/chatBridge.ts:152](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L152)

***

### StartAlfaClubChatBridgeResult

> **StartAlfaClubChatBridgeResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:144](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L144)

#### Properties

##### intervalMs

> **intervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:147](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L147)

##### reason?

> `optional` **reason**: [`AlfaClubChatBridgeSkipReason`](#alfaclubchatbridgeskipreason)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:146](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L146)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:148](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L148)

##### started

> **started**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:145](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L145)

##### stop()

> **stop**: () => `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:149](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L149)

###### Returns

`void`

## Functions

### \_isRoomHistoryAuthErrorForTests()

> **\_isRoomHistoryAuthErrorForTests**(`error`): `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:1438](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L1438)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### \_resetAlfaClubChatBridgeStateForTests()

> **\_resetAlfaClubChatBridgeStateForTests**(): `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:1442](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L1442)

#### Returns

`void`

***

### buildAlfaClubOutboundFrame()

> **buildAlfaClubOutboundFrame**(`params`): `AlfaClubOutboundFrame`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:278](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L278)

#### Parameters

##### params

###### attachments?

`unknown`

###### roomId

`string`

###### text

`string`

#### Returns

`AlfaClubOutboundFrame`

***

### collectAlfaClubCommandMessages()

> **collectAlfaClubCommandMessages**(`params`): [`AlfaClubCommandMessage`](#alfaclubcommandmessage)[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:336](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L336)

#### Parameters

##### params

###### messages

`AlfaClubRoomHistoryMessage`[]

###### seenMessageIds

`ReadonlySet`\<`string`\>

###### selfAddress?

`string`

#### Returns

[`AlfaClubCommandMessage`](#alfaclubcommandmessage)[]

***

### extractAlfaClubWsMessagesForTest()

> **extractAlfaClubWsMessagesForTest**(`payload`): `AlfaClubLiveInboundMessage`[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:548](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L548)

#### Parameters

##### payload

`unknown`

#### Returns

`AlfaClubLiveInboundMessage`[]

***

### readAlfaClubChatBridgeFlags()

> **readAlfaClubChatBridgeFlags**(): [`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:217](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L217)

#### Returns

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

***

### runAlfaClubChatBridgeTickOnce()

> **runAlfaClubChatBridgeTickOnce**(): `Promise`\<[`RunAlfaClubChatBridgeTickOnceResult`](#runalfaclubchatbridgetickonceresult)\>

Defined in: [server/\_lib/alfaclub/chatBridge.ts:1302](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L1302)

#### Returns

`Promise`\<[`RunAlfaClubChatBridgeTickOnceResult`](#runalfaclubchatbridgetickonceresult)\>

***

### startAlfaClubChatBridge()

> **startAlfaClubChatBridge**(`opts?`): [`StartAlfaClubChatBridgeResult`](#startalfaclubchatbridgeresult)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:1338](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L1338)

#### Parameters

##### opts?

###### onError?

(`error`) => `void`

###### onTick?

(`result`) => `void`

#### Returns

[`StartAlfaClubChatBridgeResult`](#startalfaclubchatbridgeresult)
