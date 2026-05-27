[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/messaging/xmtpWalletSendCalls

# server/\_lib/messaging/xmtpWalletSendCalls

## Functions

### buildWalletSendCallsFromSwapTransaction()

> **buildWalletSendCallsFromSwapTransaction**(`params`): `any`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L24)

#### Parameters

##### params

###### chainId?

`number`

###### description?

`string`

###### from

`string`

###### swap

`Record`\<`string`, `unknown`\>

#### Returns

`any`

***

### extractWalletSendCallsFromUniswapActionReply()

> **extractWalletSendCallsFromUniswapActionReply**(`params`): `any`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L71)

#### Parameters

##### params

###### actionReply

`string`

###### fallbackFrom

`string` \| `null`

#### Returns

`any`
