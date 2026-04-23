[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/commands/registry

# server/commands/registry

## Type Aliases

### CommandFamily

> **CommandFamily** = `"start"` \| `"help"` \| `"keepr"` \| `"id"` \| `"whois"` \| `"link"` \| `"linked"` \| `"unlink"` \| `"zora"` \| `"deploy"` \| `"vaultdeploy"` \| `"join"` \| `"rooms"` \| `"eligibility"` \| `"wallet"` \| `"alfaclub"` \| `"vaults"` \| `"auctions"` \| `"mybids"` \| `"buy"` \| `"sell"` \| `"bid"` \| `"twitter"` \| `"ai"` \| `"coin"` \| `"send"`

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

Defined in: [server/commands/registry.ts:275](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L275)

***

### TELEGRAM\_COMMAND\_HEADS\_PATTERN

> `const` **TELEGRAM\_COMMAND\_HEADS\_PATTERN**: `string`

Defined in: [server/commands/registry.ts:276](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L276)

***

### TELEGRAM\_NATIVE\_COMMAND\_HEADS

> `const` **TELEGRAM\_NATIVE\_COMMAND\_HEADS**: `string`[] = `telegramNativeHeads`

Defined in: [server/commands/registry.ts:274](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L274)

## Functions

### buildTelegramBotCommands()

> **buildTelegramBotCommands**(`scope`): [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [server/commands/registry.ts:265](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L265)

#### Parameters

##### scope

[`CommandScope`](#commandscope)

#### Returns

[`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

***

### getCommandFamily()

> **getCommandFamily**(`rawText`): [`CommandFamily`](#commandfamily) \| `null`

Defined in: [server/commands/registry.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L228)

#### Parameters

##### rawText

`string`

#### Returns

[`CommandFamily`](#commandfamily) \| `null`

***

### getCommandHead()

> **getCommandHead**(`rawText`): `string`

Defined in: [server/commands/registry.ts:219](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L219)

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### isKnownTelegramCommandHead()

> **isKnownTelegramCommandHead**(`head`): `boolean`

Defined in: [server/commands/registry.ts:261](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L261)

#### Parameters

##### head

`string`

#### Returns

`boolean`

***

### matchesAnyCommandFamily()

> **matchesAnyCommandFamily**(`rawText`, `families`): `boolean`

Defined in: [server/commands/registry.ts:236](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L236)

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

Defined in: [server/commands/registry.ts:232](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L232)

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

Defined in: [server/commands/registry.ts:257](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L257)

#### Parameters

##### family

[`CommandFamily`](#commandfamily) | `null`

#### Returns

`boolean`

***

### resolveCommandDefinition()

> **resolveCommandDefinition**(`rawText`): `ResolvedCommandDefinition` \| `null`

Defined in: [server/commands/registry.ts:223](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L223)

#### Parameters

##### rawText

`string`

#### Returns

`ResolvedCommandDefinition` \| `null`
