[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/chatBridge

# server/\_lib/alfaclub/chatBridge

## Type Aliases

### AlfaClubChatBridgeFlags

> **AlfaClubChatBridgeFlags** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L48)

#### Properties

##### apiBaseUrl

> **apiBaseUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L53)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L50)

##### groupId

> **groupId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L55)

##### historyLimit

> **historyLimit**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:57](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L57)

##### jwt

> **jwt**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L52)

##### killSwitch

> **killSwitch**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L49)

##### pollIntervalMs

> **pollIntervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L56)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L51)

##### sendTimeoutMs

> **sendTimeoutMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L58)

##### websocketUrl

> **websocketUrl**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L54)

***

### AlfaClubChatBridgeSkipReason

> **AlfaClubChatBridgeSkipReason** = `"kill_switch"` \| `"disabled"` \| `"env_missing"` \| `"already_running"`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L75)

***

### AlfaClubChatBridgeTickResult

> **AlfaClubChatBridgeTickResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:81](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L81)

#### Properties

##### errors

> **errors**: `object`[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L88)

###### error

> **error**: `string`

###### messageId

> **messageId**: `string`

##### fetched

> **fetched**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L84)

##### processed

> **processed**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L86)

##### replied

> **replied**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:87](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L87)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L83)

##### seeded

> **seeded**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L82)

##### unseen

> **unseen**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L85)

***

### AlfaClubCommandMessage

> **AlfaClubCommandMessage** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L61)

#### Properties

##### date

> **date**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L63)

##### id

> **id**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L62)

##### sender

> **sender**: `` `0x${string}` ``

Defined in: [server/\_lib/alfaclub/chatBridge.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L64)

##### text

> **text**: `string`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L65)

***

### StartAlfaClubChatBridgeResult

> **StartAlfaClubChatBridgeResult** = `object`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:91](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L91)

#### Properties

##### intervalMs

> **intervalMs**: `number`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:94](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L94)

##### reason?

> `optional` **reason**: [`AlfaClubChatBridgeSkipReason`](#alfaclubchatbridgeskipreason)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:93](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L93)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:95](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L95)

##### started

> **started**: `boolean`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:92](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L92)

##### stop()

> **stop**: () => `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:96](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L96)

###### Returns

`void`

## Functions

### \_resetAlfaClubChatBridgeStateForTests()

> **\_resetAlfaClubChatBridgeStateForTests**(): `void`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:575](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L575)

#### Returns

`void`

***

### buildAlfaClubOutboundFrame()

> **buildAlfaClubOutboundFrame**(`params`): `AlfaClubOutboundFrame`

Defined in: [server/\_lib/alfaclub/chatBridge.ts:167](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L167)

#### Parameters

##### params

###### roomId

`string`

###### text

`string`

#### Returns

`AlfaClubOutboundFrame`

***

### collectAlfaClubCommandMessages()

> **collectAlfaClubCommandMessages**(`params`): [`AlfaClubCommandMessage`](#alfaclubcommandmessage)[]

Defined in: [server/\_lib/alfaclub/chatBridge.ts:200](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L200)

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

### readAlfaClubChatBridgeFlags()

> **readAlfaClubChatBridgeFlags**(): [`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L136)

#### Returns

[`AlfaClubChatBridgeFlags`](#alfaclubchatbridgeflags)

***

### startAlfaClubChatBridge()

> **startAlfaClubChatBridge**(`opts?`): [`StartAlfaClubChatBridgeResult`](#startalfaclubchatbridgeresult)

Defined in: [server/\_lib/alfaclub/chatBridge.ts:483](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/chatBridge.ts#L483)

#### Parameters

##### opts?

###### onError?

(`error`) => `void`

###### onTick?

(`result`) => `void`

#### Returns

[`StartAlfaClubChatBridgeResult`](#startalfaclubchatbridgeresult)
