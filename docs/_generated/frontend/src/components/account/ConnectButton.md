[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/ConnectButton

# src/components/account/ConnectButton

## Functions

### ConnectButton()

> **ConnectButton**(`__namedParameters`): `Element`

Defined in: [src/components/account/ConnectButton.tsx:325](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/ConnectButton.tsx#L325)

#### Parameters

##### \_\_namedParameters

###### variant?

`ConnectButtonVariant` = `'default'`

#### Returns

`Element`

***

### deriveConnectButtonState()

> **deriveConnectButtonState**(`input`): `"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

Defined in: [src/components/account/ConnectButton.tsx:55](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/ConnectButton.tsx#L55)

#### Parameters

##### input

`ConnectButtonStateInput`

#### Returns

`"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

***

### deriveWalletIdentityPresentation()

> **deriveWalletIdentityPresentation**(`input`): `WalletIdentityPresentation`

Defined in: [src/components/account/ConnectButton.tsx:231](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/ConnectButton.tsx#L231)

#### Parameters

##### input

`WalletIdentityPresentationInput`

#### Returns

`WalletIdentityPresentation`

***

### ExternalWalletOptions()

> **ExternalWalletOptions**(`props`): `Element`

Defined in: [src/components/account/ConnectButton.tsx:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/ConnectButton.tsx#L91)

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

Defined in: [src/components/account/ConnectButton.tsx:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/ConnectButton.tsx#L72)

#### Parameters

##### input

`ExternalWalletButtonsInput`

#### Returns

`boolean`

***

### shouldResolveConnectIdentity()

> **shouldResolveConnectIdentity**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/ConnectButton.tsx#L85)

#### Parameters

##### input

`ResolveIdentityInput`

#### Returns

`boolean`
