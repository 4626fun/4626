[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/lottery/AmoeEntryCard

# src/components/lottery/AmoeEntryCard

## Type Aliases

### AmoeSigningWalletClient

> **AmoeSigningWalletClient** = `object`

Defined in: [src/components/lottery/AmoeEntryCard.tsx:104](https://github.com/wenakita/4626/blob/main/frontend/src/components/lottery/AmoeEntryCard.tsx#L104)

#### Properties

##### signMessage()

> **signMessage**: (`args`) => `Promise`\<`Hex` \| `string`\>

Defined in: [src/components/lottery/AmoeEntryCard.tsx:105](https://github.com/wenakita/4626/blob/main/frontend/src/components/lottery/AmoeEntryCard.tsx#L105)

###### Parameters

###### args

###### message

`string`

###### Returns

`Promise`\<`Hex` \| `string`\>

## Variables

### \_\_testHooks

> `const` **\_\_testHooks**: `object`

Defined in: [src/components/lottery/AmoeEntryCard.tsx:169](https://github.com/wenakita/4626/blob/main/frontend/src/components/lottery/AmoeEntryCard.tsx#L169)

#### Type Declaration

##### buildAmoeShareText()

> **buildAmoeShareText**: () => `string`

###### Returns

`string`

##### buildXIntentUrl()

> **buildXIntentUrl**: () => `string`

###### Returns

`string`

## Functions

### AmoeEntryCard()

> **AmoeEntryCard**(`props`): `Element`

Defined in: [src/components/lottery/AmoeEntryCard.tsx:174](https://github.com/wenakita/4626/blob/main/frontend/src/components/lottery/AmoeEntryCard.tsx#L174)

#### Parameters

##### props

###### creatorCoin

`string` \| `null`

###### walletAddress

`string` \| `null`

###### walletClientOverride?

[`AmoeSigningWalletClient`](#amoesigningwalletclient) \| `null`

#### Returns

`Element`
