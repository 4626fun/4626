[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/LaunchCoinCard

# src/features/waitlist/LaunchCoinCard

## Type Aliases

### LaunchCoinCardProps

> **LaunchCoinCardProps** = `object`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L48)

#### Properties

##### defaultName?

> `optional` **defaultName**: `string` \| `null`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L52)

Prefill coin name (used in one-click mode)

##### defaultSymbol?

> `optional` **defaultSymbol**: `string` \| `null`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:54](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L54)

Prefill coin symbol seed (used in one-click mode)

##### mode?

> `optional` **mode**: `"form"` \| `"one-click"`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L50)

UI mode: full form (default) or 1-click prefilled

##### onCoinCreated()?

> `optional` **onCoinCreated**: (`coinAddress`, `symbol`) => `void`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L60)

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

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L58)

The EOA owner address that will sign the UserOp

##### smartWalletAddress

> **smartWalletAddress**: `string` \| `null`

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L56)

The user's Coinbase Smart Wallet address (coin creator)

## Variables

### LaunchCoinCard

> `const` **LaunchCoinCard**: `NamedExoticComponent`\<[`LaunchCoinCardProps`](#launchcoincardprops)\>

Defined in: [src/features/waitlist/LaunchCoinCard.tsx:84](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/LaunchCoinCard.tsx#L84)

## References

### default

Renames and re-exports [LaunchCoinCard](#launchcoincard)
