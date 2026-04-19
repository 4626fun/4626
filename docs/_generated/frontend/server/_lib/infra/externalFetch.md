[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/externalFetch

# server/\_lib/infra/externalFetch

## Classes

### ExternalFetchError

Defined in: [server/\_lib/infra/externalFetch.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/externalFetch.ts#L18)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ExternalFetchError**(`message`, `reason`, `statusCode`): [`ExternalFetchError`](#externalfetcherror)

Defined in: [server/\_lib/infra/externalFetch.ts:22](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/externalFetch.ts#L22)

###### Parameters

###### message

`string`

###### reason

`RejectReason`

###### statusCode

`number` = `502`

###### Returns

[`ExternalFetchError`](#externalfetcherror)

###### Overrides

`Error.constructor`

#### Properties

##### reason

> `readonly` **reason**: `RejectReason`

Defined in: [server/\_lib/infra/externalFetch.ts:19](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/externalFetch.ts#L19)

##### statusCode

> `readonly` **statusCode**: `number`

Defined in: [server/\_lib/infra/externalFetch.ts:20](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/externalFetch.ts#L20)

## Functions

### fetchExternalJson()

> **fetchExternalJson**\<`T`\>(`rawUrl`, `options`): `Promise`\<\{ `data`: `T`; `status`: `number`; \}\>

Defined in: [server/\_lib/infra/externalFetch.ts:102](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/externalFetch.ts#L102)

#### Type Parameters

##### T

`T`

#### Parameters

##### rawUrl

`string`

##### options

`ExternalFetchJsonOptions`

#### Returns

`Promise`\<\{ `data`: `T`; `status`: `number`; \}\>
