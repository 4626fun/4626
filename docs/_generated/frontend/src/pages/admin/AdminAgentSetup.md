[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/pages/admin/AdminAgentSetup

# src/pages/admin/AdminAgentSetup

## Functions

### AdminAgentSetup()

> **AdminAgentSetup**(): `Element`

Defined in: [src/pages/admin/AdminAgentSetup.tsx:289](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/admin/AdminAgentSetup.tsx#L289)

#### Returns

`Element`

***

### selectAjnaAutomationViewState()

> **selectAjnaAutomationViewState**(`input`): `object`

Defined in: [src/pages/admin/AdminAgentSetup.tsx:199](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/pages/admin/AdminAgentSetup.tsx#L199)

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
