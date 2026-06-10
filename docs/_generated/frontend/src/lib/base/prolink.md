[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/base/prolink

# src/lib/base/prolink

## Functions

### buildBaseAppProlinkUrl()

> **buildBaseAppProlinkUrl**(`payload`, `baseUrl`): `string`

Defined in: [src/lib/base/prolink.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/base/prolink.ts#L52)

#### Parameters

##### payload

`string`

##### baseUrl

`string` = `DEFAULT_BASE_APP_PROLINK_URL`

#### Returns

`string`

***

### encodeSingleCallSendCallsProlink()

> **encodeSingleCallSendCallsProlink**(`input`): `Promise`\<`string`\>

Defined in: [src/lib/base/prolink.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/lib/base/prolink.ts#L23)

Encode a single-call wallet_sendCalls prolink payload for Base mainnet.

#### Parameters

##### input

###### atomicRequired?

`boolean`

###### data

`string`

###### from

`string`

###### to

`string`

###### value?

`string`

#### Returns

`Promise`\<`string`\>
