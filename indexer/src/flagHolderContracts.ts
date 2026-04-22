import "dotenv/config";

import { type Address } from "viem";

import { createBasePublicClient } from "./baseClient.js";
import { createIndexerSupabase } from "./supabase.js";

/**
 * Flag each holder address in zora_coin_holders as EOA or contract.
 *
 * Why this is critical: protocol contracts (Uniswap V4 PoolManager,
 * DEX routers, aggregator vaults) show up as top token holders
 * because they custody LP-backed liquidity on behalf of many LPs.
 * Without this flag, our "multi-creator believer" analysis surfaces
 * AMM plumbing as #1 whale, which is wrong signal.
 *
 * We look up each unique holder_address once (not once per row) via
 * eth_getCode, then fan the result out to every row with that holder.
 * CBSW proxy bytecode (~124 chars) is classified separately because
 * those are smart wallets belonging to real users, not protocol code.
 *
 * Runtime: ~6-10 minutes for ~3k unique addresses at reasonable
 * concurrency. Idempotent: re-running skips rows that already have a
 * holder_flagged_at stamp.
 */

const CONCURRENCY = Number(process.env.FLAG_CONCURRENCY ?? "20");
const CBSW_PROXY_SIGNATURE =
  "363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d38";

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const chain = createBasePublicClient();

  // Distinct unflagged holder addresses (we only need to call getCode
  // once per unique address). Using a direct PostgREST range query
  // keyset-paginated on holder_address.
  console.log("[flag] collecting unique unflagged holder addresses…");
  const toFlag = new Set<string>();
  const PAGE = 1000;
  let cursor: string | null = null;
  while (true) {
    let q = supabase
      .from("zora_coin_holders")
      .select("holder_address")
      .is("holder_flagged_at", null)
      .order("holder_address", { ascending: true })
      .limit(PAGE);
    if (cursor !== null) q = q.gt("holder_address", cursor);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Array<{ holder_address: string }>;
    if (rows.length === 0) break;
    for (const row of rows) toFlag.add(row.holder_address.toLowerCase());
    cursor = rows[rows.length - 1].holder_address;
    if (rows.length < PAGE) break;
  }
  const addrs = [...toFlag];
  console.log(`[flag] ${addrs.length} unique addresses to classify`);
  if (addrs.length === 0) return;

  // For each address, read bytecode and classify.
  type Classification = {
    addr: string;
    isContract: boolean;
    codeSize: number;
    kind: "eoa" | "cbsw_proxy" | "generic_contract" | "large_contract";
  };
  const classifications: Classification[] = [];
  let completed = 0;
  const inflight = new Set<Promise<void>>();

  for (const addr of addrs) {
    const task = (async () => {
      let codeHex: string | undefined = "0x";
      try {
        codeHex = await chain.getCode({ address: addr as Address });
      } catch {
        // Leave as "0x" if the RPC briefly errors — we'll retry on rerun.
      }
      // viem returns `undefined` when the address has no code (EOA or
      // never deployed). Normalize to "0x" for classification.
      const codeNormalized = codeHex ?? "0x";
      const codeSize = codeNormalized.length - 2;
      const isContract = codeSize > 0;
      let kind: Classification["kind"] = "eoa";
      if (isContract) {
        if (codeNormalized.includes(CBSW_PROXY_SIGNATURE)) kind = "cbsw_proxy";
        else if (codeSize > 2000) kind = "large_contract";
        else kind = "generic_contract";
      }
      classifications.push({ addr, isContract, codeSize, kind });
      completed += 1;
      if (completed % 200 === 0 || completed === addrs.length) {
        const rate = (completed / ((Date.now() - startedAt) / 1000)).toFixed(1);
        console.log(`[flag] ${completed}/${addrs.length}  ${rate}/s`);
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);

  // Persist in chunks. We write the same classification to every row
  // with this holder_address (potentially across multiple coins).
  console.log("[flag] persisting classifications…");
  const now = new Date().toISOString();
  let persistedRows = 0;
  const BATCH = 100;
  for (let i = 0; i < classifications.length; i += BATCH) {
    const chunk = classifications.slice(i, i + BATCH);
    // One UPDATE per address — .update() with .in() doesn't let us
    // specify per-row values, so we issue per-address updates.
    // Concurrency-limited to avoid overwhelming Supabase.
    const chunkTasks: Array<Promise<void>> = [];
    let chunkInflight = 0;
    for (const c of chunk) {
      const p = (async () => {
        const { error } = await supabase
          .from("zora_coin_holders")
          .update({
            holder_is_contract: c.isContract,
            holder_code_size: c.codeSize,
            holder_contract_kind: c.kind,
            holder_flagged_at: now,
          })
          .eq("holder_address", c.addr);
        if (error) {
          console.warn(`[flag] update failed for ${c.addr}: ${error.message}`);
          return;
        }
        persistedRows += 1;
      })();
      chunkTasks.push(p);
      chunkInflight += 1;
      if (chunkInflight >= 20) {
        await Promise.race(chunkTasks);
        chunkInflight -= 1;
      }
    }
    await Promise.all(chunkTasks);
    if ((i + BATCH) % 500 === 0 || i + BATCH >= classifications.length) {
      console.log(`[flag] persisted ${persistedRows}/${classifications.length} unique addresses`);
    }
  }

  // Summary
  const counts = classifications.reduce(
    (acc, c) => {
      acc[c.kind] = (acc[c.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(`\n[flag] done in ${elapsed.toFixed(1)}s`);
  console.log(`  eoa:              ${counts.eoa ?? 0}`);
  console.log(`  cbsw_proxy:       ${counts.cbsw_proxy ?? 0}`);
  console.log(`  generic_contract: ${counts.generic_contract ?? 0}`);
  console.log(`  large_contract:   ${counts.large_contract ?? 0}`);
}

main().catch((err) => {
  console.error("[flag] fatal:", err);
  process.exit(1);
});
