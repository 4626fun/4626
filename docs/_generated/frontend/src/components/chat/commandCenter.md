[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/chat/commandCenter

# src/components/chat/commandCenter

## Type Aliases

### ChatCommandCategory

> **ChatCommandCategory** = `object`

Defined in: [src/components/chat/commandCenter.ts:12](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L12)

#### Properties

##### id

> **id**: [`ChatCommandCategoryId`](#chatcommandcategoryid-1)

Defined in: [src/components/chat/commandCenter.ts:13](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L13)

##### label

> **label**: `string`

Defined in: [src/components/chat/commandCenter.ts:14](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L14)

***

### ChatCommandCategoryId

> **ChatCommandCategoryId** = `"vault"` \| `"market"` \| `"bankr"` \| `"cre"` \| `"wallet"` \| `"knowledge"` \| `"advanced"`

Defined in: [src/components/chat/commandCenter.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L3)

***

### ChatCommandDefinition

> **ChatCommandDefinition** = `object`

Defined in: [src/components/chat/commandCenter.ts:17](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L17)

#### Properties

##### category

> **category**: [`ChatCommandCategoryId`](#chatcommandcategoryid-1)

Defined in: [src/components/chat/commandCenter.ts:21](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L21)

##### command

> **command**: `string`

Defined in: [src/components/chat/commandCenter.ts:22](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L22)

##### description

> **description**: `string`

Defined in: [src/components/chat/commandCenter.ts:20](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L20)

##### followUpIds?

> `optional` **followUpIds**: readonly `string`[]

Defined in: [src/components/chat/commandCenter.ts:25](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L25)

##### id

> **id**: `string`

Defined in: [src/components/chat/commandCenter.ts:18](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L18)

##### label

> **label**: `string`

Defined in: [src/components/chat/commandCenter.ts:19](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L19)

##### mode

> **mode**: [`ChatCommandMode`](#chatcommandmode)

Defined in: [src/components/chat/commandCenter.ts:24](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L24)

##### risk

> **risk**: [`ChatCommandRisk`](#chatcommandrisk)

Defined in: [src/components/chat/commandCenter.ts:23](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L23)

***

### ChatCommandMode

> **ChatCommandMode** = `"send"` \| `"prefill"`

Defined in: [src/components/chat/commandCenter.ts:2](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L2)

***

### ChatCommandRisk

> **ChatCommandRisk** = `"read"` \| `"write"`

Defined in: [src/components/chat/commandCenter.ts:1](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L1)

## Variables

### CHAT\_COMMAND\_CATEGORIES

> `const` **CHAT\_COMMAND\_CATEGORIES**: readonly [`ChatCommandCategory`](#chatcommandcategory)[]

Defined in: [src/components/chat/commandCenter.ts:28](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L28)

## Functions

### getChatCommandByCommandText()

> **getChatCommandByCommandText**(`commandText`): [`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

Defined in: [src/components/chat/commandCenter.ts:289](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L289)

#### Parameters

##### commandText

`string`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

***

### getChatCommandById()

> **getChatCommandById**(`id`): [`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

Defined in: [src/components/chat/commandCenter.ts:281](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L281)

#### Parameters

##### id

`string`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition) \| `null`

***

### inferCommandIdFromAgentText()

> **inferCommandIdFromAgentText**(`text`): `string` \| `null`

Defined in: [src/components/chat/commandCenter.ts:320](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L320)

#### Parameters

##### text

`string`

#### Returns

`string` \| `null`

***

### listAllChatCommands()

> **listAllChatCommands**(): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:285](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L285)

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### listChatCommandsByCategory()

> **listChatCommandsByCategory**(`categoryId`): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:277](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L277)

#### Parameters

##### categoryId

[`ChatCommandCategoryId`](#chatcommandcategoryid-1)

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### listChatFollowUps()

> **listChatFollowUps**(`commandId`): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:336](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L336)

#### Parameters

##### commandId

`string` | `null`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### listQuickChatCommands()

> **listQuickChatCommands**(): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:271](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L271)

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]

***

### searchChatCommands()

> **searchChatCommands**(`query`, `limit`): [`ChatCommandDefinition`](#chatcommanddefinition)[]

Defined in: [src/components/chat/commandCenter.ts:295](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/commandCenter.ts#L295)

#### Parameters

##### query

`string`

##### limit

`number` = `8`

#### Returns

[`ChatCommandDefinition`](#chatcommanddefinition)[]
