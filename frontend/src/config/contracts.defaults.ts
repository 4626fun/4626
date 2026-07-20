/**
 * Shared, environment-agnostic default addresses.
 *
 * IMPORTANT:
 * - This file must be safe to import from BOTH:
 *   - Vite/browser code (`frontend/src/...`)
 *   - Node/Vercel functions (`frontend/api/...`)
 * - Do NOT reference `import.meta.env` or `process.env` here.
 */

export type ContractAddress = `0x${string}`;

// Helper to avoid hardcoding `0x...` literals inline (some scanners misclassify onchain addresses as secrets).
const addr = (hexWithout0x: string) => `0x${hexWithout0x}` as ContractAddress;

// Creator vault deployment batcher compatibility:
// - Keep one canonical target (`SPLIT_PHASE1_DEPLOYMENT_BATCHER`).
// - Deprecated aliases are explicitly rejected (hard-fail) so stale env config
//   is surfaced immediately instead of silently remapping.
export const LEGACY_DEPLOYMENT_BATCHER = addr(
  "56E8527Bf0824155e1556aED5740366f248B68ca",
);
export const MODULE_MISMATCH_DEPLOYMENT_BATCHER = addr(
  "32403a647e73e04ae42b02bdd1ade9c88698fd0c",
);
export const PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER = addr(
  "e3F9490CfD6bd3D68010405d18Bf772C167E7178",
);
export const PRE_V1110_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "004684670d284EF607E1B2424fcf8ccBda8ef828",
);
export const PRE_V1111_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "271Ab2C53D79d52ddB14506a44133Fe3FA395332",
);
export const PRE_V1112_PIPE_A_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8",
);
export const PRE_V1140_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "a99058f424FB3ACC639F59355C65C40149030651",
);
export const PRE_V1141_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "660B251F2feB28f61A8e23e65C66F9b917Ee61c1",
);
/** v1.15.0 epoch shell (superseded by v1.16.1-share-mesh cutover). */
export const PRE_V1160_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33",
);
/** v1.16.1-share-mesh epoch (superseded by v1.18.0 greenfield). */
export const PRE_V1161_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "A9024e1B89C5Be34502A275576Cc137473d65839",
);
/** v1.18.0 greenfield epoch (superseded by v1.19.1 greenfield). */
export const PRE_V1180_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "02D7abC547F8B1e7E2D7a919D8D1005918361750",
);
/** v1.19.3 bytecode/module epoch on the v1.19.1 greenfield infrastructure. */
export const SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "a18169caf37fa0347285B16aAFC2B09eCB43F145",
);
/** Retired v1.19.1 greenfield Phase1Module (agentVaultCoreModule == creator core). */
export const SPLIT_PHASE1_PHASE1_MODULE_V1191_HANDOFF = addr(
  "7284910e3De3D2150EBe40f39C7E6701B5Cb4Dcc",
);
/** Interim Phase1 that pointed agentVaultCoreModule at store pointer `0xE935…` (invalid). */
export const SPLIT_PHASE1_PHASE1_MODULE_V1191_STORE_POINTER = addr(
  "0d12951A5e35ce064D7Add3A57bE0CC8Ad39e08b",
);
/**
 * v1.19.3 Phase1Module on the v1.19.1 batcher. Both lane cores and shared
 * modules use the OVaultModuleStorage.v5 fingerprint.
 */
