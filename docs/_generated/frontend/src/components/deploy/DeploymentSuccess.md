[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/deploy/DeploymentSuccess

# src/components/deploy/DeploymentSuccess

## Interfaces

### DeploymentSuccessProps

Defined in: [src/components/deploy/DeploymentSuccess.tsx:273](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L273)

#### Properties

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:283](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L283)

Canonical CSW used for Ajna automation consent

##### deployment

> **deployment**: [`DeploymentRecord`](../../hooks/useDeploymentTracker.md#deploymentrecord) \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:275](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L275)

The deployment record

##### embeddedEoaAddress?

> `optional` **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:285](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L285)

Connected embedded EOA wallet address

##### onNewDeploy()?

> `optional` **onNewDeploy**: () => `void`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:281](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L281)

Callback when user wants to view another deployment

###### Returns

`void`

##### privyWalletId?

> `optional` **privyWalletId**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:287](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L287)

Connected embedded EOA Privy wallet ID

##### shareSymbol?

> `optional` **shareSymbol**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:279](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L279)

Share symbol for display

##### tokenSymbol?

> `optional` **tokenSymbol**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:277](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L277)

Token symbol for display

## Type Aliases

### AjnaAutomationOptInCardProps

> **AjnaAutomationOptInCardProps** = `object`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:108](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L108)

#### Properties

##### canonicalCswAddress

> **canonicalCswAddress**: `string` \| `null` \| `undefined`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:110](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L110)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null` \| `undefined`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:111](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L111)

##### errorMessage?

> `optional` **errorMessage**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:119](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L119)

##### isRevoking

> **isRevoking**: `boolean`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:116](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L116)

##### isStatusLoading?

> `optional` **isStatusLoading**: `boolean`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:117](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L117)

##### isSubmitting

> **isSubmitting**: `boolean`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:115](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L115)

##### onEnable()

> **onEnable**: (`payload`) => `void`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:120](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L120)

###### Parameters

###### payload

[`AjnaAutomationPayload`](#ajnaautomationpayload)

###### Returns

`void`

##### onRevoke()

> **onRevoke**: (`vaultAddress`) => `void`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:121](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L121)

###### Parameters

###### vaultAddress

`string`

###### Returns

`void`

##### onVaultAddressChange()?

> `optional` **onVaultAddressChange**: (`value`) => `void`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:122](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L122)

###### Parameters

###### value

`string`

###### Returns

`void`

##### privyWalletId

> **privyWalletId**: `string` \| `null` \| `undefined`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:112](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L112)

##### showVaultInput?

> `optional` **showVaultInput**: `boolean`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:118](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L118)

##### status

> **status**: [`AjnaAutomationStatus`](#ajnaautomationstatus) \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:113](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L113)

##### statusUnavailable?

> `optional` **statusUnavailable**: `boolean`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:114](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L114)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:109](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L109)

***

### AjnaAutomationPayload

> **AjnaAutomationPayload** = `object`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:89](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L89)

#### Properties

##### cswAddress

> **cswAddress**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:91](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L91)

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:92](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L92)

##### privyWalletId

> **privyWalletId**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:93](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L93)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:90](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L90)

***

### AjnaAutomationStatus

> **AjnaAutomationStatus** = `object`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:96](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L96)

#### Properties

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:98](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L98)

##### automationScope?

> `optional` **automationScope**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:99](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L99)

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:100](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L100)

##### embeddedEoaAddress?

> `optional` **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:101](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L101)

##### lastOwnerCheckAt?

> `optional` **lastOwnerCheckAt**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:103](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L103)

##### privyWalletId?

> `optional` **privyWalletId**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:102](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L102)

##### revokedAt?

> `optional` **revokedAt**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:104](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L104)

##### updatedAt?

> `optional` **updatedAt**: `string` \| `null`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:105](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L105)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:97](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L97)

## Functions

### AjnaAutomationOptInCard()

> **AjnaAutomationOptInCard**(`__namedParameters`): `Element`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:138](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L138)

#### Parameters

##### \_\_namedParameters

[`AjnaAutomationOptInCardProps`](#ajnaautomationoptincardprops)

#### Returns

`Element`

***

### AlreadyDeployedBanner()

> **AlreadyDeployedBanner**(`__namedParameters`): `Element`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:649](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L649)

Simpler "already deployed" banner for use at the top of the deploy page

#### Parameters

##### \_\_namedParameters

###### deployment

[`DeploymentRecord`](../../hooks/useDeploymentTracker.md#deploymentrecord)

###### tokenSymbol?

`string`

#### Returns

`Element`

***

### DeploymentSuccess()

> **DeploymentSuccess**(`__namedParameters`): `Element`

Defined in: [src/components/deploy/DeploymentSuccess.tsx:290](https://github.com/wenakita/4626/blob/main/frontend/src/components/deploy/DeploymentSuccess.tsx#L290)

#### Parameters

##### \_\_namedParameters

[`DeploymentSuccessProps`](#deploymentsuccessprops)

#### Returns

`Element`
