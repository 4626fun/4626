[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/token/\_metadata

# api/\_handlers/token/\_metadata

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/token/\_metadata.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/token/_metadata.ts#L30)

ERC-7572 Token Metadata API

Returns contract-level metadata for ■TOKEN (CreatorShareOFT) tokens.
The image fields point at the canonical token renderer used across API and contract metadata.

Query params:
  - address: ShareOFT token address (required)
  - chain: Chain ID (default: 8453 for Base)

Response: ERC-7572 compliant JSON

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
