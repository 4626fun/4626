[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/priceOverrides

# server/\_lib/creatorStrategy/priceOverrides

## Type Aliases

### PriceOverrideRow

> **PriceOverrideRow** = `object`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:32](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L32)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L42)

##### creatorToken

> **creatorToken**: `Address` \| `null`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L34)

##### expiresAt

> **expiresAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L40)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L36)

##### grantedBy

> **grantedBy**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L39)

##### id

> **id**: `number`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L33)

##### priceUsdcOverride

> **priceUsdcOverride**: `bigint`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L37)

##### reason

> **reason**: `string`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L38)

##### revokedAt

> **revokedAt**: `string` \| `null`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L41)

##### walletAddress

> **walletAddress**: `Address` \| `null`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:35](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L35)

## Functions

### applyPriceOverride()

> **applyPriceOverride**(`catalogPriceUsdc`, `override`): `object`

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:115](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L115)

Resolve the effective price the creator must pay, clamped to
`min(override, catalog)` so a malformed override row can never raise
the price above what the catalog advertises.

#### Parameters

##### catalogPriceUsdc

`bigint`

##### override

[`PriceOverrideRow`](#priceoverriderow) | `null`

#### Returns

`object`

##### appliedOverrideId

> **appliedOverrideId**: `number` \| `null`

##### discountBps

> **discountBps**: `number` \| `null`

##### effectivePriceUsdc

> **effectivePriceUsdc**: `bigint`

***

### findActivePriceOverride()

> **findActivePriceOverride**(`db`, `params`): `Promise`\<[`PriceOverrideRow`](#priceoverriderow) \| `null`\>

Defined in: [server/\_lib/creatorStrategy/priceOverrides.ts:65](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/priceOverrides.ts#L65)

Look up the most-specific active override for a given
(creator, wallet, feature) triple. Returns `null` if no override
applies — the caller must then fall back to catalog price.

#### Parameters

##### db

`Db`

##### params

###### creatorToken

`string`

###### featureKey

`string`

###### walletAddress

`string`

#### Returns

`Promise`\<[`PriceOverrideRow`](#priceoverriderow) \| `null`\>
