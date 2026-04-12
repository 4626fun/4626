[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/token/\_tokenlist

# api/\_handlers/token/\_tokenlist

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/token/\_tokenlist.ts:61](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/api/_handlers/token/_tokenlist.ts#L61)

Token List compatible output for a single Share token entry.
This endpoint publishes logoURI as an absolute HTTPS URL that points to
canonical extension-based aliases (/logo.png and /logo.svg).

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
