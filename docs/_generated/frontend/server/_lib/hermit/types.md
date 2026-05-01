[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/hermit/types

# server/\_lib/hermit/types

## Type Aliases

### HermitCommandKind

> **HermitCommandKind** = `"gmeow"` \| `"hermit"` \| `"meme"`

Defined in: [server/\_lib/hermit/types.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L15)

***

### HermitExecutionParams

> **HermitExecutionParams** = `object`

Defined in: [server/\_lib/hermit/types.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L17)

#### Properties

##### commandText

> **commandText**: `string`

Defined in: [server/\_lib/hermit/types.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L18)

##### senderAddress

> **senderAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/hermit/types.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L19)

***

### HermitExecutionResult

> **HermitExecutionResult** = `object`

Defined in: [server/\_lib/hermit/types.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L22)

#### Properties

##### imagePrompt?

> `optional` **imagePrompt**: `string`

Defined in: [server/\_lib/hermit/types.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L26)

##### kind

> **kind**: [`HermitCommandKind`](#hermitcommandkind)

Defined in: [server/\_lib/hermit/types.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L23)

##### mediaAttachments?

> `optional` **mediaAttachments**: [`HermitMediaAttachment`](#hermitmediaattachment)[]

Defined in: [server/\_lib/hermit/types.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L27)

##### meme?

> `optional` **meme**: [`HermitMeme`](#hermitmeme)

Defined in: [server/\_lib/hermit/types.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L25)

##### provider

> **provider**: `"local"` \| `"pinata"`

Defined in: [server/\_lib/hermit/types.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L28)

##### reply

> **reply**: `string`

Defined in: [server/\_lib/hermit/types.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L24)

***

### HermitMediaAttachment

> **HermitMediaAttachment** = `object`

Defined in: [server/\_lib/hermit/types.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L8)

#### Properties

##### filename?

> `optional` **filename**: `string`

Defined in: [server/\_lib/hermit/types.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L11)

##### mime\_type?

> `optional` **mime\_type**: `string`

Defined in: [server/\_lib/hermit/types.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L12)

##### type

> **type**: `string`

Defined in: [server/\_lib/hermit/types.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L10)

##### url

> **url**: `string`

Defined in: [server/\_lib/hermit/types.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L9)

***

### HermitMeme

> **HermitMeme** = `object`

Defined in: [server/\_lib/hermit/types.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L1)

#### Properties

##### caption

> **caption**: `string`

Defined in: [server/\_lib/hermit/types.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L4)

##### id

> **id**: `string`

Defined in: [server/\_lib/hermit/types.ts:2](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L2)

##### tags

> **tags**: `string`[]

Defined in: [server/\_lib/hermit/types.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L5)

##### url

> **url**: `string`

Defined in: [server/\_lib/hermit/types.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/types.ts#L3)
