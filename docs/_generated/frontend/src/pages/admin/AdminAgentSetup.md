[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/admin/AdminAgentSetup

# src/pages/admin/AdminAgentSetup

## Functions

### AdminAgentSetup()

> **AdminAgentSetup**(): `Element`

Defined in: [src/pages/admin/AdminAgentSetup.tsx:288](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AdminAgentSetup.tsx#L288)

#### Returns

`Element`

***

### selectAjnaAutomationViewState()

> **selectAjnaAutomationViewState**(`input`): `object`

Defined in: [src/pages/admin/AdminAgentSetup.tsx:198](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/pages/admin/AdminAgentSetup.tsx#L198)

#### Parameters

##### input

###### enableMutation

`AjnaAutomationMutationSnapshot`\<[`AjnaAutomationPayload`](../../components/deploy/DeploymentSuccess.md#ajnaautomationpayload)\>

###### normalizedVaultAddress

`string` \| `null`

###### queryError?

`unknown`

###### queryStatus

[`AjnaAutomationStatus`](../../components/deploy/DeploymentSuccess.md#ajnaautomationstatus) \| `null` \| `undefined`

###### revokeMutation

`AjnaAutomationMutationSnapshot`\<`string`\>

#### Returns

`object`

##### errorMessage

> **errorMessage**: `string` \| `null`

##### status

> **status**: [`AjnaAutomationStatus`](../../components/deploy/DeploymentSuccess.md#ajnaautomationstatus) \| `null`

##### statusUnavailable

> **statusUnavailable**: `boolean`

## References

### AjnaAutomationOptInCard

Re-exports [AjnaAutomationOptInCard](../../components/deploy/DeploymentSuccess.md#ajnaautomationoptincard)

***

### pickPrivyEmbeddedEoaWallet

Re-exports [pickPrivyEmbeddedEoaWallet](../../lib/privyEmbeddedEoa.md#pickprivyembeddedeoawallet)
