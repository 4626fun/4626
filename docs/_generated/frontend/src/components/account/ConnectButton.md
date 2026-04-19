[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/account/ConnectButton

# src/components/account/ConnectButton

## Functions

### ConnectButton()

> **ConnectButton**(`__namedParameters`): `Element`

Defined in: [src/components/account/ConnectButton.tsx:232](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/account/ConnectButton.tsx#L232)

#### Parameters

##### \_\_namedParameters

###### variant?

`ConnectButtonVariant` = `'default'`

#### Returns

`Element`

***

### deriveConnectButtonState()

> **deriveConnectButtonState**(`input`): `"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

Defined in: [src/components/account/ConnectButton.tsx:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/account/ConnectButton.tsx#L18)

#### Parameters

##### input

`ConnectButtonStateInput`

#### Returns

`"hydrating"` \| `"connected-wallet"` \| `"session-restored"` \| `"signed-out"`

***

### deriveWalletIdentityPresentation()

> **deriveWalletIdentityPresentation**(`input`): `WalletIdentityPresentation`

Defined in: [src/components/account/ConnectButton.tsx:138](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/account/ConnectButton.tsx#L138)

#### Parameters

##### input

`WalletIdentityPresentationInput`

#### Returns

`WalletIdentityPresentation`

***

### shouldAllowExternalWalletButtons()

> **shouldAllowExternalWalletButtons**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:35](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/account/ConnectButton.tsx#L35)

#### Parameters

##### input

`ExternalWalletButtonsInput`

#### Returns

`boolean`

***

### shouldResolveConnectIdentity()

> **shouldResolveConnectIdentity**(`input`): `boolean`

Defined in: [src/components/account/ConnectButton.tsx:48](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/account/ConnectButton.tsx#L48)

#### Parameters

##### input

`ResolveIdentityInput`

#### Returns

`boolean`
