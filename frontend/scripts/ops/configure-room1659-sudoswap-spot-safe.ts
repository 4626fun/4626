#!/usr/bin/env tsx
/**
 * Nudge Room 1659 Sudoswap virtual spot so 1-key buy is a target % vs the
 * FriendKey bonding-curve buy (after fee), converted at live AKITA USD.
 *
 * Usage:
 *   pnpm exec tsx scripts/ops/configure-room1659-sudoswap-spot-safe.ts
 *   pnpm exec tsx scripts/ops/configure-room1659-sudoswap-spot-safe.ts --execute
 *   pnpm exec tsx scripts/ops/configure-room1659-sudoswap-spot-safe.ts --vs-curve=-0.02 --execute
 */
import Safe from "@safe-global/protocol-kit";
import { OperationType } from "@safe-global/types-kit";
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  getAddress,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const SAFE = getAddress("0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3");
const PAIR = getAddress("0x4a1bD15948A6a61DbE5dfD1e57d5982fD1285766");
const FRIEND = getAddress("0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F");
const AKITA = getAddress("0x5b674196812451b7cec024fe9d22d2c0b172fa75");
const CURVE = getAddress("0xd0A2f4ae5E816ec09374c67F6532063B60dE037B");
const FACTORY = getAddress("0x605145D263482684590f630E9e581B21E4938eb8");
const TOKEN_ID = 1659n;

const PAIR_ABI = parseAbi([
  "function owner() view returns (address)",
  "function spotPrice() view returns (uint128)",
  "function delta() view returns (uint128)",
  "function fee() view returns (uint256)",
  "function getBuyNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 inputAmount, uint256 protocolFee, uint256 royaltyAmount)",
  "function getSellNFTQuote(uint256 assetId, uint256 numItems) view returns (uint8 errorCode, uint256 newSpotPrice, uint256 newDelta, uint256 outputAmount, uint256 protocolFee, uint256 royaltyAmount)",
  "function changeSpotPrice(uint128 newSpotPrice)",
]);
const CURVE_ABI = parseAbi([
  "function getBuyInfo(uint128 spotPrice, uint128 delta, uint256 numItems, uint256 feeMultiplier, uint256 protocolFeeMultiplier) view returns (uint8 errorCode, uint128 newSpotPrice, uint128 newDelta, uint256 inputValue, uint256 tradeFee, uint256 protocolFee)",
  "function getSellInfo(uint128 spotPrice, uint128 delta, uint256 numItems, uint256 feeMultiplier, uint256 protocolFeeMultiplier) view returns (uint8 errorCode, uint128 newSpotPrice, uint128 newDelta, uint256 outputValue, uint256 tradeFee, uint256 protocolFee)",
]);
const FACTORY_ABI = parseAbi([
  "function protocolFeeMultiplier() view returns (uint256)",
]);
const FRIEND_ABI = parseAbi([
  "function getBuyPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)",
  "function getSellPriceAfterFee(uint256 id, uint256 amount) view returns (uint256)",
  "function totalSupply(uint256 id) view returns (uint256)",
]);

function normalizePrivateKey(raw: string): `0x${string}` {
  const trimmed = raw.trim();
  const normalized = (
    trimmed.startsWith("0x") || trimmed.startsWith("0X")
      ? `0x${trimmed.slice(2)}`
      : `0x${trimmed}`
  ) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error("private_key_invalid");
  }
  return normalized;
}

