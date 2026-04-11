[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/imageStorage

# server/\_lib/imageStorage

## Functions

### downloadImageStorageObject()

> **downloadImageStorageObject**(`pathname`): `Promise`\<\{ `bytes`: `Uint8Array`; `contentType`: `string` \| `null`; \}\>

Defined in: [server/\_lib/imageStorage.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/imageStorage.ts#L37)

#### Parameters

##### pathname

`string`

#### Returns

`Promise`\<\{ `bytes`: `Uint8Array`; `contentType`: `string` \| `null`; \}\>

***

### getImageStorageBucket()

> **getImageStorageBucket**(): `string`

Defined in: [server/\_lib/imageStorage.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/imageStorage.ts#L7)

#### Returns

`string`

***

### uploadImageStorageObject()

> **uploadImageStorageObject**(`params`): `Promise`\<\{ `url`: `string`; \}\>

Defined in: [server/\_lib/imageStorage.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/imageStorage.ts#L13)

#### Parameters

##### params

###### bytes

`Uint8Array`

###### cacheControlMaxAgeSeconds?

`number`

###### contentType

`string`

###### pathname

`string`

#### Returns

`Promise`\<\{ `url`: `string`; \}\>
