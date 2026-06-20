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

// Creator vault deployment batcher compatibility:
// - Keep one canonical target (`SPLIT_PHASE1_DEPLOYMENT_BATCHER`).
// - Deprecated aliases are explicitly rejected (hard-fail) so stale env config
//   is surfaced immediately instead of silently remapping.
export const LEGACY_DEPLOYMENT_BATCHER = addr('56E8527Bf0824155e1556aED5740366f248B68ca')
export const MODULE_MISMATCH_DEPLOYMENT_BATCHER = addr('32403a647e73e04ae42b02bdd1ade9c88698fd0c')
export const PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER = addr('e3F9490CfD6bd3D68010405d18Bf772C167E7178')
export const PRE_V1110_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('004684670d284EF607E1B2424fcf8ccBda8ef828')
export const PRE_V1111_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('271Ab2C53D79d52ddB14506a44133Fe3FA395332')
export const PRE_V1112_PIPE_A_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8')
export const PRE_V1140_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('a99058f424FB3ACC639F59355C65C40149030651')
/** v1.14.1 epoch: fresh split shell + post-deploy helper wiring + payable finalize / ShareOFT peer. */
export const SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('660B251F2feB28f61A8e23e65C66F9b917Ee61c1')
/** v1.14.1 greenfield target: v3 impairment modules + store-aligned create2 deployer. */
export const SPLIT_PHASE1_PHASE1_MODULE = addr('0fac3F8040879eF1ca6cc4572cc27f0908a8f266')
/** Retired v1.13.0 v2 Phase1Module (grandfathered greenfield only). */
export const SPLIT_PHASE1_PHASE1_MODULE_V2_LEGACY = addr('19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87')
/** Earlier impairment pilot Phase1Module (superseded by v1.14.0 store cutover). */
export const SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT = addr('ffbFf3E529e5A4dBFD9ea2e9C01B773D1B7fA1a0')
export const SPLIT_PHASE1_PHASE2_MODULE = addr('de192645Fb02dD05f586930e55D709E89c320435')
export const SPLIT_PHASE1_PHASE3_HELPER = addr('E0971a924E33251556fE73a4025166701b772dBe')
export const SPLIT_PHASE1_UNIV4_HELPER = addr('D2c68F175FB4DB4069A2ebBc3f02B31C635438eb')
export const SPLIT_PHASE1_UTILS_HELPER = addr('E41231e399511baaDa8844C9D1c83C096e3f2E60')
export const CREATOR_OVAULT_FACTORY = addr('f4a4d70D9fB3b29c56eB2aaE264FBd3DF9221A6a')
export const CREATOR_OVAULT_CORE_MODULE = addr('D4553478780571A1A5F6cCCC0735F897F15a85Cf')
export const CREATOR_OVAULT_STRATEGIES_MODULE = addr('4036e3D2d029451cEB68d521a5D0233F56518681')
export const CREATOR_OVAULT_ADMIN_MODULE = addr('Dd136c20F8f6688089e55a6CA8709718c5183307')

const DEPRECATED_CREATOR_VAULT_BATCHERS = new Set<string>([
  LEGACY_DEPLOYMENT_BATCHER.toLowerCase(),
  MODULE_MISMATCH_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1110_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1111_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1112_PIPE_A_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1140_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
])

export function isDeprecatedCreatorVaultBatcherAddress(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return false
  return DEPRECATED_CREATOR_VAULT_BATCHERS.has(trimmed.toLowerCase())
}

/** Historical split Phase-1 batcher that also rejects non-zero share vanity salt overrides. */
export const PRE_V110_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr('f941Bb68e4f083f3F531cc598d5C08d0b8FfbA7E')

/**
 * Split Phase-1 batchers that expose *WithSalt entrypoints but still reject
 * non-zero `shareOftSaltOverride` with `SaltOverrideDisabled()`.
 *
 * Keep this list explicit and historical: do not key off the canonical
 * `SPLIT_PHASE1_DEPLOYMENT_BATCHER` constant so future cutovers do not get
 * accidentally pinned to stale disable-list behavior.
 */
export const SPLIT_PHASE1_SALT_DISABLED_BATCHER = PRE_V110_SPLIT_PHASE1_DEPLOYMENT_BATCHER
const SHARE_OFT_SALT_OVERRIDE_DISABLED_BATCHERS = new Set<string>([
  PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V110_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1110_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1111_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1112_PIPE_A_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
])

export function isShareOftSaltOverrideDisabledBatcher(value: string | null | undefined): boolean {
  if (value == null) return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return false
  return SHARE_OFT_SALT_OVERRIDE_DISABLED_BATCHERS.has(trimmed.toLowerCase())
}

export function normalizeCreatorVaultBatcherAddress(
  value: string | null | undefined,
): ContractAddress | null | undefined {
  if (value == null) return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return undefined
  if (isDeprecatedCreatorVaultBatcherAddress(trimmed)) return undefined
  const normalized = trimmed as ContractAddress
  return normalized
}