function readVsCurve(): number {
  const arg = process.argv.find((value) => value.startsWith("--vs-curve="));
  if (!arg) return -0.02;
  const parsed = Number(arg.slice("--vs-curve=".length));
  if (!Number.isFinite(parsed) || parsed <= -0.5 || parsed >= 0.5) {
    throw new Error("vs_curve_invalid");
  }
  return parsed;
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const vsCurve = readVsCurve();
  const rpcUrl =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.BASE_READ_RPC_URL?.trim() ||
    "https://mainnet.base.org";
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const [spot, delta, fee, buyLive, sellLive, protoFee, curveBuy, curveSell, supply, pairOwner, block] =
    await Promise.all([
      client.readContract({
        address: PAIR,
        abi: PAIR_ABI,
        functionName: "spotPrice",
      }),
      client.readContract({
        address: PAIR,
        abi: PAIR_ABI,
        functionName: "delta",
      }),
      client.readContract({
        address: PAIR,
        abi: PAIR_ABI,
        functionName: "fee",
      }),
      client.readContract({
        address: PAIR,
        abi: PAIR_ABI,
        functionName: "getBuyNFTQuote",
        args: [TOKEN_ID, 1n],
      }),
      client.readContract({
        address: PAIR,
        abi: PAIR_ABI,
        functionName: "getSellNFTQuote",
        args: [TOKEN_ID, 1n],
      }),
      client.readContract({
        address: FACTORY,
        abi: FACTORY_ABI,
        functionName: "protocolFeeMultiplier",
      }),
      client.readContract({
        address: FRIEND,
        abi: FRIEND_ABI,
        functionName: "getBuyPriceAfterFee",
        args: [TOKEN_ID, 1n],
      }),
      client.readContract({
        address: FRIEND,
        abi: FRIEND_ABI,
        functionName: "getSellPriceAfterFee",
        args: [TOKEN_ID, 1n],
      }),
      client.readContract({
        address: FRIEND,
        abi: FRIEND_ABI,
        functionName: "totalSupply",
        args: [TOKEN_ID],
      }),
      client.readContract({
        address: PAIR,
        abi: PAIR_ABI,
        functionName: "owner",
      }),
      client.getBlockNumber(),
    ]);

  if (getAddress(pairOwner) !== SAFE) {
    throw new Error(`pair_owner_mismatch:${pairOwner}`);
  }

  const dexs = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${AKITA}`,
  ).then((response) => response.json());
  const akitaUsd = Number(
    (dexs.pairs || []).find(
      (pair: { chainId?: string }) => pair.chainId === "base",
    )?.priceUsd || 0,
  );
  if (!(akitaUsd > 0)) throw new Error("akita_usd_unavailable");

  const curveBuyUsd = Number(formatUnits(curveBuy, 6));
  const targetBuyUsd = curveBuyUsd * (1 + vsCurve);
  const targetBuyAkita = targetBuyUsd / akitaUsd;
  const spotHuman = Number(formatUnits(spot, 18));
  const liveBuyAkita = Number(formatUnits(buyLive[3], 18));

  async function buyAtSpot(spotHumanValue: number): Promise<number> {
    const spotWei = BigInt(Math.round(spotHumanValue)) * 10n ** 18n;
    const quote = await client.readContract({
      address: CURVE,
      abi: CURVE_ABI,
      functionName: "getBuyInfo",
      args: [spotWei, delta, 1n, fee, protoFee],
    });
    if (Number(quote[0]) !== 0) {
      throw new Error(`buy_quote_error:${quote[0]}`);
    }
    return Number(formatUnits(quote[3], 18));
  }

  let lo = spotHuman * 0.2;
  let hi = spotHuman * 2;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const buyAkita = await buyAtSpot(mid);
    if (buyAkita < targetBuyAkita) lo = mid;
    else hi = mid;
  }
  const nextSpotHuman = (lo + hi) / 2;
  const nextSpotWei = BigInt(Math.round(nextSpotHuman)) * 10n ** 18n;

  const [nextBuy, nextSell] = await Promise.all([
    client.readContract({
      address: CURVE,
      abi: CURVE_ABI,
      functionName: "getBuyInfo",
      args: [nextSpotWei, delta, 1n, fee, protoFee],
    }),
    client.readContract({
      address: CURVE,
      abi: CURVE_ABI,
      functionName: "getSellInfo",
      args: [nextSpotWei, delta, 1n, fee, protoFee],
    }),
  ]);
  if (Number(nextBuy[0]) !== 0 || Number(nextSell[0]) !== 0) {
    throw new Error("next_quote_error");
  }

  const nextBuyAkita = Number(formatUnits(nextBuy[3], 18));
  const nextSellAkita = Number(formatUnits(nextSell[3], 18));
  const nextBuyUsd = nextBuyAkita * akitaUsd;
  const nextSellUsd = nextSellAkita * akitaUsd;

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        block: block.toString(),
        vsCurve,
        akitaUsd,
        curve: {
          supply: supply.toString(),
          buyUsd: curveBuyUsd,
          sellUsd: Number(formatUnits(curveSell, 6)),
        },
        current: {
          spot: spot.toString(),
          spotHuman,
          delta: delta.toString(),
          buyAkita: liveBuyAkita,
          buyUsd: liveBuyAkita * akitaUsd,
          sellAkita: Number(formatUnits(sellLive[3], 18)),
          sellUsd: Number(formatUnits(sellLive[3], 18)) * akitaUsd,
        },
        target: {
          buyUsd: targetBuyUsd,
          buyAkita: targetBuyAkita,
        },
        next: {
          spot: nextSpotWei.toString(),
          spotHuman: Math.round(nextSpotHuman),
          delta: delta.toString(),
          buyAkita: nextBuyAkita,
          buyUsd: nextBuyUsd,
          sellAkita: nextSellAkita,
          sellUsd: nextSellUsd,
          vsCurveBuyPct: (nextBuyUsd / curveBuyUsd - 1) * 100,
        },
      },
      null,
      2,
    ),
  );

  if (nextSpotWei === spot) {
    console.log("Spot already at target; nothing to execute.");
    return;
  }
  if (!execute) {
    console.log("Dry-run complete. Re-run with --execute to submit.");
    return;
  }

  const pk = normalizePrivateKey(process.env.PRIVATE_KEY ?? "");
  const signer = privateKeyToAccount(pk);
  const protocolKit = await Safe.init({
    provider: rpcUrl,
    signer: pk,
    safeAddress: SAFE,
  });
  const signerAddress = await protocolKit.getSafeProvider().getSignerAddress();
  const owners = (await protocolKit.getOwners()).map((owner) =>
    getAddress(owner),
  );
  if (!signerAddress || !owners.includes(getAddress(signerAddress))) {
    throw new Error(`signer_not_owner:${signerAddress ?? "null"}`);
  }
  if ((await protocolKit.getThreshold()) !== 1) {
    throw new Error("safe_threshold_requires_external_confirmation");
  }

  const transactions: Array<{
    to: Address;
    value: string;
    operation: OperationType;
    data: Hex;
  }> = [
    {
      to: PAIR,
      value: "0",
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: PAIR_ABI,
        functionName: "changeSpotPrice",
        args: [nextSpotWei],
      }),
    },
  ];

  console.log(
    JSON.stringify(
      { phase: "executing", signer: signer.address, nextSpot: nextSpotWei.toString() },
      null,
      2,
    ),
  );

  const safeTransaction = await protocolKit.createTransaction({
    transactions,
  });
  const execution = await protocolKit.executeTransaction(safeTransaction);
  const hash =
    (execution.hash as Hex | undefined) ??
    (
      execution as {
        transactionResponse?: { hash?: Hex };
      }
    ).transactionResponse?.hash;
  if (!hash) throw new Error("safe_execution_hash_missing");

  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 180_000,
  });
  if (receipt.status !== "success") throw new Error("safe_execution_reverted");

  const [spotAfter, buyAfter, sellAfter] = await Promise.all([
    client.readContract({
      address: PAIR,
      abi: PAIR_ABI,
      functionName: "spotPrice",
    }),
    client.readContract({
      address: PAIR,
      abi: PAIR_ABI,
      functionName: "getBuyNFTQuote",
      args: [TOKEN_ID, 1n],
    }),
    client.readContract({
      address: PAIR,
      abi: PAIR_ABI,
      functionName: "getSellNFTQuote",
      args: [TOKEN_ID, 1n],
    }),
  ]);

  const buyAfterAkita = Number(formatUnits(buyAfter[3], 18));
  const buyAfterUsd = buyAfterAkita * akitaUsd;
  const ok =
    spotAfter === nextSpotWei &&
    Math.abs(buyAfterUsd / curveBuyUsd - (1 + vsCurve)) < 0.005;

  console.log(
    JSON.stringify(
      {
        executed: true,
        ok,
        transactionHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        after: {
          spot: spotAfter.toString(),
          buyAkita: buyAfterAkita,
          buyUsd: buyAfterUsd,
          sellAkita: Number(formatUnits(sellAfter[3], 18)),
          sellUsd: Number(formatUnits(sellAfter[3], 18)) * akitaUsd,
          vsCurveBuyPct: (buyAfterUsd / curveBuyUsd - 1) * 100,
        },
      },
      null,
      2,
    ),
  );

  if (!ok) throw new Error("configure_postcondition_failed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
