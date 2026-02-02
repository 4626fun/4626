[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/tokenSymbols

# src/lib/tokenSymbols

## Variables

### SHARE\_SYMBOL\_PREFIX

> `const` **SHARE\_SYMBOL\_PREFIX**: `"■"` = `'■'`

Defined in: [lib/tokenSymbols.ts:5](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L5)

***

### VAULT\_SYMBOL\_PREFIX

> `const` **VAULT\_SYMBOL\_PREFIX**: `"▢"` = `'▢'`

Defined in: [lib/tokenSymbols.ts:6](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L6)

## Functions

### isUnicodeShareSymbol()

> **isUnicodeShareSymbol**(`symbol`): `boolean`

Defined in: [lib/tokenSymbols.ts:55](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L55)

#### Parameters

##### symbol

`string`

#### Returns

`boolean`

***

### isUnicodeVaultSymbol()

> **isUnicodeVaultSymbol**(`symbol`): `boolean`

Defined in: [lib/tokenSymbols.ts:59](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L59)

#### Parameters

##### symbol

`string`

#### Returns

`boolean`

***

### normalizeUnderlyingSymbol()

> **normalizeUnderlyingSymbol**(`raw`): `string`

Defined in: [lib/tokenSymbols.ts:17](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L17)

Strip known prefixes (Unicode badges or legacy ws/s) to recover the underlying ticker.

#### Parameters

##### raw

`string`

#### Returns

`string`

***

### toShareName()

> **toShareName**(`rawUnderlying`, `creatorName?`): `string`

Defined in: [lib/tokenSymbols.ts:43](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L43)

#### Parameters

##### rawUnderlying

`string`

##### creatorName?

`string`

#### Returns

`string`

***

### toShareSymbol()

> **toShareSymbol**(`rawUnderlying`): `string`

Defined in: [lib/tokenSymbols.ts:33](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L33)

#### Parameters

##### rawUnderlying

`string`

#### Returns

`string`

***

### toVaultName()

> **toVaultName**(`rawUnderlying`, `creatorName?`): `string`

Defined in: [lib/tokenSymbols.ts:49](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L49)

#### Parameters

##### rawUnderlying

`string`

##### creatorName?

`string`

#### Returns

`string`

***

### toVaultSymbol()

> **toVaultSymbol**(`rawUnderlying`): `string`

Defined in: [lib/tokenSymbols.ts:38](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L38)

#### Parameters

##### rawUnderlying

`string`

#### Returns

`string`

***

### underlyingSymbolUpper()

> **underlyingSymbolUpper**(`raw`): `string`

Defined in: [lib/tokenSymbols.ts:28](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/tokenSymbols.ts#L28)

#### Parameters

##### raw

`string`

#### Returns

`string`