export const BASE_DEFAULTS = {
  // Shared infrastructure
  // v1.14.1 protocol cutover addresses.
  registry: addr('DD7B106a15540bA2F59464590222bF47D8C9394E'),
  lotteryManager: addr('29F901864D65Eb848BC548ebCEAcD6dAD39EFd26'),
  vrfConsumer: addr('86B605400DBb67cc4756493c7791422184e4dC59'),
  // No live global PayoutRouterFactory is part of the current deploy flow.
  // PayoutRouter is deployed per creator through DeploymentBatcher; keep this
  // zero so stale no-code factory addresses fail closed if a legacy caller uses it.
  payoutRouterFactory: addr('0000000000000000000000000000000000000000'),

  // Base↔Solana bridge integration for current v1.14.1 target stack.
  solanaBridgeAdapter: addr('8e99bb0270bbdf2d64ff6854509CD2410A28fBae'),

  // CREATE2 infra (canonical, chain-agnostic)
  create2Factory: addr('4e59b44847b379578588920cA78FbF26c0B4956C'),
  create2Deployer: addr('aBf645362104F34D9C3FE48440bE7c99aaDE58E7'),

  // Module-fixed split Phase-1 bytecode store + deployer-from-store for the
  // active Base DeploymentBatcher. Keep these paired with
  // `creatorVaultBatcher`; strict no-EOA deploy preflight checks the
  // batcher's onchain getters.
  universalBytecodeStore: addr('b3712E84F123e7C5390913E30FC6BBD5AEd2a314'),
  /** Paired with `universalBytecodeStore` on live split batcher `0x660B25…`. */
  universalCreate2DeployerFromStore: addr('2fA570Cb17925Da86b303D4651f06b83057a10c4'),
  vaultAuxiliaryDeployBatcher: addr('a3986F2F812a80a4Ee4A33646bE5248D9e22eb88'),

  // AA helpers
  vaultActivationBatcher: addr('5EaFfa41f07a1aAf6ecd38833fd128C53fD8669A'),
  // Module-fixed split Phase-1 deployment batcher for strict no-EOA deploy
  // sessions. It exposes both core/finalize split selectors, Base↔Solana
  // bridge routing, compatible CreatorOVault modules, and enabled OVault
  // runtime composer config for day-one mesh preflight.
  creatorVaultBatcher: SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  // Optional alias used by env-based rollout/cutover logic.
  creatorVaultBatcherAutoHandoff: SPLIT_PHASE1_DEPLOYMENT_BATCHER,

  // Treasury (cold — custody, strategy ownership, feature payments)
  protocolTreasury: addr('7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3'),
  // Automation (hot — Charm vault manager; set PROTOCOL_AUTOMATION_SAFE after Safe deploy)
  protocolAutomation: addr('0000000000000000000000000000000000000000'),

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
  // Deploy script: `alfaclub/contracts/script/DeployAlfaCreatorKeyLPFactory.s.sol`.
  // Per-environment override at runtime: `VITE_ALFA_CREATOR_KEY_LP_FACTORY`.
  // For Base Sepolia we rely on the env override; the default stays zero so
  // an unconfigured environment fails loudly at the consumer rather than
  // routing writes to a stale or wrong address.
  alfaCreatorKeyLpFactory: addr('0000000000000000000000000000000000000000'),

  // Impairment-v1 auxiliary contracts.
  // Claims/escrow are PER-VAULT: each 1-click deploy derives a fresh pair via
  // `buildImpairmentAuxPlan` (permissionless CREATE2), wires `setVault`, then
  // transfers ownership to the protocol treasury. Shared defaults stay zero so
  // no flow accidentally reuses a singleton pair across vaults. (A standalone
  // historical pair from DeployImpairmentAuxContracts.s.sol exists at
  // 0xfd1704ac… / 0x51d2a6a5… and can be selected via IMPAIRMENT_CLAIMS /
  // IMPAIRMENT_RECOVERY_ESCROW env overrides for manual/legacy wiring only.)
  impairmentClaims: addr('0000000000000000000000000000000000000000'),
  impairmentRecoveryEscrow: addr('0000000000000000000000000000000000000000'),
  impairmentGuardian: addr('0000000000000000000000000000000000000000'),
  // 1 day default in CreatorOVault constructor; runtime can override via env.
  impairmentChallengeWindowSeconds: 86_400,
} as const

export const AKITA_DEFAULTS = {
  // NOTE: This is an example creator coin stack.
  // If/when you redeploy the AKITA vault stack, update these addresses to the new deployment outputs.
  token: addr('5b674196812451b7cec024fe9d22d2c0b172fa75'),
  vault: addr('82C06EaAE27B1Ca31fA29F22341A162A670A4471'),
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
  vault: addr('82C06EaAE27B1Ca31fA29F22341A162A670A4471'),
  wrapper: addr('58Cd1E9248F89138208A601e95A531d3c0fa0c4f'),
  shareOFT: addr('4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57'),
  gaugeController: addr('B471B53cD0A30289Bc3a2dc3c6dd913288F8baA1'),
  ccaStrategy: addr('00c7897e0554b34A477D9D144AcC613Cdc97046F'),
  oracle: addr('8C044aeF10d05bcC53912869db89f6e1f37bC6fC'),
} as const
