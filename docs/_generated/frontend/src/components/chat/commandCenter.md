[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/chat/commandCenter

# src/components/chat/commandCenter

## Type Aliases

### ChatCommandCategory

> **ChatCommandCategory** = `object`

Defined in: [src/components/chat/commandCenter.ts:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L10)

#### Properties

##### id

> **id**: [`ChatCommandCategoryId`](#chatcommandcategoryid-1)

Defined in: [src/components/chat/commandCenter.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L11)

##### label

> **label**: `string`

Defined in: [src/components/chat/commandCenter.ts:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L12)

***

### ChatCommandCategoryId

> **ChatCommandCategoryId** = `"vault"` \| `"cre"` \| `"wallet"` \| `"knowledge"` \| `"advanced"`

Defined in: [src/components/chat/commandCenter.ts:3](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L3)

***

### ChatCommandDefinition

> **ChatCommandDefinition** = `object`

Defined in: [src/components/chat/commandCenter.ts:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L15)

#### Properties

##### aliases?

> `optional` **aliases**: readonly `string`[]

Defined in: [src/components/chat/commandCenter.ts:21](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L21)

##### category

> **category**: [`ChatCommandCategoryId`](#chatcommandcategoryid-1)

Defined in: [src/components/chat/commandCenter.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L19)

##### command

> **command**: `string`

Defined in: [src/components/chat/commandCenter.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L20)

##### description

> **description**: `string`

Defined in: [src/components/chat/commandCenter.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L18)

##### followUpIds?

> `optional` **followUpIds**: readonly `string`[]

Defined in: [src/components/chat/commandCenter.ts:24](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L24)

##### id

> **id**: `string`

Defined in: [src/components/chat/commandCenter.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L16)

##### label

> **label**: `string`

Defined in: [src/components/chat/commandCenter.ts:17](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L17)

##### mode

> **mode**: [`ChatCommandMode`](#chatcommandmode)

Defined in: [src/components/chat/commandCenter.ts:23](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L23)

##### risk

> **risk**: [`ChatCommandRisk`](#chatcommandrisk)

Defined in: [src/components/chat/commandCenter.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L22)

***

### ChatCommandMode

> **ChatCommandMode** = `"send"` \| `"prefill"`

Defined in: [src/components/chat/commandCenter.ts:2](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L2)

***

### ChatCommandRisk

> **ChatCommandRisk** = `"read"` \| `"write"`

Defined in: [src/components/chat/commandCenter.ts:1](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L1)

## Variables

### CHAT\_COMMAND\_CATEGORIES

> `const` **CHAT\_COMMAND\_CATEGORIES**: readonly [`ChatCommandCategory`](#chatcommandcategory)[]

Defined in: [src/components/chat/commandCenter.ts:27](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L27)

## Functions

### getChatCommandByCommandText()

> **getChatCommandByCommandText**(`commandText`): [`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

Defined in: [src/components/chat/commandCenter.ts:232](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L232)

#### Parameters

##### commandText

`string`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

***

### getChatCommandById()

> **getChatCommandById**(`id`): [`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

Defined in: [src/components/chat/commandCenter.ts:224](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L224)

#### Parameters

##### id

`string`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

***

### inferCommandIdFromAgentText()

> **inferCommandIdFromAgentText**(`text`): `string` \| `null`

Defined in: [src/components/chat/commandCenter.ts:268](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L268)

#### Parameters

##### text

`string`

#### Returns

`string` \| `null`

***

### listAllChatCommands()

> **listAllChatCommands**(): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:228](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L228)

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### listChatCommandsByCategory()

> **listChatCommandsByCategory**(`categoryId`): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:220](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L220)

#### Parameters

##### categoryId

[`ChatCommandCategoryId`](#chatcommandcategoryid-1)

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### listChatFollowUps()

> **listChatFollowUps**(`commandId`): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:281](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L281)

#### Parameters

##### commandId

`string` | `null`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### listQuickChatCommands()

> **listQuickChatCommands**(): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:214](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L214)

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### searchChatCommands()

> **searchChatCommands**(`query`, `limit`): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:238](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/chat/commandCenter.ts#L238)

#### Parameters

##### query

`string`

##### limit

`number` = `8`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]
