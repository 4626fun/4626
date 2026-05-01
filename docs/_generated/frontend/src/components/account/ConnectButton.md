[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/account/ConnectButton

# src/components/account/ConnectButton

## Functions

### ConnectButton()

> **ConnectButton**(`__namedParameters`): `Element`

Defined in: [src/components/account/ConnectButton.tsx:235](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L235)

#### Parameters

##### \_\_namedParameters

###### variant?

`ConnectButtonVariant` = `'default'`

#### Returns

`Element`

***

### deriveConnectButtonState()

> **deriveConnectButtonState**(`input`): `"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

Defined in: [src/components/account/ConnectButton.tsx:25](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L25)

#### Parameters

##### input

`ConnectButtonStateInput`

#### Returns

`"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

***

### deriveWalletIdentityPresentation()

> **deriveWalletIdentityPresentation**(`input`): `WalletIdentityPresentation`

Defined in: [src/components/account/ConnectButton.tsx:141](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L141)

#### Parameters

##### input

`WalletIdentityPresentationInput`

#### Returns

`WalletIdentityPresentation`

***

### shouldAllowExternalWalletButtons()

> **shouldAllowExternalWalletButtons**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:42](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L42)

#### Parameters

##### input

`ExternalWalletButtonsInput`

#### Returns

`boolean`

***

### shouldResolveConnectIdentity()

> **shouldResolveConnectIdentity**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:55](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L55)

#### Parameters

##### input

`ResolveIdentityInput`

#### Returns

`boolean`
