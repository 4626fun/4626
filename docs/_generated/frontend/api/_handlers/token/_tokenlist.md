[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/token/\_tokenlist

# api/\_handlers/token/\_tokenlist

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/token/\_tokenlist.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/token/_tokenlist.ts#L61)

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
