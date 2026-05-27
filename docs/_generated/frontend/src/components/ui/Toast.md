[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/ui/Toast

# src/components/ui/Toast

## Variables

### ~~CdsToastBridge()~~

> `const` **CdsToastBridge**: () => `Element` = `AppToaster`

Defined in: [src/components/ui/Toast.tsx:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/ui/Toast.tsx#L27)

#### Returns

`Element`

#### Deprecated

Use AppToaster at app root; kept for one release of import stability.

***

### toast

> `const` **toast**: (`text`, `options?`) => `string` \| `number` & `object`

Defined in: [src/components/ui/Toast.tsx:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/ui/Toast.tsx#L29)

#### Type Declaration

##### clearQueue()

> **clearQueue**: () => `void`

###### Returns

`void`

##### dismiss()

> **dismiss**: (`id?`) => `string` \| `number`

###### Parameters

###### id?

`string` | `number`

###### Returns

`string` \| `number`

##### error()

> **error**: (`text`, `options?`) => `string` \| `number`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`string` \| `number`

##### hide()

> **hide**: (`id?`) => `string` \| `number`

###### Parameters

###### id?

`string` | `number`

###### Returns

`string` \| `number`

##### info()

> **info**: (`text`, `options?`) => `string` \| `number`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`string` \| `number`

##### message()

> **message**: (`text`, `options?`) => `string` \| `number`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`string` \| `number`

##### success()

> **success**: (`text`, `options?`) => `string` \| `number`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`string` \| `number`

##### warning()

> **warning**: (`text`, `options?`) => `string` \| `number`

###### Parameters

###### text

`string`

###### options?

###### duration?

`number`

###### Returns

`string` \| `number`

## Functions

### AppToaster()

> **AppToaster**(): `Element`

Defined in: [src/components/ui/Toast.tsx:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/ui/Toast.tsx#L7)

#### Returns

`Element`
