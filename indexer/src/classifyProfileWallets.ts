import "dotenv/config";

import { isAddress, type Address } from "viem";

import { createBasePublicClient } from "./baseClient.js";
import { createIndexerSupabase } from "./supabase.js";

/**
 * Classify every wallet address on zora_profiles as
 * eoa | cbsw_proxy | generic_contract | large_contract.
 *
 * Each profile has up to four addresses we care about:
 *   - primary_wallet
 *   - payout_recipient
 *   - smart_wallet_address
 *   - privy_wallet_address
 *
 * We dedupe across all four fields and across all profiles (since many
 * creators share wallets across these roles, and some creators share
 * infrastructure) so each unique address gets one `eth_getCode` call.
 * Then we fan the classification back out to every profile row that
 * references it.
 *
 * Why: without this column, we can't cleanly filter outreach queries
 * like "signer candidates that are actually EOAs" or "creators whose
 * payout is a contract we can't sign from." The booleans we added
 * earlier (payout_recipient_is_contract, payout_is_cbsw, etc.) are
 * partial — this unifies them into a consistent 4-valued classification.
 */

const CONCURRENCY = Number(process.env.CLASSIFY_PROFILE_CONCURRENCY ?? "20");
const CBSW_PROXY_SIGNATURE =
  "363d3d373d3d363d7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d38";

type Kind = "eoa" | "cbsw_proxy" | "generic_contract" | "large_contract";

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const chain = createBasePublicClient();

  // Pull every profile row with any wallet address. We include rows
  // that have already been classified so re-runs refresh them — the
  // operation is cheap.
  console.log("[classify-profiles] pulling profile wallets…");
  const { data, error } = await supabase
    .from("zora_profiles")
    .select(
      "handle, primary_wallet, payout_recipient, smart_wallet_address, privy_wallet_address",
    );
  if (error) throw error;
  type Row = {
    handle: string;
    primary_wallet: string | null;
    payout_recipient: string | null;
    smart_wallet_address: string | null;
    privy_wallet_address: string | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  console.log(`[classify-profiles] ${rows.length} profiles`);

  // Collect unique addresses across all four roles on every profile.
  const uniqueAddrs = new Set<string>();
  for (const row of rows) {
    for (const a of [
      row.primary_wallet,
      row.payout_recipient,
      row.smart_wallet_address,
      row.privy_wallet_address,
    ]) {
      if (a && isAddress(a)) uniqueAddrs.add(a.toLowerCase());
    }
  }
  const addrs = [...uniqueAddrs];
  console.log(`[classify-profiles] ${addrs.length} unique addresses to classify`);

  // Classify via eth_getCode. Concurrent; bounded.
  const classifications = new Map<string, Kind>();
  let completed = 0;
  const inflight = new Set<Promise<void>>();
  for (const addr of addrs) {
    const task = (async () => {
      let codeHex: string | undefined = "0x";
      try {
        codeHex = await chain.getCode({ address: addr as Address });
      } catch {
        // Keep as "0x"; we'll classify as eoa (most likely) and can
        // re-run later if needed.
      }
      const code = codeHex ?? "0x";
      const codeSize = code.length - 2;
      let kind: Kind = "eoa";
      if (codeSize > 0) {
        if (code.includes(CBSW_PROXY_SIGNATURE)) kind = "cbsw_proxy";
        else if (codeSize > 2000) kind = "large_contract";
        else kind = "generic_contract";
      }
      classifications.set(addr, kind);
      completed += 1;
      if (completed % 50 === 0 || completed === addrs.length) {
        const rate = (completed / ((Date.now() - startedAt) / 1000)).toFixed(1);
        console.log(`[classify-profiles] ${completed}/${addrs.length}  ${rate}/s`);
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);

  // Fan classifications out to every profile row. Per-row UPDATE
  // (upsert would null out other fields on conflict-resolve).
  console.log("[classify-profiles] persisting per-profile classifications…");
  const now = new Date().toISOString();
  let persisted = 0;
  const persistInflight = new Set<Promise<void>>();
  function kindFor(addr: string | null): Kind | null {
    if (!addr) return null;
    return classifications.get(addr.toLowerCase()) ?? null;
  }
  for (const row of rows) {
    const task = (async () => {
      const { error: upErr } = await supabase
        .from("zora_profiles")
        .update({
          primary_wallet_kind: kindFor(row.primary_wallet),
          payout_recipient_kind: kindFor(row.payout_recipient),
          smart_wallet_kind: kindFor(row.smart_wallet_address),
          privy_wallet_kind: kindFor(row.privy_wallet_address),
          wallet_kinds_synced_at: now,
        })
        .eq("handle", row.handle);
      if (upErr) {
        console.warn(`[classify-profiles] update failed for ${row.handle}: ${upErr.message}`);
        return;
      }
      persisted += 1;
    })();
    persistInflight.add(task);
    task.finally(() => persistInflight.delete(task));
    if (persistInflight.size >= CONCURRENCY) await Promise.race(persistInflight);
  }
  await Promise.all(persistInflight);

  // Summary by role.
  const byKind: Record<string, Record<Kind, number>> = {
    primary_wallet: { eoa: 0, cbsw_proxy: 0, generic_contract: 0, large_contract: 0 },
    payout_recipient: { eoa: 0, cbsw_proxy: 0, generic_contract: 0, large_contract: 0 },
    smart_wallet_address: { eoa: 0, cbsw_proxy: 0, generic_contract: 0, large_contract: 0 },
    privy_wallet_address: { eoa: 0, cbsw_proxy: 0, generic_contract: 0, large_contract: 0 },
  };
  for (const row of rows) {
    const map: Array<[string, string | null]> = [
      ["primary_wallet", row.primary_wallet],
      ["payout_recipient", row.payout_recipient],
      ["smart_wallet_address", row.smart_wallet_address],
      ["privy_wallet_address", row.privy_wallet_address],
    ];
    for (const [role, addr] of map) {
      const kind = kindFor(addr);
      if (kind) byKind[role][kind] += 1;
    }
  }

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(`\n[classify-profiles] done in ${elapsed.toFixed(1)}s`);
  console.log(`  profiles updated:   ${persisted}/${rows.length}`);
  console.log(`  unique addresses:   ${addrs.length}`);
  console.log(`\n  breakdown by role:`);
  for (const role of Object.keys(byKind)) {
    const counts = byKind[role];
    const total = counts.eoa + counts.cbsw_proxy + counts.generic_contract + counts.large_contract;
    console.log(
      `    ${role.padEnd(22)}  total=${total}  eoa=${counts.eoa}  cbsw=${counts.cbsw_proxy}  ` +
        `generic=${counts.generic_contract}  large=${counts.large_contract}`,
    );
  }
}

main().catch((err) => {
  console.error("[classify-profiles] fatal:", err);
  process.exit(1);
});
