[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/ui/Accordion

# src/components/ui/Accordion

## Interfaces

### AccordionItemData

Defined in: [src/components/ui/Accordion.tsx:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/ui/Accordion.tsx#L16)

#### Properties

##### children

> **children**: `ReactNode`

Defined in: [src/components/ui/Accordion.tsx:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/ui/Accordion.tsx#L19)

##### key

> **key**: `string`

Defined in: [src/components/ui/Accordion.tsx:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/ui/Accordion.tsx#L17)

##### title

> **title**: `string`

Defined in: [src/components/ui/Accordion.tsx:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/ui/Accordion.tsx#L18)

## Functions

### FaqAccordion()

> **FaqAccordion**(`__namedParameters`): `Element`

Defined in: [src/components/ui/Accordion.tsx:38](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/ui/Accordion.tsx#L38)

Multi-open accordion backed by CDS AccordionItem.

Each item is wrapped in its own CDS Accordion so multiple items can be
independently expanded — CDS Accordion's native mode only supports
single-open.

#### Parameters

##### \_\_namedParameters

`AccordionProps`

#### Returns

`Element`

***

### SingleAccordion()

> **SingleAccordion**(`__namedParameters`): `Element`

Defined in: [src/components/ui/Accordion.tsx:70](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/components/ui/Accordion.tsx#L70)

Single-open accordion backed by CDS Accordion (standard mode).

#### Parameters

##### \_\_namedParameters

###### activeKey

`string` \| `null`

###### className?

`string`

###### items

[`AccordionItemData`](#accordionitemdata)[]

###### onChange

(`key`) => `void`

#### Returns

`Element`
