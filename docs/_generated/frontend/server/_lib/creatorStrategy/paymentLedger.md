[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/paymentLedger

# server/\_lib/creatorStrategy/paymentLedger

## Functions

### recordPaymentEvent()

> **recordPaymentEvent**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/creatorStrategy/paymentLedger.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/creatorStrategy/paymentLedger.ts#L26)

#### Parameters

##### params

###### amountAtomic?

`bigint` \| `null`

###### currency?

`string` \| `null`

###### db

`Db`

###### eventType

`string`

###### orderId

`string`

###### payload?

`Record`\<`string`, `unknown`\> \| `null`

###### provider

`"manual"` \| `"stripe"` \| `"x402"`

###### providerEventId

`string`

#### Returns

`Promise`\<`void`\>
