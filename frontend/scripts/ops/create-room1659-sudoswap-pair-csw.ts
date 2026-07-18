#!/usr/bin/env tsx

import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

import {
  ROOM_1659_CREATOR_COIN,
  ROOM_1659_ERC1155_ABI,
  ROOM_1659_ERC20_ABI,
  ROOM_1659_FACTORY_ABI,
  ROOM_1659_FRIEND_KEY,
  ROOM_1659_PAIR_ABI,
  ROOM_1659_PAIR_FEE,
  ROOM_1659_PAIR_VARIANT,
  ROOM_1659_POOL_TYPE,
  ROOM_1659_TOKEN_ID,
  ROOM_1659_XYK_CURVE_ABI,
  assertRoom1659PairPlanConfig,
  buildRoom1659CreateCalls,
  buildRoom1659PairOwnershipTransferCall,
  type Room1659PairPlanConfig,
  type Room1659UserOperationCall,
} from "../../server/_lib/alfaclub/room1659SudoswapPairPlan.js";
import {
  readCanonicalCswAddressEnv,
  readCanonicalCswOwnerIndexEnv,
  readCanonicalCswPrivyWalletIdEnv,
} from "../../server/_lib/wallet/canonicalCswEnv.js";
import {
  resolvePrivyCoinbaseSmartWalletOwnerContext,
  sendPrivyCoinbaseSmartWalletUserOperation,
} from "../../server/_lib/wallet/privyCoinbaseSmartWallet.js";
import { CANONICAL_CSW_ADDRESS } from "../../src/wallet/canonicalWalletPolicy.js";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const CURVE_OK = 0;

type Mode =
  | { kind: "dry-run" }
  | { kind: "apply" }
  | { kind: "finalize"; pair: Address };

type SeederSnapshot = {
  canonicalCswHasCode: boolean;
  factoryHasCode: boolean;
  curveHasCode: boolean;
  pairOwnerHasCode: boolean;
  factoryOwner: Address;
  curveAllowed: boolean;
  protocolFeeMultiplier: bigint;
  availableKeys: bigint;
  availableCreatorCoin: bigint;
  factoryHasFriendKeyApproval: boolean;
  factoryCreatorCoinAllowance: bigint;
  oneKeyBuyQuote: bigint;
  oneKeyBuyQuoteError: number;
  oneKeySellQuote: bigint;
  oneKeySellQuoteError: number;
};

type PairSnapshot = {
  hasCode: boolean;
  validPair: boolean;
  owner: Address;
  factory: Address;
  pairVariant: number;
  poolType: number;
  token: Address;
  nft: Address;
  nftId: bigint;
  curve: Address;
  fee: bigint;
  delta: bigint;
  spotPrice: bigint;
  keyBalance: bigint;
  creatorCoinBalance: bigint;
  factoryHasFriendKeyApproval: boolean;
  factoryCreatorCoinAllowance: bigint;
};

function readMode(): Mode {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  const finalizeIndex = process.argv.indexOf("--finalize-pair");
  const finalizeRaw = finalizeIndex >= 0 ? process.argv[finalizeIndex + 1] : "";
  const selected = Number(dryRun) + Number(apply) + Number(finalizeIndex >= 0);
  if (selected !== 1) {
    throw new Error(
      "Pass exactly one of --dry-run, --apply, or --finalize-pair 0x...",
    );
  }
  if (dryRun) return { kind: "dry-run" };
  if (apply) return { kind: "apply" };
  if (!finalizeRaw || !isAddress(finalizeRaw))
    throw new Error("--finalize-pair requires an address");
  return { kind: "finalize", pair: getAddress(finalizeRaw) };
}

function envAddress(names: readonly string[]): Address {
  const raw = names.map((name) => process.env[name]?.trim()).find(Boolean);
  if (!raw || !isAddress(raw)) throw new Error(`${names[0]}_not_configured`);
  const address = getAddress(raw);
  if (address === ZERO_ADDRESS) throw new Error(`${names[0]}_not_configured`);
  return address;
}

