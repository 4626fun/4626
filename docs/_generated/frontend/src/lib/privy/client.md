[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/privy/client

# src/lib/privy/client

## Variables

### ZORA\_PRIVY\_APP\_ID

> `const` **ZORA\_PRIVY\_APP\_ID**: `"clpgf04wn04hnkw0fv1m11mnb"` = `'clpgf04wn04hnkw0fv1m11mnb'`

Defined in: [src/lib/privy/client.tsx:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/client.tsx#L12)

## Functions

### PrivyClientProvider()

> **PrivyClientProvider**(`props`): `Element`

Defined in: [src/lib/privy/client.tsx:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/client.tsx#L76)

Privy Client Provider

Privy handles:
- Authentication (email, Farcaster, etc.)
- Global Wallet access (shared with Zora via Privy's global wallet feature)

With Zora Global Wallet enabled:
- Users who created their coin on Zora can access the SAME Coinbase Smart Wallet
- The embedded wallet from Zora is shared with 4626
- No new wallet is created - they use their existing Zora wallet

#### Parameters

##### props

###### children

`ReactNode`

###### mode?

`PrivyClientMode`

###### showWalletLoginFirst?

`boolean`

#### Returns

`Element`

***

### usePrivyClientStatus()

> **usePrivyClientStatus**(): `PrivyClientStatus`

Defined in: [src/lib/privy/client.tsx:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/client.tsx#L17)

#### Returns

`PrivyClientStatus`
