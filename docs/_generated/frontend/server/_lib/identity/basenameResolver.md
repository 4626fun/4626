[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/basenameResolver

# server/\_lib/identity/basenameResolver

## Functions

### basenameToHandle()

> **basenameToHandle**(`name`): `string` \| `null`

Defined in: [server/\_lib/identity/basenameResolver.ts:51](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/identity/basenameResolver.ts#L51)

#### Parameters

##### name

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### getBasenameName()

> **getBasenameName**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/identity/basenameResolver.ts:66](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/identity/basenameResolver.ts#L66)

Resolve a wallet address to its full Basename (e.g. "akita.base.eth")
by calling the L2 Resolver on Base.

Returns null when no Basename is configured or on lookup failure.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolveBasenameHandle()

> **resolveBasenameHandle**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/identity/basenameResolver.ts:94](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/identity/basenameResolver.ts#L94)

Resolve a "Basename handle" (e.g. "akita" from "akita.base.eth")
for a wallet address via the Base L2 Resolver.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>
