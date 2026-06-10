[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/hermitCommandCooldown

# server/\_lib/alfaclub/hermitCommandCooldown

## Type Aliases

### HermitCooldownCommand

> **HermitCooldownCommand** = `"gmeow"` \| `"meme"`

Defined in: [server/\_lib/alfaclub/hermitCommandCooldown.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitCommandCooldown.ts#L6)

## Functions

### checkHermitCommandCooldown()

> **checkHermitCommandCooldown**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `retryAfterSec`: `number`; \}\>

Defined in: [server/\_lib/alfaclub/hermitCommandCooldown.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitCommandCooldown.ts#L38)

#### Parameters

##### params

###### command

[`HermitCooldownCommand`](#hermitcooldowncommand)

###### roomId

`string`

###### senderAddress

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `retryAfterSec`: `number`; \}\>

***

### isHermitCommandCooldownEnabled()

> **isHermitCommandCooldownEnabled**(): `boolean`

Defined in: [server/\_lib/alfaclub/hermitCommandCooldown.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitCommandCooldown.ts#L26)

#### Returns

`boolean`

***

### readHermitCommandCooldownMs()

> **readHermitCommandCooldownMs**(`command`): `number`

Defined in: [server/\_lib/alfaclub/hermitCommandCooldown.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitCommandCooldown.ts#L19)

#### Parameters

##### command

[`HermitCooldownCommand`](#hermitcooldowncommand)

#### Returns

`number`

***

### recordHermitCommandCooldown()

> **recordHermitCommandCooldown**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/alfaclub/hermitCommandCooldown.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitCommandCooldown.ts#L75)

#### Parameters

##### params

###### command

[`HermitCooldownCommand`](#hermitcooldowncommand)

###### roomId

`string`

###### senderAddress

`string`

#### Returns

`Promise`\<`void`\>

***

### resolveHermitCooldownCommand()

> **resolveHermitCooldownCommand**(`text`): [`HermitCooldownCommand`](#hermitcooldowncommand) \| `null`

Defined in: [server/\_lib/alfaclub/hermitCommandCooldown.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/hermitCommandCooldown.ts#L31)

#### Parameters

##### text

`string`

#### Returns

[`HermitCooldownCommand`](#hermitcooldowncommand) \| `null`
