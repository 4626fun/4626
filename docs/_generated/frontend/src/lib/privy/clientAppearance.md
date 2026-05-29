[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/privy/clientAppearance

# src/lib/privy/clientAppearance

## Variables

### BASE\_ACCOUNT\_WALLET\_LOGIN\_LIST

> `const` **BASE\_ACCOUNT\_WALLET\_LOGIN\_LIST**: readonly \[`"coinbase_wallet"`, `"base_account"`\]

Defined in: [src/lib/privy/clientAppearance.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/clientAppearance.ts#L6)

Wallet connectors used for Coinbase Smart Wallet / Base Account sign-in.

## Functions

### createPrivyAppearance()

> **createPrivyAppearance**(`options?`): `object`

Defined in: [src/lib/privy/clientAppearance.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/privy/clientAppearance.ts#L8)

#### Parameters

##### options?

`PrivyAppearanceOptions`

#### Returns

`object`

##### landingHeader

> `readonly` **landingHeader**: `"Continue to 4626"` = `'Continue to 4626'`

##### loginMessage

> `readonly` **loginMessage**: `"Use verified email first, or continue with your wallet-native path."` = `'Use verified email first, or continue with your wallet-native path.'`

##### showWalletLoginFirst

> **showWalletLoginFirst**: `boolean`

##### theme

> `readonly` **theme**: `"#0f1117"` = `'#0f1117'`

##### walletChainType

> `readonly` **walletChainType**: `"all"` = `'all'`

##### walletList

> **walletList**: `string`[]
