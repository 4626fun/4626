import "dotenv/config";

import { type Address, isAddress } from "viem";

import { createBasePublicClient } from "./baseClient.js";
import { createIndexerSupabase } from "./supabase.js";

/**
 * Compute a concrete 4626-agent install plan for each zora_profiles row.
 *
 * For each profile we decide:
 *   - recommended_install_target  → the CBSW address to install the
 *                                     agent on (preferred order:
 *                                     payout_recipient if it's a CBSW,
 *                                     else smart_wallet_address if CBSW,
 *                                     else null).
 *   - signing_eoa                 → an EOA confirmed (via
 *                                     isOwnerAddress) to own the install
 *                                     target. Tried in order:
 *                                     primary_wallet, then each address
 *                                     in external_wallets[].
 *   - signing_eoa_balance_wei     → helps flag users who need gas
 *                                     sponsorship before they can sign.
 *
 * Key insight: we don't do a separate "is this a CBSW?" bytecode check.
 * Instead we duck-type: try calling isOwnerAddress() on the candidate
 * smart wallet. If the call succeeds it's a CBSW-compatible contract;
 * if it reverts it isn't. This single call does both jobs — supports
 * detection AND tells us whether the EOA is an owner.
 */

const CONCURRENCY = Number(process.env.PLAN_CONCURRENCY ?? "10");
const TARGET_COUNT = Number(process.env.PLAN_TARGET_COUNT ?? "5000");

