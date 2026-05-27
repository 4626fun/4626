[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/leaderboardAccountKind

# src/features/waitlist/leaderboardAccountKind

## Type Aliases

### LeaderboardAccountKind

> **LeaderboardAccountKind** = `"base_app"` \| `"zora"` \| `"coinbase_csw"` \| `"eoa"` \| `"unknown"`

Defined in: [src/features/waitlist/leaderboardAccountKind.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardAccountKind.ts#L5)

Single public account lane shown on the waitlist leaderboard.

## Functions

### leaderboardAccountKindLabel()

> **leaderboardAccountKindLabel**(`kind`, `walletProvider?`): `string`

Defined in: [src/features/waitlist/leaderboardAccountKind.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardAccountKind.ts#L30)

#### Parameters

##### kind

[`LeaderboardAccountKind`](#leaderboardaccountkind)

##### walletProvider?

[`WalletProviderId`](../../lib/wallet/providerIdentity.md#walletproviderid)

#### Returns

`string`

***

### resolveLeaderboardAccountKind()

> **resolveLeaderboardAccountKind**(`input`): [`LeaderboardAccountKind`](#leaderboardaccountkind)

Defined in: [src/features/waitlist/leaderboardAccountKind.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardAccountKind.ts#L7)

#### Parameters

##### input

###### cswAddress?

`string` \| `null`

###### showBaseAppBadge?

`boolean`

###### showZoraBadge?

`boolean`

###### walletProvider?

`string` \| `null`

#### Returns

[`LeaderboardAccountKind`](#leaderboardaccountkind)

***

### resolveLeaderboardWalletProvider()

> **resolveLeaderboardWalletProvider**(`walletProvider`): [`WalletProviderId`](../../lib/wallet/providerIdentity.md#walletproviderid)

Defined in: [src/features/waitlist/leaderboardAccountKind.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/leaderboardAccountKind.ts#L20)

#### Parameters

##### walletProvider

`string` | `null` | `undefined`

#### Returns

[`WalletProviderId`](../../lib/wallet/providerIdentity.md#walletproviderid)
