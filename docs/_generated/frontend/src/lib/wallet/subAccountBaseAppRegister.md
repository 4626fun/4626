[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/subAccountBaseAppRegister

# src/lib/wallet/subAccountBaseAppRegister

## Type Aliases

### RegisterBaseAppSubAccountInput

> **RegisterBaseAppSubAccountInput** = `object`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L5)

#### Properties

##### embeddedEoaAddress

> **embeddedEoaAddress**: `Address`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L8)

##### parentAddress

> **parentAddress**: `Address`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L6)

##### subAccountAddress

> **subAccountAddress**: `Address`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L7)

***

### RegisterBaseAppSubAccountResult

> **RegisterBaseAppSubAccountResult** = `object`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L11)

#### Properties

##### errorCode?

> `optional` **errorCode**: `string`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L14)

##### message

> **message**: `string`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L13)

##### ok

> **ok**: `boolean`

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L12)

## Functions

### registerBaseAppSubAccountLink()

> **registerBaseAppSubAccountLink**(`body`): `Promise`\<[`RegisterBaseAppSubAccountResult`](#registerbaseappsubaccountresult)\>

Defined in: [src/lib/wallet/subAccountBaseAppRegister.ts:49](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/subAccountBaseAppRegister.ts#L49)

#### Parameters

##### body

[`RegisterBaseAppSubAccountInput`](#registerbaseappsubaccountinput)

#### Returns

`Promise`\<[`RegisterBaseAppSubAccountResult`](#registerbaseappsubaccountresult)\>
