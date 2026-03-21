[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/client

# src/lib/privy/client

## Variables

### ZORA\_PRIVY\_APP\_ID

> `const` **ZORA\_PRIVY\_APP\_ID**: `"clpgf04wn04hnkw0fv1m11mnb"` = `'clpgf04wn04hnkw0fv1m11mnb'`

Defined in: [src/lib/privy/client.tsx:9](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/privy/client.tsx#L9)

## Functions

### PrivyClientProvider()

> **PrivyClientProvider**(`props`): `Element`

Defined in: [src/lib/privy/client.tsx:72](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/privy/client.tsx#L72)

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

###### showWalletLoginFirst?

`boolean`

#### Returns

`Element`

***

### usePrivyClientStatus()

> **usePrivyClientStatus**(): `PrivyClientStatus`

Defined in: [src/lib/privy/client.tsx:13](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/privy/client.tsx#L13)

#### Returns

`PrivyClientStatus`
