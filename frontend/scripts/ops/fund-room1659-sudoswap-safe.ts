#!/usr/bin/env tsx
/**
 * Fund Room 1659 Sudoswap pair from protocol treasury Safe:
 * transfer 23M AKITA + 5 FriendKey #1659 into the live pair.
 *
 * Usage:
 *   pnpm exec tsx scripts/ops/fund-room1659-sudoswap-safe.ts           # dry-run
 *   pnpm exec tsx scripts/ops/fund-room1659-sudoswap-safe.ts --execute
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
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const SAFE = getAddress("0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3");
const PAIR = getAddress("0x4a1bD15948A6a61DbE5dfD1e57d5982fD1285766");
const FRIEND = getAddress("0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F");
const AKITA = getAddress("0x5b674196812451b7cec024fe9d22d2c0b172fa75");
const TOKEN_ID = 1659n;
const KEY_AMOUNT = 5n;
const AKITA_AMOUNT = parseUnits("23000000", 18);

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);
const FRIEND_ABI = parseAbi([
  "function balanceOf(address,uint256) view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
]);
const PAIR_ABI = parseAbi(["function owner() view returns (address)"]);

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

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");
  const rpcUrl =
    process.env.BASE_RPC_URL?.trim() ||
    process.env.BASE_READ_RPC_URL?.trim() ||
    "https://mainnet.base.org";
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });

  const [
    safeAkita,
    safeKeys,
    poolAkitaBefore,
    poolKeysBefore,
    pairOwner,
    ethBal,
    blockBefore,
  ] = await Promise.all([
    client.readContract({
      address: AKITA,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [SAFE],
    }),
    client.readContract({
      address: FRIEND,
      abi: FRIEND_ABI,
      functionName: "balanceOf",
      args: [SAFE, TOKEN_ID],
    }),
    client.readContract({
      address: AKITA,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [PAIR],
    }),
    client.readContract({
      address: FRIEND,
      abi: FRIEND_ABI,
      functionName: "balanceOf",
      args: [PAIR, TOKEN_ID],
    }),
    client.readContract({
      address: PAIR,
      abi: PAIR_ABI,
      functionName: "owner",
    }),
    client.getBalance({ address: SAFE }),
    client.getBlockNumber(),
  ]);

  if (getAddress(pairOwner) !== SAFE) {
    throw new Error(`pair_owner_mismatch:${pairOwner}`);
  }
  if (safeKeys < KEY_AMOUNT) {
    throw new Error(`safe_keys_insufficient:${safeKeys.toString()}`);
  }
  if (safeAkita < AKITA_AMOUNT) {
    throw new Error(`safe_akita_insufficient:${safeAkita.toString()}`);
  }

  const transactions: Array<{
    to: Address;
    value: string;
    operation: OperationType;
    data: Hex;
  }> = [
    {
      to: AKITA,
      value: "0",
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [PAIR, AKITA_AMOUNT],
      }),
    },
    {
      to: FRIEND,
      value: "0",
      operation: OperationType.Call,
      data: encodeFunctionData({
        abi: FRIEND_ABI,
        functionName: "safeTransferFrom",
        args: [SAFE, PAIR, TOKEN_ID, KEY_AMOUNT, "0x"],
      }),
    },
  ];

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        block: blockBefore.toString(),
        safe: SAFE,
        pair: PAIR,
        fund: {
          keys: KEY_AMOUNT.toString(),
          akita: formatUnits(AKITA_AMOUNT, 18),
        },
        before: {
          safeKeys: safeKeys.toString(),
          safeAkita: formatUnits(safeAkita, 18),
          poolKeys: poolKeysBefore.toString(),
          poolAkita: formatUnits(poolAkitaBefore, 18),
          safeEth: formatUnits(ethBal, 18),
        },
        expectedAfter: {
          poolKeys: (poolKeysBefore + KEY_AMOUNT).toString(),
          poolAkita: formatUnits(poolAkitaBefore + AKITA_AMOUNT, 18),
        },
        transactions: transactions.map((tx) => ({
          to: tx.to,
          data: tx.data.slice(0, 10),
        })),
      },
      null,
      2,
    ),
  );

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
  if (
    !signerAddress ||
    !owners.includes(getAddress(signerAddress))
  ) {
    throw new Error(`signer_not_owner:${signerAddress ?? "null"}`);
  }
  if ((await protocolKit.getThreshold()) !== 1) {
    throw new Error("safe_threshold_requires_external_confirmation");
  }

  console.log(
    JSON.stringify(
      { phase: "executing", signer: signer.address, ownerCount: owners.length },
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

  const [safeAkitaAfter, safeKeysAfter, poolAkitaAfter, poolKeysAfter] =
    await Promise.all([
      client.readContract({
        address: AKITA,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [SAFE],
      }),
      client.readContract({
        address: FRIEND,
        abi: FRIEND_ABI,
        functionName: "balanceOf",
        args: [SAFE, TOKEN_ID],
      }),
      client.readContract({
        address: AKITA,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [PAIR],
      }),
      client.readContract({
        address: FRIEND,
        abi: FRIEND_ABI,
        functionName: "balanceOf",
        args: [PAIR, TOKEN_ID],
      }),
    ]);

  const ok =
    poolKeysAfter === poolKeysBefore + KEY_AMOUNT &&
    poolAkitaAfter >= poolAkitaBefore + AKITA_AMOUNT - 1n;

  console.log(
    JSON.stringify(
      {
        executed: true,
        ok,
        transactionHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        after: {
          poolKeys: poolKeysAfter.toString(),
          poolAkita: formatUnits(poolAkitaAfter, 18),
          safeKeys: safeKeysAfter.toString(),
          safeAkita: formatUnits(safeAkitaAfter, 18),
        },
      },
      null,
      2,
    ),
  );

  if (!ok) throw new Error("fund_postcondition_failed");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
