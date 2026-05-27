[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / api/\_handlers/arch-b/\_subAccountBaseAppRegister

# api/\_handlers/arch-b/\_subAccountBaseAppRegister

## Interfaces

### ZoraSubAccountBaseAppRegisterHandlerHooks

Defined in: [api/\_handlers/arch-b/\_subAccountBaseAppRegister.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/arch-b/_subAccountBaseAppRegister.ts#L98)

Test seam — handler-side hooks to skip slow side-effects in unit
tests (the Base RPC sanity read in particular). Mirrors the
`__setHandlerHooksForTest` pattern used by the AMOE crons.

#### Properties

##### sanityReadSubAccount()?

> `optional` **sanityReadSubAccount**: (`args`) => `Promise`\<`void`\>

Defined in: [api/\_handlers/arch-b/\_subAccountBaseAppRegister.ts:105](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/arch-b/_subAccountBaseAppRegister.ts#L105)

Override the optional sanity read of `subAccountAddress.code` /
`ownerAtIndex(0)` from Base RPC. The default uses
`getBasePublicClient()`. Tests inject a no-op so they don't try
to talk to a real RPC.

###### Parameters

###### args

###### embeddedEoaAddress

`string`

###### subAccountAddress

`string`

###### Returns

`Promise`\<`void`\>

## Functions

### \_\_resetHandlerHooksForTest()

> **\_\_resetHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/arch-b/\_subAccountBaseAppRegister.ts:119](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/arch-b/_subAccountBaseAppRegister.ts#L119)

#### Returns

`void`

***

### \_\_setHandlerHooksForTest()

> **\_\_setHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/arch-b/\_subAccountBaseAppRegister.ts:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/arch-b/_subAccountBaseAppRegister.ts#L113)

#### Parameters

##### hooks

[`ZoraSubAccountBaseAppRegisterHandlerHooks`](#zorasubaccountbaseappregisterhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/arch-b/\_subAccountBaseAppRegister.ts:200](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/arch-b/_subAccountBaseAppRegister.ts#L200)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