function envBigInt(name: string): bigint {
  const raw = String(process.env[name] ?? "").trim();
  if (!/^\d+$/.test(raw)) throw new Error(`${name}_invalid`);
  return BigInt(raw);
}

function readPlanConfig(): Room1659PairPlanConfig {
  const config = {
    factory: envAddress([
      "SUDOSWAP_PAIR_FACTORY",
      "VITE_SUDOSWAP_PAIR_FACTORY",
    ]),
    xykCurve: envAddress(["SUDOSWAP_XYK_CURVE", "VITE_SUDOSWAP_XYK_CURVE"]),
    pairOwner: envAddress(["PAIR_OWNER", "ALFACLUB_MARKET_ADMIN_SAFE"]),
    initialKeyBalance: envBigInt("INITIAL_KEY_BALANCE"),
    initialCreatorCoinBalance: envBigInt("INITIAL_CREATOR_COIN_BALANCE"),
    virtualKeyReserve: envBigInt("VIRTUAL_KEY_RESERVE"),
    virtualCreatorCoinReserve: envBigInt("VIRTUAL_CREATOR_COIN_RESERVE"),
    pairFee: envBigInt("PAIR_FEE"),
  };
  assertRoom1659PairPlanConfig(config);
  return config;
}

function readCanonicalCsw(): Address {
  const pinned = getAddress(CANONICAL_CSW_ADDRESS);
  const configuredRaw = readCanonicalCswAddressEnv().trim();
  if (!configuredRaw) return pinned;
  if (!isAddress(configuredRaw))
    throw new Error("CANONICAL_CSW_ADDRESS_invalid");
  const configured = getAddress(configuredRaw);
  if (configured !== pinned)
    throw new Error("CANONICAL_CSW_ADDRESS_policy_mismatch");
  return configured;
}

function readRpcUrl(): string {
  return (
    String(process.env.BASE_RPC_URL ?? "").trim() ||
    "https://base-rpc.publicnode.com"
  );
}

function createBasePublicClient() {
  return createPublicClient({ chain: base, transport: http(readRpcUrl()) });
}

type BasePublicClient = ReturnType<typeof createBasePublicClient>;

function readBundlerUrl(): string {
  const candidates = [
    process.env.CDP_PAYMASTER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_URL,
    process.env.CDP_PAYMASTER_AND_BUNDLER_ENDPOINT,
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }
  throw new Error("Bundler URL missing (CDP_PAYMASTER_URL).");
}

