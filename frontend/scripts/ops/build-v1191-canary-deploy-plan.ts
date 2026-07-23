#!/usr/bin/env node

/**
 * Build a v1.19.1 deploy-session JSON plan for a single creator or agent vault canary.
 *
 * Example:
 *   pnpm -C frontend exec tsx --env-file=.env scripts/ops/build-v1191-canary-deploy-plan.ts \
 *     --vault-kind creator --creator-token 0x... --out tmp/creator-canary-plan.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PublicKey } from "@solana/web3.js";
import { coinABI } from "@zoralabs/protocol-deployments";
import {
  concatHex,
  createPublicClient,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbiParameters,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { erc20Abi } from "viem";
import { base } from "viem/chains";

import { BASE_DEFAULTS } from "../../src/config/contracts.defaults.js";
import {
  DEPLOYMENT_BATCHER_ABI,
  VAULT_AUXILIARY_DEPLOY_BATCHER_ABI,
  CREATOR_OVAULT_WRAPPER_ADMIN_ABI,
  CREATOR_SHARE_OFT_ADMIN_ABI,
  CREATOR_VAULT_ADMIN_ABI,
  PAYOUT_ROUTER_ADMIN_ABI,
  VAULT_SHARE_BURN_STREAM_ABI,
  BATCHER_PHASE3_CONFIG_ABI,
  PHASE3_HELPER_VIEW_ABI,
  UNISWAP_V3_FACTORY_ABI,
  AJNA_FACTORY_ABI,
  IMPAIRMENT_AUX_OWNED_ABI,
  COIN_PAYOUT_RECIPIENT_ABI,
  SHARE_OFT_OPERATION_NO_FEES,
} from "../../src/pages/deploy/deployVaultAbis.js";
import {
  ZERO_BYTES32,
  encodeUniswapV3Path,
  findCreate2SaltForSuffix,
  normalizeAddressLike,
  normalizeHexSuffix,
  sameAddress,
  deriveShareOftVanityStartAt,
  type DeployVanityCacheState,
} from "../../src/pages/deploy/deployVaultHelpers.js";
import {
  normalizeUnderlyingSymbol,
  shareSymbolForVaultKind,
  toShareName,
  toVaultName,
  underlyingSymbolUpper as deriveUnderlyingUpper,
  vaultSymbolForVaultKind,
  type VaultKind as TokenSymbolVaultKind,
} from "../../src/lib/tokens/tokenSymbols.js";
import { DEPLOY_BYTECODE } from "../../src/deploy/bytecode.generated.js";
import {
  readCreatorVaultBatcherInfra,
  type CreatorVaultBatcherInfra,
} from "../../src/lib/deploy/deploymentBatcherInfra.js";
import {
  resolveDeployLanePhase1CodeIds,
  resolveDeployLanePayoutRouterCodeId,
  resolveDeployLaneRevenuePolicyControllerCodeId,
  resolveDeployLaneVaultBytecode,
  resolveDeployLaneVaultSaltLabel,
  resolveDeployLaneWrapperBytecode,
  resolveDeployLaneWrapperSaltLabel,
  toOnchainVaultKind,
  usesCreatorCoinPolicyController,
  usesRevenuePolicyController,
} from "../../src/lib/deploy/deployLaneBytecode.js";
import {
  resolveDeployExpectedAddresses,
  type ResolveDeployExpectedAddressesResult,
} from "../../src/lib/deploy/resolveDeployExpectedAddresses.js";
import {
  deriveDeployBaseSalt,
  deriveShareOftSaltFromVersion,
  predictCreate2AddressFromInitCode,
  saltForDeployLabel,
} from "../../src/lib/deploy/perVaultVanityVersionSearch.js";
import {
  attachFinalizeShareBridgeValueToCalls,
  parseCallValue,
} from "../../src/lib/deploy/finalizeShareBridgeFee.js";
import {
  buildImpairmentAuxPlan,
  PERMISSIONLESS_CREATE2_DEPLOYER,
} from "../../src/lib/deploy/impairmentAuxPlan.js";
import { computeMarketFloorQuote } from "../../src/lib/cca/marketFloor.js";
import { planCreatorCoinPolicyControllerOwnershipGrant } from "../../src/lib/deploy/creatorCoinOwnership.js";
import { readDeployedPhase1CoreAddresses } from "../../src/lib/deploy/phase1OnchainState.js";
import { findCreate2SaltForSuffixOnServer } from "../../server/_lib/deploy/findCreate2SaltForSuffixServer.js";
import { getApiContracts } from "../../server/_lib/onchain/contracts.js";
import { resolveProtocolAjnaKeeperAddress } from "../../server/_lib/wallet/protocolTreasurySafe.js";

const DEPLOYMENT_BATCHER = getAddress(
  "0xa18169caf37fa0347285B16aAFC2B09eCB43F145",
);
const VAULT_AUXILIARY_DEPLOY_BATCHER = getAddress(
  "0xaA9229c1649a7eC6DA85a76097E0910B24F9408e",
);
const OWNER_CSW = getAddress("0xAb6d5C10b03300326CD7fAb7267Ae192842967b5");
const DEPLOYMENT_VERSION = "v1.19.1";
const MIN_FIRST_DEPOSIT = 50_000_000n * 10n ** 18n;
const DEFAULT_REQUIRED_RAISE_WEI = 100_000_000_000_000_000n;
const DEFAULT_CCA_DURATION_BLOCKS = 302_400n;
const DEFAULT_CHARM_WEIGHT_BPS = 4_500n;
const DEFAULT_AJNA_WEIGHT_BPS = 4_500n;
const DEFAULT_SOLANA_WEIGHT_BPS = 0n;
const DEFAULT_MIN_IDLE_PERCENT_BPS = 1_000n;
const DEFAULT_SOLANA_MAX_NAV_AGE = 3_600n;
const DEFAULT_SOLANA_MAX_NAV_DELTA_BPS = 500;
const DEFAULT_SOLANA_MIN_BASE_LIQUIDITY_BPS = 1_000;
const DEFAULT_SOLANA_OVAULT_MESH_ENABLED = true;
const RETIRED_AKITA_B1_SHARE_MESH_MINT =
  "5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv";
const DEFAULT_CHARM_EXPECTED_PROTOCOL_FEE_PIPS = 10_000;
const DEFAULT_VAULT_VANITY_PREFIX = "4626";
const DEFAULT_SHARE_OFT_VANITY_SUFFIX = "4626";
const DEFAULT_VAULT_VANITY_MAX_TRIES = 250_000;
const DEFAULT_SHARE_OFT_VANITY_MAX_TRIES = 1_000_000;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const BASE_SWAP_ROUTER = getAddress(
  "0x2626664c2603336E57B271c5C0b26F421741e481",
);

type DeploySessionCall = { to: Address; value: string; data: Hex };

type SessionCreateRequest = {
  smartWallet: Address;
  creatorToken: Address;
  ownerAddress: Address;
  phase1Calls: DeploySessionCall[];
  phase2CoreCalls: DeploySessionCall[];
  phase2FinalizeCalls: DeploySessionCall[];
  phase3Calls?: DeploySessionCall[];
  phase2PreFinalizeCalls?: DeploySessionCall[];
  phase4Calls?: DeploySessionCall[];
  solanaOvault?: {
    enabled: boolean;
    mode: "b1" | "b2";
    shareMeshMint: string;
  };
  vanity?: { vaultPrefix?: string; shareSuffix?: string };
  version: string;
};

type Args = {
  vaultKind: TokenSymbolVaultKind;
  creatorToken: Address;
  deploymentVersion: string;
  shareOftSaltOverride: Hex | null;
  shareMeshMint: string | null;
  solanaLotteryMode: "b1" | "b2" | null;
  solanaOvaultEnabled: boolean;
  phase1Only: boolean;
  out: string;
};

type TokenMetadata = {
  symbol: string;
  name: string;
  decimals: number;
};

type VanityPlanLite = {
  deploymentVersionUsed: string;
  shareOftSaltOverrideUsed: Hex | null;
  vanityVersionSearchOutcome:
    | "not_applicable"
    | "combined_match"
    | "vault_only_match"
    | "share_only_match"
    | "missed_defaults"
    | "missed_custom";
  shareOftVanityWarning: string | null;
  shareOftVanityInfo: string | null;
  vaultInitCode: Hex;
  shareOftInitCode: Hex;
  shareSymbolLower: string;
  vaultAddress: Address;
  cacheState: DeployVanityCacheState;
};

function usage(): string {
  return [
    "Usage:",
    "  pnpm -C frontend exec tsx --env-file=.env scripts/ops/build-v1191-canary-deploy-plan.ts \\",
    "    --vault-kind creator|agent --creator-token 0x... --deployment-version v1.19.4-v... \\",
    "    [--share-oft-salt 0x...] [--share-mesh-mint <MINT> --solana-lottery-mode b1|b2 | --disable-solana-ovault] \\",
    "    [--phase1-only] --out path.json",
  ].join("\n");
}

function parseArgs(argv: string[]): Args {
  const getArg = (flag: string): string | null => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return null;
    return argv[idx + 1] ?? null;
  };

  const vaultKindRaw = String(getArg("--vault-kind") ?? "")
    .trim()
    .toLowerCase();
  const creatorTokenRaw = String(getArg("--creator-token") ?? "").trim();
  const deploymentVersion = String(
    getArg("--deployment-version") ?? DEPLOYMENT_VERSION,
  ).trim();
  const shareOftSaltRaw = String(getArg("--share-oft-salt") ?? "").trim();
  const shareMeshMintRaw = String(getArg("--share-mesh-mint") ?? "").trim();
  const solanaLotteryModeRaw = String(
    getArg("--solana-lottery-mode") ?? "",
  )
    .trim()
    .toLowerCase();
  const solanaOvaultEnabled = !argv.includes("--disable-solana-ovault");
  const phase1Only = argv.includes("--phase1-only");
  const out = String(getArg("--out") ?? "").trim();

  if (vaultKindRaw !== "creator" && vaultKindRaw !== "agent") {
    throw new Error(
      `Invalid --vault-kind: ${vaultKindRaw || "(empty)"}\n${usage()}`,
    );
  }
  if (!isAddress(creatorTokenRaw)) {
    throw new Error(
      `Invalid --creator-token: ${creatorTokenRaw || "(empty)"}\n${usage()}`,
    );
  }
  if (!out) {
    throw new Error(`Missing --out\n${usage()}`);
  }
  if (!deploymentVersion || deploymentVersion.length > 96) {
    throw new Error(
      `Invalid --deployment-version: ${deploymentVersion || "(empty)"}\n${usage()}`,
    );
  }
  if (shareOftSaltRaw && !/^0x[0-9a-fA-F]{64}$/.test(shareOftSaltRaw)) {
    throw new Error(`Invalid --share-oft-salt: ${shareOftSaltRaw}\n${usage()}`);
  }
  let shareMeshMint: string | null = null;
  if (shareMeshMintRaw) {
    try {
      shareMeshMint = new PublicKey(shareMeshMintRaw).toBase58();
    } catch {
      throw new Error(`Invalid --share-mesh-mint: ${shareMeshMintRaw}\n${usage()}`);
    }
    if (shareMeshMint === RETIRED_AKITA_B1_SHARE_MESH_MINT) {
      throw new Error(
        "The retired standard-SPL AKITA B1 mint cannot be used for a B2/OVault deployment plan.",
      );
    }
  }
  if (!phase1Only && solanaOvaultEnabled && !shareMeshMint) {
    throw new Error(
      "Full Solana OVault plans require --share-mesh-mint <fresh Token-2022 mint>. " +
        "Use --phase1-only before the mint exists, or --disable-solana-ovault for a Base-only plan.",
    );
  }
  const solanaLotteryMode =
    solanaLotteryModeRaw === "b1" || solanaLotteryModeRaw === "b2"
      ? solanaLotteryModeRaw
      : null;
  if (
    solanaLotteryModeRaw &&
    solanaLotteryModeRaw !== "b1" &&
    solanaLotteryModeRaw !== "b2"
  ) {
    throw new Error(
      `Invalid --solana-lottery-mode: ${solanaLotteryModeRaw}; expected b1 or b2.`,
    );
  }
  if (!phase1Only && solanaOvaultEnabled && !solanaLotteryMode) {
    throw new Error(
      "Full Solana OVault plans require --solana-lottery-mode b1|b2; the lottery path must be explicit.",
    );
  }
  if (!solanaOvaultEnabled && shareMeshMint) {
    throw new Error(
      "--share-mesh-mint cannot be combined with --disable-solana-ovault.",
    );
  }
  if (!solanaOvaultEnabled && solanaLotteryMode) {
    throw new Error(
      "--solana-lottery-mode cannot be combined with --disable-solana-ovault.",
    );
  }

  return {
    vaultKind: vaultKindRaw,
    creatorToken: getAddress(creatorTokenRaw),
    deploymentVersion,
    shareOftSaltOverride: shareOftSaltRaw ? (shareOftSaltRaw as Hex) : null,
    shareMeshMint,
    solanaLotteryMode,
    solanaOvaultEnabled,
    phase1Only,
    out,
  };
}

function rpcUrl(): string {
  return (
    process.env.BASE_RPC_URL?.trim() ||
    process.env.VITE_BASE_RPC?.trim() ||
    "https://mainnet.base.org"
  );
}

function serializeSessionCalls(
  calls: Array<{ target: Address; value: bigint; data: Hex }>,
): DeploySessionCall[] {
  return calls.map((call) => ({
    to: call.target,
    value: String(call.value),
    data: call.data,
  }));
}

function encodeUniswapCcaLinearSteps(durationBlocks: bigint): Hex {
  const MPS = 10_000_000n;
  if (durationBlocks <= 0n) return "0x";

  const mpsLow = MPS / durationBlocks;
  const remainder = MPS - mpsLow * durationBlocks;
  const mpsHigh = mpsLow + 1n;
  const highBlocks = remainder;
  const lowBlocks = durationBlocks - highBlocks;

  const packStep = (mps: bigint, blockDelta: bigint) =>
    encodeAbiParameters(parseAbiParameters("uint24 mps, uint40 blockDelta"), [
      Number(mps),
      Number(blockDelta),
    ])
      .replace(/^0x/, "")
      .slice(0, 6 + 10) as string;

  const parts: Hex[] = [];
  if (highBlocks > 0n) parts.push(`0x${packStep(mpsHigh, highBlocks)}` as Hex);
  if (lowBlocks > 0n) parts.push(`0x${packStep(mpsLow, lowBlocks)}` as Hex);
  return concatHex(parts);
}

function candidateDeploymentVersion(
  baseVersion: string,
  attempt: number,
): string {
  return attempt === 0
    ? baseVersion
    : `${baseVersion}-v${attempt.toString(36)}`;
}

async function readTokenMetadata(
  publicClient: ReturnType<typeof createPublicClient>,
  creatorToken: Address,
): Promise<TokenMetadata> {
  const [symbol, name, decimals] = await Promise.all([
    publicClient.readContract({
      address: creatorToken,
      abi: erc20Abi,
      functionName: "symbol",
    }) as Promise<string>,
    publicClient.readContract({
      address: creatorToken,
      abi: erc20Abi,
      functionName: "name",
    }) as Promise<string>,
    publicClient.readContract({
      address: creatorToken,
      abi: erc20Abi,
      functionName: "decimals",
    }) as Promise<number>,
  ]);

  return {
    symbol: String(symbol ?? "").trim(),
    name: String(name ?? "").trim(),
    decimals: typeof decimals === "number" ? decimals : Number(decimals),
  };
}

function deriveTokenNamesAndSymbols(
  token: TokenMetadata,
  vaultKind: TokenSymbolVaultKind,
): {
  vaultName: string;
  vaultSymbol: string;
  shareName: string;
  shareSymbol: string;
} {
  const underlying = normalizeUnderlyingSymbol(token.symbol);
  const underlyingUpper = underlying
    ? deriveUnderlyingUpper(underlying)
    : deriveUnderlyingUpper(token.symbol);
  if (!underlyingUpper) {
    throw new Error(
      `Could not derive token symbol from creator token symbol "${token.symbol}"`,
    );
  }
  return {
    vaultName: toVaultName(underlyingUpper, token.name),
    vaultSymbol: vaultSymbolForVaultKind(underlyingUpper, vaultKind),
    shareName: toShareName(underlyingUpper, token.name),
    shareSymbol: shareSymbolForVaultKind(underlyingUpper, vaultKind),
  };
}

async function readBytecodeFailClosed(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  address: Address;
  label: string;
  attempts?: number;
}): Promise<Hex | undefined> {
  const attempts = Math.max(1, params.attempts ?? 3);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await params.publicClient.getBytecode({ address: params.address });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
  }
  const detail =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `Unable to confirm whether ${params.label} (${params.address}) is already deployed after ${attempts} RPC attempts: ${detail}`,
  );
}

async function searchVersionForVaultPrefix(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  creatorToken: Address;
  owner: Address;
  chainId: number;
  baseVersion: string;
  create2Deployer: Address;
  vaultInitCode: Hex;
  vaultSaltLabel: string;
  vaultPrefix: string | null;
  maxTries: number;
}): Promise<{ deploymentVersionUsed: string; vaultAddress: Address }> {
  const requestedPrefix = normalizeHexSuffix(params.vaultPrefix);
  if (!requestedPrefix) {
    const version = params.baseVersion;
    const baseSalt = deriveDeployBaseSalt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      version,
    });
    const vaultSalt = saltForDeployLabel(baseSalt, params.vaultSaltLabel);
    return {
      deploymentVersionUsed: version,
      vaultAddress: predictCreate2AddressFromInitCode({
        create2Deployer: params.create2Deployer,
        salt: vaultSalt,
        initCode: params.vaultInitCode,
      }),
    };
  }

  for (let attempt = 0; attempt < params.maxTries; attempt += 1) {
    const version = candidateDeploymentVersion(params.baseVersion, attempt);
    const baseSalt = deriveDeployBaseSalt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      version,
    });
    const vaultSalt = saltForDeployLabel(baseSalt, params.vaultSaltLabel);
    const vaultAddress = predictCreate2AddressFromInitCode({
      create2Deployer: params.create2Deployer,
      salt: vaultSalt,
      initCode: params.vaultInitCode,
    });
    if (
      vaultAddress.slice(2, 2 + requestedPrefix.length).toLowerCase() ===
      requestedPrefix
    ) {
      // Skip versions whose CREATE2 vault is already live so a rebuild after a
      // partial canary does not reuse addresses that trip finalize peer quoting.
      // Fail closed on RPC errors — never treat a failed read as undeployed.
      const code = await readBytecodeFailClosed({
        publicClient: params.publicClient,
        address: vaultAddress,
        label: `vanity vault candidate version ${version}`,
      });
      if (code && code !== "0x") {
        if (attempt > 0 && attempt % 4096 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
        continue;
      }
      return { deploymentVersionUsed: version, vaultAddress };
    }
    if (attempt > 0 && attempt % 4096 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  throw new Error(
    `Unable to find undeployed vault vanity prefix 0x${requestedPrefix} in ${params.maxTries.toLocaleString()} attempts. ` +
      "Increase the local search budget or run a dedicated vanity grind first.",
  );
}

async function resolveVanityPlanLite(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  batcherAddress: Address;
  batcherInfra: CreatorVaultBatcherInfra;
  creatorToken: Address;
  owner: Address;
  chainId: number;
  deploymentVersion: string;
  vaultName: string;
  vaultSymbol: string;
  shareName: string;
  shareSymbol: string;
  vaultKind: TokenSymbolVaultKind;
  shareOftSaltOverride?: Hex | null;
}): Promise<VanityPlanLite> {
  const create2Deployer = params.batcherInfra.create2Deployer;
  const tempOwner = params.batcherAddress;
  const shareSymbolLower = params.shareSymbol.toLowerCase();
  const vaultBytecode = resolveDeployLaneVaultBytecode(params.vaultKind);
  const wrapperBytecode = resolveDeployLaneWrapperBytecode(params.vaultKind);
  const vaultSaltLabel = resolveDeployLaneVaultSaltLabel(params.vaultKind);
  const wrapperSaltLabel = resolveDeployLaneWrapperSaltLabel(params.vaultKind);
  const vaultVanityPrefix = DEFAULT_VAULT_VANITY_PREFIX;
  const shareOftVanitySuffix = DEFAULT_SHARE_OFT_VANITY_SUFFIX;

  const oftBootstrapSalt = keccak256(toHex("4626:OFTBootstrapRegistry:v1"));
  const oftBootstrapRegistry = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: oftBootstrapSalt,
    initCode: DEPLOY_BYTECODE.OFTBootstrapRegistry as Hex,
  });

  const shareOftArgs = encodeAbiParameters(
    parseAbiParameters("string,string,address,address"),
    [
      params.shareName,
      params.shareSymbol.toUpperCase(),
      oftBootstrapRegistry,
      tempOwner,
    ],
  );
  const shareOftInitCode = concatHex([
    DEPLOY_BYTECODE.CreatorShareOFT as Hex,
    shareOftArgs,
  ]);

  const vaultArgs = encodeAbiParameters(
    parseAbiParameters("address,address,string,string"),
    [params.creatorToken, tempOwner, params.vaultName, params.vaultSymbol],
  );
  const vaultInitCode = concatHex([vaultBytecode, vaultArgs]);

  const { deploymentVersionUsed, vaultAddress } =
    await searchVersionForVaultPrefix({
      publicClient: params.publicClient,
      creatorToken: params.creatorToken,
      owner: params.owner,
      chainId: params.chainId,
      baseVersion: params.deploymentVersion,
      create2Deployer,
      vaultInitCode,
      vaultSaltLabel,
      vaultPrefix: vaultVanityPrefix,
      maxTries: DEFAULT_VAULT_VANITY_MAX_TRIES,
    });

  const deterministicShareSalt = deriveShareOftSaltFromVersion({
    creatorToken: params.creatorToken,
    owner: params.owner,
    shareSymbol: params.shareSymbol,
    version: deploymentVersionUsed,
  });
  const deterministicShareAddress = predictCreate2AddressFromInitCode({
    create2Deployer,
    salt: deterministicShareSalt,
    initCode: shareOftInitCode,
  });

  let shareOftSaltOverrideUsed: Hex | null =
    params.shareOftSaltOverride ?? null;
  const requestedSuffix = normalizeHexSuffix(shareOftVanitySuffix);
  if (shareOftSaltOverrideUsed) {
    const overriddenShareAddress = predictCreate2AddressFromInitCode({
      create2Deployer,
      salt: shareOftSaltOverrideUsed,
      initCode: shareOftInitCode,
    });
    if (
      requestedSuffix &&
      !overriddenShareAddress.toLowerCase().endsWith(requestedSuffix)
    ) {
      throw new Error(
        `Provided ShareOFT salt predicts ${overriddenShareAddress}, which does not end in ${requestedSuffix}`,
      );
    }
  } else if (
    requestedSuffix &&
    !deterministicShareAddress.toLowerCase().endsWith(requestedSuffix)
  ) {
    const saltStartAt = deriveShareOftVanityStartAt({
      creatorToken: params.creatorToken,
      owner: params.owner,
      deploymentVersion: deploymentVersionUsed,
    });
    let found = await findCreate2SaltForSuffix({
      create2Deployer,
      initCode: shareOftInitCode,
      suffix: requestedSuffix,
      maxTries: DEFAULT_SHARE_OFT_VANITY_MAX_TRIES,
      startAt: saltStartAt,
    });
    if (!found) {
      const serverFound = await findCreate2SaltForSuffixOnServer({
        create2Deployer,
        initCodeHash: keccak256(shareOftInitCode),
        startAt: toHex(saltStartAt, { size: 32 }) as Hex,
        suffix: requestedSuffix,
        maxAttempts: DEFAULT_SHARE_OFT_VANITY_MAX_TRIES,
      });
      found = serverFound?.salt ?? null;
    }
    if (!found) {
      throw new Error(
        `Unable to find ShareOFT vanity suffix "${requestedSuffix}" in ${DEFAULT_SHARE_OFT_VANITY_MAX_TRIES.toLocaleString()} tries. ` +
          "Increase the local search budget or pre-seed the vanity salt first.",
      );
    }
    shareOftSaltOverrideUsed = found;
  }

  const cacheState: DeployVanityCacheState = {
    vaultVanityVersion: null,
    shareOftVanity: null,
    shareOftVanitySkipLogKey: null,
  };

  void wrapperBytecode;
  void wrapperSaltLabel;

  return {
    deploymentVersionUsed,
    shareOftSaltOverrideUsed,
    vanityVersionSearchOutcome: shareOftSaltOverrideUsed
      ? "vault_only_match"
      : "combined_match",
    shareOftVanityWarning: null,
    shareOftVanityInfo: null,
    vaultInitCode,
    shareOftInitCode,
    shareSymbolLower,
    vaultAddress,
    cacheState,
  };
}

async function resolveExpectedAddressesForPlan(params: {
  publicClient: ReturnType<typeof createPublicClient>;
  creatorToken: Address;
  owner: Address;
  vaultKind: TokenSymbolVaultKind;
  token: TokenMetadata;
  names: {
    vaultName: string;
    vaultSymbol: string;
    shareName: string;
    shareSymbol: string;
  };
  deploymentVersion: string;
  shareOftSaltOverride?: Hex | null;
}): Promise<{
  contracts: ReturnType<typeof getApiContracts>;
  batcherInfra: CreatorVaultBatcherInfra;
  vanityPlan: VanityPlanLite;
  expectedAddresses: ResolveDeployExpectedAddressesResult;
}> {
  const contracts = getApiContracts();
  const infraResult = await readCreatorVaultBatcherInfra({
    publicClient: params.publicClient,
    batcherAddress: DEPLOYMENT_BATCHER,
    fallbacks: {
      create2Deployer: normalizeAddressLike(
        contracts.universalCreate2DeployerFromStore ?? null,
      ),
      bytecodeStore: normalizeAddressLike(
        contracts.universalBytecodeStore ?? null,
      ),
      protocolTreasury: normalizeAddressLike(
        contracts.protocolTreasury ?? null,
      ),
      registry: normalizeAddressLike(contracts.registry ?? null),
      chainlinkEthUsd: normalizeAddressLike(contracts.chainlinkEthUsd ?? null),
    },
  });
  if (!infraResult.ok) {
    throw new Error(infraResult.message);
  }

  const vanityPlan = await resolveVanityPlanLite({
    publicClient: params.publicClient,
    batcherAddress: DEPLOYMENT_BATCHER,
    batcherInfra: infraResult.infra,
    creatorToken: params.creatorToken,
    owner: params.owner,
    chainId: base.id,
    deploymentVersion: params.deploymentVersion,
    vaultName: params.names.vaultName,
    vaultSymbol: params.names.vaultSymbol,
    shareName: params.names.shareName,
    shareSymbol: params.names.shareSymbol,
    vaultKind: params.vaultKind,
    shareOftSaltOverride: params.shareOftSaltOverride,
  });

  const expectedAddresses = await resolveDeployExpectedAddresses({
    publicClient: params.publicClient,
    batcherAddress: DEPLOYMENT_BATCHER,
    batcherInfra: infraResult.infra,
    creatorToken: params.creatorToken,
    owner: params.owner,
    chainId: base.id,
    vanityPlan,
    universalBytecodeStoreFallback: normalizeAddressLike(
      contracts.universalBytecodeStore ?? null,
    ),
    wethAddress: getAddress(contracts.weth ?? BASE_DEFAULTS.weth),
    vaultShareBurnStreamCodeId: keccak256(
      DEPLOY_BYTECODE.VaultShareBurnStream as Hex,
    ),
    payoutRouterCodeId: resolveDeployLanePayoutRouterCodeId(params.vaultKind),
    creatorCoinPolicyControllerCodeId:
      resolveDeployLaneRevenuePolicyControllerCodeId(params.vaultKind),
    vaultKind: params.vaultKind,
  });

  void params.token;

  return {
    contracts,
    batcherInfra: infraResult.infra,
    vanityPlan,
    expectedAddresses,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const publicClient = createPublicClient({
    chain: base,
    transport: http(rpcUrl(), { timeout: 30_000 }),
  });

  const token = await readTokenMetadata(publicClient, args.creatorToken);
  const names = deriveTokenNamesAndSymbols(token, args.vaultKind);
  const { contracts, expectedAddresses, vanityPlan } =
    await resolveExpectedAddressesForPlan({
      publicClient,
      creatorToken: args.creatorToken,
      owner: OWNER_CSW,
      vaultKind: args.vaultKind,
      token,
      names,
      deploymentVersion: args.deploymentVersion,
      shareOftSaltOverride: args.shareOftSaltOverride,
    });

  const expected = expectedAddresses.expected;
  const expectedBurnStream = expected.burnStream;
  const expectedPayoutRouter = expected.payoutRouter;
  const expectedCreatorCoinPolicyController =
    expected.creatorCoinPolicyController;
  const expectedProtocolTreasury = getAddress(
    expectedAddresses.protocolTreasury,
  );
  const expectedCreate2Deployer = getAddress(expectedAddresses.create2Deployer);
  const onchainVaultKind = toOnchainVaultKind(args.vaultKind);
  const includePolicyController = usesRevenuePolicyController(args.vaultKind);
  const includeCreatorCoinPolicyGrant = usesCreatorCoinPolicyController(
    args.vaultKind,
  );
  const minFirstDeposit = MIN_FIRST_DEPOSIT;
  const minimumTotalIdle =
    (minFirstDeposit * DEFAULT_MIN_IDLE_PERCENT_BPS) / 10_000n;
  const auctionSteps = encodeUniswapCcaLinearSteps(DEFAULT_CCA_DURATION_BLOCKS);
  const floorPriceQ96ForBatcher = await (async () => {
    try {
      const quote = await computeMarketFloorQuote({
        publicClient: publicClient as Parameters<
          typeof computeMarketFloorQuote
        >[0]["publicClient"],
        creatorCoin: args.creatorToken,
      });
      return quote.floorPriceQ96Aligned > 0n ? quote.floorPriceQ96Aligned : 1n;
    } catch {
      return 1n;
    }
  })();

  const phase1BaseSalt = deriveDeployBaseSalt({
    creatorToken: args.creatorToken,
    owner: OWNER_CSW,
    chainId: base.id,
    version: vanityPlan.deploymentVersionUsed,
  });
  const phase1Onchain = await readDeployedPhase1CoreAddresses({
    publicClient: publicClient as Parameters<
      typeof readDeployedPhase1CoreAddresses
    >[0]["publicClient"],
    batcherAddress: DEPLOYMENT_BATCHER,
    baseSalt: phase1BaseSalt,
  }).catch(() => null);

  const phase1State = {
    vaultDeployed: Boolean(phase1Onchain?.vault),
    wrapperDeployed: Boolean(phase1Onchain?.wrapper),
    shareOftDeployed: Boolean(phase1Onchain?.shareOFT),
  };
  const phase1Any =
    phase1State.vaultDeployed ||
    phase1State.wrapperDeployed ||
    phase1State.shareOftDeployed;
  const phase1All =
    phase1State.vaultDeployed &&
    phase1State.wrapperDeployed &&
    phase1State.shareOftDeployed;
  if (
    phase1State.shareOftDeployed &&
    (!phase1State.vaultDeployed || !phase1State.wrapperDeployed)
  ) {
    throw new Error(
      `Phase 1 split state is invalid for deployment version (${vanityPlan.deploymentVersionUsed}). ` +
        "ShareOFT is deployed while vault or wrapper is missing.",
    );
  }
  if (phase1State.vaultDeployed !== phase1State.wrapperDeployed) {
    throw new Error(
      `Phase 1 split state is invalid for deployment version (${vanityPlan.deploymentVersionUsed}). ` +
        "Vault and wrapper deployment is inconsistent.",
    );
  }

  const phase1Params = {
    creatorToken: args.creatorToken,
    owner: OWNER_CSW,
    vaultName: names.vaultName,
    vaultSymbol: names.vaultSymbol,
    shareName: names.shareName,
    shareSymbol: names.shareSymbol,
    version: vanityPlan.deploymentVersionUsed,
    vaultKind: onchainVaultKind,
  } as const;
  const phase1CodeIds = resolveDeployLanePhase1CodeIds(args.vaultKind);
  const phase1SaltOverride = (vanityPlan.shareOftSaltOverrideUsed ??
    ZERO_BYTES32) as Hex;
  const asBatcherCall = (data: Hex) =>
    ({ target: DEPLOYMENT_BATCHER, value: 0n, data }) as const;

  const phase1Calls: Array<{ target: Address; value: bigint; data: Hex }> =
    (() => {
      if (phase1All) return [];
      const coreCallData = encodeFunctionData({
        abi: DEPLOYMENT_BATCHER_ABI,
        functionName: "deployPhase1CoreWithSalt",
        args: [phase1Params, phase1CodeIds, phase1SaltOverride],
      });
      const finalizeCallData = encodeFunctionData({
        abi: DEPLOYMENT_BATCHER_ABI,
        functionName: "finalizePhase1WithSalt",
        args: [phase1Params, phase1CodeIds, phase1SaltOverride],
      });
      if (!phase1State.vaultDeployed || !phase1State.wrapperDeployed) {
        return [asBatcherCall(coreCallData), asBatcherCall(finalizeCallData)];
      }
      return [asBatcherCall(finalizeCallData)];
    })();

  if (args.phase1Only) {
    if (phase1Calls.length === 0) {
      throw new Error(
        `Phase 1 is already deployed for deployment version (${vanityPlan.deploymentVersionUsed}); refusing to emit an empty session.`,
      );
    }

    // A fresh B2 ShareOFT cannot be wired to its Solana Token-2022 OFT Store
    // until Phase 1 creates the Base ShareOFT. Keep this first session strictly
    // Base-only: no finalize quote, post-Phase-2 work, or Solana mesh request.
    const sessionPlan: SessionCreateRequest = {
      smartWallet: OWNER_CSW,
      creatorToken: args.creatorToken,
      ownerAddress: OWNER_CSW,
      phase1Calls: serializeSessionCalls(phase1Calls),
      phase2CoreCalls: [],
      phase2FinalizeCalls: [],
      vanity: {
        vaultPrefix: `0x${DEFAULT_VAULT_VANITY_PREFIX}`,
        shareSuffix: DEFAULT_SHARE_OFT_VANITY_SUFFIX,
      },
      version: vanityPlan.deploymentVersionUsed,
    };

    const outPath = path.resolve(process.cwd(), args.out);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(sessionPlan, null, 2)}\n`, "utf8");

    process.stdout.write(
      JSON.stringify(
        {
          out: outPath,
          mode: "phase1-only",
          batcher: DEPLOYMENT_BATCHER,
          owner: OWNER_CSW,
          creatorToken: args.creatorToken,
          vaultKind: args.vaultKind,
          version: sessionPlan.version,
          expectedAddresses: expected,
          counts: {
            phase1: sessionPlan.phase1Calls.length,
            phase2Core: 0,
            phase2PreFinalize: 0,
            phase2Finalize: 0,
            phase3: 0,
            phase4: 0,
          },
          nextGate:
            "provision and verify a fresh Token-2022 TransferHook mint/OFT Store, then build the continuation plan",
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const burnStreamAlreadyDeployed = Boolean(
    (await publicClient
      .getBytecode({ address: expectedBurnStream })
      .catch(() => null)) &&
      (await publicClient
        .getBytecode({ address: expectedBurnStream })
        .catch(() => null)) !== "0x",
  );
  const payoutRouterAlreadyDeployed = Boolean(
    (await publicClient
      .getBytecode({ address: expectedPayoutRouter })
      .catch(() => null)) &&
      (await publicClient
        .getBytecode({ address: expectedPayoutRouter })
        .catch(() => null)) !== "0x",
  );
  const creatorCoinPolicyControllerAlreadyDeployed = includePolicyController
    ? Boolean(
        (await publicClient
          .getBytecode({ address: expectedCreatorCoinPolicyController })
          .catch(() => null)) &&
          (await publicClient
            .getBytecode({ address: expectedCreatorCoinPolicyController })
            .catch(() => null)) !== "0x",
      )
    : true;

  const phase2AuxiliaryDeployNeeded = includePolicyController
    ? !burnStreamAlreadyDeployed ||
      !payoutRouterAlreadyDeployed ||
      !creatorCoinPolicyControllerAlreadyDeployed
    : !burnStreamAlreadyDeployed || !payoutRouterAlreadyDeployed;

  const phase2AuxiliaryDeployCall = phase2AuxiliaryDeployNeeded
    ? ({
        target: VAULT_AUXILIARY_DEPLOY_BATCHER,
        value: 0n,
        data: encodeFunctionData({
          abi: VAULT_AUXILIARY_DEPLOY_BATCHER_ABI,
          functionName: "deployPhase2Auxiliaries",
          args: [
            {
              assetToken: args.creatorToken,
              owner: OWNER_CSW,
              vault: expected.vault,
              shareOFT: expected.shareOFT,
              wrapper: expected.wrapper,
              swapRouter: BASE_SWAP_ROUTER,
              weth: getAddress(contracts.weth ?? BASE_DEFAULTS.weth),
              protocolRewards: ZERO_ADDRESS,
              vaultKind: onchainVaultKind,
            },
            {
              vaultShareBurnStream: keccak256(
                DEPLOY_BYTECODE.VaultShareBurnStream as Hex,
              ),
              revenueRouter: resolveDeployLanePayoutRouterCodeId(
                args.vaultKind,
              ),
              revenuePolicyController:
                resolveDeployLaneRevenuePolicyControllerCodeId(args.vaultKind),
            },
          ],
        }),
      } as const)
    : null;

  const payoutRouterWrapperWhitelisted = await (async () => {
    try {
      return await publicClient.readContract({
        address: expected.wrapper,
        abi: CREATOR_OVAULT_WRAPPER_ADMIN_ABI,
        functionName: "isWhitelisted",
        args: [expectedPayoutRouter],
      });
    } catch {
      return false;
    }
  })();
  const wrapperOwnerAddress = await (async () => {
    try {
      const value = await publicClient.readContract({
        address: expected.wrapper,
        abi: CREATOR_OVAULT_WRAPPER_ADMIN_ABI,
        functionName: "owner",
      });
      return typeof value === "string" && isAddress(value)
        ? getAddress(value as Address)
        : null;
    } catch {
      return null;
    }
  })();
  const batcherWhitelistPayoutRouterCall =
    wrapperOwnerAddress &&
    sameAddress(wrapperOwnerAddress, DEPLOYMENT_BATCHER) &&
    !payoutRouterWrapperWhitelisted
      ? ({
          target: DEPLOYMENT_BATCHER,
          value: 0n,
          data: encodeFunctionData({
            abi: DEPLOYMENT_BATCHER_ABI,
            functionName: "whitelistPayoutRouterOnWrapper",
            args: [expected.wrapper, expectedPayoutRouter],
          }),
        } as const)
      : null;

  const payoutRouterShareOftNoFees = await (async () => {
    try {
      const opType = await publicClient.readContract({
        address: expected.shareOFT,
        abi: CREATOR_SHARE_OFT_ADMIN_ABI,
        functionName: "addressType",
        args: [expectedPayoutRouter],
      });
      return Number(opType) === SHARE_OFT_OPERATION_NO_FEES;
    } catch {
      return false;
    }
  })();
  const shareOftOwnerAddress = await (async () => {
    try {
      const value = await publicClient.readContract({
        address: expected.shareOFT,
        abi: CREATOR_SHARE_OFT_ADMIN_ABI,
        functionName: "owner",
      });
      return typeof value === "string" && isAddress(value)
        ? getAddress(value as Address)
        : null;
    } catch {
      return null;
    }
  })();
  const batcherSetPayoutRouterShareOftNoFeesCall =
    shareOftOwnerAddress &&
    sameAddress(shareOftOwnerAddress, DEPLOYMENT_BATCHER) &&
    !payoutRouterShareOftNoFees
      ? ({
          target: DEPLOYMENT_BATCHER,
          value: 0n,
          data: encodeFunctionData({
            abi: DEPLOYMENT_BATCHER_ABI,
            functionName: "setPayoutRouterShareOftNoFees",
            args: [expected.shareOFT, expectedPayoutRouter],
          }),
        } as const)
      : null;

  const currentVaultBurnStream = await (async () => {
    try {
      const value = await publicClient.readContract({
        address: expected.vault,
        abi: CREATOR_VAULT_ADMIN_ABI,
        functionName: "burnStream",
      });
      return typeof value === "string" && isAddress(value)
        ? getAddress(value as Address)
        : ZERO_ADDRESS;
    } catch {
      return ZERO_ADDRESS;
    }
  })();
  const burnStreamAlreadyConfigured = !sameAddress(
    currentVaultBurnStream,
    ZERO_ADDRESS,
  );
  if (
    burnStreamAlreadyConfigured &&
    !sameAddress(currentVaultBurnStream, expectedBurnStream)
  ) {
    throw new Error(
      `Vault burn stream is already set to ${currentVaultBurnStream} (expected ${expectedBurnStream}). ` +
        "Bump the deployment version or reconcile the existing deployment state.",
    );
  }

  const payoutRouterQueuerAlreadyAuthorized = await (async () => {
    try {
      return await publicClient.readContract({
        address: expectedBurnStream,
        abi: VAULT_SHARE_BURN_STREAM_ABI,
        functionName: "authorizedQueuers",
        args: [expectedPayoutRouter],
      });
    } catch {
      return false;
    }
  })();

  const currentVaultImpairmentConfig = await (async () => {
    try {
      const [management, guardian, claims, escrow, challengeWindow] =
        await Promise.all([
          publicClient.readContract({
            address: expected.vault,
            abi: CREATOR_VAULT_ADMIN_ABI,
            functionName: "management",
          }),
          publicClient.readContract({
            address: expected.vault,
            abi: CREATOR_VAULT_ADMIN_ABI,
            functionName: "impairmentGuardian",
          }),
          publicClient.readContract({
            address: expected.vault,
            abi: CREATOR_VAULT_ADMIN_ABI,
            functionName: "impairmentClaims",
          }),
          publicClient.readContract({
            address: expected.vault,
            abi: CREATOR_VAULT_ADMIN_ABI,
            functionName: "impairmentRecoveryEscrow",
          }),
          publicClient.readContract({
            address: expected.vault,
            abi: CREATOR_VAULT_ADMIN_ABI,
            functionName: "impairmentChallengeWindow",
          }),
        ]);
      return {
        management: normalizeAddressLike(management) ?? ZERO_ADDRESS,
        guardian: normalizeAddressLike(guardian) ?? ZERO_ADDRESS,
        claims: normalizeAddressLike(claims) ?? ZERO_ADDRESS,
        escrow: normalizeAddressLike(escrow) ?? ZERO_ADDRESS,
        challengeWindow:
          typeof challengeWindow === "bigint"
            ? Number(challengeWindow)
            : Number(
                challengeWindow ??
                  BASE_DEFAULTS.impairmentChallengeWindowSeconds,
              ),
      };
    } catch {
      return {
        management: ZERO_ADDRESS,
        guardian: ZERO_ADDRESS,
        claims: ZERO_ADDRESS,
        escrow: ZERO_ADDRESS,
        challengeWindow: BASE_DEFAULTS.impairmentChallengeWindowSeconds,
      };
    }
  })();

  const impairmentPhase3Calls: Array<{
    target: Address;
    value: bigint;
    data: Hex;
  }> = [];
  const configuredImpairmentGuardian = normalizeAddressLike(
    contracts.impairmentGuardian ?? null,
  );
  if (
    configuredImpairmentGuardian &&
    !sameAddress(
      currentVaultImpairmentConfig.guardian,
      configuredImpairmentGuardian,
    )
  ) {
    impairmentPhase3Calls.push({
      target: expected.vault,
      value: 0n,
      data: encodeFunctionData({
        abi: CREATOR_VAULT_ADMIN_ABI,
        functionName: "setImpairmentGuardian",
        args: [configuredImpairmentGuardian],
      }),
    });
  }

  const impairmentChallengeWindowSecondsRaw = String(
    process.env.IMPAIRMENT_CHALLENGE_WINDOW_SECONDS ?? "",
  ).trim();
  const configuredImpairmentChallengeWindowSeconds =
    impairmentChallengeWindowSecondsRaw
      ? Number.parseInt(impairmentChallengeWindowSecondsRaw, 10)
      : null;
  if (
    configuredImpairmentChallengeWindowSeconds &&
    Number.isFinite(configuredImpairmentChallengeWindowSeconds) &&
    configuredImpairmentChallengeWindowSeconds > 0 &&
    currentVaultImpairmentConfig.challengeWindow !==
      configuredImpairmentChallengeWindowSeconds
  ) {
    const challengeWindowCallData = encodeFunctionData({
      abi: CREATOR_VAULT_ADMIN_ABI,
      functionName: "setImpairmentChallengeWindow",
      args: [BigInt(configuredImpairmentChallengeWindowSeconds)],
    });
    const canSetChallengeWindow = await (async () => {
      try {
        await publicClient.call({
          to: expected.vault,
          data: challengeWindowCallData,
          account: OWNER_CSW,
        });
        return true;
      } catch {
        return false;
      }
    })();
    if (!canSetChallengeWindow) {
      throw new Error(
        `Cannot set impairment challenge window from ${OWNER_CSW}. Current management is ${currentVaultImpairmentConfig.management}.`,
      );
    }
    impairmentPhase3Calls.push({
      target: expected.vault,
      value: 0n,
      data: challengeWindowCallData,
    });
  }

  const impairmentAuxPlan = buildImpairmentAuxPlan({
    vault: expected.vault,
    initialOwner: OWNER_CSW,
  });
  const readImpairmentAuxState = async (target: Address) => {
    const code = await publicClient
      .getBytecode({ address: target })
      .catch(() => undefined);
    const hasCode = Boolean(code && code !== "0x");
    if (!hasCode)
      return { hasCode: false, owner: ZERO_ADDRESS, vault: ZERO_ADDRESS };
    const [ownerRead, vaultRead] = await Promise.all([
      publicClient.readContract({
        address: target,
        abi: IMPAIRMENT_AUX_OWNED_ABI,
        functionName: "owner",
      }),
      publicClient.readContract({
        address: target,
        abi: IMPAIRMENT_AUX_OWNED_ABI,
        functionName: "vault",
      }),
    ]);
    return {
      hasCode: true,
      owner: normalizeAddressLike(ownerRead) ?? ZERO_ADDRESS,
      vault: normalizeAddressLike(vaultRead) ?? ZERO_ADDRESS,
    };
  };
  const planImpairmentAuxLeg = async (
    label: "claims" | "escrow",
    leg: ReturnType<typeof buildImpairmentAuxPlan>["claims"],
    currentOnVault: Address,
  ) => {
    if (!sameAddress(currentOnVault, ZERO_ADDRESS)) return;
    const state = await readImpairmentAuxState(leg.address);
    if (!state.hasCode) {
      impairmentPhase3Calls.push({
        target: PERMISSIONLESS_CREATE2_DEPLOYER,
        value: 0n,
        data: leg.deployCallData,
      });
    }
    const vaultLinked =
      state.hasCode && sameAddress(state.vault, expected.vault);
    if (!vaultLinked) {
      if (state.hasCode && !sameAddress(state.owner, OWNER_CSW)) {
        throw new Error(
          `Impairment ${label} contract at ${leg.address} is owned by ${state.owner} but is not linked to this vault. ` +
            "Bump the deployment version to derive a fresh pair.",
        );
      }
      impairmentPhase3Calls.push({
        target: leg.address,
        value: 0n,
        data: encodeFunctionData({
          abi: IMPAIRMENT_AUX_OWNED_ABI,
          functionName: "setVault",
          args: [expected.vault],
        }),
      });
    }
    impairmentPhase3Calls.push({
      target: expected.vault,
      value: 0n,
      data: encodeFunctionData({
        abi: CREATOR_VAULT_ADMIN_ABI,
        functionName:
          label === "claims"
            ? "setImpairmentClaims"
            : "setImpairmentRecoveryEscrow",
        args: [leg.address],
      }),
    });
    if (
      !(state.hasCode && sameAddress(state.owner, expectedProtocolTreasury))
    ) {
      impairmentPhase3Calls.push({
        target: leg.address,
        value: 0n,
        data: encodeFunctionData({
          abi: IMPAIRMENT_AUX_OWNED_ABI,
          functionName: "transferOwnership",
          args: [expectedProtocolTreasury],
        }),
      });
    }
  };
  await planImpairmentAuxLeg(
    "claims",
    impairmentAuxPlan.claims,
    currentVaultImpairmentConfig.claims,
  );
  await planImpairmentAuxLeg(
    "escrow",
    impairmentAuxPlan.escrow,
    currentVaultImpairmentConfig.escrow,
  );

  const currentPayoutRecipient = await (async () => {
    try {
      const value = await publicClient.readContract({
        address: args.creatorToken,
        abi: coinABI,
        functionName: "payoutRecipient",
      });
      return typeof value === "string" && isAddress(value)
        ? getAddress(value as Address)
        : null;
    } catch {
      return null;
    }
  })();
  const payoutMismatch =
    currentPayoutRecipient != null &&
    !sameAddress(currentPayoutRecipient, expectedPayoutRouter);
  const payoutRecipientCallData = encodeFunctionData({
    abi: COIN_PAYOUT_RECIPIENT_ABI,
    functionName: "setPayoutRecipient",
    args: [expectedPayoutRouter],
  });
  const canSetPayoutRecipientFromOwner = await (async () => {
    if (!payoutMismatch) return false;
    try {
      await publicClient.call({
        to: args.creatorToken,
        data: payoutRecipientCallData,
        account: OWNER_CSW,
      });
      return true;
    } catch {
      return false;
    }
  })();

  const creatorCoinPolicyControllerOwnershipPlan = includeCreatorCoinPolicyGrant
    ? await planCreatorCoinPolicyControllerOwnershipGrant({
        publicClient: publicClient as Parameters<
          typeof planCreatorCoinPolicyControllerOwnershipGrant
        >[0]["publicClient"],
        creatorToken: args.creatorToken,
        deploySender: OWNER_CSW,
        policyController: expectedCreatorCoinPolicyController,
      })
    : {
        needsGrant: false,
        grantMethod: null,
        grantCallData: null,
        coinOwners: null,
        policyControllerIsOwner: false,
        deploySenderIsCoinOwner: false,
        legacyCoinOwner: null,
      };

  const phase2CoreParams = {
    creatorToken: args.creatorToken,
    owner: OWNER_CSW,
    creatorTreasury: expectedProtocolTreasury,
    payoutRecipient: ZERO_ADDRESS,
    vault: expected.vault,
    wrapper: expected.wrapper,
    shareOFT: expected.shareOFT,
    shareSymbol: names.shareSymbol,
    version: vanityPlan.deploymentVersionUsed,
    floorPriceQ96: floorPriceQ96ForBatcher,
  } as const;
  const phase2FinalizeParams = {
    creatorToken: args.creatorToken,
    owner: OWNER_CSW,
    vault: expected.vault,
    wrapper: expected.wrapper,
    shareOFT: expected.shareOFT,
    gaugeController: expected.gaugeController,
    ccaLaunchArm: expected.ccaLaunchArm,
    oracle: expected.oracle,
    version: vanityPlan.deploymentVersionUsed,
    depositAmount: minFirstDeposit,
    requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
    floorPriceQ96: floorPriceQ96ForBatcher,
    auctionSteps,
  } as const;

  const phase2CoreState = await (async () => {
    const addrs = [
      expected.gaugeController,
      expected.ccaLaunchArm,
      expected.oracle,
    ] as const;
    const codes = await Promise.all(
      addrs.map((addr) =>
        publicClient.getBytecode({ address: addr }).catch(() => null),
      ),
    );
    const deployed = codes.map((code) => Boolean(code && code !== "0x"));
    return {
      gaugeDeployed: deployed[0] ?? false,
      ccaDeployed: deployed[1] ?? false,
      oracleDeployed: deployed[2] ?? false,
    };
  })();
  const phase2CoreAny =
    phase2CoreState.gaugeDeployed ||
    phase2CoreState.ccaDeployed ||
    phase2CoreState.oracleDeployed;
  const phase2CoreAll =
    phase2CoreState.gaugeDeployed &&
    phase2CoreState.ccaDeployed &&
    phase2CoreState.oracleDeployed;
  if (phase2CoreAny && !phase2CoreAll) {
    throw new Error(
      `Phase 2 core is partially deployed for deployment version (${vanityPlan.deploymentVersionUsed}). ` +
        "Expected gauge, CCA, and oracle to be all present or all absent.",
    );
  }

  const phase2ApproveCalls: Array<{
    target: Address;
    value: bigint;
    data: Hex;
  }> = [];
  const allowanceToBatcher = (await publicClient.readContract({
    address: args.creatorToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [OWNER_CSW, DEPLOYMENT_BATCHER],
  })) as bigint;
  if (allowanceToBatcher < minFirstDeposit) {
    if (allowanceToBatcher !== 0n) {
      phase2ApproveCalls.push({
        target: args.creatorToken,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [DEPLOYMENT_BATCHER, 0n],
        }),
      });
    }
    phase2ApproveCalls.push({
      target: args.creatorToken,
      value: 0n,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [DEPLOYMENT_BATCHER, minFirstDeposit],
      }),
    });
  }

  const finalizePhase2Calldata = encodeFunctionData({
    abi: DEPLOYMENT_BATCHER_ABI,
    functionName: "finalizePhase2",
    args: [phase2FinalizeParams],
  });
  const attachedFinalizeCalls = await attachFinalizeShareBridgeValueToCalls({
    publicClient: publicClient as Parameters<
      typeof attachFinalizeShareBridgeValueToCalls
    >[0]["publicClient"],
    calls: [
      { to: DEPLOYMENT_BATCHER, value: "0", data: finalizePhase2Calldata },
    ],
  });
  const finalizeBridgeNativeFee = parseCallValue(
    attachedFinalizeCalls[0]?.value ?? "0",
  );

  const phase2CoreCall = {
    target: DEPLOYMENT_BATCHER,
    value: 0n,
    data: encodeFunctionData({
      abi: DEPLOYMENT_BATCHER_ABI,
      functionName: "deployPhase2Core",
      args: [phase2CoreParams, phase1CodeIds],
    }),
  } as const;
  const phase2FinalizeCall = {
    target: DEPLOYMENT_BATCHER,
    value: finalizeBridgeNativeFee,
    data: finalizePhase2Calldata,
  } as const;

  const phase2CoreNeeded = !phase2CoreAll;
  const phase2CoreCalls = phase2CoreNeeded
    ? [...phase2ApproveCalls, phase2CoreCall]
    : [...phase2ApproveCalls];

  const phase2PreFinalizeCalls = [
    phase2AuxiliaryDeployCall,
    batcherWhitelistPayoutRouterCall,
    batcherSetPayoutRouterShareOftNoFeesCall,
  ].filter(
    (call): call is { target: Address; value: bigint; data: Hex } =>
      call != null,
  );

  const phase2ConfigCalls: Array<{
    target: Address;
    value: bigint;
    data: Hex;
  }> = [];
  if (!burnStreamAlreadyConfigured) {
    phase2ConfigCalls.push({
      target: expected.vault,
      value: 0n,
      data: encodeFunctionData({
        abi: CREATOR_VAULT_ADMIN_ABI,
        functionName: "setBurnStream",
        args: [expectedBurnStream],
      }),
    });
  }
  phase2ConfigCalls.push({
    target: expected.vault,
    value: 0n,
    data: encodeFunctionData({
      abi: CREATOR_VAULT_ADMIN_ABI,
      functionName: "setWhitelist",
      args: [expectedPayoutRouter, true],
    }),
  });
  if (!payoutRouterQueuerAlreadyAuthorized) {
    phase2ConfigCalls.push({
      target: expected.vault,
      value: 0n,
      data: encodeFunctionData({
        abi: CREATOR_VAULT_ADMIN_ABI,
        functionName: "setBurnStreamAuthorizedQueuer",
        args: [expectedPayoutRouter, true],
      }),
    });
  }
  if (payoutMismatch) {
    if (!canSetPayoutRecipientFromOwner) {
      throw new Error(
        `Cannot set creator payout recipient to router from ${OWNER_CSW}. Current payout recipient is ${currentPayoutRecipient}.`,
      );
    }
    phase2ConfigCalls.push({
      target: args.creatorToken,
      value: 0n,
      data: payoutRecipientCallData,
    });
  }
  if (
    includeCreatorCoinPolicyGrant &&
    creatorCoinPolicyControllerOwnershipPlan.needsGrant
  ) {
    if (!creatorCoinPolicyControllerOwnershipPlan.grantCallData) {
      throw new Error(
        `Cannot grant creator coin admin to policy controller ${expectedCreatorCoinPolicyController} from deploy sender ${OWNER_CSW}.`,
      );
    }
    phase2ConfigCalls.push({
      target: args.creatorToken,
      value: 0n,
      data: creatorCoinPolicyControllerOwnershipPlan.grantCallData,
    });
  }

  const fallbackV3InitialSqrtPriceX96 = (() => {
    const creatorUnit = 10n ** BigInt(token.decimals);
    const usdcUnit = 10n ** 6n;
    const usdcPerCreatorBase = 10_000n;
    const creatorAddr = getAddress(args.creatorToken);
    const usdcAddr = getAddress(contracts.usdc ?? BASE_DEFAULTS.usdc);
    const token0IsCreator = creatorAddr.toLowerCase() < usdcAddr.toLowerCase();
    let amount0: bigint;
    let amount1: bigint;
    if (token0IsCreator) {
      amount0 = creatorUnit;
      amount1 = usdcPerCreatorBase;
    } else {
      amount0 = usdcUnit;
      amount1 = (creatorUnit * usdcUnit) / usdcPerCreatorBase;
    }
    const ratioX192 = (amount1 << 192n) / amount0;
    return sqrtBigInt(ratioX192);
  })();

  const marketV3InitialSqrtPriceX96 = await (async () => {
    try {
      const quote = await computeMarketFloorQuote({
        publicClient: publicClient as Parameters<
          typeof computeMarketFloorQuote
        >[0]["publicClient"],
        creatorCoin: args.creatorToken,
      });
      const weiPerCreator = quote.weiPerToken;
      if (weiPerCreator <= 0n) return null;
      const chainlink = getAddress(
        contracts.chainlinkEthUsd ?? BASE_DEFAULTS.chainlinkEthUsd,
      );
      const [decimals, round] = await Promise.all([
        publicClient.readContract({
          address: chainlink,
          abi: [
            {
              type: "function",
              name: "decimals",
              stateMutability: "view",
              inputs: [],
              outputs: [{ type: "uint8" }],
            },
          ] as const,
          functionName: "decimals",
        }) as Promise<number>,
        publicClient.readContract({
          address: chainlink,
          abi: [
            {
              type: "function",
              name: "latestRoundData",
              stateMutability: "view",
              inputs: [],
              outputs: [
                { name: "roundId", type: "uint80" },
                { name: "answer", type: "int256" },
                { name: "startedAt", type: "uint256" },
                { name: "updatedAt", type: "uint256" },
                { name: "answeredInRound", type: "uint80" },
              ],
            },
          ] as const,
          functionName: "latestRoundData",
        }),
      ]);
      const answer = BigInt((round as readonly unknown[])[1] as bigint);
      if (answer <= 0n) return null;

      const usdcPerCreatorBase =
        (weiPerCreator * answer * 1_000_000n) /
        (10n ** 18n * 10n ** BigInt(Number(decimals)));
      if (usdcPerCreatorBase <= 0n) return null;

      const creatorUnit = 10n ** BigInt(token.decimals);
      const usdcUnit = 10n ** 6n;
      const usdcAddr = getAddress(contracts.usdc ?? BASE_DEFAULTS.usdc);
      const creatorAddr = getAddress(args.creatorToken);
      const token0IsCreator =
        creatorAddr.toLowerCase() < usdcAddr.toLowerCase();
      let amount0: bigint;
      let amount1: bigint;
      if (token0IsCreator) {
        amount0 = creatorUnit;
        amount1 = usdcPerCreatorBase;
      } else {
        amount0 = usdcUnit;
        amount1 = (creatorUnit * usdcUnit) / usdcPerCreatorBase;
      }
      if (amount0 <= 0n || amount1 <= 0n) return null;
      const ratioX192 = (amount1 << 192n) / amount0;
      return sqrtBigInt(ratioX192);
    } catch {
      return null;
    }
  })();

  const ajnaKeeper = resolveProtocolAjnaKeeperAddress();
  if (!ajnaKeeper) {
    throw new Error(
      "Protocol Ajna keeper is not configured. Set PROTOCOL_AJNA_KEEPER before building the plan.",
    );
  }

  const phase3Calls: Array<{ target: Address; value: bigint; data: Hex }> = [
    {
      target: DEPLOYMENT_BATCHER,
      value: 0n,
      data: encodeFunctionData({
        abi: DEPLOYMENT_BATCHER_ABI,
        functionName: "deployPhase3Strategies",
        args: [
          {
            creatorToken: args.creatorToken,
            owner: OWNER_CSW,
            vault: expected.vault,
            version: vanityPlan.deploymentVersionUsed,
            initialSqrtPriceX96:
              marketV3InitialSqrtPriceX96 ?? fallbackV3InitialSqrtPriceX96,
            charmVaultName: token.symbol
              ? `4626: ${token.symbol.toLowerCase()}/USDC`
              : "4626: CREATOR/USDC",
            charmVaultSymbol: token.symbol
              ? `CV-${token.symbol.toLowerCase()}-USDC`
              : "CV-CREATOR-USDC",
            ajnaVaultName: token.symbol
              ? `Ajna 4626: ${token.symbol.toLowerCase()}/USDC`
              : "Ajna 4626: CREATOR/USDC",
            ajnaVaultSymbol: token.symbol
              ? `AJ-${token.symbol.toLowerCase()}-USDC`
              : "AJ-CREATOR-USDC",
            charmWeightBps: DEFAULT_CHARM_WEIGHT_BPS,
            ajnaWeightBps: DEFAULT_AJNA_WEIGHT_BPS,
            solanaWeightBps: DEFAULT_SOLANA_WEIGHT_BPS,
            ajnaBufferRatioBps: 1_000n,
            ajnaMinBucketIndex: 4_156n,
            ajnaKeeper,
            solanaKeeper: expectedProtocolTreasury,
            solanaMaxNavAge: DEFAULT_SOLANA_MAX_NAV_AGE,
            solanaMaxNavDeltaBpsPerUpdate: DEFAULT_SOLANA_MAX_NAV_DELTA_BPS,
            solanaMinBaseLiquidityBps: DEFAULT_SOLANA_MIN_BASE_LIQUIDITY_BPS,
            solanaBridgeAddress: ZERO_ADDRESS,
            enableAutoAllocate: false,
            expectedCharmProtocolFeePips:
              DEFAULT_CHARM_EXPECTED_PROTOCOL_FEE_PIPS,
          },
          {
            charmAlphaVaultDeploy: keccak256(
              toHex("charm-factory-sentinel-v1"),
            ),
            charmStrategy4626: keccak256(
              DEPLOY_BYTECODE.CharmStrategy4626 as Hex,
            ),
            ajnaVaultAuth: keccak256(DEPLOY_BYTECODE.AjnaVaultAuth as Hex),
            ajnaVault: keccak256(DEPLOY_BYTECODE.AjnaERC4626Vault as Hex),
            erc4626StrategyAdapter: keccak256(
              DEPLOY_BYTECODE.ERC4626StrategyAdapter as Hex,
            ),
            solanaStrategy: ZERO_BYTES32 as Hex,
          },
        ],
      }),
    },
    {
      target: expected.vault,
      value: 0n,
      data: encodeFunctionData({
        abi: CREATOR_VAULT_ADMIN_ABI,
        functionName: "setMinimumTotalIdle",
        args: [minimumTotalIdle],
      }),
    },
    {
      target: expected.vault,
      value: 0n,
      data: encodeFunctionData({
        abi: CREATOR_VAULT_ADMIN_ABI,
        functionName: "deployToStrategies",
        args: [],
      }),
    },
    ...impairmentPhase3Calls,
    ...phase2ConfigCalls,
  ];

  const phase4Calls: Array<{ target: Address; value: bigint; data: Hex }> = [
    {
      target: DEPLOYMENT_BATCHER,
      value: 0n,
      data: encodeFunctionData({
        abi: DEPLOYMENT_BATCHER_ABI,
        functionName: "launchDeferredAuction",
        args: [
          {
            creatorToken: args.creatorToken,
            owner: OWNER_CSW,
            shareOFT: expected.shareOFT,
            version: vanityPlan.deploymentVersionUsed,
            floorPriceQ96: floorPriceQ96ForBatcher,
            requiredRaise: DEFAULT_REQUIRED_RAISE_WEI,
            auctionSteps,
          },
        ],
      }),
    },
  ];

  const sessionPlan: SessionCreateRequest = {
    smartWallet: OWNER_CSW,
    creatorToken: args.creatorToken,
    ownerAddress: OWNER_CSW,
    phase1Calls: serializeSessionCalls(phase1Calls),
    phase2CoreCalls: serializeSessionCalls(phase2CoreCalls),
    ...(phase2PreFinalizeCalls.length > 0
      ? {
          phase2PreFinalizeCalls: serializeSessionCalls(phase2PreFinalizeCalls),
        }
      : {}),
    phase2FinalizeCalls: serializeSessionCalls([phase2FinalizeCall]),
    ...(phase3Calls.length > 0
      ? { phase3Calls: serializeSessionCalls(phase3Calls) }
      : {}),
    ...(phase4Calls.length > 0
      ? { phase4Calls: serializeSessionCalls(phase4Calls) }
      : {}),
    ...(args.solanaOvaultEnabled &&
    args.shareMeshMint &&
    args.solanaLotteryMode
      ? {
          solanaOvault: {
            enabled: DEFAULT_SOLANA_OVAULT_MESH_ENABLED,
            mode: args.solanaLotteryMode,
            shareMeshMint: args.shareMeshMint,
          },
        }
      : {}),
    vanity: {
      vaultPrefix: `0x${DEFAULT_VAULT_VANITY_PREFIX}`,
      shareSuffix: DEFAULT_SHARE_OFT_VANITY_SUFFIX,
    },
    version: vanityPlan.deploymentVersionUsed,
  };

  const outPath = path.resolve(process.cwd(), args.out);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(sessionPlan, null, 2)}\n`, "utf8");

  process.stdout.write(
    JSON.stringify(
      {
        out: outPath,
        batcher: DEPLOYMENT_BATCHER,
        vaultAuxiliaryDeployBatcher: VAULT_AUXILIARY_DEPLOY_BATCHER,
        owner: OWNER_CSW,
        creatorToken: args.creatorToken,
        vaultKind: args.vaultKind,
        version: sessionPlan.version,
        expectedAddresses: expected,
        counts: {
          phase1: sessionPlan.phase1Calls.length,
          phase2Core: sessionPlan.phase2CoreCalls.length,
          phase2PreFinalize: sessionPlan.phase2PreFinalizeCalls?.length ?? 0,
          phase2Finalize: sessionPlan.phase2FinalizeCalls.length,
          phase3: sessionPlan.phase3Calls?.length ?? 0,
          phase4: sessionPlan.phase4Calls?.length ?? 0,
        },
      },
      null,
      2,
    ) + "\n",
  );

  void expectedCreate2Deployer;
}

function sqrtBigInt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrtBigInt: negative");
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x1 + n / x1) >> 1n;
  }
  return x0;
}

main().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
