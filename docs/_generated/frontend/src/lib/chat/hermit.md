[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/chat/hermit

# src/lib/chat/hermit

## Type Aliases

### HermitCommandKind

> **HermitCommandKind** = `"gmeow"` \| `"hermit"` \| `"meme"`

Defined in: [src/lib/chat/hermit.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L5)

***

### HermitMeme

> **HermitMeme** = `object`

Defined in: [src/lib/chat/hermit.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L8)

#### Properties

##### caption

> **caption**: `string`

Defined in: [src/lib/chat/hermit.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L11)

##### id

> **id**: `string`

Defined in: [src/lib/chat/hermit.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L9)

##### tags

> **tags**: `string`[]

Defined in: [src/lib/chat/hermit.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L12)

##### url

> **url**: `string`

Defined in: [src/lib/chat/hermit.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L10)

***

### HermitProvider

> **HermitProvider** = `"local"` \| `"pinata"`

Defined in: [src/lib/chat/hermit.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L6)

***

### HermitResult

> **HermitResult** = `object`

Defined in: [src/lib/chat/hermit.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L15)

#### Properties

##### imagePrompt?

> `optional` **imagePrompt**: `string`

Defined in: [src/lib/chat/hermit.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L20)

##### kind

> **kind**: [`HermitCommandKind`](#hermitcommandkind)

Defined in: [src/lib/chat/hermit.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L16)

##### meme?

> `optional` **meme**: [`HermitMeme`](#hermitmeme)

Defined in: [src/lib/chat/hermit.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L19)

##### provider

> **provider**: [`HermitProvider`](#hermitprovider)

Defined in: [src/lib/chat/hermit.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L17)

##### reply

> **reply**: `string`

Defined in: [src/lib/chat/hermit.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L18)

## Functions

### runHermitCommand()

> **runHermitCommand**(`command`): `Promise`\<[`HermitResult`](#hermitresult)\>

Defined in: [src/lib/chat/hermit.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/chat/hermit.ts#L66)

#### Parameters

##### command

`string`

#### Returns

`Promise`\<[`HermitResult`](#hermitresult)\>
