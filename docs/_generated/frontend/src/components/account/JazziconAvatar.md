[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/account/JazziconAvatar

# src/components/account/JazziconAvatar

## Functions

### JazziconAvatar()

> **JazziconAvatar**(`__namedParameters`): `Element`

Defined in: [src/components/account/JazziconAvatar.tsx:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/account/JazziconAvatar.tsx#L14)

Deterministic jazzicon avatar derived from an Ethereum address.

Uses `react-jazzicon` under the hood — the same library MetaMask uses
internally. Same address always produces the same icon across the
app so users learn to recognize their own address by the icon alone.

Size matches the surrounding avatar slot. Default 24px for the
header card; `size={48}` on the `/accounts` hero.

#### Parameters

##### \_\_namedParameters

###### address

`string` \| `null` \| `undefined`

###### className?

`string`

###### size?

`number` = `24`

#### Returns

`Element`
