[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/prepareWaitlistMessagingWallet

# src/features/waitlist/prepareWaitlistMessagingWallet

## Type Aliases

### PrepareWaitlistMessagingWalletInput

> **PrepareWaitlistMessagingWalletInput** = `object`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L14)

#### Properties

##### activeConnectorId?

> `optional` **activeConnectorId**: `string` \| `null`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L22)

##### connectAsync()

> **connectAsync**: (`variables`) => `Promise`\<`unknown`\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L19)

###### Parameters

###### variables

###### connector

`unknown`

###### Returns

`Promise`\<`unknown`\>

##### connectors

> **connectors**: `ReadonlyArray`\<\{ `id`: `string`; `name`: `string`; \}\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L20)

##### disconnectAsync()?

> `optional` **disconnectAsync**: () => `Promise`\<`unknown`\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L21)

###### Returns

`Promise`\<`unknown`\>

##### embeddedEoaAddress

> **embeddedEoaAddress**: `string` \| `null`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L16)

##### ensureEmbeddedWallet()

> **ensureEmbeddedWallet**: () => `Promise`\<\{ `address`: `string`; \}\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L17)

###### Returns

`Promise`\<\{ `address`: `string`; \}\>

##### messagingWalletReady

> **messagingWalletReady**: `boolean`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L23)

##### setActiveWallet()?

> `optional` **setActiveWallet**: (`wallet`) => `Promise`\<`unknown`\> \| `unknown`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L18)

###### Parameters

###### wallet

`unknown`

###### Returns

`Promise`\<`unknown`\> \| `unknown`

##### wagmiConfig

> **wagmiConfig**: `Config`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L24)

##### wallets

> **wallets**: `unknown`[]

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L15)

***

### PrepareWaitlistMessagingWalletResult

> **PrepareWaitlistMessagingWalletResult** = \{ `ok`: `true`; \} \| \{ `error`: `string`; `ok`: `false`; \}

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L27)

## Functions

### findLiveEmbeddedPrivyWallet()

> **findLiveEmbeddedPrivyWallet**(`wallets`, `embeddedEoaAddress`): `Record`\<`string`, `unknown`\> \| `null`

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L45)

#### Parameters

##### wallets

`unknown`[]

##### embeddedEoaAddress

`string` | `null`

#### Returns

`Record`\<`string`, `unknown`\> \| `null`

***

### prepareWaitlistMessagingWallet()

> **prepareWaitlistMessagingWallet**(`input`): `Promise`\<[`PrepareWaitlistMessagingWalletResult`](#preparewaitlistmessagingwalletresult)\>

Defined in: [src/features/waitlist/prepareWaitlistMessagingWallet.ts:130](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/prepareWaitlistMessagingWallet.ts#L130)

#### Parameters

##### input

[`PrepareWaitlistMessagingWalletInput`](#preparewaitlistmessagingwalletinput)

#### Returns

`Promise`\<[`PrepareWaitlistMessagingWalletResult`](#preparewaitlistmessagingwalletresult)\>

## References

### isWaitlistMessagingWagmiConnector

Re-exports [isWaitlistMessagingWagmiConnector](../../lib/xmtp/waitForMessagingWallet.md#iswaitlistmessagingwagmiconnector)

***

### WAITLIST\_EMBEDDED\_CONNECTOR\_ID

Re-exports [WAITLIST_EMBEDDED_CONNECTOR_ID](../../lib/xmtp/waitForMessagingWallet.md#waitlist_embedded_connector_id)
