[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/creatorRoomLinks

# server/\_lib/alfaclub/creatorRoomLinks

## Type Aliases

### CreatorRoomLinkHint

> **CreatorRoomLinkHint** = `object`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L10)

#### Properties

##### address

> **address**: `string`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L11)

##### tokenId?

> `optional` **tokenId**: `string`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L13)

FriendKey / metrics token id — prefer matching `alfaclub_rooms_snapshot.room_id`.

## Functions

### buildAlfaClubRoomUrl()

> **buildAlfaClubRoomUrl**(`roomId`): `string`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L28)

#### Parameters

##### roomId

`string`

#### Returns

`string`

***

### formatAlfaClubBriefOpsRoomFooter()

> **formatAlfaClubBriefOpsRoomFooter**(`postingRoomId`): `string` \| `null`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:283](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L283)

One-line context when the daily brief posts into an ops/bridge room (e.g. 1043).

#### Parameters

##### postingRoomId

`string`

#### Returns

`string` \| `null`

***

### formatCreatorRoomLink()

> **formatCreatorRoomLink**(`creatorAddress`, `roomIds`): `string` \| `null`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:273](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L273)

#### Parameters

##### creatorAddress

`string`

##### roomIds

`Map`\<`string`, `string`\>

#### Returns

`string` \| `null`

***

### loadCreatorRoomIdByCoinAddress()

> **loadCreatorRoomIdByCoinAddress**(`addresses`): `Promise`\<`Map`\<`string`, `string`\>\>

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:239](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L239)

#### Parameters

##### addresses

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, `string`\>\>

***

### pickCreatorRoomIdFromSnapshotRows()

> **pickCreatorRoomIdFromSnapshotRows**(`rows`, `tokenId?`): `string` \| `null`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L64)

Prefer token-id room match, then highest reported volume.

#### Parameters

##### rows

`SnapshotRoomRow`[]

##### tokenId?

`string`

#### Returns

`string` \| `null`

***

### readAlfaClubPageOrigin()

> **readAlfaClubPageOrigin**(): `string`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L21)

#### Returns

`string`

***

### readOperationalAlfaClubRoomIds()

> **readOperationalAlfaClubRoomIds**(): `Set`\<`string`\>

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L40)

#### Returns

`Set`\<`string`\>

***

### resolveCreatorRoomLinks()

> **resolveCreatorRoomLinks**(`input`): `Promise`\<`Map`\<`string`, `string`\>\>

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:194](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L194)

Resolve creator → AlfaClub room URL targets.
Order: room_access_policies → alfaclub_rooms_snapshot (canonical) → non-ops chat activity.

#### Parameters

##### input

`string`[] | [`CreatorRoomLinkHint`](#creatorroomlinkhint)[]

#### Returns

`Promise`\<`Map`\<`string`, `string`\>\>

***

### resolveRoomIdFromFriendKeyTokenId()

> **resolveRoomIdFromFriendKeyTokenId**(`tokenId`): `string` \| `null`

Defined in: [server/\_lib/alfaclub/creatorRoomLinks.ts:232](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/creatorRoomLinks.ts#L232)

FriendKey token ids usually match AlfaClub trading room ids.
Use only when policy/snapshot/chat did not resolve — never map ops rooms.

#### Parameters

##### tokenId

`string` | `undefined`

#### Returns

`string` \| `null`
