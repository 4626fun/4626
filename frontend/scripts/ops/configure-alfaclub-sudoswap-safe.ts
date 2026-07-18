#!/usr/bin/env tsx

import Safe from "@safe-global/protocol-kit";
import { OperationType } from "@safe-global/types-kit";
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { base } from "viem/chains";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const CANONICAL_PERMIT2 = getAddress(
  "0x000000000022D473030F116dDEE9F6B43aC78BA3",
);
const FRIEND_KEY = getAddress("0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F");
const DEFAULT_CREATOR_COIN = getAddress(
  "0x5b674196812451b7cec024fe9d22d2c0b172fa75",
);
const DEFAULT_TOKEN_ID = 1659n;
const ERC1155_ERC20_VARIANT = 3;
const TRADE_POOL_TYPE = 2;
const TRADING_PAIR_FEE = 69_000_000_000_000_000n;

const FACTORY_ABI = parseAbi([
  "function owner() view returns (address)",
  "function isValidPair(address pair) view returns (bool)",
  "function bondingCurveAllowed(address curve) view returns (bool)",
  "function routerStatus(address router) view returns (bool allowed, bool wasEverTouched)",
]);
const ADAPTER_ABI = parseAbi([
  "function owner() view returns (address)",
  "function factory() view returns (address)",
  "function permit2() view returns (address)",
  "function friendKey() view returns (address)",
  "function xykCurve() view returns (address)",
  "function universalRouter() view returns (address)",
  "function markets(address pair) view returns (address creatorCoin, uint256 tokenId, bool allowed)",
  "function setMarket(address pair, address creatorCoin, uint256 tokenId, bool allowed)",
]);
const ROUTER_ABI = parseAbi([
  "function SUDOSWAP_ADAPTER() view returns (address)",
]);
const PAIR_ABI = parseAbi([
  "function factory() view returns (address)",
  "function pairVariant() pure returns (uint8)",
  "function poolType() view returns (uint8)",
  "function token() view returns (address)",
  "function nft() view returns (address)",
  "function nftId() pure returns (uint256)",
  "function bondingCurve() view returns (address)",
  "function fee() view returns (uint96)",
]);

type Config = {
  safe: Address;
  factory: Address;
  curve: Address;
  adapter: Address;
  router: Address;
  pair: Address;
  creatorCoin: Address;
  tokenId: bigint;
};

type Snapshot = {
  safeHasCode: boolean;
  factoryOwner: Address;
  curveAllowed: boolean;
  validPair: boolean;
  routerAllowed: boolean;
  routerWasEverTouched: boolean;
  adapterOwner: Address;
  adapterFactory: Address;
  adapterPermit2: Address;
  adapterFriendKey: Address;
  adapterCurve: Address;
  adapterRouter: Address;
  routerAdapter: Address;
  marketCreatorCoin: Address;
  marketTokenId: bigint;
  marketAllowed: boolean;
  pairFactory: Address;
  pairVariant: number;
  poolType: number;
  pairToken: Address;
  pairNft: Address;
  pairTokenId: bigint;
  pairCurve: Address;
  pairFee: bigint;
};

type ReadClient = Pick<
  ReturnType<typeof createPublicClient>,
  "getBytecode" | "readContract"
>;

function envAddress(names: readonly string[], fallback?: Address): Address {
  const raw = names.map((name) => process.env[name]?.trim()).find(Boolean);
  if (!raw && fallback) return fallback;
  if (!raw || !isAddress(raw)) throw new Error(`${names[0]}_not_configured`);
  const address = getAddress(raw);
  if (address === ZERO_ADDRESS) throw new Error(`${names[0]}_not_configured`);
  return address;
}

function envTokenId(): bigint {
  const raw = String(
    process.env.ALFACLUB_LP_TOKEN_ID ?? DEFAULT_TOKEN_ID,
  ).trim();
  if (!/^\d+$/.test(raw) || BigInt(raw) <= 0n)
    throw new Error("ALFACLUB_LP_TOKEN_ID_invalid");
  return BigInt(raw);
}

function normalizePrivateKey(value: string): Hex {
  const trimmed = value.trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    throw new Error("PRIVATE_KEY must be a 32-byte 0x-prefixed key");
  }
  return trimmed as Hex;
}

