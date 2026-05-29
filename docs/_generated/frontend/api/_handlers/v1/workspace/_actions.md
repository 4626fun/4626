[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/workspace/\_actions

# api/\_handlers/v1/workspace/\_actions

## Type Aliases

### MaxAssetsCapParseResult

> **MaxAssetsCapParseResult** = \{ `ok`: `true`; `value`: `string` \| `null` \| `undefined`; \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: [api/\_handlers/v1/workspace/\_actions.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_actions.ts#L68)

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/v1/workspace/\_actions.ts:175](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_actions.ts#L175)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>

***

### parseMaxAssetsCap()

> **parseMaxAssetsCap**(`payload`): [`MaxAssetsCapParseResult`](#maxassetscapparseresult)

Defined in: [api/\_handlers/v1/workspace/\_actions.ts:78](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/workspace/_actions.ts#L78)

#### Parameters

##### payload

`Record`\<`string`, `unknown`\>

#### Returns

[`MaxAssetsCapParseResult`](#maxassetscapparseresult)
