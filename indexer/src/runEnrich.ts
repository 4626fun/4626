import "dotenv/config";

import type { Address } from "viem";

import { createBasePublicClient } from "./baseClient.js";
import { enrichCswOwners } from "./enrichOwners.js";
import { createIndexerSupabase } from "./supabase.js";

const TARGET_COUNT = Number(process.env.ENRICH_TARGET_COUNT ?? "15000");
const CONCURRENCY = Number(process.env.ENRICH_CONCURRENCY ?? "16");
const PAGE_SIZE = 1000;
/** How many enriched rows to batch into one Supabase upsert. */
const UPDATE_BATCH_SIZE = Number(process.env.ENRICH_UPDATE_BATCH ?? "200");

/**
 * Priority mode for which rows to enrich first.
 *   - "newest"       → creation_block desc (freshest cohort, best for outreach)
 *   - "oldest-unsynced" → last_owner_sync_at asc (FIFO refresh; matches cron)
 *   - "random"       → statistical sample
 */
const MODE = (process.env.ENRICH_MODE ?? "newest") as
  | "newest"
  | "oldest-unsynced"
  | "random";

type PendingRow = { csw_address: string; creation_block: number };

/**
 * Pull a page of CSW addresses that need enrichment.
 *
 * Uses keyset pagination on `creation_block` instead of OFFSET because
 * the "last_owner_sync_at IS NULL" filter hits 1M+ rows once the POC
 * seed has been enriched. OFFSET-based paging forces Postgres to
 * re-sort the whole filtered set for every page, blowing past Supabase
 * statement timeouts. Keyset is O(1) per page.
 *
 * The `cursor` is the last creation_block we saw — the next page
 * returns rows strictly less-than (newest mode) or greater-than
 * (oldest mode) that block. Returning ties would require a compound
 * cursor on (creation_block, csw_address); in practice ties are rare
 * enough that we tolerate the theoretical skip.
 */
async function fetchPage(
  supabase: ReturnType<typeof createIndexerSupabase>,
  cursor: number | null,
  limit: number,
): Promise<PendingRow[]> {
  let query = supabase
    .from("zora_csw_owners")
    .select("csw_address, creation_block")
    .is("last_owner_sync_at", null)
    .limit(limit);

  if (MODE === "newest") {
    query = query.order("creation_block", { ascending: false });
    if (cursor !== null) query = query.lt("creation_block", cursor);
  } else if (MODE === "oldest-unsynced") {
    query = query.order("creation_block", { ascending: true });
    if (cursor !== null) query = query.gt("creation_block", cursor);
  } else if (MODE === "random") {
    // Random mode doesn't support keyset — fall back to a single
    // page's worth. Acceptable because random mode is only used for
    // small POC samples.
    query = query.order("csw_address", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PendingRow[];
}

async function main() {
  const startedAt = Date.now();
  const client = createBasePublicClient();
  const supabase = createIndexerSupabase();

  console.log(`[enrich] target: ${TARGET_COUNT} rows, concurrency: ${CONCURRENCY}, mode: ${MODE}`);

  // Pull the target addresses using keyset pagination on creation_block.
  // `cursor` tracks the last block we saw; the next page returns rows
  // strictly past it. Exhaustion is detected when a page returns fewer
  // rows than requested.
  const addresses: Address[] = [];
  let cursor: number | null = null;
  while (addresses.length < TARGET_COUNT) {
    const remaining = TARGET_COUNT - addresses.length;
    const pageLimit = Math.min(PAGE_SIZE, remaining);
    const page = await fetchPage(supabase, cursor, pageLimit);
    if (page.length === 0) break;
    for (const row of page) addresses.push(row.csw_address as Address);
    cursor = page[page.length - 1].creation_block;
    if (page.length < pageLimit) break; // exhausted
  }

  if (addresses.length === 0) {
    console.log("[enrich] no unsynced rows found — nothing to do");
    return;
  }
  console.log(`[enrich] selected ${addresses.length} rows`);

  // Collected enriched rows waiting for a batch flush. We buffer them
  // here and upsert in chunks of UPDATE_BATCH_SIZE — single-row UPDATE
  // per CSW was the bottleneck (each had its own DB round-trip). With
  // batched upserts we turn N DB calls into N/200.
  type EnrichedRow = {
    csw_address: string;
    current_owners: string[];
    last_owner_sync_at: string;
    metadata: Record<string, unknown>;
  };
  const pendingRows: EnrichedRow[] = [];

  async function flushPending(): Promise<void> {
    if (pendingRows.length === 0) return;
    const batch = pendingRows.splice(0, pendingRows.length);
    const { error } = await supabase
      .from("zora_csw_owners")
      .upsert(batch, { onConflict: "csw_address" });
    if (error) {
      failed += batch.length;
      console.warn(`[enrich] batch upsert (${batch.length} rows) failed:`, error.message);
      return;
    }
    successful += batch.length;
  }

  let completed = 0;
  let successful = 0;
  let passkeyOnly = 0;
  let failed = 0;

  const inflight = new Set<Promise<void>>();
  let lastLog = Date.now();

  for (const csw of addresses) {
    const task = (async () => {
      try {
        const enriched = await enrichCswOwners(client, csw);
        if (enriched.addressOwners.length === 0) passkeyOnly += 1;
        pendingRows.push({
          csw_address: csw,
          current_owners: enriched.addressOwners,
          last_owner_sync_at: new Date().toISOString(),
          metadata: {
            next_owner_index: enriched.nextOwnerIndex?.toString() ?? null,
            removed_owners_count: enriched.removedOwnersCount?.toString() ?? null,
            passkey_owner_count: enriched.passkeyOwnerCount,
          },
        });
        if (pendingRows.length >= UPDATE_BATCH_SIZE) {
          await flushPending();
        }
      } catch (err) {
        failed += 1;
        if (failed <= 5) {
          console.warn(
            `[enrich] onchain read failed for ${csw}: ` +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      } finally {
        completed += 1;
        const now = Date.now();
        if (now - lastLog > 5000 || completed === addresses.length) {
          const rate = (completed / ((now - startedAt) / 1000)).toFixed(1);
          console.log(
            `[enrich] ${completed}/${addresses.length}  ok=${successful}  passkey=${passkeyOnly}  fail=${failed}  buffer=${pendingRows.length}  ${rate} rows/s`,
          );
          lastLog = now;
        }
      }
    })();

    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) {
      await Promise.race(inflight);
    }
  }
  await Promise.all(inflight);
  await flushPending();

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log("\n[enrich] done");
  console.log(`  attempted:     ${addresses.length}`);
  console.log(`  enriched ok:   ${successful}`);
  console.log(`  passkey-only:  ${passkeyOnly}`);
  console.log(`  failed:        ${failed}`);
  console.log(`  elapsed:       ${elapsed.toFixed(1)}s`);
  console.log(`  avg rate:      ${(addresses.length / elapsed).toFixed(1)} rows/s`);
}

main().catch((err) => {
  console.error("[enrich] fatal:", err);
  process.exit(1);
});
