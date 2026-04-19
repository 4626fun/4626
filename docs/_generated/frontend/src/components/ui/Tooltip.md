[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/ui/Tooltip

# src/components/ui/Tooltip

## Interfaces

### TooltipProps

Defined in: [src/components/ui/Tooltip.tsx:11](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L11)

#### Properties

##### children

> **children**: `ReactElement`

Defined in: [src/components/ui/Tooltip.tsx:15](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L15)

The trigger element (must accept ref).

##### closeDelay?

> `optional` **closeDelay**: `number`

Defined in: [src/components/ui/Tooltip.tsx:21](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L21)

Delay in ms before hiding after pointer leaves.

##### content

> **content**: `ReactNode`

Defined in: [src/components/ui/Tooltip.tsx:13](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L13)

The content shown inside the tooltip popup.

##### hasInteractiveContent?

> `optional` **hasInteractiveContent**: `boolean`

Defined in: [src/components/ui/Tooltip.tsx:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L23)

Whether the tooltip contains interactive elements (links, buttons).

##### openDelay?

> `optional` **openDelay**: `number`

Defined in: [src/components/ui/Tooltip.tsx:19](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L19)

Delay in ms before showing on hover.

##### placement?

> `optional` **placement**: `"left"` \| `"right"` \| `"top"` \| `"bottom"`

Defined in: [src/components/ui/Tooltip.tsx:17](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L17)

Position relative to the trigger.

## Functions

### Tooltip()

> **Tooltip**(`__namedParameters`): `Element`

Defined in: [src/components/ui/Tooltip.tsx:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/ui/Tooltip.tsx#L26)

#### Parameters

##### \_\_namedParameters

[`TooltipProps`](#tooltipprops)

#### Returns

`Element`
