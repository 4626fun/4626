[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/messaging/xmtpWalletSendCalls

# server/\_lib/messaging/xmtpWalletSendCalls

## Type Aliases

### XmtpWalletSendCallsPayload

> **XmtpWalletSendCallsPayload** = `object`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L7)

#### Properties

##### calls

> **calls**: `object`[]

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L11)

###### data

> **data**: `string`

###### gas?

> `optional` **gas**: `string`

###### metadata?

> `optional` **metadata**: `object`

###### metadata.description?

> `optional` **description**: `string`

###### metadata.transactionType?

> `optional` **transactionType**: `string`

###### to

> **to**: `string`

###### value

> **value**: `string`

##### chainId

> **chainId**: `string`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L9)

##### from

> **from**: `string`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L10)

##### version

> **version**: `string`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L8)

## Functions

### buildWalletSendCallsFromSwapTransaction()

> **buildWalletSendCallsFromSwapTransaction**(`params`): [`XmtpWalletSendCallsPayload`](#xmtpwalletsendcallspayload) \| `null`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L36)

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

[`XmtpWalletSendCallsPayload`](#xmtpwalletsendcallspayload) \| `null`

***

### extractWalletSendCallsFromUniswapActionReply()

> **extractWalletSendCallsFromUniswapActionReply**(`params`): [`XmtpWalletSendCallsPayload`](#xmtpwalletsendcallspayload) \| `null`

Defined in: [server/\_lib/messaging/xmtpWalletSendCalls.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/messaging/xmtpWalletSendCalls.ts#L83)

#### Parameters

##### params

###### actionReply

`string`

###### fallbackFrom

`string` \| `null`

#### Returns

[`XmtpWalletSendCallsPayload`](#xmtpwalletsendcallspayload) \| `null`
