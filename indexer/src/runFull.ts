import "dotenv/config";

import { createBasePublicClient } from "./baseClient.js";
import { ZORA_ACCOUNT_MANAGER_ADDRESS } from "./constants.js";
import { findDeploymentBlock } from "./findDeploymentBlock.js";
import { scanCreationsForward, type CswCreation } from "./indexCreations.js";
import { createIndexerSupabase, type ZoraCswRow } from "./supabase.js";

const WINDOW_SIZE = BigInt(process.env.GETLOGS_WINDOW ?? "10000");
const UPSERT_BATCH_SIZE = Number(process.env.UPSERT_BATCH_SIZE ?? "500");
const START_BLOCK_OVERRIDE = process.env.INDEXER_START_BLOCK
  ? BigInt(process.env.INDEXER_START_BLOCK)
  : null;
const END_BLOCK_OVERRIDE = process.env.INDEXER_END_BLOCK
  ? BigInt(process.env.INDEXER_END_BLOCK)
  : null;
/**
 * When true, ignore the "resume from DB max" fallback and always
 * binary-search the actual deployment block of the account manager.
 * Use this for one-time full-history backfills; the default is the
 * cron-friendly "resume from max" semantics for incremental catch-up.
 */
const FULL_BACKFILL = process.env.FULL_BACKFILL === "1" || process.env.FULL_BACKFILL === "true";

type RunStats = {
  startBlock: bigint;
  endBlock: bigint;
  eventsFound: number;
  uniqueCsws: number;
  rowsUpserted: number;
  windowsScanned: number;
  startedAt: number;
};

async function flush(
  supabase: ReturnType<typeof createIndexerSupabase>,
  buffer: Map<string, CswCreation>,
): Promise<number> {
  if (buffer.size === 0) return 0;

  // The newest occurrence of each CSW wins. Because we're scanning
  // forward the latest event in the buffer for a given address is the
  // most recent on-chain creation for that address. Iterating the Map
  // values directly preserves insertion order so last-write-wins is
  // just "take what's in the Map".
  const rows: ZoraCswRow[] = [...buffer.values()].map((c) => ({
    csw_address: c.cswAddress,
    base_owner: c.baseOwner,
    initial_owners: c.initialOwners,
    current_owners: null,
    creation_nonce: c.nonce.toString(),
    creation_block: Number(c.blockNumber),
    creation_tx_hash: c.txHash,
    source: "zora_account_manager",
    metadata: { log_index: c.logIndex },
    last_owner_sync_at: null,
  }));

  const { error } = await supabase
    .from("zora_csw_owners")
    .upsert(rows, { onConflict: "csw_address" });
  if (error) {
    console.error("[full] upsert batch failed:", error);
    throw error;
  }
  buffer.clear();
  return rows.length;
}

