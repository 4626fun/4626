[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/socialIdentity

# src/lib/xmtp/socialIdentity

## Type Aliases

### DmRecipientResolution

> **DmRecipientResolution** = `object`

Defined in: [src/lib/xmtp/socialIdentity.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L50)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [src/lib/xmtp/socialIdentity.ts:52](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L52)

Final recipient used for DM creation (after canonical wallet mapping).

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:58](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L58)

##### basenameHint

> **basenameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L57)

##### inputAddress

> **inputAddress**: `` `0x${string}` ``

Defined in: [src/lib/xmtp/socialIdentity.ts:54](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L54)

Direct address resolved from the user input before canonical mapping.

##### wasCanonicalRemap

> **wasCanonicalRemap**: `boolean`

Defined in: [src/lib/xmtp/socialIdentity.ts:56](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L56)

True when recipient address was remapped to a canonical smart wallet.

## Functions

### getBasenameAutocompleteCandidate()

> **getBasenameAutocompleteCandidate**(`input`): `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:61](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L61)

#### Parameters

##### input

`string`

#### Returns

`string` \| `null`

***

### getBasenameName()

> **getBasenameName**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/xmtp/socialIdentity.ts:42](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L42)

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

Defined in: [src/lib/xmtp/socialIdentity.ts:139](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/xmtp/socialIdentity.ts#L139)

Resolve a "new DM" recipient input into an EVM address.
Supports raw addresses and basename handles (e.g. "akita", "@akita", "akita.base.eth").

#### Parameters

##### input

`string`

#### Returns

`Promise`\<[`DmRecipientResolution`](#dmrecipientresolution) \| `null`\>
