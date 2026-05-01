[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/commands/registry

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

Defined in: [server/commands/registry.ts:277](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L277)

***

### TELEGRAM\_COMMAND\_HEADS\_PATTERN

> `const` **TELEGRAM\_COMMAND\_HEADS\_PATTERN**: `string`

Defined in: [server/commands/registry.ts:278](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L278)

***

### TELEGRAM\_NATIVE\_COMMAND\_HEADS

> `const` **TELEGRAM\_NATIVE\_COMMAND\_HEADS**: `string`[] = `telegramNativeHeads`

Defined in: [server/commands/registry.ts:276](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L276)

## Functions

### buildTelegramBotCommands()

> **buildTelegramBotCommands**(`scope`): [`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

Defined in: [server/commands/registry.ts:267](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L267)

#### Parameters

##### scope

[`CommandScope`](#commandscope)

#### Returns

[`TelegramBotMenuCommand`](#telegrambotmenucommand)[]

***

### getCommandFamily()

> **getCommandFamily**(`rawText`): [`CommandFamily`](#commandfamily) \| `null`

Defined in: [server/commands/registry.ts:230](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L230)

#### Parameters

##### rawText

`string`

#### Returns

[`CommandFamily`](#commandfamily) \| `null`

***

### getCommandHead()

> **getCommandHead**(`rawText`): `string`

Defined in: [server/commands/registry.ts:221](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L221)

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### isKnownTelegramCommandHead()

> **isKnownTelegramCommandHead**(`head`): `boolean`

Defined in: [server/commands/registry.ts:263](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L263)

#### Parameters

##### head

`string`

#### Returns

`boolean`

***

### matchesAnyCommandFamily()

> **matchesAnyCommandFamily**(`rawText`, `families`): `boolean`

Defined in: [server/commands/registry.ts:238](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L238)

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

Defined in: [server/commands/registry.ts:234](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L234)

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

Defined in: [server/commands/registry.ts:259](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L259)

#### Parameters

##### family

[`CommandFamily`](#commandfamily) | `null`

#### Returns

`boolean`

***

### resolveCommandDefinition()

> **resolveCommandDefinition**(`rawText`): `ResolvedCommandDefinition` \| `null`

Defined in: [server/commands/registry.ts:225](https://github.com/wenakita/4626/blob/main/frontend/server/commands/registry.ts#L225)

#### Parameters

##### rawText

`string`

#### Returns

`ResolvedCommandDefinition` \| `null`
