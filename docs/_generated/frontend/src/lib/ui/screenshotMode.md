[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/ui/screenshotMode

# src/lib/ui/screenshotMode

## Type Aliases

### ScreenshotMode

> **ScreenshotMode** = `object`

Defined in: [src/lib/ui/screenshotMode.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L8)

#### Properties

##### demo

> **demo**: `string` \| `null`

Defined in: [src/lib/ui/screenshotMode.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L10)

##### enabled

> **enabled**: `boolean`

Defined in: [src/lib/ui/screenshotMode.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L9)

## Variables

### SCREENSHOT\_DEMO\_QUERY\_PARAM

> `const` **SCREENSHOT\_DEMO\_QUERY\_PARAM**: `"demo"` = `'demo'`

Defined in: [src/lib/ui/screenshotMode.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L5)

***

### SCREENSHOT\_HIDE\_ATTR

> `const` **SCREENSHOT\_HIDE\_ATTR**: `"data-screenshot-hide"` = `'data-screenshot-hide'`

Defined in: [src/lib/ui/screenshotMode.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L6)

***

### SCREENSHOT\_QUERY\_PARAM

> `const` **SCREENSHOT\_QUERY\_PARAM**: `"screenshot"` = `'screenshot'`

Defined in: [src/lib/ui/screenshotMode.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L4)

## Functions

### clearAppScreenshotReady()

> **clearAppScreenshotReady**(): `void`

Defined in: [src/lib/ui/screenshotMode.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L46)

#### Returns

`void`

***

### isScreenshotMode()

> **isScreenshotMode**(`input`): `boolean`

Defined in: [src/lib/ui/screenshotMode.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L42)

#### Parameters

##### input

`string` | `URLSearchParams`

#### Returns

`boolean`

***

### parseScreenshotMode()

> **parseScreenshotMode**(`input`): [`ScreenshotMode`](#screenshotmode)

Defined in: [src/lib/ui/screenshotMode.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L32)

#### Parameters

##### input

`string` | `URLSearchParams`

#### Returns

[`ScreenshotMode`](#screenshotmode)

***

### setAppScreenshotReady()

> **setAppScreenshotReady**(`ready`): `void`

Defined in: [src/lib/ui/screenshotMode.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L51)

#### Parameters

##### ready

`boolean`

#### Returns

`void`

***

### useScreenshotMode()

> **useScreenshotMode**(): [`ScreenshotMode`](#screenshotmode)

Defined in: [src/lib/ui/screenshotMode.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L56)

#### Returns

[`ScreenshotMode`](#screenshotmode)

***

### useScreenshotReady()

> **useScreenshotReady**(`ready`): `void`

Defined in: [src/lib/ui/screenshotMode.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/ui/screenshotMode.ts#L61)

#### Parameters

##### ready

`boolean`

#### Returns

`void`
