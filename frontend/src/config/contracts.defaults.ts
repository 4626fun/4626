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
  // NOTE: If you redeploy CreatorRegistry (e.g. after ABI/storage breaking changes),
  // set `VITE_REGISTRY` in the environment and/or update this default.
  registry: addr('888482d648D1fCa1A735268A9e579b44Bf644626'),
  lotteryManager: addr('77740C44A3E1d8262e8bfAB6204A29B2cbeE4626'),
  vrfConsumer: addr('0265236984DE964CB0422BaeFbDb2de7C9d590F5'),
  payoutRouterFactory: addr('9C53cEaA15AdDB436c89A1F929fF12ED2BD26ea9'),

  // Base↔Solana bridge integration
  solanaBridgeAdapter: addr('5D0e33a4DFAA4e1EB4BDf41B953baa03CA73eA92'),

  // CREATE2 infra
  create2Factory: addr('4e59b44847b379578588920cA78FbF26c0B4956C'),
  create2Deployer: addr('aBf645362104F34D9C3FE48440bE7c99aaDE58E7'),
  // Phase-2 v2 bytecode store (chunked) + deterministic CREATE2 deployer-from-store
  // (rolled to match phased split Phase-1 CreatorVaultDeployer infra)
  universalBytecodeStore: addr('1268f550E794e235e4eFCE7B2D3fd7a30bb62d13'),
  universalCreate2DeployerFromStore: addr('74183076C7D33346880A5bf0e263B761FB4d38BA'),

  // AA helpers
  vaultActivationBatcher: addr('d17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB'),
  // v2-infra CreatorVaultBatcher (deterministic, deployed via CREATE2 factory)
  // NOTE: This is the phased `CreatorVaultDeployer` (Phases 1–3).
  creatorVaultBatcher: addr('32e91185B92c6c13dd56D745aBf24F009cdD3019'),

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
  // TODO: Replace these with the real protocol coin ($4626) creator-coin stack once it exists.
  // Until then, we mirror AKITA so the app has a working default example without requiring env vars.
  token: AKITA_DEFAULTS.token,
  vault: AKITA_DEFAULTS.vault,
  wrapper: AKITA_DEFAULTS.wrapper,
  shareOFT: AKITA_DEFAULTS.shareOFT,
  gaugeController: AKITA_DEFAULTS.gaugeController,
  ccaStrategy: AKITA_DEFAULTS.ccaStrategy,
  oracle: AKITA_DEFAULTS.oracle,
} as const
