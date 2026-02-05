[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/guild-api

# src/lib/guild-api

## Interfaces

### BaseGuildStats

Defined in: [lib/guild-api.ts:23](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L23)

#### Properties

##### baseSocialScore?

> `optional` **baseSocialScore**: `number`

Defined in: [lib/guild-api.ts:34](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L34)

##### builderStatus?

> `optional` **builderStatus**: `"Based Developer"` \| `"Recognized by Base"` \| `null`

Defined in: [lib/guild-api.ts:35](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L35)

##### casterRank?

> `optional` **casterRank**: `"10k+"` \| `"50k+"` \| `"100k+"` \| `null`

Defined in: [lib/guild-api.ts:32](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L32)

##### isBased?

> `optional` **isBased**: `boolean`

Defined in: [lib/guild-api.ts:25](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L25)

##### isBuilder?

> `optional` **isBuilder**: `boolean`

Defined in: [lib/guild-api.ts:27](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L27)

##### isCoinbaseVerified?

> `optional` **isCoinbaseVerified**: `boolean`

Defined in: [lib/guild-api.ts:29](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L29)

##### isCreator?

> `optional` **isCreator**: `boolean`

Defined in: [lib/guild-api.ts:28](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L28)

##### isOnchain?

> `optional` **isOnchain**: `boolean`

Defined in: [lib/guild-api.ts:26](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L26)

##### roles

> **roles**: [`GuildRole`](#guildrole)[]

Defined in: [lib/guild-api.ts:37](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L37)

##### xCreatorRank?

> `optional` **xCreatorRank**: `"10k+"` \| `"50k+"` \| `"100k+"` \| `null`

Defined in: [lib/guild-api.ts:33](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L33)

***

### GuildMembership

Defined in: [lib/guild-api.ts:16](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L16)

#### Properties

##### guildId

> **guildId**: `number`

Defined in: [lib/guild-api.ts:17](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L17)

##### guildName

> **guildName**: `string`

Defined in: [lib/guild-api.ts:18](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L18)

##### joinedAt?

> `optional` **joinedAt**: `string`

Defined in: [lib/guild-api.ts:20](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L20)

##### roles

> **roles**: [`GuildRole`](#guildrole)[]

Defined in: [lib/guild-api.ts:19](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L19)

***

### GuildRole

Defined in: [lib/guild-api.ts:8](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L8)

#### Properties

##### description?

> `optional` **description**: `string`

Defined in: [lib/guild-api.ts:11](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L11)

##### id

> **id**: `number`

Defined in: [lib/guild-api.ts:9](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L9)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [lib/guild-api.ts:12](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L12)

##### memberCount?

> `optional` **memberCount**: `number`

Defined in: [lib/guild-api.ts:13](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L13)

##### name

> **name**: `string`

Defined in: [lib/guild-api.ts:10](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L10)

## Functions

### formatGuildRole()

> **formatGuildRole**(`role`): `string`

Defined in: [lib/guild-api.ts:138](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L138)

Format Guild role badge for display

#### Parameters

##### role

[`GuildRole`](#guildrole)

#### Returns

`string`

***

### getBaseGuildStats()

> **getBaseGuildStats**(`address`): `Promise`\<[`BaseGuildStats`](#baseguildstats)\>

Defined in: [lib/guild-api.ts:71](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L71)

Get Base Guild specific stats
Base Guild ID: You'll need to find the actual guild ID for Base

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`BaseGuildStats`](#baseguildstats)\>

***

### getGuildMemberships()

> **getGuildMemberships**(`address`): `Promise`\<[`GuildMembership`](#guildmembership)[]\>

Defined in: [lib/guild-api.ts:43](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/guild-api.ts#L43)

Fetch user's Guild memberships by wallet address

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`GuildMembership`](#guildmembership)[]\>
