[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/socialIdentity

# src/lib/xmtp/socialIdentity

## Type Aliases

### DmRecipientResolution

> **DmRecipientResolution** = `object`

Defined in: [src/lib/xmtp/socialIdentity.ts:50](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/socialIdentity.ts#L50)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [src/lib/xmtp/socialIdentity.ts:51](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/socialIdentity.ts#L51)

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:53](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/socialIdentity.ts#L53)

##### basenameHint

> **basenameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:52](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/socialIdentity.ts#L52)

## Functions

### getBasenameAutocompleteCandidate()

> **getBasenameAutocompleteCandidate**(`input`): `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:56](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/socialIdentity.ts#L56)

#### Parameters

##### input

`string`

#### Returns

`string` \| `null`

***

### getBasenameName()

> **getBasenameName**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/xmtp/socialIdentity.ts:42](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/socialIdentity.ts#L42)

Chat identity helpers.

NOTE: Basenames reverse resolution can't be done reliably using `viem` on Base L2 in browsers
because the chain config may not include ENS universal resolver info (and some RPCs can fail
under CORS). This wrapper keeps the logic in one place.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolveDmRecipient()

> **resolveDmRecipient**(`input`): `Promise`\<[`DmRecipientResolution`](#dmrecipientresolution) \| `null`\>

Defined in: [src/lib/xmtp/socialIdentity.ts:134](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/xmtp/socialIdentity.ts#L134)

Resolve a "new DM" recipient input into an EVM address.
Supports raw addresses and basename handles (e.g. "akita", "@akita", "akita.base.eth").

#### Parameters

##### input

`string`

#### Returns

`Promise`\<[`DmRecipientResolution`](#dmrecipientresolution) \| `null`\>
