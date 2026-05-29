[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/satoriRenderer

# server/\_lib/alfaclub/satoriRenderer

## Type Aliases

### SatoriFont

> **SatoriFont** = `object`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L34)

#### Properties

##### data

> **data**: `ArrayBuffer`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L36)

##### name

> **name**: `"Inter"` \| `"JetBrains Mono"`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L35)

##### style

> **style**: `"normal"`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L38)

##### weight

> **weight**: `number`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L37)

***

### SatoriNode

> **SatoriNode** = `object`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L85)

#### Properties

##### props

> **props**: `object`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L89)

###### Index Signature

\[`attr`: `string`\]: `unknown`

###### children?

> `optional` **children**: `SatoriNodeChild`

###### style?

> `optional` **style**: `StyleObject`

##### type

> **type**: `string`

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:86](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L86)

## Functions

### h()

> **h**(`type`, `style`, ...`children`): [`SatoriNode`](#satorinode)

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L105)

#### Parameters

##### type

`string`

##### style

`StyleObject` = `{}`

##### children

...(`string` \| `number` \| `false` \| [`SatoriNode`](#satorinode) \| `null` \| `undefined`)[]

#### Returns

[`SatoriNode`](#satorinode)

***

### renderSatoriPng()

> **renderSatoriPng**(`tree`, `opts`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [server/\_lib/alfaclub/satoriRenderer.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/satoriRenderer.ts#L124)

#### Parameters

##### tree

[`SatoriNode`](#satorinode)

##### opts

###### height

`number`

###### pixelRatio?

`number`

###### width

`number`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
