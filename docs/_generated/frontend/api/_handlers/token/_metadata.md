[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/token/\_metadata

# api/\_handlers/token/\_metadata

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/token/\_metadata.ts:30](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/token/_metadata.ts#L30)

ERC-7572 Token Metadata API

Returns contract-level metadata for ■TOKEN (CreatorShareOFT) tokens.
The image fields point at the canonical token renderer used across API and contract metadata.

Query params:
  - address: ShareOFT token address (required)
  - chain: Chain ID (default: 8453 for Base)

Response: ERC-7572 compliant JSON

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>
