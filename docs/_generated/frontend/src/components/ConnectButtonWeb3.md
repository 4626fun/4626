[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/components/ConnectButtonWeb3

# src/components/ConnectButtonWeb3

## Functions

### ConnectButtonWeb3()

> **ConnectButtonWeb3**(`__namedParameters`): `Element`

Defined in: [src/components/ConnectButtonWeb3.tsx:144](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/ConnectButtonWeb3.tsx#L144)

Simple Connect Button

Shows available connectors and handles connection.

#### Parameters

##### \_\_namedParameters

###### variant?

`ConnectButtonVariant` = `'default'`

#### Returns

`Element`

***

### deriveConnectButtonState()

> **deriveConnectButtonState**(`input`): `"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

Defined in: [src/components/ConnectButtonWeb3.tsx:18](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/ConnectButtonWeb3.tsx#L18)

#### Parameters

##### input

`ConnectButtonStateInput`

#### Returns

`"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

***

### deriveWalletIdentityPresentation()

> **deriveWalletIdentityPresentation**(`input`): `WalletIdentityPresentation`

Defined in: [src/components/ConnectButtonWeb3.tsx:66](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/ConnectButtonWeb3.tsx#L66)

#### Parameters

##### input

`WalletIdentityPresentationInput`

#### Returns

`WalletIdentityPresentation`

***

### shouldAllowExternalWalletButtons()

> **shouldAllowExternalWalletButtons**(`input`): `boolean`

Defined in: [src/components/ConnectButtonWeb3.tsx:35](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/ConnectButtonWeb3.tsx#L35)

#### Parameters

##### input

`ExternalWalletButtonsInput`

#### Returns

`boolean`
