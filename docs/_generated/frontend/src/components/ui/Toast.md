[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/ui/Toast

# src/components/ui/Toast

## Variables

### toast

> `const` **toast**: (`text`, `options?`) => `void` & `object`

Defined in: [src/components/ui/Toast.tsx:87](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/ui/Toast.tsx#L87)

Drop-in replacement for `import { toast } from 'sonner'`.

Usage:
```ts
toast.success('Deposit confirmed')
toast.error('Something went wrong')
toast('Plain message')
```

#### Type Declaration

##### clearQueue()

> **clearQueue**: () => `void`

###### Returns

`void`

##### dismiss()

> **dismiss**: () => `void`

###### Returns

`void`

##### error()

> **error**: (`text`, `options?`) => `void`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`void`

##### hide()

> **hide**: () => `void`

###### Returns

`void`

##### info()

> **info**: (`text`, `options?`) => `void`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`void`

##### message()

> **message**: (`text`, `options?`) => `void`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`void`

##### success()

> **success**: (`text`, `options?`) => `void`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`void`

##### warning()

> **warning**: (`text`, `options?`) => `void`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`void`

## Functions

### CdsToastBridge()

> **CdsToastBridge**(): `null`

Defined in: [src/components/ui/Toast.tsx:39](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/components/ui/Toast.tsx#L39)

Render this once near the app root (inside CDS PortalProvider) to connect
the imperative `toast` singleton to the CDS toast context.

#### Returns

`null`
