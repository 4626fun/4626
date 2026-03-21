[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/components/DeploymentSuccess

# src/components/DeploymentSuccess

## Interfaces

### DeploymentSuccessProps

Defined in: [src/components/DeploymentSuccess.tsx:272](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L272)

#### Properties

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:282](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L282)

Canonical CSW used for Ajna automation consent

##### deployment

> **deployment**: [`DeploymentRecord`](../hooks/useDeploymentTracker.md#deploymentrecord) \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:274](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L274)

The deployment record

##### embeddedEoaAddress?

> `optional` **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:284](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L284)

Connected embedded EOA wallet address

##### onNewDeploy()?

> `optional` **onNewDeploy**: () => `void`

Defined in: [src/components/DeploymentSuccess.tsx:280](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L280)

Callback when user wants to view another deployment

###### Returns

`void`

##### privyWalletId?

> `optional` **privyWalletId**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:286](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L286)

Connected embedded EOA Privy wallet ID

##### shareSymbol?

> `optional` **shareSymbol**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:278](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L278)

Share symbol for display

##### tokenSymbol?

> `optional` **tokenSymbol**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:276](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L276)

Token symbol for display

## Type Aliases

### AjnaAutomationOptInCardProps

> **AjnaAutomationOptInCardProps** = `object`

Defined in: [src/components/DeploymentSuccess.tsx:107](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L107)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null` \| `undefined`

Defined in: [src/components/DeploymentSuccess.tsx:109](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L109)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null` \| `undefined`

Defined in: [src/components/DeploymentSuccess.tsx:110](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L110)

##### errorMessage?

> `optional` **errorMessage**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:118](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L118)

##### isRevoking

> **isRevoking**: `boolean`

Defined in: [src/components/DeploymentSuccess.tsx:115](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L115)

##### isStatusLoading?

> `optional` **isStatusLoading**: `boolean`

Defined in: [src/components/DeploymentSuccess.tsx:116](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L116)

##### isSubmitting

> **isSubmitting**: `boolean`

Defined in: [src/components/DeploymentSuccess.tsx:114](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L114)

##### onEnable()

> **onEnable**: (`payload`) => `void`

Defined in: [src/components/DeploymentSuccess.tsx:119](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L119)

###### Parameters

###### payload

[`AjnaAutomationPayload`](#ajnaautomationpayload)

###### Returns

`void`

##### onRevoke()

> **onRevoke**: (`vaultAddress`) => `void`

Defined in: [src/components/DeploymentSuccess.tsx:120](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L120)

###### Parameters

###### vaultAddress

`string`

###### Returns

`void`

##### onVaultAddressChange()?

> `optional` **onVaultAddressChange**: (`value`) => `void`

Defined in: [src/components/DeploymentSuccess.tsx:121](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L121)

###### Parameters

###### value

`string`

###### Returns

`void`

##### privyWalletId

> **privyWalletId**: `string` \| `null` \| `undefined`

Defined in: [src/components/DeploymentSuccess.tsx:111](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L111)

##### showVaultInput?

> `optional` **showVaultInput**: `boolean`

Defined in: [src/components/DeploymentSuccess.tsx:117](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L117)

##### status

> **status**: [`AjnaAutomationStatus`](#ajnaautomationstatus) \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:112](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L112)

##### statusUnavailable?

> `optional` **statusUnavailable**: `boolean`

Defined in: [src/components/DeploymentSuccess.tsx:113](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L113)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:108](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L108)

***

### AjnaAutomationPayload

> **AjnaAutomationPayload** = `object`

Defined in: [src/components/DeploymentSuccess.tsx:88](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L88)

#### Properties

##### cswAddress

> **cswAddress**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:90](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L90)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:91](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L91)

##### privyWalletId

> **privyWalletId**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:92](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L92)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:89](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L89)

***

### AjnaAutomationStatus

> **AjnaAutomationStatus** = `object`

Defined in: [src/components/DeploymentSuccess.tsx:95](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L95)

#### Properties

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [src/components/DeploymentSuccess.tsx:97](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L97)

##### automationScope?

> `optional` **automationScope**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:98](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L98)

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:99](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L99)

##### embeddedEoaAddress?

> `optional` **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:100](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L100)

##### lastOwnerCheckAt?

> `optional` **lastOwnerCheckAt**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:102](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L102)

##### privyWalletId?

> `optional` **privyWalletId**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:101](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L101)

##### revokedAt?

> `optional` **revokedAt**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:103](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L103)

##### updatedAt?

> `optional` **updatedAt**: `string` \| `null`

Defined in: [src/components/DeploymentSuccess.tsx:104](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L104)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [src/components/DeploymentSuccess.tsx:96](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L96)

## Functions

### AjnaAutomationOptInCard()

> **AjnaAutomationOptInCard**(`__namedParameters`): `Element`

Defined in: [src/components/DeploymentSuccess.tsx:137](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L137)

#### Parameters

##### \_\_namedParameters

[`AjnaAutomationOptInCardProps`](#ajnaautomationoptincardprops)

#### Returns

`Element`

***

### AlreadyDeployedBanner()

> **AlreadyDeployedBanner**(`__namedParameters`): `Element`

Defined in: [src/components/DeploymentSuccess.tsx:611](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L611)

Simpler "already deployed" banner for use at the top of the deploy page

#### Parameters

##### \_\_namedParameters

###### deployment

[`DeploymentRecord`](../hooks/useDeploymentTracker.md#deploymentrecord)

###### tokenSymbol?

`string`

#### Returns

`Element`

***

### DeploymentSuccess()

> **DeploymentSuccess**(`__namedParameters`): `Element`

Defined in: [src/components/DeploymentSuccess.tsx:289](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/DeploymentSuccess.tsx#L289)

#### Parameters

##### \_\_namedParameters

[`DeploymentSuccessProps`](#deploymentsuccessprops)

#### Returns

`Element`
