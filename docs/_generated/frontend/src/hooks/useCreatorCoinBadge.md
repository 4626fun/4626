[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useCreatorCoinBadge

# src/hooks/useCreatorCoinBadge

## Type Aliases

### CreatorCoinBadge

> **CreatorCoinBadge** = `object`

Defined in: [src/hooks/useCreatorCoinBadge.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L14)

Thin adapter over `useZoraCoin` that returns just the fields the
identity card + accounts hero need to display a creator coin badge.
Returns `null` when the address isn't a known Zora coin or the
profile doesn't have enough data to render a meaningful badge — the
consumer omits the badge entirely in that case (see
`docs/design/identity-surface-spec.md` § "Creator coin chip").

#### Properties

##### address

> **address**: `Address`

Defined in: [src/hooks/useCreatorCoinBadge.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L15)

##### loading

> **loading**: `boolean`

Defined in: [src/hooks/useCreatorCoinBadge.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L24)

##### logoUrl

> **logoUrl**: `string` \| `null`

Defined in: [src/hooks/useCreatorCoinBadge.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L19)

Best-available logo URL (small square), or null if none.

##### marketCapUsd

> **marketCapUsd**: `string` \| `null`

Defined in: [src/hooks/useCreatorCoinBadge.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L23)

Market cap in USD, stringified, or null.

##### name

> **name**: `string` \| `null`

Defined in: [src/hooks/useCreatorCoinBadge.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L17)

##### priceUsd

> **priceUsd**: `string` \| `null`

Defined in: [src/hooks/useCreatorCoinBadge.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L21)

USD price per coin, stringified, or null if unknown.

##### symbol

> **symbol**: `string` \| `null`

Defined in: [src/hooks/useCreatorCoinBadge.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L16)

## Functions

### useCreatorCoinBadge()

> **useCreatorCoinBadge**(`address?`): [`CreatorCoinBadge`](#creatorcoinbadge) \| `null`

Defined in: [src/hooks/useCreatorCoinBadge.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useCreatorCoinBadge.ts#L45)

#### Parameters

##### address?

`string` | `null`

#### Returns

[`CreatorCoinBadge`](#creatorcoinbadge) \| `null`
