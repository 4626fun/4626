[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/messaging/chatCommandFallback

# server/\_lib/messaging/chatCommandFallback

## Type Aliases

### NumberedCommandOption

> **NumberedCommandOption** = `object`

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L1)

#### Properties

##### command

> **command**: `string`

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L3)

##### description

> **description**: `string`

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L4)

##### index

> **index**: `number`

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:2](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L2)

***

### WelcomeMenuResolution

> **WelcomeMenuResolution** = \{ `kind`: `"passthrough"`; \} \| \{ `kind`: `"command"`; `resolvedText`: `string`; \} \| \{ `kind`: `"ai_prompt"`; \} \| \{ `kind`: `"invalid"`; `selection`: `string`; \}

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L46)

## Functions

### formatAiPromptGuidance()

> **formatAiPromptGuidance**(): `string`

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L40)

#### Returns

`string`

***

### formatNumberedCommandFallback()

> **formatNumberedCommandFallback**(`params?`): `string`

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L19)

#### Parameters

##### params?

###### includeHint?

`string` \| `null`

###### intro?

`string`

#### Returns

`string`

***

### formatWelcomeNumberedOptions()

> **formatWelcomeNumberedOptions**(): `string`

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L30)

#### Returns

`string`

***

### resolveInboundMenuText()

> **resolveInboundMenuText**(`input`): [`WelcomeMenuResolution`](#welcomemenuresolution)

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L63)

#### Parameters

##### input

`string`

#### Returns

[`WelcomeMenuResolution`](#welcomemenuresolution)

***

### resolveWelcomeMenuSelection()

> **resolveWelcomeMenuSelection**(`index`): [`WelcomeMenuResolution`](#welcomemenuresolution)

Defined in: [server/\_lib/messaging/chatCommandFallback.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/chatCommandFallback.ts#L52)

#### Parameters

##### index

`number`

#### Returns

[`WelcomeMenuResolution`](#welcomemenuresolution)
