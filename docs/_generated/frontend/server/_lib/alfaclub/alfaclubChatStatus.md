[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/alfaclubChatStatus

# server/\_lib/alfaclub/alfaclubChatStatus

## Functions

### formatAlfaClubStatusForChat()

> **formatAlfaClubStatusForChat**(`flags`): `Promise`\<`string`\>

Defined in: [server/\_lib/alfaclub/alfaclubChatStatus.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/alfaclubChatStatus.ts#L67)

#### Parameters

##### flags

[`VigilanteFlags`](vigilante.md#vigilanteflags)

#### Returns

`Promise`\<`string`\>

***

### formatBridgeAuthHealthLines()

> **formatBridgeAuthHealthLines**(`snapshot`): `string`[]

Defined in: [server/\_lib/alfaclub/alfaclubChatStatus.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/alfaclubChatStatus.ts#L22)

#### Parameters

##### snapshot

[`AlfaClubAuthHealthSnapshot`](authHealthStore.md#alfaclubauthhealthsnapshot)

#### Returns

`string`[]

***

### readAlfaClubChatStatusSnapshot()

> **readAlfaClubChatStatusSnapshot**(): `Promise`\<[`AlfaClubAuthHealthSnapshot`](authHealthStore.md#alfaclubauthhealthsnapshot) \| `null`\>

Defined in: [server/\_lib/alfaclub/alfaclubChatStatus.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/alfaclubChatStatus.ts#L50)

#### Returns

`Promise`\<[`AlfaClubAuthHealthSnapshot`](authHealthStore.md#alfaclubauthhealthsnapshot) \| `null`\>
