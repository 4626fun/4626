[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/safeSwitchToBase

# src/lib/wallet/safeSwitchToBase

## Variables

### BASE\_CHAIN\_ID\_HEX

> `const` **BASE\_CHAIN\_ID\_HEX**: `string`

Defined in: [src/lib/wallet/safeSwitchToBase.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/wallet/safeSwitchToBase.ts#L7)

## Functions

### ensureProviderOnBase()

> **ensureProviderOnBase**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/wallet/safeSwitchToBase.ts:29](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/wallet/safeSwitchToBase.ts#L29)

#### Parameters

##### params

###### allowSwitch?

`boolean`

###### label

`string`

###### provider

`Eip1193ProviderLike`

#### Returns

`Promise`\<`void`\>

***

### ensureWagmiChainOnBase()

> **ensureWagmiChainOnBase**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/wallet/safeSwitchToBase.ts:13](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/wallet/safeSwitchToBase.ts#L13)

#### Parameters

##### params

###### currentChainId

`number` \| `null` \| `undefined`

###### label

`string`

###### switchChainAsync

`SwitchChainAsyncLike`

#### Returns

`Promise`\<`void`\>
