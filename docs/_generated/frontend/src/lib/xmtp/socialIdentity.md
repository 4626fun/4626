[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/socialIdentity

# src/lib/xmtp/socialIdentity

## Type Aliases

### DmRecipientResolution

> **DmRecipientResolution** = `object`

Defined in: [src/lib/xmtp/socialIdentity.ts:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L84)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [src/lib/xmtp/socialIdentity.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L86)

Final recipient used for DM creation (after canonical wallet mapping).

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L92)

##### basenameHint

> **basenameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L91)

##### inputAddress

> **inputAddress**: `` `0x${string}` ``

Defined in: [src/lib/xmtp/socialIdentity.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L88)

Direct address resolved from the user input before canonical mapping.

##### wasCanonicalRemap

> **wasCanonicalRemap**: `boolean`

Defined in: [src/lib/xmtp/socialIdentity.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L90)

True when recipient address was remapped to a canonical smart wallet.

***

### PeerChatPresentation

> **PeerChatPresentation** = `object`

Defined in: [src/lib/xmtp/socialIdentity.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L50)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/socialIdentity.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L52)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/socialIdentity.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L51)

## Functions

### getBasenameAutocompleteCandidate()

> **getBasenameAutocompleteCandidate**(`input`): `string` \| `null`

Defined in: [src/lib/xmtp/socialIdentity.ts:95](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L95)

#### Parameters

##### input

`string`

#### Returns

`string` \| `null`

***

### getBasenameName()

> **getBasenameName**(`address`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/xmtp/socialIdentity.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L42)

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

Defined in: [src/lib/xmtp/socialIdentity.ts:173](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L173)

Resolve a "new DM" recipient input into an EVM address.
Supports raw addresses and basename handles (e.g. "akita", "@akita", "akita.base.eth").

#### Parameters

##### input

`string`

#### Returns

`Promise`\<[`DmRecipientResolution`](#dmrecipientresolution) \| `null`\>

***

### resolvePeerChatPresentation()

> **resolvePeerChatPresentation**(`address`, `truncateFallback`): `Promise`\<[`PeerChatPresentation`](#peerchatpresentation)\>

Defined in: [src/lib/xmtp/socialIdentity.ts:59](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/socialIdentity.ts#L59)

Resolve DM peer label + avatar for chat list/header at XMTP connect time.
Uses Basename profile (display name + ENS avatar) with a bounded timeout.

#### Parameters

##### address

`string`

##### truncateFallback

(`address`) => `string`

#### Returns

`Promise`\<[`PeerChatPresentation`](#peerchatpresentation)\>
