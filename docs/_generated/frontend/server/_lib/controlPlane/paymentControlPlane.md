[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/paymentControlPlane

# server/\_lib/controlPlane/paymentControlPlane

## Type Aliases

### RecordPaymentActivationQueuedInput

> **RecordPaymentActivationQueuedInput** = `object`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L10)

#### Properties

##### activationId

> **activationId**: `number`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L12)

##### amountAtomic

> **amountAtomic**: `bigint`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L18)

##### creatorToken

> **creatorToken**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L15)

##### currency

> **currency**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L19)

##### featureKey

> **featureKey**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L16)

##### metadata?

> `optional` **metadata**: `Record`\<`string`, `unknown`\> \| `null`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L21)

##### orderId

> **orderId**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L11)

##### paymentSource

> **paymentSource**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L17)

##### provider

> **provider**: `"stripe"` \| `"x402"` \| `"manual"` \| `"usdc_base"`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L13)

##### providerEventId

> **providerEventId**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L14)

##### requestedBy?

> `optional` **requestedBy**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L20)

***

### RecordPaymentActivationQueuedResult

> **RecordPaymentActivationQueuedResult** = `object`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L24)

#### Properties

##### operationId

> **operationId**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L25)

##### persisted

> **persisted**: `boolean`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L27)

##### reused

> **reused**: `boolean`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L28)

##### stageId

> **stageId**: `string`

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L26)

## Functions

### recordPaymentActivationQueued()

> **recordPaymentActivationQueued**(`input`): `Promise`\<[`RecordPaymentActivationQueuedResult`](#recordpaymentactivationqueuedresult)\>

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:31](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L31)

#### Parameters

##### input

[`RecordPaymentActivationQueuedInput`](#recordpaymentactivationqueuedinput)

#### Returns

`Promise`\<[`RecordPaymentActivationQueuedResult`](#recordpaymentactivationqueuedresult)\>

***

### recordPaymentProvisioningDispatch()

> **recordPaymentProvisioningDispatch**(`input`): `Promise`\<`void`\>

Defined in: [server/\_lib/controlPlane/paymentControlPlane.ts:130](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/controlPlane/paymentControlPlane.ts#L130)

#### Parameters

##### input

###### actor?

`string` \| `null`

###### note

`string`

###### ok

`boolean`

###### operationId

`string`

###### stageId

`string`

#### Returns

`Promise`\<`void`\>
