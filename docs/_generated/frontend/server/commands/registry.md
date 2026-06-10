[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/commands/registry

# server/commands/registry

## Type Aliases

### CommandFamily

> **CommandFamily** = `"start"` \| `"help"` \| `"keepr"` \| `"id"` \| `"whois"` \| `"link"` \| `"status"` \| `"unlink"` \| `"zora"` \| `"deploy"` \| `"vaultdeploy"` \| `"join"` \| `"rooms"` \| `"eligibility"` \| `"wallet"` \| `"alfaclub"` \| `"vaults"` \| `"auctions"` \| `"mybids"` \| `"buy"` \| `"sell"` \| `"bid"` \| `"twitter"` \| `"ai"` \| `"coin"` \| `"send"` \| `"hermit"`

Defined in: [server/commands/registry.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L8)

***

### CommandScope

> **CommandScope** = `"private"` \| `"group"` \| `"admin"`

Defined in: [server/commands/registry.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L1)

***

### TelegramBotMenuCommand

> **TelegramBotMenuCommand** = `object`

Defined in: [server/commands/registry.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L3)

#### Properties

##### command

> **command**: `string`

Defined in: [server/commands/registry.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L4)

##### description

> **description**: `string`

Defined in: [server/commands/registry.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L5)

## Variables

### TELEGRAM\_COMMAND\_HEADS

> `const` **TELEGRAM\_COMMAND\_HEADS**: `string`[] = `telegramCommandHeads`

Defined in: [server/commands/registry.ts:282](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L282)

***

### TELEGRAM\_COMMAND\_HEADS\_PATTERN

> `const` **TELEGRAM\_COMMAND\_HEADS\_PATTERN**: `string`

Defined in: [server/commands/registry.ts:283](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L283)

***

### TELEGRAM\_NATIVE\_COMMAND\_HEADS

> `const` **TELEGRAM\_NATIVE\_COMMAND\_HEADS**: `string`[] = `telegramNativeHeads`

Defined in: [server/commands/registry.ts:281](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L281)

## Functions

### buildTelegramBotCommands()

> **buildTelegramBotCommands**(`scope`): [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [server/commands/registry.ts:272](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L272)

#### Parameters

##### scope

[`CommandScope`](#commandscope)

#### Returns

[`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

***

### getCommandFamily()

> **getCommandFamily**(`rawText`): [`CommandFamily`](#commandfamily) \| `null`

Defined in: [server/commands/registry.ts:235](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L235)

#### Parameters

##### rawText

`string`

#### Returns

[`CommandFamily`](#commandfamily) \| `null`

***

### getCommandHead()

> **getCommandHead**(`rawText`): `string`

Defined in: [server/commands/registry.ts:226](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L226)

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### isKnownTelegramCommandHead()

> **isKnownTelegramCommandHead**(`head`): `boolean`

Defined in: [server/commands/registry.ts:268](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L268)

#### Parameters

##### head

`string`

#### Returns

`boolean`

***

### matchesAnyCommandFamily()

> **matchesAnyCommandFamily**(`rawText`, `families`): `boolean`

Defined in: [server/commands/registry.ts:243](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L243)

#### Parameters

##### rawText

`string`

##### families

readonly [`CommandFamily`](#commandfamily)[]

#### Returns

`boolean`

***

### matchesCommandFamily()

> **matchesCommandFamily**(`rawText`, `family`): `boolean`

Defined in: [server/commands/registry.ts:239](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L239)

#### Parameters

##### rawText

`string`

##### family

[`CommandFamily`](#commandfamily)

#### Returns

`boolean`

***

### requiresGroupAdminForFamily()

> **requiresGroupAdminForFamily**(`family`): `boolean`

Defined in: [server/commands/registry.ts:264](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L264)

#### Parameters

##### family

[`CommandFamily`](#commandfamily) | `null`

#### Returns

`boolean`

***

### resolveCommandDefinition()

> **resolveCommandDefinition**(`rawText`): `ResolvedCommandDefinition` \| `null`

Defined in: [server/commands/registry.ts:230](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L230)

#### Parameters

##### rawText

`string`

#### Returns

`ResolvedCommandDefinition` \| `null`
