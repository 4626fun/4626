[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/config/contracts.defaults

# src/config/contracts.defaults

## Type Aliases

### ContractAddress

> **ContractAddress** = `` `0x${string}` ``

Defined in: [src/config/contracts.defaults.ts:11](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/config/contracts.defaults.ts#L11)

Shared, environment-agnostic default addresses.

IMPORTANT:
- This file must be safe to import from BOTH:
  - Vite/browser code (`frontend/src/...`)
  - Node/Vercel functions (`frontend/api/...`)
- Do NOT reference `import.meta.env` or `process.env` here.

## Variables

### AKITA\_DEFAULTS

> `const` **AKITA\_DEFAULTS**: `object`

Defined in: [src/config/contracts.defaults.ts:71](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/config/contracts.defaults.ts#L71)

#### Type Declaration

##### ccaStrategy

> `readonly` **ccaStrategy**: `` `0x${string}` ``

##### gaugeController

> `readonly` **gaugeController**: `` `0x${string}` ``

##### oracle

> `readonly` **oracle**: `` `0x${string}` ``

##### shareOFT

> `readonly` **shareOFT**: `` `0x${string}` ``

##### token

> `readonly` **token**: `` `0x${string}` ``

##### vault

> `readonly` **vault**: `` `0x${string}` ``

##### wrapper

> `readonly` **wrapper**: `` `0x${string}` ``

***

### BASE\_DEFAULTS

> `const` **BASE\_DEFAULTS**: `object`

Defined in: [src/config/contracts.defaults.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/config/contracts.defaults.ts#L16)

#### Type Declaration

##### ajnaErc20Factory

> `readonly` **ajnaErc20Factory**: `` `0x${string}` ``

##### ajnaErc721Factory

> `readonly` **ajnaErc721Factory**: `` `0x${string}` ``

##### ajnaPoolInfoUtils

> `readonly` **ajnaPoolInfoUtils**: `` `0x${string}` ``

##### ajnaPositionManager

> `readonly` **ajnaPositionManager**: `` `0x${string}` ``

##### chainlinkEthUsd

> `readonly` **chainlinkEthUsd**: `` `0x${string}` ``

##### create2Deployer

> `readonly` **create2Deployer**: `` `0x${string}` ``

##### create2Factory

> `readonly` **create2Factory**: `` `0x${string}` ``

##### creatorVaultBatcher

> `readonly` **creatorVaultBatcher**: `` `0x${string}` ``

##### creatorVaultBatcherAutoHandoff

> `readonly` **creatorVaultBatcherAutoHandoff**: `` `0x${string}` ``

##### lotteryManager

> `readonly` **lotteryManager**: `` `0x${string}` ``

##### payoutRouterFactory

> `readonly` **payoutRouterFactory**: `` `0x${string}` ``

##### permit2

> `readonly` **permit2**: `` `0x${string}` ``

##### poolManager

> `readonly` **poolManager**: `` `0x${string}` ``

##### protocolTreasury

> `readonly` **protocolTreasury**: `` `0x${string}` ``

##### registry

> `readonly` **registry**: `` `0x${string}` ``

##### solanaBridgeAdapter

> `readonly` **solanaBridgeAdapter**: `` `0x${string}` ``

##### taxHook

> `readonly` **taxHook**: `` `0x${string}` ``

##### uniswapV3Factory

> `readonly` **uniswapV3Factory**: `` `0x${string}` ``

##### universalBytecodeStore

> `readonly` **universalBytecodeStore**: `` `0x${string}` ``

##### universalCreate2DeployerFromStore

> `readonly` **universalCreate2DeployerFromStore**: `` `0x${string}` ``

##### usdc

> `readonly` **usdc**: `` `0x${string}` ``

##### vaultActivationBatcher

> `readonly` **vaultActivationBatcher**: `` `0x${string}` ``

##### vrfConsumer

> `readonly` **vrfConsumer**: `` `0x${string}` ``

##### weth

> `readonly` **weth**: `` `0x${string}` ``

##### zora

> `readonly` **zora**: `` `0x${string}` ``

##### zoraUsdcV3Pool

> `readonly` **zoraUsdcV3Pool**: `` `0x${string}` ``

##### zoraWethV3Pool

> `readonly` **zoraWethV3Pool**: `` `0x${string}` ``

***

### ERC4626\_DEFAULTS

> `const` **ERC4626\_DEFAULTS**: `object`

Defined in: [src/config/contracts.defaults.ts:83](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/config/contracts.defaults.ts#L83)

#### Type Declaration

##### ccaStrategy

> `readonly` **ccaStrategy**: `` `0x${string}` ``

##### gaugeController

> `readonly` **gaugeController**: `` `0x${string}` ``

##### oracle

> `readonly` **oracle**: `` `0x${string}` ``

##### shareOFT

> `readonly` **shareOFT**: `` `0x${string}` ``

##### token

> `readonly` **token**: `` `0x${string}` ``

##### vault

> `readonly` **vault**: `` `0x${string}` ``

##### wrapper

> `readonly` **wrapper**: `` `0x${string}` ``
