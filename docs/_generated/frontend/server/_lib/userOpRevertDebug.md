[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/userOpRevertDebug

# server/\_lib/userOpRevertDebug

## Type Aliases

### UserOpCallLike

> **UserOpCallLike** = `object`

Defined in: [server/\_lib/userOpRevertDebug.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L3)

#### Properties

##### data?

> `optional` **data**: `Hex`

Defined in: [server/\_lib/userOpRevertDebug.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L6)

##### to

> **to**: `Address`

Defined in: [server/\_lib/userOpRevertDebug.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L4)

##### value?

> `optional` **value**: `bigint`

Defined in: [server/\_lib/userOpRevertDebug.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L5)

***

### UserOpErrorDebug

> **UserOpErrorDebug** = `object`

Defined in: [server/\_lib/userOpRevertDebug.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L9)

#### Properties

##### at

> **at**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L10)

##### callSummary?

> `optional` **callSummary**: `object`[]

Defined in: [server/\_lib/userOpRevertDebug.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L21)

###### selector

> **selector**: `Hex` \| `null`

###### to

> **to**: `Address`

##### details?

> `optional` **details**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L16)

##### errorName?

> `optional` **errorName**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L20)

##### errorType?

> `optional` **errorType**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L13)

##### message?

> `optional` **message**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L14)

##### metaMessages?

> `optional` **metaMessages**: `string`[]

Defined in: [server/\_lib/userOpRevertDebug.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L17)

##### revertData?

> `optional` **revertData**: `Hex`

Defined in: [server/\_lib/userOpRevertDebug.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L18)

##### selector?

> `optional` **selector**: `Hex`

Defined in: [server/\_lib/userOpRevertDebug.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L19)

##### sessionId?

> `optional` **sessionId**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L11)

##### shortMessage?

> `optional` **shortMessage**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L15)

##### stage?

> `optional` **stage**: `string`

Defined in: [server/\_lib/userOpRevertDebug.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L12)

## Functions

### buildUserOpErrorDebug()

> **buildUserOpErrorDebug**(`params`): [`UserOpErrorDebug`](#useroperrordebug)

Defined in: [server/\_lib/userOpRevertDebug.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/userOpRevertDebug.ts#L133)

#### Parameters

##### params

###### calls?

[`UserOpCallLike`](#useropcalllike)[] \| `null`

###### err

`unknown`

###### now?

`Date`

###### sessionId?

`string`

###### stage?

`string` \| `null`

#### Returns

[`UserOpErrorDebug`](#useroperrordebug)
