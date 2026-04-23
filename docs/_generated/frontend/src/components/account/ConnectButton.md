[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/account/ConnectButton

# src/components/account/ConnectButton

## Functions

### ConnectButton()

> **ConnectButton**(`__namedParameters`): `Element`

Defined in: [src/components/account/ConnectButton.tsx:237](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L237)

#### Parameters

##### \_\_namedParameters

###### variant?

`ConnectButtonVariant` = `'default'`

#### Returns

`Element`

***

### deriveConnectButtonState()

> **deriveConnectButtonState**(`input`): `"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

Defined in: [src/components/account/ConnectButton.tsx:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L23)

#### Parameters

##### input

`ConnectButtonStateInput`

#### Returns

`"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

***

### deriveWalletIdentityPresentation()

> **deriveWalletIdentityPresentation**(`input`): `WalletIdentityPresentation`

Defined in: [src/components/account/ConnectButton.tsx:143](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L143)

#### Parameters

##### input

`WalletIdentityPresentationInput`

#### Returns

`WalletIdentityPresentation`

***

### shouldAllowExternalWalletButtons()

> **shouldAllowExternalWalletButtons**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:40](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L40)

#### Parameters

##### input

`ExternalWalletButtonsInput`

#### Returns

`boolean`

***

### shouldResolveConnectIdentity()

> **shouldResolveConnectIdentity**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:53](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L53)

#### Parameters

##### input

`ResolveIdentityInput`

#### Returns

`boolean`
