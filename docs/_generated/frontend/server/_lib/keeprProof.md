[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/keeprProof

# server/\_lib/keeprProof

## Type Aliases

### KeeprJoinMessageFields

> **KeeprJoinMessageFields** = `object`

Defined in: [server/\_lib/keeprProof.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L124)

#### Properties

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/keeprProof.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L129)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/\_lib/keeprProof.ts:128](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L128)

##### nonce

> **nonce**: `string`

Defined in: [server/\_lib/keeprProof.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L127)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/keeprProof.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L126)

##### wallet

> **wallet**: `` `0x${string}` ``

Defined in: [server/\_lib/keeprProof.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L125)

## Functions

### buildKeeprJoinMessage()

> **buildKeeprJoinMessage**(`fields`): `string`

Defined in: [server/\_lib/keeprProof.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L132)

#### Parameters

##### fields

[`KeeprJoinMessageFields`](#keeprjoinmessagefields)

#### Returns

`string`

***

### issueKeeprJoinNonce()

> **issueKeeprJoinNonce**(`params`): `Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `string`; \}\>

Defined in: [server/\_lib/keeprProof.ts:172](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L172)

#### Parameters

##### params

###### vaultAddress

`` `0x${string}` ``

###### wallet

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `expiresAt`: `string`; `issuedAt`: `string`; `nonce`: `string`; \}\>

***

### parseKeeprJoinMessage()

> **parseKeeprJoinMessage**(`message`): [`KeeprJoinMessageFields`](#keeprjoinmessagefields) \| `null`

Defined in: [server/\_lib/keeprProof.ts:144](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L144)

#### Parameters

##### message

`string`

#### Returns

[`KeeprJoinMessageFields`](#keeprjoinmessagefields) \| `null`

***

### verifyKeeprJoinProof()

> **verifyKeeprJoinProof**(`params`): `Promise`\<\{ `messageHash`: `string`; `wallet`: `` `0x${string}` ``; \}\>

Defined in: [server/\_lib/keeprProof.ts:253](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/keeprProof.ts#L253)

#### Parameters

##### params

###### expectedVaultAddress

`` `0x${string}` ``

###### message

`string`

###### req

`VercelRequest`

###### signature

`string`

#### Returns

`Promise`\<\{ `messageHash`: `string`; `wallet`: `` `0x${string}` ``; \}\>