async function main() {
  const startedAt = Date.now();
  const client = createBasePublicClient();
  const supabase = createIndexerSupabase();

  const tip = await client.getBlockNumber();
  const endBlock = END_BLOCK_OVERRIDE ?? tip;

  // Determine the starting block. Preference order:
  //   1. Explicit INDEXER_START_BLOCK env override — for resumes after
  //      a crash or for targeting a specific date range.
  //   2. FULL_BACKFILL=1 → always binary-search the deployment block,
  //      ignoring existing DB rows. For one-time history backfills.
  //   3. Default: highest creation_block already in Supabase + 1, for
  //      incremental cron-style catch-up.
  let startBlock: bigint;
  if (START_BLOCK_OVERRIDE !== null) {
    startBlock = START_BLOCK_OVERRIDE;
    console.log(`[full] start block (override): ${startBlock}`);
  } else if (FULL_BACKFILL) {
    console.log(`[full] FULL_BACKFILL=1 — binary-searching deployment block of ${ZORA_ACCOUNT_MANAGER_ADDRESS}…`);
    const deploymentBlock = await findDeploymentBlock(client, ZORA_ACCOUNT_MANAGER_ADDRESS);
    if (deploymentBlock === null) {
      throw new Error("Could not locate ZoraAccountManager deployment on this RPC");
    }
    startBlock = deploymentBlock;
    console.log(`[full] deployment block: ${startBlock}`);
  } else {
    const { data: maxRow, error: maxErr } = await supabase
      .from("zora_csw_owners")
      .select("creation_block")
      .order("creation_block", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr) {
      console.warn("[full] could not read current max block:", maxErr);
    }
    const existingMax = maxRow?.creation_block ? BigInt(maxRow.creation_block) : null;
    if (existingMax !== null && existingMax > 0n) {
      startBlock = existingMax + 1n;
      console.log(`[full] resuming from block ${startBlock} (db max: ${existingMax})`);
      console.log(`[full] tip: set FULL_BACKFILL=1 to re-scan from the deployment block`);
    } else {
      console.log(`[full] binary-searching deployment block of ${ZORA_ACCOUNT_MANAGER_ADDRESS}…`);
      const deploymentBlock = await findDeploymentBlock(client, ZORA_ACCOUNT_MANAGER_ADDRESS);
      if (deploymentBlock === null) {
        throw new Error("Could not locate ZoraAccountManager deployment on this RPC");
      }
      startBlock = deploymentBlock;
      console.log(`[full] deployment block: ${startBlock}`);
    }
  }

  console.log(`[full] scanning ${startBlock} → ${endBlock} (${endBlock - startBlock + 1n} blocks)`);
  console.log(`[full] window size: ${WINDOW_SIZE}, upsert batch size: ${UPSERT_BATCH_SIZE}`);

  const stats: RunStats = {
    startBlock,
    endBlock,
    eventsFound: 0,
    uniqueCsws: 0,
    rowsUpserted: 0,
    windowsScanned: 0,
    startedAt,
  };

  // Buffer events so we upsert in chunks rather than once per event.
  const buffer = new Map<string, CswCreation>();

  const iter = scanCreationsForward(client, {
    fromBlock: startBlock,
    toBlock: endBlock,
    windowSize: WINDOW_SIZE,
    onWindow: ({ from, to, events }) => {
      stats.windowsScanned += 1;
      if (stats.windowsScanned % 20 === 0 || events > 0) {
        const progressPct = Number(
          ((to - startBlock) * 10000n) / (endBlock - startBlock + 1n),
        ) / 100;
        console.log(
          `[full] window ${from}..${to}  events=${events}  ` +
            `total=${stats.eventsFound}  unique=${stats.uniqueCsws}  ` +
            `progress=${progressPct.toFixed(1)}%`,
        );
      }
    },
  });

  try {
    for await (const ev of iter) {
      stats.eventsFound += 1;
      const key = ev.cswAddress.toLowerCase();
      if (!buffer.has(key)) stats.uniqueCsws += 1;
      buffer.set(key, ev);

      if (buffer.size >= UPSERT_BATCH_SIZE) {
        const flushed = await flush(supabase, buffer);
        stats.rowsUpserted += flushed;
        console.log(
          `[full] flushed ${flushed} rows (total upserted: ${stats.rowsUpserted})`,
        );
      }
    }
    const finalFlush = await flush(supabase, buffer);
    stats.rowsUpserted += finalFlush;
    if (finalFlush > 0) {
      console.log(`[full] final flush: ${finalFlush} rows`);
    }
  } catch (err) {
    console.error("[full] scan aborted:", err);
    const finalFlush = await flush(supabase, buffer);
    stats.rowsUpserted += finalFlush;
    console.log("[full] partial progress preserved");
    throw err;
  }

  const elapsedMs = Date.now() - startedAt;
  console.log("\n[full] done");
  console.log(`  scanned:            ${stats.startBlock} → ${stats.endBlock}`);
  console.log(`  windows scanned:    ${stats.windowsScanned}`);
  console.log(`  events found:       ${stats.eventsFound}`);
  console.log(`  unique CSWs:        ${stats.uniqueCsws}`);
  console.log(`  rows upserted:      ${stats.rowsUpserted}`);
  console.log(`  elapsed:            ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(
    `  throughput:         ` +
      `${(Number(stats.endBlock - stats.startBlock) / (elapsedMs / 1000)).toFixed(0)} blocks/s`,
  );
}

main().catch((err) => {
  console.error("[full] fatal:", err);
  process.exit(1);
});
