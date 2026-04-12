[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/basenameResolver

# server/\_lib/basenameResolver

## Functions

### basenameToHandle()

> **basenameToHandle**(`name`): `string` \| `null`

Defined in: [server/\_lib/basenameResolver.ts:120](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/basenameResolver.ts#L120)

#### Parameters

##### name

`string` | `null` | `undefined`

#### Returns

`string` \| `null`

***

### getBasenameName()

> **getBasenameName**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/basenameResolver.ts:76](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/basenameResolver.ts#L76)

Resolve a wallet address to its Basename (e.g. "akita.base.eth") using
ENSIP-19 reverse resolution on Ethereum mainnet.

Returns null when no Basename is configured or on lookup failure.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolveBasenameHandle()

> **resolveBasenameHandle**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/basenameResolver.ts:155](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/basenameResolver.ts#L155)

Resolve a "Basename handle" (e.g. "akita" from "akita.base.eth") for a wallet address.

Best-effort:
- try Base L2 ENS reverse resolution
- fall back to ENSIP-19 reverse resolution on mainnet
- fall back to plain mainnet ENS reverse resolution when it returns a `.base.eth` name

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>