function readConfig(): Config {
  return {
    safe: envAddress(["ALFACLUB_MARKET_ADMIN_SAFE"]),
    factory: envAddress([
      "SUDOSWAP_PAIR_FACTORY",
      "VITE_SUDOSWAP_PAIR_FACTORY",
    ]),
    curve: envAddress(["SUDOSWAP_XYK_CURVE", "VITE_SUDOSWAP_XYK_CURVE"]),
    adapter: envAddress([
      "ALFACLUB_SUDOSWAP_ADAPTER",
      "VITE_ALFACLUB_SUDOSWAP_ADAPTER",
    ]),
    router: envAddress([
      "ALFACLUB_UNIVERSAL_ROUTER",
      "VITE_ALFACLUB_UNIVERSAL_ROUTER",
    ]),
    pair: envAddress([
      "ALFACLUB_ROOM_1659_SUDOSWAP_PAIR",
      "VITE_ALFACLUB_ROOM_1659_SUDOSWAP_PAIR",
    ]),
    creatorCoin: envAddress(["ALFACLUB_LP_CREATOR_COIN"], DEFAULT_CREATOR_COIN),
    tokenId: envTokenId(),
  };
}

async function readSnapshot(
  client: ReadClient,
  config: Config,
): Promise<Snapshot> {
  const [
    safeBytecode,
    factoryOwner,
    curveAllowed,
    validPair,
    routerStatus,
    adapterOwner,
    adapterFactory,
    adapterPermit2,
    adapterFriendKey,
    adapterCurve,
    adapterRouter,
    routerAdapter,
    market,
    pairFactory,
    pairVariant,
    poolType,
    pairToken,
    pairNft,
    pairTokenId,
    pairCurve,
    pairFee,
  ] = await Promise.all([
    client.getBytecode({ address: config.safe }),
    client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: "owner",
    }),
    client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: "bondingCurveAllowed",
      args: [config.curve],
    }),
    client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: "isValidPair",
      args: [config.pair],
    }),
    client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: "routerStatus",
      args: [config.adapter],
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "owner",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "permit2",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "friendKey",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "xykCurve",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "universalRouter",
    }),
    client.readContract({
      address: config.router,
      abi: ROUTER_ABI,
      functionName: "SUDOSWAP_ADAPTER",
    }),
    client.readContract({
      address: config.adapter,
      abi: ADAPTER_ABI,
      functionName: "markets",
      args: [config.pair],
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "factory",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "pairVariant",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "poolType",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "token",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "nft",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "nftId",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "bondingCurve",
    }),
    client.readContract({
      address: config.pair,
      abi: PAIR_ABI,
      functionName: "fee",
    }),
  ]);

  return {
    safeHasCode: Boolean(safeBytecode && safeBytecode !== "0x"),
    factoryOwner: getAddress(factoryOwner),
    curveAllowed,
    validPair,
    routerAllowed: routerStatus[0],
    routerWasEverTouched: routerStatus[1],
    adapterOwner: getAddress(adapterOwner),
    adapterFactory: getAddress(adapterFactory),
    adapterPermit2: getAddress(adapterPermit2),
    adapterFriendKey: getAddress(adapterFriendKey),
    adapterCurve: getAddress(adapterCurve),
    adapterRouter: getAddress(adapterRouter),
    routerAdapter: getAddress(routerAdapter),
    marketCreatorCoin: getAddress(market[0]),
    marketTokenId: market[1],
    marketAllowed: market[2],
    pairFactory: getAddress(pairFactory),
    pairVariant,
    poolType,
    pairToken: getAddress(pairToken),
    pairNft: getAddress(pairNft),
    pairTokenId,
    pairCurve: getAddress(pairCurve),
    pairFee,
  };
}

