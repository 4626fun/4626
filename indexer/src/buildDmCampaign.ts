// Build a personalized XMTP DM queue for the 302 reachable creators.
//
// Philosophy: this script produces drafts, not sent messages. Every row is
// reviewable before anything goes out. The Keepr agent's XMTP queue
// executor can consume the JSON output later via a separate "send" step
// that you must explicitly trigger.
//
// Output:
//   exports/dm-campaign-<ts>.json   — full queue with per-recipient draft
//   exports/dm-campaign-<ts>.csv    — review-friendly view
//
// Run:  pnpm tsx src/buildDmCampaign.ts
// Env:  SENDER_HANDLE=agent.4626.fun  (used in DM body)

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const EXPORT_DIR = resolve(ROOT, "exports");

const SENDER_HANDLE = process.env.SENDER_HANDLE ?? "agent.4626.fun";

type AddressKind =
  | "payout_recipient"
  | "csw"
  | "primary_wallet"
  | "signing_eoa"
  | "privy_wallet"
  | "base_owner"
  | "holder";

type Cohort = "top_creator" | "extension_wallet" | "multi_holder";

interface XmtpReachRow {
  cohort: Cohort;
  name: string;
  handle: string | null;
  candidates: Array<{ address: string; kind: AddressKind }>;
  xmtp_reachable: boolean;
  xmtp_address: string | null;
  xmtp_address_kind: AddressKind | null;
  reachable_candidates: Array<{ address: string; kind: AddressKind }>;
}

interface TopCreatorSrc {
  rank: number;
  handle: string | null;
  coin_ticker: string | null;
  market_cap_usd: number | null;
  unique_holders: number | null;
  install_target: string | null;
  ready_to_install: boolean;
  needs_gas_sponsorship: boolean;
  farcaster_username: string | null;
  twitter_username: string | null;
  basename: string | null;
}

interface ExtWalletSrc {
  eoa: string;
  zora_handle: string | null;
  farcaster_username: string | null;
  basename: string | null;
  activity_tier: string | null;
  zora_csw_address: string;
  base_tx_count: number;
  ethereum_tx_count: number;
}

interface MultiHolderSrc {
  holder_address: string;
  owner_handle: string | null;
  creators_held: number;
  creator_handles: string[];
  basename: string | null;
  farcaster_username: string | null;
}

function latest(pattern: string): string | null {
  const files = readdirSync(EXPORT_DIR)
    .filter((f) => f.startsWith(pattern) && (f.endsWith(".json")))
    .sort();
  return files.length ? resolve(EXPORT_DIR, files[files.length - 1]) : null;
}

