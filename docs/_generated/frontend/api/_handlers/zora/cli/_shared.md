[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/zora/cli/\_shared

# api/\_handlers/zora/cli/\_shared

## Type Aliases

### CliParseResult

> **CliParseResult**\<`TParams`\> = \{ `ok`: `true`; `params`: `TParams`; \} \| \{ `body`: `CliErrorBody`; `ok`: `false`; `status`: `number`; \}

Defined in: [api/\_handlers/zora/cli/\_shared.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/zora/cli/_shared.ts#L13)

#### Type Parameters

##### TParams

`TParams`

## Functions

### okParams()

> **okParams**\<`TParams`\>(`params`): [`CliParseResult`](#cliparseresult)\<`TParams`\>

Defined in: [api/\_handlers/zora/cli/\_shared.ts:76](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/zora/cli/_shared.ts#L76)

#### Type Parameters

##### TParams

`TParams`

#### Parameters

##### params

`TParams`

#### Returns

[`CliParseResult`](#cliparseresult)\<`TParams`\>

***

### parseError()

> **parseError**(`status`, `error`, `suggestion?`): [`CliParseResult`](#cliparseresult)\<`never`\>

Defined in: [api/\_handlers/zora/cli/\_shared.ts:80](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/zora/cli/_shared.ts#L80)

#### Parameters

##### status

`number`

##### error

`string`

##### suggestion?

`string`

#### Returns

[`CliParseResult`](#cliparseresult)\<`never`\>

***

### withCliReadHandler()

> **withCliReadHandler**\<`TParams`, `TResult`\>(`options`): (`req`, `res`) => `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/zora/cli/\_shared.ts:33](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_handlers/zora/cli/_shared.ts#L33)

#### Type Parameters

##### TParams

`TParams`

##### TResult

`TResult`

#### Parameters

##### options

`CliReadHandlerOptions`\<`TParams`, `TResult`\>

#### Returns

> (`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

##### Parameters

###### req

`VercelRequest`

###### res

`VercelResponse`

##### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
