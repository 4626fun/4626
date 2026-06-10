[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/creatorStrategy/paymentLedger

# server/\_lib/creatorStrategy/paymentLedger

## Functions

### recordPaymentEvent()

> **recordPaymentEvent**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/creatorStrategy/paymentLedger.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/creatorStrategy/paymentLedger.ts#L26)

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
