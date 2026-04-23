// Unified master outreach sheet: joins all three cohort exports with the
// XMTP reachability probe output into a single CSV that is safe to upload
// to Google Sheets and to merge into the Notion `4626 Outreach — Zora
// Creators` database.
//
// Why one artifact: Google Sheets (operator comfort) and Notion
// (collaborator surface) both want the same rows. Maintaining two
// pipelines drifts the data; one CSV is the shared source of truth.
//
// Output: exports/master-outreach-sheet-<ts>.csv
//
// Run: pnpm tsx src/buildMasterSheet.ts
//      SKIP_XMTP=1 pnpm tsx src/buildMasterSheet.ts   # build without reach

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const EXPORT_DIR = resolve(ROOT, "exports");

const TOP_CREATORS = resolve(
  EXPORT_DIR,
  "outreach-top-creators-289-2026-04-22T06-20-21-000Z.json",
);
const EXT_WALLETS = resolve(
  EXPORT_DIR,
  "outreach-triple-signal-50-2026-04-22T05-18-11-911Z.json",
);
const MULTI_HOLDERS = resolve(
  EXPORT_DIR,
  "outreach-multi-creator-believers-40-2026-04-22T07-27-30-800Z.json",
);

// Columns must exactly match the Notion database property names for the
// Merge-with-CSV path to line up automatically.
const COLUMNS = [
  "Name",
  "Cohort",
  "Status",
  "Priority",
  "Zora Handle",
  "Coin Ticker",
  "Market Cap USD",
  "Unique Holders",
  "Farcaster Username",
  "Farcaster FID",
  "Farcaster Followers",
  "Farcaster URL",
  "Twitter Username",
  "Twitter Followers",
  "Twitter URL",
  "Basename",
  "ENS Name",
  "Holder Kind",
  "Install Target",
  "Install Target URL",
  "Signing EOA",
  "Signing EOA URL",
  "Signer ETH Balance",
  "Install Readiness",
  "Creators Held",
  "Creator Handles",
  "Zora Profile URL",
  "Avatar URL",
  "Holder Address",
  "CSW Address",
  "XMTP Reachable",
  "XMTP Address",
  "XMTP Address Kind",
  "XMTP Reachable Count",
];

type AddressKind =
  | "payout_recipient"
  | "csw"
  | "primary_wallet"
  | "signing_eoa"
  | "privy_wallet"
  | "base_owner"
  | "holder";

interface XmtpReachRow {
  cohort: string;
  handle: string | null;
  candidates: Array<{ address: string; kind: AddressKind }>;
  xmtp_reachable: boolean;
  xmtp_address: string | null;
  xmtp_address_kind: AddressKind | null;
  reachable_candidates: Array<{ address: string; kind: AddressKind }>;
}

