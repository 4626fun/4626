[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/account/JazziconAvatar

# src/components/account/JazziconAvatar

## Functions

### JazziconAvatar()

> **JazziconAvatar**(`__namedParameters`): `Element`

Defined in: [src/components/account/JazziconAvatar.tsx:14](https://github.com/wenakita/4626/blob/main/frontend/src/components/account/JazziconAvatar.tsx#L14)

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
