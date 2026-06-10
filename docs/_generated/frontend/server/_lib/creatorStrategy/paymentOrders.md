[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/paymentOrders

# server/\_lib/creatorStrategy/paymentOrders

## Type Aliases

### PaymentOrderStatus

> **PaymentOrderStatus** = `"quoted"` \| `"payment_pending"` \| `"paid"` \| `"provisioning_queued"` \| `"provisioning_running"` \| `"manual_review"` \| `"completed"` \| `"failed"` \| `"refunded"` \| `"cancelled"` \| `"expired"`

Defined in: [server/\_lib/creatorStrategy/paymentOrders.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/paymentOrders.ts#L5)

## Functions

### upsertPaymentOrder()

> **upsertPaymentOrder**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/creatorStrategy/paymentOrders.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/paymentOrders.ts#L18)

#### Parameters

##### params

###### amountAtomic

`bigint`

###### currency

`string`

###### db

`Db`

###### metadata?

`Record`\<`string`, `unknown`\> \| `null`

###### orderId

`string`

###### policyVersion?

`string` \| `null`

###### status

[`PaymentOrderStatus`](#paymentorderstatus)

#### Returns

`Promise`\<`void`\>
