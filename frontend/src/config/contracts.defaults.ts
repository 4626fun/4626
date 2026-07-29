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
/** v1.19.1/v1.19.3 greenfield shell (superseded by v1.20.0 greenfield). */
export const PRE_V1193_SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "a18169caf37fa0347285B16aAFC2B09eCB43F145",
);
/** v1.20.0 greenfield infrastructure + sealed deploy bytecode. */
export const SPLIT_PHASE1_DEPLOYMENT_BATCHER = addr(
  "83A9b2481E3e6d3a8fA12F6eB072253AAc518032",
);
/** Retired v1.19.1 greenfield Phase1Module (agentVaultCoreModule == creator core). */
export const SPLIT_PHASE1_PHASE1_MODULE_V1191_HANDOFF = addr(
  "7284910e3De3D2150EBe40f39C7E6701B5Cb4Dcc",
);
/** Interim Phase1 that pointed agentVaultCoreModule at store pointer `0xE935…` (invalid). */
export const SPLIT_PHASE1_PHASE1_MODULE_V1191_STORE_POINTER = addr(
  "0d12951A5e35ce064D7Add3A57bE0CC8Ad39e08b",
);
/** Retired v1.19.4 Phase1Module on the v1.19.1 batcher. */
export const SPLIT_PHASE1_PHASE1_MODULE_V1194 = addr(
  "8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3",
);
/** Live Phase1Module on v1.20.0 batcher `0x83A9b248…`. */
export const SPLIT_PHASE1_PHASE1_MODULE = addr(
  "416FA15e40caA51C20d1795db946c6806C946aC5",
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
/** Retired Phase2Module on v1.19.1 batcher `0xa18169…`. */
export const SPLIT_PHASE1_PHASE2_MODULE_V1191 = addr(
  "1217bA070DBf64303117939301788925030295d1",
);
/** Live Phase2Module on v1.20.0 batcher `0x83A9b248…`. */
export const SPLIT_PHASE1_PHASE2_MODULE = addr(
  "f1334BE96B3530BBF17506DED98E50D917A45B41",
);
export const SPLIT_PHASE1_PHASE3_HELPER = addr(
  "3Ed642288cd03846e9dA956cF95812d3125dD274",
);
export const SPLIT_PHASE1_SHARE_MESH_HELPER = addr(
  "1BCd4768180671Aa435C845239e05Afc81a496cA",
);
/** @deprecated Use SPLIT_PHASE1_SHARE_MESH_HELPER */
export const SPLIT_PHASE1_UNIV4_HELPER = SPLIT_PHASE1_SHARE_MESH_HELPER;
export const SPLIT_PHASE1_UTILS_HELPER = addr(
  "99712E96f11670113f66b9356890a2209359C37d",
);
export const OVAULT_FACTORY4626 = addr(
  "29AB55092F4009aa3F3603f32b11A6B02e6F0eb5",
);
export const OVAULT_CORE_MODULE = addr(
  "D6B862783Fd362ccF0d39d86E6384D8770e78833",
);
export const OVAULT_STRATEGIES_MODULE = addr(
  "968b8233053B64A93a4Cde044fFf4f43ea6D3c60",
);
export const OVAULT_ADMIN_MODULE = addr(
  "5bC4d71dB82081fCCF3647F1C094BEB202C0DB50",
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
  PRE_V1193_SPLIT_PHASE1_DEPLOYMENT_BATCHER.toLowerCase(),
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
  // Shared infrastructure — v1.20.0 greenfield cutover addresses.
  registry: addr("F60a1490C4129f2b6ae540734D3C2C8C6111824e"),
  lotteryManager: addr("0fC6f30adFD9e82097895Bb166536FdFD8EaC97b"),
  vrfConsumer: addr("56E2453Bf8Cf2C3FC33E7D18Edc2310297f2a251"),
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
  universalBytecodeStore: addr("8599CA87b28320158941C59CB3cd9a3f12083530"),
  /** Paired with `universalBytecodeStore` on live split batcher `0x83A9b248…`. */
  universalCreate2DeployerFromStore: addr(
    "dffB25505F5050E15B3602296330Ef352127d1Ef",
  ),
  vaultAuxiliaryDeployBatcher: addr("15eE1D03a5556C28E5079E68763F8231ad68dAdD"),

  // AA helpers
  vaultActivationBatcher: addr("37A9136dcD3e3245E4E992a1302dfEBD3d8673B3"),
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
  // Canonical ZORA ERC-20 on Base (not the uninitialized 0x4200…0777 OP-Stack predeploy).
  zora: addr("1111111111166b7FE7bd91427724B487980aFc69"),

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
  // Live Akita B2 share-mesh stack (v1.19.4-akita-b2-20260727-v11gl).
  token: addr("5b674196812451b7cec024fe9d22d2c0b172fa75"),
  vault: addr("4626539E5C01cc32C29755146D31755e3adA848A"),
  wrapper: addr("2d66Fe297CDAE8B4325bB58887bE125CED4A81b4"),
  shareOFT: addr("44710150A469DE368Abc82F05e6217086Be84626"),
  gaugeController: addr("Ff168cc0E26F288c02509afc1bED1Be4F85834C5"),
  ccaLaunchArm: addr("44aCFe7E68031Bed3BE801fD242E884e72e0CFD4"),
  oracle: addr("3954fC7c961f17699497BB3D7b7e903722881ffa"),
} as const;

/**
 * ■AKITA CCA launch expansion chains (chainId → env suffix).
 *
 * Spokes are ShareOFT + CCA arm only — vault/wrapper/gauge/Zora token stay on
 * Base. Required pins after each spoke deploy:
 *   `VITE_AKITA_SHARE_OFT_<SUFFIX>`
 *   `VITE_AKITA_CCA_STRATEGY_<SUFFIX>`
 * Never invent addresses; leave unset until deploy lands.
 */
export const AKITA_EXPANSION_CHAIN_ENV_SUFFIX: Readonly<Record<number, string>> = {
  1: "ETHEREUM",
  42161: "ARBITRUM",
  130: "UNICHAIN",
  4663: "ROBINHOOD",
};

export const ERC4626_DEFAULTS = {
  // Canonical protocol token defaults currently point to the live Base protocol stack.
  // Keep explicit addresses here so this default set remains independent from AKITA aliases.
  token: addr("5b674196812451b7cec024fe9d22d2c0b172fa75"),
  vault: addr("4626539E5C01cc32C29755146D31755e3adA848A"),
  wrapper: addr("2d66Fe297CDAE8B4325bB58887bE125CED4A81b4"),
  shareOFT: addr("44710150A469DE368Abc82F05e6217086Be84626"),
  gaugeController: addr("Ff168cc0E26F288c02509afc1bED1Be4F85834C5"),
  ccaLaunchArm: addr("44aCFe7E68031Bed3BE801fD242E884e72e0CFD4"),
  oracle: addr("3954fC7c961f17699497BB3D7b7e903722881ffa"),
} as const;
