import { decodeEventLog, getAddress } from "viem";

import type { BasePublicClient } from "./baseClient.js";
import {
  ZORA_ACCOUNT_MANAGER_ABI,
  ZORA_ACCOUNT_MANAGER_ADDRESS,
} from "./constants.js";

export type CswCreation = {
  cswAddress: `0x${string}`;
  baseOwner: `0x${string}`;
  initialOwners: `0x${string}`[];
  nonce: bigint;
  blockNumber: bigint;
  txHash: `0x${string}`;
  logIndex: number;
};

/**
 * Fetch ZoraSmartWalletCreated events across a single block window.
 * Throws on RPC error so the caller can decide whether to shrink the
 * window and retry.
 */
async function fetchWindow(
  client: BasePublicClient,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<CswCreation[]> {
  const logs = await client.getLogs({
    address: ZORA_ACCOUNT_MANAGER_ADDRESS,
    event: {
      type: "event",
      name: "ZoraSmartWalletCreated",
      inputs: [
        { name: "smartWallet", type: "address", indexed: true },
        { name: "baseOwner", type: "address", indexed: true },
        { name: "owners", type: "address[]", indexed: false },
        { name: "nonce", type: "uint256", indexed: false },
      ],
    },
    fromBlock,
    toBlock,
  });

  const out: CswCreation[] = [];
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: ZORA_ACCOUNT_MANAGER_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "ZoraSmartWalletCreated") continue;
      const args = decoded.args as {
        smartWallet: `0x${string}`;
        baseOwner: `0x${string}`;
        owners: readonly `0x${string}`[];
        nonce: bigint;
      };
      out.push({
        cswAddress: getAddress(args.smartWallet),
        baseOwner: getAddress(args.baseOwner),
        initialOwners: args.owners.map((a) => getAddress(a)),
        nonce: args.nonce,
        blockNumber: log.blockNumber ?? 0n,
        txHash: log.transactionHash ?? "0x",
        logIndex: log.logIndex ?? 0,
      });
    } catch (err) {
      console.warn(
        `[index] failed to decode log at ${log.transactionHash}:${log.logIndex}`,
        err,
      );
    }
  }
  return out;
}

/**
 * Scan *backwards* from a tip block in fixed-size windows, yielding
 * creations as they're found. Callers can `break` once they have
 * enough — perfect for a POC that wants just the N most recent events
 * without needing to backfill all of history.
 *
 * Why backwards? Because the most recent events are the most useful
 * for outreach (the user is probably still active) and we get
 * incrementally sized results rather than having to index everything
 * before anything is queryable.
 */
export async function* scanCreationsBackwards(
  client: BasePublicClient,
  opts: {
    /** Block to start from. Defaults to the current tip. */
    tipBlock?: bigint;
    /** Stop scanning once we cross this block. Defaults to 0. */
    floorBlock?: bigint;
    /** Size of each eth_getLogs request. Tune to your RPC. */
    windowSize?: bigint;
  } = {},
): AsyncGenerator<CswCreation, void, void> {
  const windowSize = opts.windowSize ?? 10_000n;
  const floor = opts.floorBlock ?? 0n;
  const tip = opts.tipBlock ?? (await client.getBlockNumber());

  let toBlock = tip;
  while (toBlock > floor) {
    const fromBlock = toBlock - windowSize + 1n > floor ? toBlock - windowSize + 1n : floor;
    let events: CswCreation[];
    try {
      events = await fetchWindow(client, fromBlock, toBlock);
    } catch (err) {
      console.warn(
        `[index] window ${fromBlock}..${toBlock} failed, retrying smaller:`,
        err instanceof Error ? err.message : err,
      );
      // Halve the window and retry once — usually a transient RPC limit.
      const mid = fromBlock + (toBlock - fromBlock) / 2n;
      events = [
        ...(await fetchWindow(client, mid + 1n, toBlock)),
        ...(await fetchWindow(client, fromBlock, mid)),
      ];
    }

    // Yield newest-first within the window (logs are returned in ascending order).
    for (const ev of events.reverse()) yield ev;

    if (fromBlock <= floor) return;
    toBlock = fromBlock - 1n;
  }
}

/**
 * Scan *forward* from a floor block up to a tip, yielding creations in
 * chronological order. Used for full-history backfills. Unlike the
 * backwards scanner, this one yields in ascending block order so
 * callers can checkpoint progress by remembering the last block they
 * successfully processed.
 */
export async function* scanCreationsForward(
  client: BasePublicClient,
  opts: {
    /** First block to scan (inclusive). */
    fromBlock: bigint;
    /** Final block to scan (inclusive). Defaults to the current tip. */
    toBlock?: bigint;
    /** Size of each eth_getLogs request. */
    windowSize?: bigint;
    /** Called after each window so the caller can log progress or checkpoint. */
    onWindow?: (window: { from: bigint; to: bigint; events: number }) => void;
  },
): AsyncGenerator<CswCreation, void, void> {
  const windowSize = opts.windowSize ?? 10_000n;
  const tip = opts.toBlock ?? (await client.getBlockNumber());

  let fromBlock = opts.fromBlock;
  while (fromBlock <= tip) {
    const toBlockInner = fromBlock + windowSize - 1n > tip ? tip : fromBlock + windowSize - 1n;
    let events: CswCreation[];
    try {
      events = await fetchWindow(client, fromBlock, toBlockInner);
    } catch (err) {
      console.warn(
        `[index-forward] window ${fromBlock}..${toBlockInner} failed, halving:`,
        err instanceof Error ? err.message : err,
      );
      const mid = fromBlock + (toBlockInner - fromBlock) / 2n;
      events = [
        ...(await fetchWindow(client, fromBlock, mid)),
        ...(await fetchWindow(client, mid + 1n, toBlockInner)),
      ];
    }

    opts.onWindow?.({ from: fromBlock, to: toBlockInner, events: events.length });

    for (const ev of events) yield ev;
    fromBlock = toBlockInner + 1n;
  }
}
