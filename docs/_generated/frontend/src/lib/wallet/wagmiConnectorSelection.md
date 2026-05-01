[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/wallet/wagmiConnectorSelection

# src/lib/wallet/wagmiConnectorSelection

## Type Aliases

### WalletConnectorLike

> **WalletConnectorLike** = `object`

Defined in: [src/lib/wallet/wagmiConnectorSelection.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/wagmiConnectorSelection.ts#L1)

#### Properties

##### id?

> `optional` **id**: `string`

Defined in: [src/lib/wallet/wagmiConnectorSelection.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/wagmiConnectorSelection.ts#L2)

##### name?

> `optional` **name**: `string`

Defined in: [src/lib/wallet/wagmiConnectorSelection.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/wagmiConnectorSelection.ts#L3)

## Functions

### filterHiddenInjectedConnectors()

> **filterHiddenInjectedConnectors**\<`T`\>(`connectors`, `shouldHideInjectedConnector`): `T`[]

Defined in: [src/lib/wallet/wagmiConnectorSelection.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/wagmiConnectorSelection.ts#L19)

#### Type Parameters

##### T

`T` *extends* [`WalletConnectorLike`](#walletconnectorlike)

#### Parameters

##### connectors

readonly `T`[]

##### shouldHideInjectedConnector

`boolean`

#### Returns

`T`[]

***

### selectPreferredWalletConnector()

> **selectPreferredWalletConnector**\<`T`\>(`connectors`): `T` \| `null`

Defined in: [src/lib/wallet/wagmiConnectorSelection.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/wagmiConnectorSelection.ts#L27)

#### Type Parameters

##### T

`T` *extends* [`WalletConnectorLike`](#walletconnectorlike)

#### Parameters

##### connectors

readonly `T`[]

#### Returns

`T` \| `null`