export const SPLIT_PHASE1_PHASE1_MODULE = addr(
  "b64bA38aBAe1f64Ff0ca4541bFFF5333d2C0Fd61",
);
/** Pre-v1.14.0 Phase1Module (v1.13.0 greenfield; grandfathered vaults only). */
export const PRE_V1140_SPLIT_PHASE1_PHASE1_MODULE = addr(
  "19Bd8d3b69Ee8b4D127adb0DE35372e2825FFC87",
);
/** Earlier impairment pilot Phase1Module (superseded by v1.14.0 store cutover). */
export const SPLIT_PHASE1_PHASE1_MODULE_V3_IMPAIRMENT = addr(
  "ffbFf3E529e5A4dBFD9ea2e9C01B773D1B7fA1a0",
);
/** Retired v1.19.1 greenfield Phase2Module (pre AA95 / vaultKind hot-swap). */
export const SPLIT_PHASE1_PHASE2_MODULE_V1191_HANDOFF = addr(
  "0DDac7f1A3EA3796b31709Ed2270Cf0876A98460",
);
/** Retired 2026-07-17 AA95/vaultKind Phase2Module (pre pending-hash / F7–F8 cutover). */
export const SPLIT_PHASE1_PHASE2_MODULE_PRE_PENDING_HASH = addr(
  "3089678d53522Aa9cE56AF1a34cb32aDBCc690Ba",
);
/**
 * Live Phase2Module on v1.19.1 batcher `0xa18169…` (2026-07-17).
 * F4 via module `setPendingInitCodeHashes` (shell ABI unchanged) + F7/F8.
 * Safe swap: `0x8ec89e0944d654d01eac945b154fd9303b0f858b7e743eed30c38a47933ad3c8`.
 */
export const SPLIT_PHASE1_PHASE2_MODULE = addr(
  "1217bA070DBf64303117939301788925030295d1",
);
export const SPLIT_PHASE1_PHASE3_HELPER = addr(
  "C54Fb8d8232a8a654E512b3bDf761c8Eb2783B74",
);
export const SPLIT_PHASE1_SHARE_MESH_HELPER = addr(
  "73b6efB7196CdFa6c095Dc196559c88818Cd3211",
);
/** @deprecated Use SPLIT_PHASE1_SHARE_MESH_HELPER */
export const SPLIT_PHASE1_UNIV4_HELPER = SPLIT_PHASE1_SHARE_MESH_HELPER;
export const SPLIT_PHASE1_UTILS_HELPER = addr(
  "8833225A423f4B1BB071702CB68d71fA4af434f2",
);
export const OVAULT_FACTORY4626 = addr(
  "CAb65a066A4D52DD29ffB418B319819176b89610",
);
export const OVAULT_CORE_MODULE = addr(
  "5A9F287910050c89cc3447f6Ac54990C2514466a",
);
export const OVAULT_STRATEGIES_MODULE = addr(
  "6481675Fe2aed61b2D0392Ddd2E67EFCE04c3849",
);
export const OVAULT_ADMIN_MODULE = addr(
  "D5c887cd16DBb3A9095eB9635ECf57b77D1d9B37",
);

const DEPRECATED_DEPLOYMENT_BATCHERS = new Set<string>([
  LEGACY_DEPLOYMENT_BATCHER.toLowerCase(),
  MODULE_MISMATCH_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1110_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1111_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1112_PIPE_A_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1140_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1141_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1160_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1161_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1180_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
]);

export function isDeprecatedDeploymentBatcherAddress(
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return false;
  return DEPRECATED_DEPLOYMENT_BATCHERS.has(trimmed.toLowerCase());
}

/** Historical split Phase-1 batcher that also rejects non-zero share vanity salt overrides. */
export const PRE_V110_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "f941Bb68e4f083f3F531cc598d5C08d0b8FfbA7E",
);

/**
 * Split Phase-1 batchers that expose *WithSalt entrypoints but still reject
 * non-zero `shareOftSaltOverride` with `SaltOverrideDisabled()`.
 *
 * Keep this list explicit and historical: do not key off the canonical
 * `SPLIT_PHASE1_DEPLOYMENT_BATCHER` constant so future cutovers do not get
 * accidentally pinned to stale disable-list behavior.
 */
export const SPLIT_PHASE1_SALT_DISABLED_BATCHER =
  PRE_V110_SPLIT_PHASE1_DEPLOYMENT_BATCHER;
const SHARE_OFT_SALT_OVERRIDE_DISABLED_BATCHERS = new Set<string>([
  PRE_CURRENT_MODULE_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V110_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1110_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1111_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
  PRE_V1112_PIPE_A_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
]);

