[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/tokenSymbols

# src/lib/tokenSymbols

## Variables

### SHARE\_SYMBOL\_PREFIX

> `const` **SHARE\_SYMBOL\_PREFIX**: `"■"` = `'■'`

Defined in: [src/lib/tokenSymbols.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L5)

***

### VAULT\_SYMBOL\_PREFIX

> `const` **VAULT\_SYMBOL\_PREFIX**: `"▢"` = `'▢'`

Defined in: [src/lib/tokenSymbols.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L6)

## Functions

### normalizeUnderlyingSymbol()

> **normalizeUnderlyingSymbol**(`raw`): `string`

Defined in: [src/lib/tokenSymbols.ts:17](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L17)

Strip current Unicode badge prefixes to recover the underlying ticker.

#### Parameters

##### raw

`string`

#### Returns

`string`

***

### toCharmVaultSymbol()

> **toCharmVaultSymbol**(`rawUnderlying`): `string`

Defined in: [src/lib/tokenSymbols.ts:46](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L46)

Charm vault symbols should stay creator-centric and avoid quote symbols
(e.g. USDC/WETH), which can get visually filtered on some explorers.
Example: AKITA -> charmAKITA

#### Parameters

##### rawUnderlying

`string`

#### Returns

`string`

***

### toShareName()

> **toShareName**(`rawUnderlying`, `creatorName?`): `string`

Defined in: [src/lib/tokenSymbols.ts:52](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L52)

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

Defined in: [src/lib/tokenSymbols.ts:31](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L31)

#### Parameters

##### rawUnderlying

`string`

#### Returns

`string`

***

### toVaultName()

> **toVaultName**(`rawUnderlying`, `creatorName?`): `string`

Defined in: [src/lib/tokenSymbols.ts:58](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L58)

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

Defined in: [src/lib/tokenSymbols.ts:36](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L36)

#### Parameters

##### rawUnderlying

`string`

#### Returns

`string`

***

### underlyingSymbolUpper()

> **underlyingSymbolUpper**(`raw`): `string`

Defined in: [src/lib/tokenSymbols.ts:26](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/tokenSymbols.ts#L26)

#### Parameters

##### raw

`string`

#### Returns

`string`
