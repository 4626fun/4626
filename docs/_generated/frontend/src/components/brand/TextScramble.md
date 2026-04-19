[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/brand/TextScramble

# src/components/brand/TextScramble

## Interfaces

### TextScrambleProps

Defined in: [src/components/brand/TextScramble.tsx:8](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L8)

#### Properties

##### className?

> `optional` **className**: `string`

Defined in: [src/components/brand/TextScramble.tsx:10](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L10)

##### complexity?

> `optional` **complexity**: [`TextScrambleComplexity`](#textscramblecomplexity)

Defined in: [src/components/brand/TextScramble.tsx:15](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L15)

##### font?

> `optional` **font**: [`TextScrambleFont`](#textscramblefont)

Defined in: [src/components/brand/TextScramble.tsx:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L11)

##### speed?

> `optional` **speed**: `number`

Defined in: [src/components/brand/TextScramble.tsx:14](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L14)

Resolve speed multiplier (higher = faster). Default 1.0

##### text

> **text**: `string`

Defined in: [src/components/brand/TextScramble.tsx:9](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L9)

##### trigger?

> `optional` **trigger**: `boolean`

Defined in: [src/components/brand/TextScramble.tsx:12](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L12)

## Type Aliases

### TextScrambleComplexity

> **TextScrambleComplexity** = `"simple"` \| `"complex"`

Defined in: [src/components/brand/TextScramble.tsx:6](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L6)

***

### TextScrambleFont

> **TextScrambleFont** = `"sans"` \| `"mono"` \| `"doto"`

Defined in: [src/components/brand/TextScramble.tsx:5](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L5)

## Functions

### TextScramble()

> **TextScramble**(`__namedParameters`): `Element`

Defined in: [src/components/brand/TextScramble.tsx:44](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/brand/TextScramble.tsx#L44)

Base brand "tech scramble" — vertical glyph swaps that cascade
left-to-right and resolve into the final message.

Per spec: headlines & teasers only, Medium weight, sequences ≤800ms.
Pair with a quick fade-in of supporting content.

#### Parameters

##### \_\_namedParameters

[`TextScrambleProps`](#textscrambleprops)

#### Returns

`Element`
