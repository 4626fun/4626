[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/useWaitlistMessagingConnect

# src/features/waitlist/useWaitlistMessagingConnect

## Functions

### useWaitlistMessagingConnect()

> **useWaitlistMessagingConnect**(`params`): `object`

Defined in: [src/features/waitlist/useWaitlistMessagingConnect.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/useWaitlistMessagingConnect.ts#L20)

#### Parameters

##### params

`UseWaitlistMessagingConnectParams`

#### Returns

`object`

##### connectAndJoin()

> **connectAndJoin**: (`options?`) => `Promise`\<`void`\>

###### Parameters

###### options?

###### reconnect?

`boolean`

###### skipJoinRetry?

`boolean`

###### Returns

`Promise`\<`void`\>

##### isConnecting

> **isConnecting**: `boolean`

##### messagingConnected

> **messagingConnected**: `boolean`

##### needsConnectMessaging

> **needsConnectMessaging**: `boolean`

##### prepareBusy

> **prepareBusy**: `boolean`

##### prepareError

> **prepareError**: `string` \| `null`

##### reconnectMessaging()

> **reconnectMessaging**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### walletReady

> **walletReady**: `boolean`
