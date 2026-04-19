[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/LaunchCoinCard

# src/features/waitlist/LaunchCoinCard

## Type Aliases

### LaunchCoinCardProps

> **LaunchCoinCardProps** = `object`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:47](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L47)

#### Properties

##### defaultName?

> `optional` **defaultName**: `string` \| `null`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:51](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L51)

Prefill coin name (used in one-click mode)

##### defaultSymbol?

> `optional` **defaultSymbol**: `string` \| `null`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:53](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L53)

Prefill coin symbol seed (used in one-click mode)

##### mode?

> `optional` **mode**: `"form"` \| `"one-click"`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:49](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L49)

UI mode: full form (default) or 1-click prefilled

##### onCoinCreated()?

> `optional` **onCoinCreated**: (`coinAddress`, `symbol`) => `void`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:59](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L59)

Callback when coin is successfully created

###### Parameters

###### coinAddress

`string`

###### symbol

`string`

###### Returns

`void`

##### ownerAddress

> **ownerAddress**: `string` \| `null`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:57](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L57)

The EOA owner address that will sign the UserOp

##### smartWalletAddress

> **smartWalletAddress**: `string` \| `null`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:55](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L55)

The user's Coinbase Smart Wallet address (coin creator)

## Variables

### LaunchCoinCard

> `const` **LaunchCoinCard**: `NamedExoticComponent`\<[`LaunchCoinCardProps`](#launchcoincardprops)\>

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:83](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/LaunchCoinCard.tsx#L83)

## References

### default

Renames and re-exports [LaunchCoinCard](#launchcoincard)
