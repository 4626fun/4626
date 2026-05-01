[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/hermit/repository

# server/\_lib/hermit/repository

## Type Aliases

### HermitMemeRecord

> **HermitMemeRecord** = `object`

Defined in: [server/\_lib/hermit/repository.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L5)

#### Properties

##### caption

> **caption**: `string`

Defined in: [server/\_lib/hermit/repository.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L11)

##### cid

> **cid**: `string` \| `null`

Defined in: [server/\_lib/hermit/repository.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L9)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/hermit/repository.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L14)

##### createdBy

> **createdBy**: `string`

Defined in: [server/\_lib/hermit/repository.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L13)

##### id

> **id**: `number`

Defined in: [server/\_lib/hermit/repository.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L6)

##### ownerAddress

> **ownerAddress**: `string`

Defined in: [server/\_lib/hermit/repository.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L7)

##### roomId

> **roomId**: `string`

Defined in: [server/\_lib/hermit/repository.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L8)

##### tags

> **tags**: `string`[]

Defined in: [server/\_lib/hermit/repository.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L12)

##### url

> **url**: `string`

Defined in: [server/\_lib/hermit/repository.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L10)

## Functions

### createHermitMeme()

> **createHermitMeme**(`params`): `Promise`\<[`HermitMemeRecord`](#hermitmemerecord) \| `null`\>

Defined in: [server/\_lib/hermit/repository.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L84)

#### Parameters

##### params

###### caption

`string`

###### cid

`string` \| `null`

###### createdBy

`string`

###### ownerAddress

`string`

###### roomId

`string`

###### tags

`string`[]

###### url

`string`

#### Returns

`Promise`\<[`HermitMemeRecord`](#hermitmemerecord) \| `null`\>

***

### ensureHermitSchema()

> **ensureHermitSchema**(): `Promise`\<`boolean`\>

Defined in: [server/\_lib/hermit/repository.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L50)

#### Returns

`Promise`\<`boolean`\>

***

### listHermitMemes()

> **listHermitMemes**(`params`): `Promise`\<[`HermitMemeRecord`](#hermitmemerecord)[]\>

Defined in: [server/\_lib/hermit/repository.ts:129](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L129)

#### Parameters

##### params

###### limit

`number`

###### roomId

`string`

###### tag?

`string`

#### Returns

`Promise`\<[`HermitMemeRecord`](#hermitmemerecord)[]\>

***

### softDeleteHermitMeme()

> **softDeleteHermitMeme**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/hermit/repository.ts:180](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/repository.ts#L180)

#### Parameters

##### params

###### id

`number`

###### ownerAddress

`string`

###### roomId

`string`

#### Returns

`Promise`\<`boolean`\>