function basescan(a: string | null | undefined) {
  return a ? `https://basescan.org/address/${a}` : "";
}
function warpcast(u: string | null | undefined) {
  return u && !u.startsWith("!") ? `https://warpcast.com/${u}` : "";
}
function twitter(u: string | null | undefined) {
  return u ? `https://twitter.com/${u}` : "";
}
function zora(h: string | null | undefined) {
  return h ? `https://zora.co/${h}` : "";
}
function short(a: string | null | undefined) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}
function installReadinessTop(r: Record<string, unknown>) {
  if (r.ready_to_install) return "ready";
  if (r.needs_gas_sponsorship) return "needs_gas";
  return "unknown";
}
function priTop(rank: number) {
  if (rank <= 20) return "P0";
  if (rank <= 100) return "P1";
  if (rank <= 200) return "P2";
  return "P3";
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

function latestXmtpReachJson(): string | null {
  if (process.env.SKIP_XMTP === "1") return null;
  const files = readdirSync(EXPORT_DIR).filter(
    (f) => f.startsWith("xmtp-reach-") && f.endsWith(".json"),
  );
  files.sort();
  return files.length ? resolve(EXPORT_DIR, files[files.length - 1]) : null;
}

interface XmtpIndex {
  byHandle: Map<string, XmtpReachRow>;
  byAddress: Map<string, XmtpReachRow>;
}

function loadXmtpIndex(): XmtpIndex {
  const empty: XmtpIndex = {
    byHandle: new Map(),
    byAddress: new Map(),
  };
  const path = latestXmtpReachJson();
  if (!path) return empty;
  const arr = JSON.parse(readFileSync(path, "utf8")) as XmtpReachRow[];
  const byHandle = new Map<string, XmtpReachRow>();
  const byAddress = new Map<string, XmtpReachRow>();
  for (const row of arr) {
    if (row.handle) byHandle.set(row.handle.toLowerCase(), row);
    // Also index by primary candidate address so multi_holder rows (which
    // often lack a handle) still join.
    for (const c of row.candidates ?? []) {
      byAddress.set(c.address.toLowerCase(), row);
    }
  }
  console.log(
    `Loaded XMTP index: ${arr.length} rows from ${path.split("/").pop()}`,
  );
  return { byHandle, byAddress };
}

function lookupXmtp(
  idx: XmtpIndex,
  opts: { handle?: string | null; addresses: Array<string | null | undefined> },
): XmtpReachRow | null {
  if (opts.handle) {
    const byH = idx.byHandle.get(opts.handle.toLowerCase());
    if (byH) return byH;
  }
  for (const a of opts.addresses) {
    if (!a) continue;
    const byA = idx.byAddress.get(a.toLowerCase());
    if (byA) return byA;
  }
  return null;
}

function topRow(r: Record<string, unknown>, idx: XmtpIndex) {
  const handle = (r.handle as string | null) ?? "";
  const ticker = (r.coin_ticker as string | null) ?? "";
  const xmtp = lookupXmtp(idx, {
    handle,
    addresses: [
      r.payout_recipient as string,
      r.smart_wallet as string,
      r.primary_wallet as string,
      r.signing_eoa as string,
    ],
  });
  return {
    Name: ticker
      ? `@${handle} ($${ticker})`
      : handle
        ? `@${handle}`
        : short(r.smart_wallet as string),
    Cohort: "top_creator",
    Status: "Not contacted",
    Priority: priTop(r.rank as number),
    "Zora Handle": handle,
    "Coin Ticker": ticker,
    "Market Cap USD": r.market_cap_usd,
    "Unique Holders": r.unique_holders,
    "Farcaster Username": r.farcaster_username,
    "Farcaster FID": r.farcaster_fid,
    "Farcaster Followers": r.farcaster_follower_count,
    "Farcaster URL": warpcast(r.farcaster_username as string),
    "Twitter Username": r.twitter_username,
    "Twitter Followers": r.twitter_follower_count,
    "Twitter URL": twitter(r.twitter_username as string),
    Basename: r.basename ?? "",
    "ENS Name": r.ens_name ?? "",
    "Holder Kind": "",
    "Install Target": r.install_target ?? "",
    "Install Target URL": basescan(r.install_target as string),
    "Signing EOA": r.signing_eoa ?? "",
    "Signing EOA URL": basescan(r.signing_eoa as string),
    "Signer ETH Balance": r.signing_eoa_eth,
    "Install Readiness": installReadinessTop(r),
    "Creators Held": "",
    "Creator Handles": "",
    "Zora Profile URL": zora(handle),
    "Avatar URL": r.avatar_url ?? "",
    "Holder Address": "",
    "CSW Address": r.smart_wallet ?? "",
    "XMTP Reachable": xmtp?.xmtp_reachable ? "true" : "false",
    "XMTP Address": xmtp?.xmtp_address ?? "",
    "XMTP Address Kind": xmtp?.xmtp_address_kind ?? "",
    "XMTP Reachable Count": xmtp?.reachable_candidates.length ?? 0,
  };
}

function extRow(r: Record<string, unknown>, idx: XmtpIndex) {
  const fc = (r.farcaster_username as string | null) ?? "";
  const handle = (r.zora_handle as string | null) ?? "";
  const fcClean = fc && !fc.startsWith("!") ? fc : "";
  const xmtp = lookupXmtp(idx, {
    handle,
    addresses: [r.zora_csw_address as string, r.eoa as string, r.zora_csw_base_owner as string],
  });
  return {
    Name: fcClean
      ? `@${fcClean}`
      : handle
        ? `@${handle}`
        : ((r.basename as string) ?? short(r.eoa as string)),
    Cohort: "extension_wallet",
    Status: "Not contacted",
    Priority: priExt(r.activity_tier as string),
    "Zora Handle": handle,
    "Coin Ticker": "",
    "Market Cap USD": "",
    "Unique Holders": "",
    "Farcaster Username": fcClean,
    "Farcaster FID": r.farcaster_fid,
    "Farcaster Followers": "",
    "Farcaster URL": warpcast(fc),
    "Twitter Username": "",
    "Twitter Followers": "",
    "Twitter URL": "",
    Basename: r.basename ?? "",
    "ENS Name": r.ens_name ?? "",
    "Holder Kind": "eoa",
    "Install Target": r.zora_csw_address ?? "",
    "Install Target URL": basescan(r.zora_csw_address as string),
    "Signing EOA": r.eoa ?? "",
    "Signing EOA URL": basescan(r.eoa as string),
    "Signer ETH Balance": "",
    "Install Readiness": "unknown",
    "Creators Held": "",
    "Creator Handles": "",
    "Zora Profile URL": zora(handle),
    "Avatar URL": r.avatar_url ?? "",
    "Holder Address": "",
    "CSW Address": r.zora_csw_address ?? "",
    "XMTP Reachable": xmtp?.xmtp_reachable ? "true" : "false",
    "XMTP Address": xmtp?.xmtp_address ?? "",
    "XMTP Address Kind": xmtp?.xmtp_address_kind ?? "",
    "XMTP Reachable Count": xmtp?.reachable_candidates.length ?? 0,
  };
}

function multiRow(r: Record<string, unknown>, idx: XmtpIndex) {
  const handle = (r.owner_handle as string | null) ?? "";
  const fc = (r.farcaster_username as string | null) ?? "";
  const creators = Array.isArray(r.creator_handles)
    ? (r.creator_handles as string[]).join(", ")
    : "";
  const xmtp = lookupXmtp(idx, {
    handle,
    addresses: [r.holder_address as string],
  });
  return {
    Name: handle
      ? `@${handle}`
      : fc
        ? `@${fc}`
        : ((r.basename as string) ?? short(r.holder_address as string)),
    Cohort: "multi_holder",
    Status: "Not contacted",
    Priority: priHeld(r.creators_held as number),
    "Zora Handle": handle,
    "Coin Ticker": "",
    "Market Cap USD": "",
    "Unique Holders": "",
    "Farcaster Username": fc,
    "Farcaster FID": r.farcaster_fid,
    "Farcaster Followers": "",
    "Farcaster URL": warpcast(fc),
    "Twitter Username": "",
    "Twitter Followers": "",
    "Twitter URL": "",
    Basename: r.basename ?? "",
    "ENS Name": r.ens_name ?? "",
    "Holder Kind": r.holder_kind ?? "",
    "Install Target": r.holder_address ?? "",
    "Install Target URL": basescan(r.holder_address as string),
    "Signing EOA": "",
    "Signing EOA URL": "",
    "Signer ETH Balance": "",
    "Install Readiness": "unknown",
    "Creators Held": r.creators_held,
    "Creator Handles": creators,
    "Zora Profile URL": r.is_zora_profile ? zora(handle) : "",
    "Avatar URL": r.avatar_url ?? "",
    "Holder Address": r.holder_address ?? "",
    "CSW Address": "",
    "XMTP Reachable": xmtp?.xmtp_reachable ? "true" : "false",
    "XMTP Address": xmtp?.xmtp_address ?? "",
    "XMTP Address Kind": xmtp?.xmtp_address_kind ?? "",
    "XMTP Reachable Count": xmtp?.reachable_candidates.length ?? 0,
  };
}

function rowToLine(row: Record<string, unknown>) {
  return COLUMNS.map((c) => csvEscape(row[c])).join(",");
}

function main() {
  const idx = loadXmtpIndex();
  const topCreators = (
    JSON.parse(readFileSync(TOP_CREATORS, "utf8")) as Array<Record<string, unknown>>
  ).map((r) => topRow(r, idx));
  const extWallets = (
    JSON.parse(readFileSync(EXT_WALLETS, "utf8")) as Array<Record<string, unknown>>
  ).map((r) => extRow(r, idx));
  const multiHolders = (
    JSON.parse(readFileSync(MULTI_HOLDERS, "utf8")) as Array<Record<string, unknown>>
  ).map((r) => multiRow(r, idx));
  const rows = [...topCreators, ...extWallets, ...multiHolders];

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = resolve(EXPORT_DIR, `master-outreach-sheet-${ts}.csv`);
  const header = COLUMNS.map(csvEscape).join(",");
  const body = rows.map(rowToLine).join("\n");
  writeFileSync(path, header + "\n" + body + "\n");

  const reachable = rows.filter((r) => r["XMTP Reachable"] === "true").length;
  console.log(`Wrote ${path}`);
  console.log(`  rows: ${rows.length}`);
  console.log(`  XMTP reachable: ${reachable}`);
}

main();
