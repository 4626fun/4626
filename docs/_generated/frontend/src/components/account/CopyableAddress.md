[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/CopyableAddress

# src/components/account/CopyableAddress

## Functions

### CopyableAddress()

> **CopyableAddress**(`__namedParameters`): `Element`

Defined in: [src/components/account/CopyableAddress.tsx:14](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/CopyableAddress.tsx#L14)

Display an Ethereum address in short form with a copy-to-clipboard
action. Shows the full address in a tooltip on hover; click anywhere
on the component copies the full address and briefly flashes a check
icon to confirm.

Optionally accepts a `label` prop (e.g. the address's basename/ENS)
— when provided, the label renders instead of the short hex and the
short hex shifts to a subtle secondary slot.

#### Parameters

##### \_\_namedParameters

###### address

`string`

###### className?

`string`

###### label?

`string` \| `null`

###### variant?

`"default"` \| `"muted"` \| `"pill"` = `'default'`

#### Returns

`Element`

***

### InlineAddressCopyButton()

> **InlineAddressCopyButton**(`__namedParameters`): `Element`

Defined in: [src/components/account/CopyableAddress.tsx:76](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/CopyableAddress.tsx#L76)

Compact copy control for placing next to a primary address label.
Copies the full address; shows a brief check after success.

#### Parameters

##### \_\_namedParameters

###### address

`string`

###### className?

`string`

#### Returns

`Element`
