[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/accounts/AccountsPage

# src/pages/accounts/AccountsPage

## Functions

### AccountsPage()

> **AccountsPage**(`props`): `Element`

Defined in: [src/pages/accounts/AccountsPage.tsx:201](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/accounts/AccountsPage.tsx#L201)

#### Parameters

##### props

###### initialData?

\{ `me`: `AccountsMeResponse`; `zoraStatus`: `ZoraLinkStatusResponse` \| `null`; \}

###### initialData.me

`AccountsMeResponse`

###### initialData.zoraStatus

`ZoraLinkStatusResponse` \| `null`

#### Returns

`Element`

***

### readOptionalZoraStatus()

> **readOptionalZoraStatus**(`params`): `ZoraLinkStatusResponse` \| `null`

Defined in: [src/pages/accounts/AccountsPage.tsx:144](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/accounts/AccountsPage.tsx#L144)

#### Parameters

##### params

###### payload

`ApiEnvelope`\<`ZoraLinkStatusResponse`\> \| `null`

###### responseOk

`boolean`

#### Returns

`ZoraLinkStatusResponse` \| `null`

***

### shouldRefreshAccountsOnForeground()

> **shouldRefreshAccountsOnForeground**(`input`): `boolean`

Defined in: [src/pages/accounts/AccountsPage.tsx:135](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/accounts/AccountsPage.tsx#L135)

#### Parameters

##### input

###### advancedBusy

`boolean`

###### ownerDelegationFlags

`OwnerDelegationFlags` \| `null`

###### privyAuthed

`boolean`

#### Returns

`boolean`
