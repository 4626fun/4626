[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/providerIdentity

# src/lib/wallet/providerIdentity

## Type Aliases

### WalletProviderId

> **WalletProviderId** = `"coinbase"` \| `"privy"` \| `"metamask"` \| `"rabby"` \| `"walletconnect"` \| `"unknown"`

Defined in: [src/lib/wallet/providerIdentity.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/providerIdentity.ts#L1)

## Functions

### inferWalletProvider()

> **inferWalletProvider**(`params`): [`WalletProviderId`](#walletproviderid)

Defined in: [src/lib/wallet/providerIdentity.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/providerIdentity.ts#L13)

#### Parameters

##### params

###### connectorId?

`string` \| `null`

###### isCanonicalSmartWallet?

`boolean`

###### provider?

`string` \| `null`

###### walletType?

`string` \| `null`

#### Returns

[`WalletProviderId`](#walletproviderid)

***

### walletProviderLabel()

> **walletProviderLabel**(`provider`): `string`

Defined in: [src/lib/wallet/providerIdentity.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/wallet/providerIdentity.ts#L51)

#### Parameters

##### provider

[`WalletProviderId`](#walletproviderid)

#### Returns

`string`