const COINBASE_SMART_WALLET_ABI = [
  {
    type: "function",
    name: "isOwnerAddress",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type Row = {
  handle: string;
  payout_recipient: string | null;
  smart_wallet_address: string | null;
  primary_wallet: string | null;
  external_wallets: string[] | null;
  privy_wallet_address: string | null;
};

async function main() {
  const startedAt = Date.now();
  const supabase = createIndexerSupabase();
  const chain = createBasePublicClient();

  console.log(`[install-plan] target=${TARGET_COUNT} concurrency=${CONCURRENCY}`);

  const { data, error } = await supabase
    .from("zora_profiles")
    .select(
      "handle, payout_recipient, smart_wallet_address, primary_wallet, external_wallets, privy_wallet_address",
    )
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(TARGET_COUNT);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  console.log(`[install-plan] ${rows.length} profiles to plan`);

  let completed = 0;
  let withTarget = 0;
  let withSigner = 0;
  let withGas = 0;
  const inflight = new Set<Promise<void>>();

  for (const row of rows) {
    const task = (async () => {
      // Build candidate signers: primary_wallet + external_wallets.
      // Privy wallet is usually NOT an owner of external CSWs so we
      // exclude it by default, but can be added as a last-resort probe.
      const candidateSigners: Address[] = [];
      if (row.primary_wallet && isAddress(row.primary_wallet)) {
        candidateSigners.push(row.primary_wallet as Address);
      }
      for (const a of row.external_wallets ?? []) {
        if (a && isAddress(a) && !candidateSigners.some((c) => c.toLowerCase() === a.toLowerCase())) {
          candidateSigners.push(a as Address);
        }
      }
      if (row.privy_wallet_address && isAddress(row.privy_wallet_address)) {
        // Privy as a fallback; signing through Privy requires their API
        // but at least confirms ownership.
        if (
          !candidateSigners.some(
            (c) => c.toLowerCase() === row.privy_wallet_address!.toLowerCase(),
          )
        ) {
          candidateSigners.push(row.privy_wallet_address as Address);
        }
      }

      // Targets to try, in preference order.
      const candidateTargets: Array<{ addr: Address; source: "payout_recipient" | "smart_wallet" }> = [];
      if (row.payout_recipient && isAddress(row.payout_recipient)) {
        candidateTargets.push({ addr: row.payout_recipient as Address, source: "payout_recipient" });
      }
      if (
        row.smart_wallet_address &&
        isAddress(row.smart_wallet_address) &&
        !candidateTargets.some((t) => t.addr.toLowerCase() === row.smart_wallet_address!.toLowerCase())
      ) {
        candidateTargets.push({ addr: row.smart_wallet_address as Address, source: "smart_wallet" });
      }

      let recommendedTarget: Address | null = null;
      let recommendedSource: "payout_recipient" | "smart_wallet" | "none" = "none";
      let payoutIsCbsw: boolean | null = null;
      let smartIsCbsw: boolean | null = null;
      let signingEoa: Address | null = null;
      let signingEoaSource: "primary_wallet" | "external_wallet" | "privy_wallet" | "none" = "none";
      let signingBalanceWei: bigint | null = null;

      for (const target of candidateTargets) {
        if (candidateSigners.length === 0) break;
        // Probe isOwnerAddress for every candidate signer in a single
        // multicall batch. Failures are per-call (allowFailure) — if
        // every candidate reverts, the target probably isn't a CBSW-
        // compatible contract.
        let results: Array<{ status: "success" | "failure"; result?: unknown; error?: unknown }>;
        try {
          results = (await chain.multicall({
            contracts: candidateSigners.map((signer) => ({
              address: target.addr,
              abi: COINBASE_SMART_WALLET_ABI,
              functionName: "isOwnerAddress" as const,
              args: [signer] as const,
            })),
            allowFailure: true,
          })) as unknown as typeof results;
        } catch {
          // Multicall itself failed — treat as target-not-a-CBSW.
          if (target.source === "payout_recipient") payoutIsCbsw = false;
          if (target.source === "smart_wallet") smartIsCbsw = false;
          continue;
        }

        // A CBSW will have at least one successful call (the function
        // exists). A non-CBSW reverts every call identically.
        const anySuccess = results.some((r) => r.status === "success");
        const isCbsw = anySuccess;
        if (target.source === "payout_recipient") payoutIsCbsw = isCbsw;
        if (target.source === "smart_wallet") smartIsCbsw = isCbsw;

        if (!isCbsw) continue;

        // Pick the first candidate signer that is an owner.
        for (let i = 0; i < candidateSigners.length; i += 1) {
          const r = results[i];
          if (r.status !== "success") continue;
          if (r.result === true) {
            recommendedTarget = target.addr;
            recommendedSource = target.source;
            signingEoa = candidateSigners[i];
            // Classify the signer source based on which list it came from.
            const lc = signingEoa.toLowerCase();
            if (
              row.primary_wallet &&
              lc === row.primary_wallet.toLowerCase()
            ) {
              signingEoaSource = "primary_wallet";
            } else if (
              row.privy_wallet_address &&
              lc === row.privy_wallet_address.toLowerCase()
            ) {
              signingEoaSource = "privy_wallet";
            } else {
              signingEoaSource = "external_wallet";
            }
            break;
          }
        }
        if (recommendedTarget) break;
      }

      // Balance check on the signer (if we found one).
      if (signingEoa) {
        try {
          signingBalanceWei = await chain.getBalance({ address: signingEoa });
        } catch {
          signingBalanceWei = null;
        }
      }

      // Stats
      if (recommendedTarget) withTarget += 1;
      if (signingEoa) withSigner += 1;
      if (signingBalanceWei !== null && signingBalanceWei > 0n) withGas += 1;

      const { error: upErr } = await supabase
        .from("zora_profiles")
        .update({
          payout_is_cbsw: payoutIsCbsw,
          smart_wallet_is_cbsw: smartIsCbsw,
          recommended_install_target: recommendedTarget?.toLowerCase() ?? null,
          recommended_install_source: recommendedSource,
          signing_eoa: signingEoa?.toLowerCase() ?? null,
          signing_eoa_source: signingEoaSource,
          signing_eoa_balance_wei: signingBalanceWei?.toString() ?? null,
          install_plan_synced_at: new Date().toISOString(),
        })
        .eq("handle", row.handle);
      if (upErr) console.warn(`[install-plan] update failed for ${row.handle}: ${upErr.message}`);

      completed += 1;
      if (completed % 20 === 0 || completed === rows.length) {
        console.log(
          `[install-plan] ${completed}/${rows.length}  target=${withTarget}  signer=${withSigner}  with_gas=${withGas}`,
        );
      }
    })();
    inflight.add(task);
    task.finally(() => inflight.delete(task));
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  }
  await Promise.all(inflight);

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(`\n[install-plan] done in ${elapsed.toFixed(1)}s`);
  console.log(`  with install target:       ${withTarget}/${rows.length}`);
  console.log(`  with confirmed signer EOA: ${withSigner}/${rows.length}`);
  console.log(`  signer has Base ETH:       ${withGas}/${rows.length}`);

  // Preview fully-actionable profiles
  const { data: preview } = await supabase
    .from("zora_profiles")
    .select(
      "handle, zora_creator_coin_symbol, unique_holders, recommended_install_target, recommended_install_source, signing_eoa, signing_eoa_balance_wei, farcaster_username",
    )
    .not("recommended_install_target", "is", null)
    .not("signing_eoa", "is", null)
    .order("zora_creator_coin_market_cap", { ascending: false, nullsFirst: false })
    .limit(10);
  if (preview && preview.length > 0) {
    console.log(`\n=== top 10 fully-actionable install plans ===`);
    for (const row of preview) {
      const gas = row.signing_eoa_balance_wei
        ? (Number(row.signing_eoa_balance_wei) / 1e18).toFixed(4) + " ETH"
        : "0";
      console.log(
        `  @${row.handle}  ($${row.zora_creator_coin_symbol}, ${row.unique_holders} holders)` +
          `  target=${row.recommended_install_target} (${row.recommended_install_source})` +
          `  signer=${row.signing_eoa}  gas=${gas}` +
          `  fc=@${row.farcaster_username ?? "—"}`,
      );
    }
  }
}

main().catch((err) => {
  console.error("[install-plan] fatal:", err);
  process.exit(1);
});