function json(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

function printableCalls(calls: readonly Room1659UserOperationCall[]) {
  return calls.map((call, index) => ({
    index,
    to: call.to,
    value: call.value.toString(),
    data: call.data,
  }));
}

async function readSeederSnapshot(
  client: BasePublicClient,
  canonicalCsw: Address,
  config: Room1659PairPlanConfig,
): Promise<SeederSnapshot> {
  const [
    canonicalCswCode,
    factoryCode,
    curveCode,
    pairOwnerCode,
    factoryOwner,
    curveAllowed,
    protocolFeeMultiplier,
    availableKeys,
    availableCreatorCoin,
    factoryHasFriendKeyApproval,
    factoryCreatorCoinAllowance,
  ] = await Promise.all([
    client.getBytecode({ address: canonicalCsw }),
    client.getBytecode({ address: config.factory }),
    client.getBytecode({ address: config.xykCurve }),
    client.getBytecode({ address: config.pairOwner }),
    client.readContract({
      address: config.factory,
      abi: ROOM_1659_FACTORY_ABI,
      functionName: "owner",
    }),
    client.readContract({
      address: config.factory,
      abi: ROOM_1659_FACTORY_ABI,
      functionName: "bondingCurveAllowed",
      args: [config.xykCurve],
    }),
    client.readContract({
      address: config.factory,
      abi: ROOM_1659_FACTORY_ABI,
      functionName: "protocolFeeMultiplier",
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: ROOM_1659_ERC1155_ABI,
      functionName: "balanceOf",
      args: [canonicalCsw, ROOM_1659_TOKEN_ID],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: ROOM_1659_ERC20_ABI,
      functionName: "balanceOf",
      args: [canonicalCsw],
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: ROOM_1659_ERC1155_ABI,
      functionName: "isApprovedForAll",
      args: [canonicalCsw, config.factory],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: ROOM_1659_ERC20_ABI,
      functionName: "allowance",
      args: [canonicalCsw, config.factory],
    }),
  ]);

  const [buyQuote, sellQuote] = await Promise.all([
    client.readContract({
      address: config.xykCurve,
      abi: ROOM_1659_XYK_CURVE_ABI,
      functionName: "getBuyInfo",
      args: [
        config.virtualCreatorCoinReserve,
        config.virtualKeyReserve,
        1n,
        config.pairFee,
        protocolFeeMultiplier,
      ],
    }),
    client.readContract({
      address: config.xykCurve,
      abi: ROOM_1659_XYK_CURVE_ABI,
      functionName: "getSellInfo",
      args: [
        config.virtualCreatorCoinReserve,
        config.virtualKeyReserve,
        1n,
        config.pairFee,
        protocolFeeMultiplier,
      ],
    }),
  ]);

  return {
    canonicalCswHasCode: Boolean(canonicalCswCode && canonicalCswCode !== "0x"),
    factoryHasCode: Boolean(factoryCode && factoryCode !== "0x"),
    curveHasCode: Boolean(curveCode && curveCode !== "0x"),
    pairOwnerHasCode: Boolean(pairOwnerCode && pairOwnerCode !== "0x"),
    factoryOwner: getAddress(factoryOwner),
    curveAllowed,
    protocolFeeMultiplier,
    availableKeys,
    availableCreatorCoin,
    factoryHasFriendKeyApproval,
    factoryCreatorCoinAllowance,
    oneKeyBuyQuoteError: buyQuote[0],
    oneKeyBuyQuote: buyQuote[3],
    oneKeySellQuoteError: sellQuote[0],
    oneKeySellQuote: sellQuote[3],
  };
}

function assertSeederSnapshot(
  snapshot: SeederSnapshot,
  config: Room1659PairPlanConfig,
): void {
  if (!snapshot.canonicalCswHasCode)
    throw new Error("canonical_csw_has_no_code");
  if (!snapshot.factoryHasCode) throw new Error("sudoswap_factory_has_no_code");
  if (!snapshot.curveHasCode) throw new Error("xyk_curve_has_no_code");
  if (!snapshot.pairOwnerHasCode) throw new Error("pair_owner_has_no_code");
  if (!snapshot.curveAllowed)
    throw new Error("xyk_curve_not_factory_allowlisted");
  if (snapshot.availableKeys <= config.initialKeyBalance) {
    throw new Error("seed_must_leave_one_room_key_in_canonical_csw");
  }
  if (snapshot.availableCreatorCoin < config.initialCreatorCoinBalance) {
    throw new Error("canonical_csw_creator_coin_balance_insufficient");
  }
  if (snapshot.factoryHasFriendKeyApproval)
    throw new Error("preexisting_friend_key_factory_approval");
  if (snapshot.factoryCreatorCoinAllowance !== 0n) {
    throw new Error("preexisting_creator_coin_factory_allowance");
  }
  if (
    snapshot.oneKeyBuyQuoteError !== CURVE_OK ||
    snapshot.oneKeyBuyQuote <= 0n
  ) {
    throw new Error("one_key_buy_quote_invalid");
  }
  if (
    snapshot.oneKeySellQuoteError !== CURVE_OK ||
    snapshot.oneKeySellQuote <= 0n
  ) {
    throw new Error("one_key_sell_quote_invalid");
  }
  if (snapshot.oneKeySellQuote > config.initialCreatorCoinBalance) {
    throw new Error("initial_creator_coin_inventory_cannot_fund_one_key_sell");
  }
}

async function readPairSnapshot(
  client: BasePublicClient,
  pair: Address,
  canonicalCsw: Address,
  config: Room1659PairPlanConfig,
): Promise<PairSnapshot> {
  const [
    code,
    validPair,
    owner,
    factory,
    pairVariant,
    poolType,
    token,
    nft,
    nftId,
    curve,
    fee,
    delta,
    spotPrice,
    keyBalance,
    creatorCoinBalance,
    factoryHasFriendKeyApproval,
    factoryCreatorCoinAllowance,
  ] = await Promise.all([
    client.getBytecode({ address: pair }),
    client.readContract({
      address: config.factory,
      abi: ROOM_1659_FACTORY_ABI,
      functionName: "isValidPair",
      args: [pair],
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "owner",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "pairVariant",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "poolType",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "token",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "nft",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "nftId",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "bondingCurve",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "fee",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "delta",
    }),
    client.readContract({
      address: pair,
      abi: ROOM_1659_PAIR_ABI,
      functionName: "spotPrice",
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: ROOM_1659_ERC1155_ABI,
      functionName: "balanceOf",
      args: [pair, ROOM_1659_TOKEN_ID],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: ROOM_1659_ERC20_ABI,
      functionName: "balanceOf",
      args: [pair],
    }),
    client.readContract({
      address: ROOM_1659_FRIEND_KEY,
      abi: ROOM_1659_ERC1155_ABI,
      functionName: "isApprovedForAll",
      args: [canonicalCsw, config.factory],
    }),
    client.readContract({
      address: ROOM_1659_CREATOR_COIN,
      abi: ROOM_1659_ERC20_ABI,
      functionName: "allowance",
      args: [canonicalCsw, config.factory],
    }),
  ]);

  return {
    hasCode: Boolean(code && code !== "0x"),
    validPair,
    owner: getAddress(owner),
    factory: getAddress(factory),
    pairVariant,
    poolType,
    token: getAddress(token),
    nft: getAddress(nft),
    nftId,
    curve: getAddress(curve),
    fee,
    delta,
    spotPrice,
    keyBalance,
    creatorCoinBalance,
    factoryHasFriendKeyApproval,
    factoryCreatorCoinAllowance,
  };
}

function assertPairSnapshot(
  snapshot: PairSnapshot,
  canonicalCsw: Address,
  config: Room1659PairPlanConfig,
): void {
  if (!snapshot.hasCode || !snapshot.validPair)
    throw new Error("pair_not_factory_authenticated");
  if (snapshot.owner !== canonicalCsw && snapshot.owner !== config.pairOwner) {
    throw new Error("pair_owner_is_neither_canonical_csw_nor_admin_safe");
  }
  if (snapshot.factory !== config.factory)
    throw new Error("pair_factory_mismatch");
  if (snapshot.pairVariant !== ROOM_1659_PAIR_VARIANT)
    throw new Error("pair_variant_mismatch");
  if (snapshot.poolType !== ROOM_1659_POOL_TYPE)
    throw new Error("pair_pool_type_mismatch");
  if (snapshot.token !== ROOM_1659_CREATOR_COIN)
    throw new Error("pair_creator_coin_mismatch");
  if (snapshot.nft !== ROOM_1659_FRIEND_KEY)
    throw new Error("pair_friend_key_mismatch");
  if (snapshot.nftId !== ROOM_1659_TOKEN_ID)
    throw new Error("pair_token_id_mismatch");
  if (snapshot.curve !== config.xykCurve)
    throw new Error("pair_curve_mismatch");
  if (snapshot.fee !== ROOM_1659_PAIR_FEE) throw new Error("pair_fee_mismatch");
  if (snapshot.delta !== config.virtualKeyReserve)
    throw new Error("pair_virtual_key_reserve_mismatch");
  if (snapshot.spotPrice !== config.virtualCreatorCoinReserve) {
    throw new Error("pair_virtual_creator_coin_reserve_mismatch");
  }
  if (snapshot.keyBalance !== config.initialKeyBalance)
    throw new Error("pair_key_inventory_mismatch");
  if (snapshot.creatorCoinBalance !== config.initialCreatorCoinBalance) {
    throw new Error("pair_creator_coin_inventory_mismatch");
  }
  if (snapshot.factoryHasFriendKeyApproval)
    throw new Error("friend_key_factory_approval_not_revoked");
  if (snapshot.factoryCreatorCoinAllowance !== 0n) {
    throw new Error("creator_coin_factory_allowance_not_revoked");
  }
}

async function resolveOwnerContext(
  client: BasePublicClient,
  canonicalCsw: Address,
) {
  const walletId = readCanonicalCswPrivyWalletIdEnv();
  if (!walletId) throw new Error("CANONICAL_CSW_PRIVY_WALLET_ID_missing");
  const ownerIndexRaw = readCanonicalCswOwnerIndexEnv();
  const configuredOwnerIndex = ownerIndexRaw
    ? Number(ownerIndexRaw)
    : Number.NaN;
  const context = await resolvePrivyCoinbaseSmartWalletOwnerContext({
    publicClient: client,
    walletId,
    smartWallet: canonicalCsw,
    expectedOwnerAddress: null,
    configuredOwnerIndex: Number.isSafeInteger(configuredOwnerIndex)
      ? configuredOwnerIndex
      : null,
    allowConfiguredOwnerIndexFallback: true,
    maxScan: 512,
  });
  return { walletId, ...context };
}

async function submitCalls(
  client: BasePublicClient,
  canonicalCsw: Address,
  calls: Room1659UserOperationCall[],
  ownerContext: Awaited<ReturnType<typeof resolveOwnerContext>>,
) {
  return sendPrivyCoinbaseSmartWalletUserOperation({
    publicClient: client,
    bundlerUrl: readBundlerUrl(),
    walletId: ownerContext.walletId,
    smartWallet: canonicalCsw,
    ownerAddress: ownerContext.ownerAddress,
    ownerIndex: ownerContext.ownerIndex,
    calls,
    // The create batch has state dependencies between approvals and the
    // factory call. The helper's optional per-call eth_call simulation cannot
    // model those dependencies; the bundler still simulates the complete
    // atomic UserOperation before accepting it.
    simulate: false,
  });
}

async function transferPairOwnership(
  client: BasePublicClient,
  pair: Address,
  canonicalCsw: Address,
  config: Room1659PairPlanConfig,
  ownerContext: Awaited<ReturnType<typeof resolveOwnerContext>>,
) {
  const before = await readPairSnapshot(client, pair, canonicalCsw, config);
  assertPairSnapshot(before, canonicalCsw, config);
  if (before.owner === config.pairOwner) {
    console.log(
      `[room1659-pair] pair ${pair} is already owned by ${config.pairOwner}`,
    );
    return null;
  }

  console.log(
    `[room1659-pair] recovery checkpoint pair=${pair} owner=${before.owner}`,
  );
  const transfer = buildRoom1659PairOwnershipTransferCall(
    pair,
    config.pairOwner,
  );
  const result = await submitCalls(
    client,
    canonicalCsw,
    [transfer],
    ownerContext,
  );
  const after = await readPairSnapshot(client, pair, canonicalCsw, config);
  assertPairSnapshot(after, canonicalCsw, config);
  if (after.owner !== config.pairOwner)
    throw new Error("pair_ownership_transfer_postcondition_failed");
  return { result, after };
}

async function main(): Promise<void> {
  const mode = readMode();
  const config = readPlanConfig();
  const canonicalCsw = readCanonicalCsw();
  const client = createBasePublicClient();
  const calls = buildRoom1659CreateCalls(config);

  if (mode.kind === "finalize") {
    const [pairSnapshot, pairOwnerCode] = await Promise.all([
      readPairSnapshot(client, mode.pair, canonicalCsw, config),
      client.getBytecode({ address: config.pairOwner }),
    ]);
    assertPairSnapshot(pairSnapshot, canonicalCsw, config);
    if (!pairOwnerCode || pairOwnerCode === "0x")
      throw new Error("pair_owner_has_no_code");
    console.log(
      json({
        mode: mode.kind,
        chainId: base.id,
        canonicalCsw,
        config,
        pair: mode.pair,
        pairSnapshot,
        ownershipTransfer: printableCalls([
          buildRoom1659PairOwnershipTransferCall(mode.pair, config.pairOwner),
        ])[0],
      }),
    );
    if (pairSnapshot.owner === config.pairOwner) {
      console.log(`[room1659-pair] pair ${mode.pair} is already finalized.`);
      return;
    }
    const ownerContext = await resolveOwnerContext(client, canonicalCsw);
    console.log(
      `[room1659-pair] canonical CSW owner resolved address=${ownerContext.ownerAddress} index=${ownerContext.ownerIndex}`,
    );
    const finalized = await transferPairOwnership(
      client,
      mode.pair,
      canonicalCsw,
      config,
      ownerContext,
    );
    console.log(
      json({ finalizedPair: mode.pair, ownershipTransfer: finalized }),
    );
    return;
  }

  const snapshot = await readSeederSnapshot(client, canonicalCsw, config);
  assertSeederSnapshot(snapshot, config);

  console.log(
    json({
      mode: mode.kind,
      chainId: base.id,
      canonicalCsw,
      config,
      seederSnapshot: snapshot,
      createCalls: printableCalls(calls),
      ownershipTransfer: "submitted only after emitted pair verification",
    }),
  );

  if (mode.kind === "dry-run") {
    console.log(
      "[room1659-pair] dry-run complete; no UserOperation was signed or submitted.",
    );
    return;
  }

  const ownerContext = await resolveOwnerContext(client, canonicalCsw);
  console.log(
    `[room1659-pair] canonical CSW owner resolved address=${ownerContext.ownerAddress} index=${ownerContext.ownerIndex}`,
  );

  const configuredPairRaw = String(
    process.env.ALFACLUB_ROOM_1659_SUDOSWAP_PAIR ??
      process.env.VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR ??
      "",
  ).trim();
  if (
    isAddress(configuredPairRaw) &&
    getAddress(configuredPairRaw) !== ZERO_ADDRESS
  ) {
    throw new Error(
      "room_1659_pair_already_configured_refusing_duplicate_creation",
    );
  }

  const createResult = await submitCalls(
    client,
    canonicalCsw,
    calls,
    ownerContext,
  );
  const receipt = await client.getTransactionReceipt({
    hash: createResult.txHash,
  });
  const createdEvents = parseEventLogs({
    abi: ROOM_1659_FACTORY_ABI,
    eventName: "NewERC1155Pair",
    logs: receipt.logs,
    strict: true,
  }).filter(
    (event) =>
      getAddress(event.address) === config.factory &&
      event.args.initialBalance === config.initialKeyBalance,
  );
  if (createdEvents.length !== 1)
    throw new Error("expected_exactly_one_room_1659_pair_event");
  const pair = getAddress(createdEvents[0]!.args.poolAddress);
  const createdSnapshot = await readPairSnapshot(
    client,
    pair,
    canonicalCsw,
    config,
  );
  assertPairSnapshot(createdSnapshot, canonicalCsw, config);
  if (createdSnapshot.owner !== canonicalCsw)
    throw new Error("new_pair_not_owned_by_canonical_csw");

  console.log(
    json({
      createdPair: pair,
      createUserOpHash: createResult.userOpHash,
      createTransactionHash: createResult.txHash,
      createdSnapshot,
      recoveryCommand: `pnpm -C frontend ops:alfaclub-sudoswap-seed-csw --finalize-pair ${pair}`,
    }),
  );

  const finalized = await transferPairOwnership(
    client,
    pair,
    canonicalCsw,
    config,
    ownerContext,
  );
  console.log(
    json({
      completed: true,
      pair,
      createUserOpHash: createResult.userOpHash,
      createTransactionHash: createResult.txHash,
      ownershipTransferUserOpHash: finalized?.result.userOpHash ?? null,
      ownershipTransferTransactionHash: finalized?.result.txHash ?? null,
      finalOwner: config.pairOwner,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const detail =
    error && typeof error === "object" && "causeMessage" in error
      ? String((error as { causeMessage?: unknown }).causeMessage ?? "")
      : "";
  console.error(
    `[room1659-pair] failed: ${message}${detail ? `; detail: ${detail}` : ""}`,
  );
  process.exitCode = 1;
});