function assertStaticInvariants(config: Config, snapshot: Snapshot): void {
  if (!snapshot.safeHasCode) throw new Error("market_admin_safe_has_no_code");
  if (snapshot.adapterOwner !== config.safe)
    throw new Error("adapter_owner_mismatch");
  if (!snapshot.curveAllowed)
    throw new Error("xyk_curve_not_factory_allowlisted");
  if (!snapshot.validPair) throw new Error("pair_not_factory_authenticated");
  if (snapshot.adapterFactory !== config.factory)
    throw new Error("adapter_factory_mismatch");
  if (snapshot.adapterPermit2 !== CANONICAL_PERMIT2)
    throw new Error("adapter_permit2_mismatch");
  if (snapshot.adapterFriendKey !== FRIEND_KEY)
    throw new Error("adapter_friend_key_mismatch");
  if (snapshot.adapterCurve !== config.curve)
    throw new Error("adapter_curve_mismatch");
  if (snapshot.adapterRouter !== config.router)
    throw new Error("adapter_router_mismatch");
  if (snapshot.routerAdapter !== config.adapter)
    throw new Error("router_adapter_mismatch");
  if (snapshot.pairFactory !== config.factory)
    throw new Error("pair_factory_mismatch");
  if (snapshot.pairVariant !== ERC1155_ERC20_VARIANT)
    throw new Error("pair_variant_mismatch");
  if (snapshot.poolType !== TRADE_POOL_TYPE)
    throw new Error("pair_pool_type_mismatch");
  if (snapshot.pairToken !== config.creatorCoin)
    throw new Error("pair_creator_coin_mismatch");
  if (snapshot.pairNft !== FRIEND_KEY)
    throw new Error("pair_friend_key_mismatch");
  if (snapshot.pairTokenId !== config.tokenId)
    throw new Error("pair_token_id_mismatch");
  if (snapshot.pairCurve !== config.curve)
    throw new Error("pair_curve_mismatch");
  if (snapshot.pairFee !== TRADING_PAIR_FEE)
    throw new Error("pair_fee_not_690_bps");
  if (
    snapshot.marketAllowed &&
    (snapshot.marketCreatorCoin !== config.creatorCoin ||
      snapshot.marketTokenId !== config.tokenId)
  ) {
    throw new Error("enabled_adapter_market_binding_mismatch");
  }
}

function printableSnapshot(snapshot: Snapshot) {
  return {
    ...snapshot,
    marketTokenId: snapshot.marketTokenId.toString(),
    pairTokenId: snapshot.pairTokenId.toString(),
    pairFee: snapshot.pairFee.toString(),
  };
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const config = readConfig();
  const rpcUrl =
    process.env.BASE_RPC_URL?.trim() || "https://base-rpc.publicnode.com";
  const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
  const before = await readSnapshot(client, config);
  assertStaticInvariants(config, before);
  const transactions: Array<{
    to: Address;
    value: string;
    operation: OperationType;
    data: Hex;
  }> = [];
  if (!before.marketAllowed) {
    transactions.push({
      to: config.adapter,
      value: "0",
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: ADAPTER_ABI,
        functionName: "setMarket",
        args: [config.pair, config.creatorCoin, config.tokenId, true],
      }),
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        chainId: base.id,
        config: { ...config, tokenId: config.tokenId.toString() },
        before: printableSnapshot(before),
        transactions,
      },
      null,
      2,
    ),
  );

  if (transactions.length === 0) {
    console.log("The AlfaClub Sudoswap market is already configured.");
    return;
  }
  if (!execute) {
    console.log(
      "Dry-run complete. Review the ordered Safe calls before using --execute.",
    );
    return;
  }

  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: normalizePrivateKey(process.env.PRIVATE_KEY ?? ""),
    safeAddress: config.safe,
  });
  const signerAddress = await protocolKit.getSafeProvider().getSignerAddress();
  const owners = await protocolKit.getOwners();
  if (
    !signerAddress ||
    !owners.some((owner) => getAddress(owner) === getAddress(signerAddress))
  ) {
    throw new Error("configured_signer_is_not_market_admin_safe_owner");
  }
  if ((await protocolKit.getThreshold()) !== 1) {
    throw new Error(
      "market_admin_safe_threshold_requires_external_confirmation",
    );
  }

  const safeTransaction = await protocolKit.createTransaction({ transactions });
  const execution = await protocolKit.executeTransaction(safeTransaction);
  const hash =
    execution.hash ??
    (execution as { transactionResponse?: { hash?: Hex } }).transactionResponse
      ?.hash;
  if (!hash) throw new Error("safe_execution_hash_missing");
  const receipt = await client.waitForTransactionReceipt({
    hash: hash as Hex,
    timeout: 120_000,
  });
  if (receipt.status !== "success") throw new Error("safe_execution_reverted");

  const after = await readSnapshot(client, config);
  assertStaticInvariants(config, after);
  if (!after.marketAllowed) {
    throw new Error("sudoswap_configuration_postcondition_failed");
  }
  console.log(
    JSON.stringify(
      {
        executed: true,
        transactionHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        after: printableSnapshot(after),
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