function findFile(prefix: string): string {
  const path = latest(prefix);
  if (!path) throw new Error(`No file starting with ${prefix} in ${EXPORT_DIR}`);
  return path;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return "some";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtHolders(n: number | null | undefined): string {
  if (n == null) return "your";
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// Three body templates, one per cohort. Each references concrete facts we
// already know so the DM doesn't read like a blast.

function topCreatorBody(p: TopCreatorSrc, reach: XmtpReachRow): string {
  const handle = p.handle ?? "there";
  const ticker = p.coin_ticker ? ` ($${p.coin_ticker})` : "";
  const mc = fmtMoney(p.market_cap_usd);
  const holders = fmtHolders(p.unique_holders);

  const addressKind = reach.xmtp_address_kind;
  const addressPreamble =
    addressKind === "csw"
      ? "saw your Zora smart wallet here on Base App"
      : addressKind === "payout_recipient"
        ? "found your Coinbase account through your Zora payout routing"
        : "found you through your Zora creator coin";

  const readiness = p.ready_to_install
    ? "Good news — the signer on your smart wallet already has gas on Base, so you can spin one up in a single signature."
    : p.needs_gas_sponsorship
      ? "Your signer has no ETH on Base right now, so we'd cover the gas for the first deploy."
      : "Happy to walk through what that would look like.";

  return [
    `gm @${handle} — ${addressPreamble}.`,
    "",
    `I run 4626.fun. We let Zora creators like you turn their${ticker} coin into a yield-bearing ERC-4626 vault — holders lock their coin, the vault routes the underlying into Ajna / Charm / Aave positions, and fees flow back to the coin. Your ${holders} holders would each be accruing yield passively.`,
    "",
    `${readiness} Want me to send the 1-click deploy link?`,
    "",
    `— ${SENDER_HANDLE}`,
  ].join("\n");
}

function extensionWalletBody(p: ExtWalletSrc, reach: XmtpReachRow): string {
  const handle = p.farcaster_username && !p.farcaster_username.startsWith("!")
    ? `@${p.farcaster_username}`
    : p.zora_handle
      ? `@${p.zora_handle}`
      : p.basename
        ? p.basename
        : "there";
  const tier =
    p.activity_tier === "whale"
      ? "heavy Base user"
      : p.activity_tier === "heavy_user"
        ? "frequent Base user"
        : "active on Base";

  return [
    `gm ${handle} — noticed you're a ${tier} (${p.base_tx_count.toLocaleString()} Base txs) and you've got a Zora smart wallet.`,
    "",
    "I run 4626.fun. We build yield-bearing vaults for Zora creator coins — if you hold any creator coins across the Zora ecosystem, each of those has (or could have) a vault that earns yield on the underlying.",
    "",
    "If you're curious, reply and I'll show you the ones already live. If you're a creator yourself and want to deploy your own vault, the install is one signature from your Zora smart wallet.",
    "",
    `— ${SENDER_HANDLE}`,
  ].join("\n");
}

function multiHolderBody(p: MultiHolderSrc, _reach: XmtpReachRow): string {
  const handle = p.owner_handle
    ? `@${p.owner_handle}`
    : p.farcaster_username
      ? `@${p.farcaster_username}`
      : p.basename
        ? p.basename
        : "there";
  const creatorList = p.creator_handles.slice(0, 3).join(", ");
  const moreCount = Math.max(p.creator_handles.length - 3, 0);
  const more = moreCount > 0 ? ` plus ${moreCount} others` : "";

  return [
    `gm ${handle} — saw you hold ${p.creators_held} different Zora creator coins (${creatorList}${more}). That's serious conviction.`,
    "",
    "I run 4626.fun. We turn creator coins into yield-bearing vaults — your holdings earn passively while you keep your upside. Since you hold multiple creators' coins, you'd get yield on all of them the moment each creator deploys their vault.",
    "",
    "If you'd like to lobby your favourite creators to ship a vault, I can send them the 1-click deploy link on your behalf — just reply with which creators you'd like me to nudge.",
    "",
    `— ${SENDER_HANDLE}`,
  ].join("\n");
}

interface Draft {
  cohort: Cohort;
  priority: string;
  handle: string | null;
  name: string;
  xmtp_address: string;
  xmtp_address_kind: AddressKind;
  body: string;
  body_length: number;
  dedupe_key: string;
}

function priTop(rank: number) {
  return rank <= 20 ? "P0" : rank <= 100 ? "P1" : rank <= 200 ? "P2" : "P3";
}
function priExt(t: string | null | undefined) {
  return t === "whale"
    ? "P0"
    : t === "heavy_user"
      ? "P1"
      : t === "active_user"
        ? "P2"
        : "P3";
}
function priHeld(n: number) {
  return n >= 8 ? "P0" : n >= 5 ? "P1" : n >= 3 ? "P2" : "P3";
}

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function main() {
  const xmtpPath = findFile("xmtp-reach-");
  const topPath = findFile("outreach-top-creators-");
  const extPath = findFile("outreach-triple-signal-");
  const multiPath = findFile("outreach-multi-creator-believers-");

  const reach = JSON.parse(readFileSync(xmtpPath, "utf8")) as XmtpReachRow[];
  const topRows = JSON.parse(readFileSync(topPath, "utf8")) as TopCreatorSrc[];
  const extRows = JSON.parse(readFileSync(extPath, "utf8")) as ExtWalletSrc[];
  const multiRows = JSON.parse(
    readFileSync(multiPath, "utf8"),
  ) as MultiHolderSrc[];

  // Index reach rows for fast lookup by (cohort, handle) and by candidate address.
  const byHandle = new Map<string, XmtpReachRow>();
  const byAddress = new Map<string, XmtpReachRow>();
  for (const r of reach) {
    const key = `${r.cohort}::${(r.handle ?? "").toLowerCase()}`;
    byHandle.set(key, r);
    for (const c of r.candidates) byAddress.set(c.address, r);
  }

  const drafts: Draft[] = [];
  const seenAddresses = new Set<string>();

  function push(draft: Draft) {
    // Dedupe by XMTP address — same person reached once per campaign.
    if (seenAddresses.has(draft.xmtp_address)) return;
    seenAddresses.add(draft.xmtp_address);
    drafts.push(draft);
  }

  for (const p of topRows) {
    const key = `top_creator::${(p.handle ?? "").toLowerCase()}`;
    const r = byHandle.get(key);
    if (!r || !r.xmtp_reachable || !r.xmtp_address || !r.xmtp_address_kind)
      continue;
    push({
      cohort: "top_creator",
      priority: priTop(p.rank),
      handle: p.handle,
      name: p.coin_ticker
        ? `@${p.handle} ($${p.coin_ticker})`
        : `@${p.handle}`,
      xmtp_address: r.xmtp_address,
      xmtp_address_kind: r.xmtp_address_kind,
      body: topCreatorBody(p, r),
      body_length: 0,
      dedupe_key: `top_creator:${p.handle}`,
    });
  }

  for (const p of extRows) {
    const r = byHandle.get(
      `extension_wallet::${(p.zora_handle ?? "").toLowerCase()}`,
    ) ?? byAddress.get(p.eoa.toLowerCase());
    if (!r || !r.xmtp_reachable || !r.xmtp_address || !r.xmtp_address_kind)
      continue;
    const fc = p.farcaster_username && !p.farcaster_username.startsWith("!")
      ? p.farcaster_username
      : null;
    push({
      cohort: "extension_wallet",
      priority: priExt(p.activity_tier),
      handle: fc ?? p.zora_handle,
      name: fc ? `@${fc}` : p.zora_handle ? `@${p.zora_handle}` : p.eoa,
      xmtp_address: r.xmtp_address,
      xmtp_address_kind: r.xmtp_address_kind,
      body: extensionWalletBody(p, r),
      body_length: 0,
      dedupe_key: `ext:${p.eoa}`,
    });
  }

  for (const p of multiRows) {
    const r = byAddress.get(p.holder_address.toLowerCase());
    if (!r || !r.xmtp_reachable || !r.xmtp_address || !r.xmtp_address_kind)
      continue;
    push({
      cohort: "multi_holder",
      priority: priHeld(p.creators_held),
      handle: p.owner_handle,
      name: p.owner_handle ? `@${p.owner_handle}` : p.holder_address,
      xmtp_address: r.xmtp_address,
      xmtp_address_kind: r.xmtp_address_kind,
      body: multiHolderBody(p, r),
      body_length: 0,
      dedupe_key: `multi:${p.holder_address}`,
    });
  }

  for (const d of drafts) d.body_length = d.body.length;

  // Priority sort so reviewers see P0 first.
  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  drafts.sort((a, b) => {
    const pa = priorityRank[a.priority] ?? 9;
    const pb = priorityRank[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.cohort.localeCompare(b.cohort);
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = resolve(EXPORT_DIR, `dm-campaign-${ts}.json`);
  const csvPath = resolve(EXPORT_DIR, `dm-campaign-${ts}.csv`);

  writeFileSync(jsonPath, JSON.stringify(drafts, null, 2));

  const header = [
    "Priority",
    "Cohort",
    "Name",
    "Handle",
    "XMTP Address",
    "XMTP Address Kind",
    "Body Length",
    "Body Preview",
  ]
    .map(csvEscape)
    .join(",");
  const body = drafts
    .map((d) =>
      [
        d.priority,
        d.cohort,
        d.name,
        d.handle ?? "",
        d.xmtp_address,
        d.xmtp_address_kind,
        d.body_length,
        d.body.replace(/\n/g, " ⏎ ").slice(0, 200),
      ]
        .map(csvEscape)
        .join(","),
    )
    .join("\n");
  writeFileSync(csvPath, header + "\n" + body + "\n");

  // Summary
  const byCohort = new Map<string, number>();
  const byPriority = new Map<string, number>();
  for (const d of drafts) {
    byCohort.set(d.cohort, (byCohort.get(d.cohort) ?? 0) + 1);
    byPriority.set(d.priority, (byPriority.get(d.priority) ?? 0) + 1);
  }

  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
  console.log(`\nTotal drafts: ${drafts.length}`);
  console.log("\nBy priority:");
  for (const pri of ["P0", "P1", "P2", "P3"]) {
    console.log(`  ${pri}: ${byPriority.get(pri) ?? 0}`);
  }
  console.log("\nBy cohort:");
  for (const [c, n] of byCohort) console.log(`  ${c.padEnd(18)} ${n}`);
  console.log(
    "\nNo messages have been sent. Review the JSON, then run the companion sender script when ready.",
  );
}

main();
