[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/image/\_shared

# api/\_handlers/image/\_shared

## Type Aliases

### ApiFailure

> **ApiFailure** = `object`

Defined in: [api/\_handlers/image/\_shared.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L11)

#### Properties

##### error

> **error**: `string`

Defined in: [api/\_handlers/image/\_shared.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L11)

##### success

> **success**: `false`

Defined in: [api/\_handlers/image/\_shared.ts:11](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L11)

***

### ApiSuccess

> **ApiSuccess**\<`T`\> = `object`

Defined in: [api/\_handlers/image/\_shared.ts:10](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L10)

#### Type Parameters

##### T

`T`

#### Properties

##### data

> **data**: `T`

Defined in: [api/\_handlers/image/\_shared.ts:10](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L10)

##### success

> **success**: `true`

Defined in: [api/\_handlers/image/\_shared.ts:10](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L10)

***

### ImageMutationBody

> **ImageMutationBody** = `object`

Defined in: [api/\_handlers/image/\_shared.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L6)

#### Properties

##### projectId?

> `optional` **projectId**: `string`

Defined in: [api/\_handlers/image/\_shared.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L7)

## Functions

### decodeBase64Payload()

> **decodeBase64Payload**(`value`, `options`): `Uint8Array`

Defined in: [api/\_handlers/image/\_shared.ts:93](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L93)

#### Parameters

##### value

`string`

##### options

###### maxBytes?

`number`

#### Returns

`Uint8Array`

***

### getImageApiActor()

> **getImageApiActor**(`req`): `string` \| `null`

Defined in: [api/\_handlers/image/\_shared.ts:61](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L61)

Returns the authenticated session address, or null if not signed in.

#### Parameters

##### req

`any`

#### Returns

`string` \| `null`

***

### isReferenceAssetRole()

> **isReferenceAssetRole**(`value`): value is "frame" \| "subject"

Defined in: [api/\_handlers/image/\_shared.ts:89](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L89)

#### Parameters

##### value

`unknown`

#### Returns

value is "frame" \| "subject"

***

### parseRequiredString()

> **parseRequiredString**(`value`): `string` \| `null`

Defined in: [api/\_handlers/image/\_shared.ts:85](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L85)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### prepareImageApi()

> **prepareImageApi**(`req`, `res`): `boolean`

Defined in: [api/\_handlers/image/\_shared.ts:14](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L14)

CORS + no-store + admin-only gate. Used by AdminImageGeneration flows.

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`boolean`

***

### prepareImageApiAuthenticated()

> **prepareImageApiAuthenticated**(`req`, `res`): `boolean`

Defined in: [api/\_handlers/image/\_shared.ts:33](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L33)

CORS + no-store + any-authenticated-user gate. Used by vault-deploy image gen flows.

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`boolean`

***

### readBody()

> **readBody**\<`T`\>(`req`, `options`): `Promise`\<`T`\>

Defined in: [api/\_handlers/image/\_shared.ts:65](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L65)

#### Type Parameters

##### T

`T`

#### Parameters

##### req

`any`

##### options

###### maxBytes?

`number`

#### Returns

`Promise`\<`T`\>

***

### requireImageApiAdmin()

> **requireImageApiAdmin**(`req`, `res`): `boolean`

Defined in: [api/\_handlers/image/\_shared.ts:47](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/image/_shared.ts#L47)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`boolean`
