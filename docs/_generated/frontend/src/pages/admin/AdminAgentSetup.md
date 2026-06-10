[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/pages/admin/AdminAgentSetup

# src/pages/admin/AdminAgentSetup

## Functions

### AdminAgentSetup()

> **AdminAgentSetup**(): `Element`

Defined in: [src/pages/admin/AdminAgentSetup.tsx:274](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/AdminAgentSetup.tsx#L274)

#### Returns

`Element`

***

### selectAjnaAutomationViewState()

> **selectAjnaAutomationViewState**(`input`): `object`

Defined in: [src/pages/admin/AdminAgentSetup.tsx:202](https://github.com/wenakita/4626/blob/main/frontend/src/pages/admin/AdminAgentSetup.tsx#L202)

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

Re-exports [pickPrivyEmbeddedEoaWallet](../../lib/privy/privyEmbeddedEoa.md#pickprivyembeddedeoawallet)
