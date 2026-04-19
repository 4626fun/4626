[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/SmartWalletsRouteProvider

# src/lib/privy/SmartWalletsRouteProvider

## Functions

### SmartWalletsRouteProvider()

> **SmartWalletsRouteProvider**(`__namedParameters`): `Element`

Defined in: [src/lib/privy/SmartWalletsRouteProvider.tsx:11](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/privy/SmartWalletsRouteProvider.tsx#L11)

Route-scoped SmartWallets provider.

Keep this out of the global app shell so smart-wallet internals only load
on routes that actually call `useSmartWallets()`.

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

#### Returns

`Element`