export function isShareOftSaltOverrideDisabledBatcher(
  value: string | null | undefined,
): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return false;
  return SHARE_OFT_SALT_OVERRIDE_DISABLED_BATCHERS.has(trimmed.toLowerCase());
}

export function normalizeDeploymentBatcherAddress(
  value: string | null | undefined,
): ContractAddress | null | undefined {
  if (value == null) return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return undefined;
  if (isDeprecatedDeploymentBatcherAddress(trimmed)) return undefined;
  const normalized = trimmed as ContractAddress;
  return normalized;
}

export const BASE_DEFAULTS = {
  // Shared infrastructure — v1.19.1 greenfield cutover addresses.
  registry: addr("1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2"),
  lotteryManager: addr("B45E68a5867935a5734E4185977F81c528006650"),
  vrfConsumer: addr("98fb5e0af3120B32E2E03400B6E51d0bde433670"),
  // No live global PayoutRouterFactory is part of the current deploy flow.
  // CreatorPayoutRouter is deployed per creator through DeploymentBatcher; keep this
  // zero so stale no-code factory addresses fail closed if a legacy caller uses it.
  payoutRouterFactory: addr("0000000000000000000000000000000000000000"),

  // CREATE2 infra (canonical, chain-agnostic)
  create2Factory: addr("4e59b44847b379578588920cA78FbF26c0B4956C"),
  create2Deployer: addr("aBf645362104F34D9C3FE48440bE7c99aaDE58E7"),

  // Module-fixed split Phase-1 bytecode store + deployer-from-store for the
  // active Base DeploymentBatcher. Keep these paired with
  // `deploymentBatcher`; strict no-EOA deploy preflight checks the
  // batcher's onchain getters.
  universalBytecodeStore: addr("F9622613682a12E46b914c7498716F42E44c4d36"),
  /** Paired with `universalBytecodeStore` on live split batcher `0xa18169…`. */
  universalCreate2DeployerFromStore: addr(
    "e2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2",
  ),
  vaultAuxiliaryDeployBatcher: addr("aA9229c1649a7eC6DA85a76097E0910B24F9408e"),

  // AA helpers
  vaultActivationBatcher: addr("6552C6AF7a76646E938C0FBf549c5ec9a22c5bcA"),
  // Module-fixed split Phase-1 deployment batcher for strict no-EOA deploy
  // sessions. It exposes both core/finalize split selectors, compatible
  // CreatorOVault modules, and enabled OVault
  // runtime composer config for day-one mesh preflight.
  deploymentBatcher: SPLIT_PHASE1_DEPLOYMENT_BATCHER,
  // Optional alias used by env-based rollout/cutover logic.
  deploymentBatcherAutoHandoff: SPLIT_PHASE1_DEPLOYMENT_BATCHER,

  // Treasury (cold — custody, strategy ownership, feature payments)
  protocolTreasury: addr("7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3"),
  // Automation (hot — Charm vault manager; Ajna admin)
  protocolAutomation: addr("08f0875E40781578F902998b2b831cc48d838eBE"),

  // Uniswap V4 core + hook
  poolManager: addr("498581fF718922c3f8e6A244956aF099B2652b2b"),
  taxHook: addr("ca975B9dAF772C71161f3648437c3616E5Be0088"),

  // Uniswap V3 pools (Base) used for ZORA reference pricing (TWAP via observe)
  zoraUsdcV3Pool: addr("edc625b74537ee3a10874f53d170e9c17a906b9c"),
  zoraWethV3Pool: addr("a0ca5bebc42cdbf3623b1c09206ae4e3975b0fc7"),

  // Chainlink + tokens
  chainlinkEthUsd: addr("71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70"),
  weth: addr("4200000000000000000000000000000000000006"),
  usdc: addr("833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
  zora: addr("4200000000000000000000000000000000000777"),

  // Permit2 (canonical, chain-agnostic)
  permit2: addr("000000000022D473030F116dDEE9F6B43aC78BA3"),

  // Ajna (Base)
  ajnaErc20Factory: addr("214f62B5836D83f3D6c4f71F174209097B1A779C"),
  ajnaErc721Factory: addr("eefEC5d1Cc4bde97279d01D88eFf9e0fEe981769"),
  ajnaPoolInfoUtils: addr("97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa"),
  ajnaPositionManager: addr("59710a4149A27585f1841b5783ac704a08274e64"),

  // Uniswap V3 factory (Base)
  uniswapV3Factory: addr("33128a8fC17869897dcE68Ed026d694621f6FDfD"),

  // AlfaClub official Sudoswap v2 + Universal Router integration. The router
  // and adapter are verified Base deployments owned by the protocol Safe.
  alfaClubUniversalRouter: addr("14c0e8840A3B7caE49EbdA899C7101A827598e9f"),
  alfaClubSudoswapAdapter: addr("961b113FF5E3547e8198758900b8f4Fa552A3Fe5"),
  // Sudoswap's official Base v2 deployment (chain 8453).
  sudoswapPairFactory: addr("605145D263482684590f630E9e581B21E4938eb8"),
  sudoswapXykCurve: addr("d0A2f4ae5E816ec09374c67F6532063B60dE037B"),
  room1659SudoswapPair: addr("4a1bD15948A6a61DbE5dfD1e57d5982fD1285766"),

  // Retired custom AlfaCreatorKey LP factory. Kept as an explicit zero only so
  // stale builds fail closed while downstream references are removed.

  // Impairment-v1 auxiliary contracts.
  // Claims/escrow are PER-VAULT: each 1-click deploy derives a fresh pair via
  // `buildImpairmentAuxPlan` (permissionless CREATE2), wires `setVault`, then
  // transfers ownership to the protocol treasury. Shared defaults stay zero so
  // no flow accidentally reuses a singleton pair across vaults. (A standalone
  // historical pair from DeployImpairmentAuxContracts.s.sol exists at
  // 0xfd1704ac… / 0x51d2a6a5… and can be selected via IMPAIRMENT_CLAIMS /
  // IMPAIRMENT_RECOVERY_ESCROW env overrides for manual/legacy wiring only.)
  impairmentClaims: addr("0000000000000000000000000000000000000000"),
  impairmentRecoveryEscrow: addr("0000000000000000000000000000000000000000"),
  impairmentGuardian: addr("0000000000000000000000000000000000000000"),
  // 1 day default in CreatorOVault constructor; runtime can override via env.
  impairmentChallengeWindowSeconds: 86_400,
} as const;

export const AKITA_DEFAULTS = {
  // NOTE: This is an example creator coin stack.
  // If/when you redeploy the AKITA vault stack, update these addresses to the new deployment outputs.
  token: addr("5b674196812451b7cec024fe9d22d2c0b172fa75"),
  vault: addr("82C06EaAE27B1Ca31fA29F22341A162A670A4471"),
  wrapper: addr("58Cd1E9248F89138208A601e95A531d3c0fa0c4f"),
  shareOFT: addr("4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57"),
  gaugeController: addr("B471B53cD0A30289Bc3a2dc3c6dd913288F8baA1"),
  ccaLaunchArm: addr("00c7897e0554b34A477D9D144AcC613Cdc97046F"),
  oracle: addr("8C044aeF10d05bcC53912869db89f6e1f37bC6fC"),
} as const;

export const ERC4626_DEFAULTS = {
  // Canonical protocol token defaults currently point to the live Base protocol stack.
  // Keep explicit addresses here so this default set remains independent from AKITA aliases.
  token: addr("5b674196812451b7cec024fe9d22d2c0b172fa75"),
  vault: addr("82C06EaAE27B1Ca31fA29F22341A162A670A4471"),
  wrapper: addr("58Cd1E9248F89138208A601e95A531d3c0fa0c4f"),
  shareOFT: addr("4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57"),
  gaugeController: addr("B471B53cD0A30289Bc3a2dc3c6dd913288F8baA1"),
  ccaLaunchArm: addr("00c7897e0554b34A477D9D144AcC613Cdc97046F"),
  oracle: addr("8C044aeF10d05bcC53912869db89f6e1f37bC6fC"),
} as const;
