[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/lottery/snarkjs

# server/\_lib/lottery/snarkjs

## Variables

### groth16

> `const` **groth16**: `object`

Defined in: [server/\_lib/lottery/snarkjs.d.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/snarkjs.d.ts#L26)

#### Type Declaration

##### exportSolidityCallData()

> **exportSolidityCallData**: (...`args`) => `Promise`\<`string`\>

###### Parameters

###### args

...`unknown`[]

###### Returns

`Promise`\<`string`\>

##### fullProve()

> **fullProve**: (...`args`) => `Promise`\<`unknown`\>

###### Parameters

###### args

...`unknown`[]

###### Returns

`Promise`\<`unknown`\>

##### prove()

> **prove**: (...`args`) => `Promise`\<`unknown`\>

###### Parameters

###### args

...`unknown`[]

###### Returns

`Promise`\<`unknown`\>

##### verify()

> **verify**: (...`args`) => `Promise`\<`boolean`\>

###### Parameters

###### args

...`unknown`[]

###### Returns

`Promise`\<`boolean`\>

***

### plonk

> `const` **plonk**: `object`

Defined in: [server/\_lib/lottery/snarkjs.d.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/lottery/snarkjs.d.ts#L12)

#### Type Declaration

##### exportSolidityCallData()

> **exportSolidityCallData**: (`proof`, `publicSignals`) => `Promise`\<`string`\>

###### Parameters

###### proof

`unknown`

###### publicSignals

`unknown`

###### Returns

`Promise`\<`string`\>

##### fullProve()

> **fullProve**: (`input`, `wasmPath`, `zkeyPath`) => `Promise`\<\{ `proof`: `unknown`; `publicSignals`: `unknown`; \}\>

###### Parameters

###### input

`Record`\<`string`, `unknown`\>

###### wasmPath

`string`

###### zkeyPath

`string`

###### Returns

`Promise`\<\{ `proof`: `unknown`; `publicSignals`: `unknown`; \}\>

##### prove()

> **prove**: (...`args`) => `Promise`\<`unknown`\>

###### Parameters

###### args

...`unknown`[]

###### Returns

`Promise`\<`unknown`\>

##### setup()

> **setup**: (...`args`) => `Promise`\<`unknown`\>

###### Parameters

###### args

...`unknown`[]

###### Returns

`Promise`\<`unknown`\>

##### verify()

> **verify**: (...`args`) => `Promise`\<`boolean`\>

###### Parameters

###### args

...`unknown`[]

###### Returns

`Promise`\<`boolean`\>
