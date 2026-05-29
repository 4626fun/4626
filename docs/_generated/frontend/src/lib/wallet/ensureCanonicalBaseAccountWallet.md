[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/ensureCanonicalBaseAccountWallet

# src/lib/wallet/ensureCanonicalBaseAccountWallet

## Functions

### findBaseAccountWalletInList()

> **findBaseAccountWalletInList**(`wallets`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/lib/wallet/ensureCanonicalBaseAccountWallet.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/ensureCanonicalBaseAccountWallet.ts#L14)

#### Parameters

##### wallets

`unknown`[]

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### isCanonicalBaseAccountWalletReady()

> **isCanonicalBaseAccountWalletReady**(`params`): `boolean`

Defined in: [src/lib/wallet/ensureCanonicalBaseAccountWallet.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/ensureCanonicalBaseAccountWallet.ts#L21)

#### Parameters

##### params

###### canonicalCswAddress

`string` \| `null` \| `undefined`

###### providerAccounts?

`string`[] \| `null`

###### wallets

`unknown`[]

#### Returns

`boolean`

***

### normalizeWalletAddress()

> **normalizeWalletAddress**(`value`): `string` \| `null`

Defined in: [src/lib/wallet/ensureCanonicalBaseAccountWallet.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/ensureCanonicalBaseAccountWallet.ts#L5)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### readBaseAccountProviderAccounts()

> **readBaseAccountProviderAccounts**(`baseAccountSdk`): `Promise`\<`string`[]\>

Defined in: [src/lib/wallet/ensureCanonicalBaseAccountWallet.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/ensureCanonicalBaseAccountWallet.ts#L37)

#### Parameters

##### baseAccountSdk

`unknown`

#### Returns

`Promise`\<`string`[]\>
