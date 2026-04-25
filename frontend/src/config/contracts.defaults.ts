/**
 * Shared, environment-agnostic default addresses.
 *
 * IMPORTANT:
 * - This file must be safe to import from BOTH:
 *   - Vite/browser code (`frontend/src/...`)
 *   - Node/Vercel functions (`frontend/api/...`)
 * - Do NOT reference `import.meta.env` or `process.env` here.
 */

export type ContractAddress = `0x${string}`

// Helper to avoid hardcoding `0x...` literals inline (some scanners misclassify onchain addresses as secrets).
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as ContractAddress

export const BASE_DEFAULTS = {
  // Shared infrastructure
  // Shared resources (registry / lottery / VRF / payout factory) carry over
  // from the v1.8.3 broadcast (2026-04-11); they were not re-deployed in v1.9.2.
  registry: addr('9D86e8FAfA39527c4FE13AAa8FBD2B424f9f65Fb'),
  lotteryManager: addr('d593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357'),
  vrfConsumer: addr('dd25Ed1b3D258Ccc6D306a9a325Af1A7F96C7F47'),
  payoutRouterFactory: addr('9C53cEaA15AdDB436c89A1F929fF12ED2BD26ea9'),

  // Base↔Solana bridge integration.
  // v2 adapter deployed 2026-04-19 (tx 0xfe49c9e2...fd5e). Maps creator coins to
  // lowercase-parity Solana bridge mints (e.g. AKITA -> "akita"/"akita" at
  // 9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp). Supersedes v1 at
  // 0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00, which carried a one-off
  // "ZORA"/"Zora Creator Coin" mapping for AKITA from the pre-strict-parity era.
  solanaBridgeAdapter: addr('653326dD0145656eC3b598943C0E84d7405aE6Ae'),

  // CREATE2 infra (canonical, chain-agnostic)
  create2Factory: addr('4e59b44847b379578588920cA78FbF26c0B4956C'),
  create2Deployer: addr('aBf645362104F34D9C3FE48440bE7c99aaDE58E7'),

  // Module-fixed split Phase-1 bytecode store + deployer-from-store for the
  // active Base DeploymentBatcher. Keep these paired with
  // `creatorVaultBatcher`; strict no-EOA deploy preflight checks the
  // batcher's onchain getters.
  universalBytecodeStore: addr('6925d601cf618AFB9F55099C0FF3d30769a5e141'),
  universalCreate2DeployerFromStore: addr('02feAFb12fDF2c0Ef65dA3038584Dd4EA3b1E2A9'),

  // AA helpers
  vaultActivationBatcher: addr('7Cc0050842433968cc7A0884d192b61FD0b46F63'),
  // Module-fixed split Phase-1 deployment batcher for strict no-EOA deploy
  // sessions. It exposes both core/finalize split selectors, Base↔Solana
  // bridge routing, compatible CreatorOVault modules, and enabled OVault
  // runtime composer config for day-one mesh preflight.
  creatorVaultBatcher: addr('e3F9490CfD6bd3D68010405d18Bf772C167E7178'),
  // Optional alias used by env-based rollout/cutover logic.
  creatorVaultBatcherAutoHandoff: addr('e3F9490CfD6bd3D68010405d18Bf772C167E7178'),

  // Treasury
  protocolTreasury: addr('7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3'),

  // Uniswap V4 core + hook
  poolManager: addr('498581fF718922c3f8e6A244956aF099B2652b2b'),
  taxHook: addr('ca975B9dAF772C71161f3648437c3616E5Be0088'),

  // Uniswap V3 pools (Base) used for ZORA reference pricing (TWAP via observe)
  zoraUsdcV3Pool: addr('edc625b74537ee3a10874f53d170e9c17a906b9c'),
  zoraWethV3Pool: addr('a0ca5bebc42cdbf3623b1c09206ae4e3975b0fc7'),

  // Chainlink + tokens
  chainlinkEthUsd: addr('71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70'),
  weth: addr('4200000000000000000000000000000000000006'),
  usdc: addr('833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
  zora: addr('4200000000000000000000000000000000000777'),

  // Permit2 (canonical, chain-agnostic)
  permit2: addr('000000000022D473030F116dDEE9F6B43aC78BA3'),

  // Ajna (Base)
  ajnaErc20Factory: addr('214f62B5836D83f3D6c4f71F174209097B1A779C'),
  ajnaErc721Factory: addr('eefEC5d1Cc4bde97279d01D88eFf9e0fEe981769'),
  ajnaPoolInfoUtils: addr('97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa'),
  ajnaPositionManager: addr('59710a4149A27585f1841b5783ac704a08274e64'),

  // Uniswap V3 factory (Base)
  uniswapV3Factory: addr('33128a8fC17869897dcE68Ed026d694621f6FDfD'),

  // 4626 AlfaClub secondary-market LP factory. Zero until deployed.
  alfaCreatorKeyLpFactory: addr('0000000000000000000000000000000000000000'),
} as const

export const AKITA_DEFAULTS = {
  // NOTE: This is an example creator coin stack.
  // If/when you redeploy the AKITA vault stack, update these addresses to the new deployment outputs.
  token: addr('5b674196812451b7cec024fe9d22d2c0b172fa75'),
  vault: addr('A015954E2606d08967Aee3787456bB3A86a46A42'),
  wrapper: addr('58Cd1E9248F89138208A601e95A531d3c0fa0c4f'),
  shareOFT: addr('4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57'),
  gaugeController: addr('B471B53cD0A30289Bc3a2dc3c6dd913288F8baA1'),
  ccaStrategy: addr('00c7897e0554b34A477D9D144AcC613Cdc97046F'),
  oracle: addr('8C044aeF10d05bcC53912869db89f6e1f37bC6fC'),
} as const

export const ERC4626_DEFAULTS = {
  // Canonical protocol token defaults currently point to the live Base protocol stack.
  // Keep explicit addresses here so this default set remains independent from AKITA aliases.
  token: addr('5b674196812451b7cec024fe9d22d2c0b172fa75'),
  vault: addr('A015954E2606d08967Aee3787456bB3A86a46A42'),
  wrapper: addr('58Cd1E9248F89138208A601e95A531d3c0fa0c4f'),
  shareOFT: addr('4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57'),
  gaugeController: addr('B471B53cD0A30289Bc3a2dc3c6dd913288F8baA1'),
  ccaStrategy: addr('00c7897e0554b34A477D9D144AcC613Cdc97046F'),
  oracle: addr('8C044aeF10d05bcC53912869db89f6e1f37bC6fC'),
} as const
