[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/commands/hermitXPostHelpers

# server/commands/hermitXPostHelpers

## Functions

### formatHermitXCrossPostSkipMessage()

> **formatHermitXCrossPostSkipMessage**(`tweetResponse`): `string`

Defined in: [server/commands/hermitXPostHelpers.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/commands/hermitXPostHelpers.ts#L15)

#### Parameters

##### tweetResponse

`string`

#### Returns

`string`

***

### isTwitterDuplicateContentError()

> **isTwitterDuplicateContentError**(`message`): `boolean`

Defined in: [server/commands/hermitXPostHelpers.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/commands/hermitXPostHelpers.ts#L11)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### truncateWithEllipsis()

> **truncateWithEllipsis**(`value`, `maxLength`): `string`

Defined in: [server/commands/hermitXPostHelpers.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/commands/hermitXPostHelpers.ts#L5)

Pure helpers for Hermit → X cross-post copy (uniquify text, duplicate detection).

#### Parameters

##### value

`string`

##### maxLength

`number`

#### Returns

`string`
