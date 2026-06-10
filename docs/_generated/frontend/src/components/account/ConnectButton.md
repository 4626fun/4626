[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/ConnectButton

# src/components/account/ConnectButton

## Functions

### ConnectButton()

> **ConnectButton**(`__namedParameters`): `Element`

Defined in: [src/components/account/ConnectButton.tsx:335](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L335)

#### Parameters

##### \_\_namedParameters

###### variant?

`ConnectButtonVariant` = `'default'`

#### Returns

`Element`

***

### deriveConnectButtonState()

> **deriveConnectButtonState**(`input`): `"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

Defined in: [src/components/account/ConnectButton.tsx:59](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L59)

#### Parameters

##### input

`ConnectButtonStateInput`

#### Returns

`"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

***

### deriveWalletIdentityPresentation()

> **deriveWalletIdentityPresentation**(`input`): `WalletIdentityPresentation`

Defined in: [src/components/account/ConnectButton.tsx:241](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L241)

#### Parameters

##### input

`WalletIdentityPresentationInput`

#### Returns

`WalletIdentityPresentation`

***

### ExternalWalletOptions()

> **ExternalWalletOptions**(`props`): `Element`

Defined in: [src/components/account/ConnectButton.tsx:95](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L95)

#### Parameters

##### props

###### authBusy

`boolean`

###### hasMultipleInjectedProviders

`boolean`

###### lockedEthereumProviderGlobal

`boolean`

###### onClose

() => `void`

###### shouldHideInjectedConnector

`boolean`

###### showPrivyDivider?

`boolean`

#### Returns

`Element`

***

### shouldAllowExternalWalletButtons()

> **shouldAllowExternalWalletButtons**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:76](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L76)

#### Parameters

##### input

`ExternalWalletButtonsInput`

#### Returns

`boolean`

***

### shouldResolveConnectIdentity()

> **shouldResolveConnectIdentity**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:89](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/ConnectButton.tsx#L89)

#### Parameters

##### input

`ResolveIdentityInput`

#### Returns

`boolean`
