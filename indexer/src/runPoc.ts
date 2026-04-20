import "dotenv/config";

import { createBasePublicClient } from "./baseClient.js";
import { enrichCswOwners } from "./enrichOwners.js";
import { scanCreationsBackwards, type CswCreation } from "./indexCreations.js";
import { createIndexerSupabase, type ZoraCswRow } from "./supabase.js";

const TARGET_COUNT = Number(process.env.POC_TARGET_COUNT ?? "100");
const WINDOW_SIZE = BigInt(process.env.GETLOGS_WINDOW ?? "10000");

type PocStats = {
  eventsFound: number;
  upserted: number;
  enriched: number;
  skippedMissingOwner: number;
  windowsScanned: number;
  startedAt: number;
};

async function main() {
  const startedAt = Date.now();
  const client = createBasePublicClient();
  const supabase = createIndexerSupabase();

  console.log(`[poc] target: ${TARGET_COUNT} CSWs, window: ${WINDOW_SIZE} blocks`);

  const tip = await client.getBlockNumber();
  console.log(`[poc] tip block: ${tip}`);

  const stats: PocStats = {
    eventsFound: 0,
    upserted: 0,
    enriched: 0,
    skippedMissingOwner: 0,
    windowsScanned: 0,
    startedAt,
  };

  const creations: CswCreation[] = [];
  for await (const ev of scanCreationsBackwards(client, {
    tipBlock: tip,
    windowSize: WINDOW_SIZE,
  })) {
    creations.push(ev);
    stats.eventsFound += 1;
    if (creations.length >= TARGET_COUNT) break;
  }

  console.log(`[poc] collected ${creations.length} creation events`);

  if (creations.length === 0) {
    console.warn("[poc] no events found — extend scan window or check RPC");
    return;
  }

  // Deduplicate within the batch by csw_address. The same CSW can be
  // created multiple times at different nonces (Zora re-issues proxies
  // via their account manager). Supabase upsert rejects duplicate
  // primary keys within a single INSERT, so we collapse duplicates to
  // the newest occurrence (we're iterating newest-first, so `first wins`).
  const seen = new Set<string>();
  const uniqueCreations: CswCreation[] = [];
  for (const c of creations) {
    const key = c.cswAddress.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueCreations.push(c);
  }
  const duplicates = creations.length - uniqueCreations.length;
  if (duplicates > 0) {
    console.log(`[poc] collapsed ${duplicates} duplicate CSW creations (same address, different nonce)`);
  }

  // First pass: upsert the raw creation data. Enrichment happens next so
  // that even if the multicall layer misbehaves we still have the rows.
  const initialRows: ZoraCswRow[] = uniqueCreations.map((c) => ({
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

  const { error: upsertError } = await supabase
    .from("zora_csw_owners")
    .upsert(initialRows, { onConflict: "csw_address" });

  if (upsertError) {
    console.error("[poc] initial upsert failed:", upsertError);
    return;
  }
  stats.upserted = initialRows.length;
  console.log(`[poc] upserted ${stats.upserted} rows (initial)`);

  // Second pass: enrich with current owner list by re-reading on chain.
  // Sequential with small concurrency — multicall inside viem already
  // batches heavily, so we don't need heavy external concurrency.
  const CONCURRENCY = 5;
  for (let i = 0; i < uniqueCreations.length; i += CONCURRENCY) {
    const batch = uniqueCreations.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (c) => {
        try {
          const enriched = await enrichCswOwners(client, c.cswAddress);
          const currentOwners = enriched.addressOwners;
          if (currentOwners.length === 0) {
            // Still write the enrichment timestamp even when no EOA
            // owners — useful signal that this CSW is passkey-only.
            stats.skippedMissingOwner += 1;
          }
          const { error } = await supabase
            .from("zora_csw_owners")
            .update({
              current_owners: currentOwners,
              last_owner_sync_at: new Date().toISOString(),
              metadata: {
                log_index: c.logIndex,
                next_owner_index: enriched.nextOwnerIndex?.toString() ?? null,
                removed_owners_count: enriched.removedOwnersCount?.toString() ?? null,
                passkey_owner_count: enriched.passkeyOwnerCount,
              },
            })
            .eq("csw_address", c.cswAddress);
          if (error) {
            console.warn(`[poc] enrich update failed for ${c.cswAddress}:`, error.message);
            return;
          }
          stats.enriched += 1;
        } catch (err) {
          console.warn(
            `[poc] enrich failed for ${c.cswAddress}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }),
    );
    console.log(
      `[poc] enriched ${Math.min(i + CONCURRENCY, uniqueCreations.length)}/${uniqueCreations.length}`,
    );
  }

  const elapsedMs = Date.now() - startedAt;
  console.log("\n[poc] done");
  console.log(`  events found:       ${stats.eventsFound}`);
  console.log(`  rows upserted:      ${stats.upserted}`);
  console.log(`  enriched:           ${stats.enriched}`);
  console.log(`  passkey-only:       ${stats.skippedMissingOwner}`);
  console.log(`  elapsed:            ${(elapsedMs / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("[poc] fatal:", err);
  process.exit(1);
});
