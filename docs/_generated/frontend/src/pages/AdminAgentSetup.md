[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/pages/AdminAgentSetup

# src/pages/AdminAgentSetup

## Functions

### AdminAgentSetup()

> **AdminAgentSetup**(): `Element`

Defined in: [src/pages/AdminAgentSetup.tsx:282](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AdminAgentSetup.tsx#L282)

#### Returns

`Element`

***

### selectAjnaAutomationViewState()

> **selectAjnaAutomationViewState**(`input`): `object`

Defined in: [src/pages/AdminAgentSetup.tsx:192](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/pages/AdminAgentSetup.tsx#L192)

#### Parameters

##### input

###### enableMutation

`AjnaAutomationMutationSnapshot`\<[`AjnaAutomationPayload`](../components/DeploymentSuccess.md#ajnaautomationpayload)\>

###### normalizedVaultAddress

`string` \| `null`

###### queryError?

`unknown`

###### queryStatus

[`AjnaAutomationStatus`](../components/DeploymentSuccess.md#ajnaautomationstatus) \| `null` \| `undefined`

###### revokeMutation

`AjnaAutomationMutationSnapshot`\<`string`\>

#### Returns

`object`

##### errorMessage

> **errorMessage**: `string` \| `null`

##### status

> **status**: [`AjnaAutomationStatus`](../components/DeploymentSuccess.md#ajnaautomationstatus) \| `null`

##### statusUnavailable

> **statusUnavailable**: `boolean`

## References

### AjnaAutomationOptInCard

Re-exports [AjnaAutomationOptInCard](../components/DeploymentSuccess.md#ajnaautomationoptincard)

***

### pickPrivyEmbeddedEoaWallet

Re-exports [pickPrivyEmbeddedEoaWallet](../lib/privyEmbeddedEoa.md#pickprivyembeddedeoawallet)
