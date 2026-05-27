[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/privy/walletHooksContext

# src/lib/privy/walletHooksContext

## Functions

### PrivyWalletHooksContextProvider()

> **PrivyWalletHooksContextProvider**(`props`): `Element`

Defined in: [src/lib/privy/walletHooksContext.tsx:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/walletHooksContext.tsx#L61)

#### Parameters

##### props

###### children

`ReactNode`

###### enabled

`boolean`

#### Returns

`Element`

***

### usePrivyConnectWalletFromContext()

> **usePrivyConnectWalletFromContext**(): (`options?`) => `void` \| `undefined`

Defined in: [src/lib/privy/walletHooksContext.tsx:36](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/walletHooksContext.tsx#L36)

Privy wallet action hooks bridged once inside `PrivyProvider`.

#### Returns

(`options?`) => `void` \| `undefined`

***

### usePrivySetActiveWalletFromContext()

> **usePrivySetActiveWalletFromContext**(): (`wallet`) => `void` \| `undefined`

Defined in: [src/lib/privy/walletHooksContext.tsx:40](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/walletHooksContext.tsx#L40)

#### Returns

(`wallet`) => `void` \| `undefined`

***

### usePrivyWalletsFromContext()

> **usePrivyWalletsFromContext**(): `ConnectedWalletLike`[]

Defined in: [src/lib/privy/walletHooksContext.tsx:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/walletHooksContext.tsx#L31)

Read wallet state from the single in-tree `useWallets()` bridge.

#### Returns

`ConnectedWalletLike`[]

***

### usePrivyWalletsSnapshot()

> **usePrivyWalletsSnapshot**(): `PrivyWalletHooksSnapshot`

Defined in: [src/lib/privy/walletHooksContext.tsx:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/walletHooksContext.tsx#L26)

#### Returns

`PrivyWalletHooksSnapshot`
