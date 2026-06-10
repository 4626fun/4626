[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/hermit/memeStore

# server/\_lib/hermit/memeStore

## Functions

### listHermitMemes()

> **listHermitMemes**(): [`HermitMeme`](types.md#hermitmeme)[]

Defined in: [server/\_lib/hermit/memeStore.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/memeStore.ts#L123)

#### Returns

[`HermitMeme`](types.md#hermitmeme)[]

***

### pickGmeowLocalLine()

> **pickGmeowLocalLine**(`meme`): `string`

Defined in: [server/\_lib/hermit/memeStore.ts:150](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/memeStore.ts#L150)

Local creative line when Pinata is unavailable — not the same stock caption every drop.

#### Parameters

##### meme

[`HermitMeme`](types.md#hermitmeme)

#### Returns

`string`

***

### pickRandomHermitMeme()

> **pickRandomHermitMeme**(`tag?`): [`HermitMeme`](types.md#hermitmeme)

Defined in: [server/\_lib/hermit/memeStore.ts:136](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/memeStore.ts#L136)

#### Parameters

##### tag?

`string`

#### Returns

[`HermitMeme`](types.md#hermitmeme)

***

### resetHermitMemeRecentForTests()

> **resetHermitMemeRecentForTests**(): `void`

Defined in: [server/\_lib/hermit/memeStore.ts:132](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/memeStore.ts#L132)

Test-only: reset rotation memory between cases.

#### Returns

`void`
