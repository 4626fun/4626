[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/zora-api

# src/lib/zora-api

## Interfaces

### ZoraCreator

Defined in: [lib/zora-api.ts:8](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L8)

#### Properties

##### address

> **address**: `string`

Defined in: [lib/zora-api.ts:9](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L9)

##### avatar?

> `optional` **avatar**: `string`

Defined in: [lib/zora-api.ts:12](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L12)

##### description?

> `optional` **description**: `string`

Defined in: [lib/zora-api.ts:11](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L11)

##### instagram?

> `optional` **instagram**: `string`

Defined in: [lib/zora-api.ts:15](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L15)

##### name?

> `optional` **name**: `string`

Defined in: [lib/zora-api.ts:10](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L10)

##### twitter?

> `optional` **twitter**: `string`

Defined in: [lib/zora-api.ts:14](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L14)

##### website?

> `optional` **website**: `string`

Defined in: [lib/zora-api.ts:13](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L13)

## Functions

### getZoraCreatorProfile()

> **getZoraCreatorProfile**(`address`): `Promise`\<[`ZoraCreator`](#zoracreator) \| `null`\>

Defined in: [lib/zora-api.ts:23](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L23)

Fetch creator profile from Zora
Note: This uses Zora's GraphQL API - you may need to adjust based on their current schema

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`ZoraCreator`](#zoracreator) \| `null`\>

***

### mergeCreatorData()

> **mergeCreatorData**(`props`, `talent`, `zora`): `object`

Defined in: [lib/zora-api.ts:75](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora-api.ts#L75)

Merge creator data from multiple sources (Zora, Talent, props)
Priority: Props > Talent > Zora

#### Parameters

##### props

`any`

##### talent

`any`

##### zora

[`ZoraCreator`](#zoracreator) | `null`

#### Returns

`object`

##### bio

> **bio**: `any`

##### image

> **image**: `any`

##### name

> **name**: `any`

##### socials

> **socials**: `object`

###### socials.discord

> **discord**: `any`

###### socials.instagram

> **instagram**: `any`

###### socials.telegram

> **telegram**: `any`

###### socials.twitter

> **twitter**: `any`

###### socials.website

> **website**: `any`
