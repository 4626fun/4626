[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/deploy/create2Salts

# src/lib/deploy/create2Salts

## Variables

### BURN\_STREAM\_SALT\_TAG

> `const` **BURN\_STREAM\_SALT\_TAG**: `"4626:VaultShareBurnStream"`

Defined in: [shared/deploy/create2Salts.ts:5](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/shared/deploy/create2Salts.ts#L5)

***

### CREATOR\_COIN\_POLICY\_CONTROLLER\_SALT\_TAG

> `const` **CREATOR\_COIN\_POLICY\_CONTROLLER\_SALT\_TAG**: `"4626:CreatorCoinPolicyController"`

Defined in: [shared/deploy/create2Salts.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/shared/deploy/create2Salts.ts#L6)

***

### PAYOUT\_ROUTER\_SALT\_TAG

> `const` **PAYOUT\_ROUTER\_SALT\_TAG**: `"4626:PayoutRouter"`

Defined in: [shared/deploy/create2Salts.ts:4](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/shared/deploy/create2Salts.ts#L4)

## Functions

### deriveCreatorCoinPolicyControllerSalt()

> **deriveCreatorCoinPolicyControllerSalt**(`params`): `` `0x${string}` ``

Defined in: [shared/deploy/create2Salts.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/shared/deploy/create2Salts.ts#L20)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### owner

`` `0x${string}` ``

#### Returns

`` `0x${string}` ``

***

### derivePayoutRouterSalt()

> **derivePayoutRouterSalt**(`params`): `` `0x${string}` ``

Defined in: [shared/deploy/create2Salts.ts:8](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/shared/deploy/create2Salts.ts#L8)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### owner

`` `0x${string}` ``

#### Returns

`` `0x${string}` ``

***

### deriveVaultShareBurnStreamSalt()

> **deriveVaultShareBurnStreamSalt**(`params`): `` `0x${string}` ``

Defined in: [shared/deploy/create2Salts.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/shared/deploy/create2Salts.ts#L14)

#### Parameters

##### params

###### creatorToken

`` `0x${string}` ``

###### owner

`` `0x${string}` ``

#### Returns

`` `0x${string}` ``
