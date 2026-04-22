#!/usr/bin/env node
// Emit a single unified CSV matching the Notion "4626 Outreach — Zora Creators"
// schema, so it can be imported directly (Notion database → "..." → Merge with CSV).
// Columns must exactly match the Notion database property names.
//
// Usage: node scripts/build-notion-csv.mjs

import { readFileSync, writeFileSync } from "node:fs";
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

const OUT_CSV = resolve(EXPORT_DIR, "notion-outreach-unified-379.csv");

// Column order and exact names must match the Notion DB schema.
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
];

function basescan(a) { return a ? `https://basescan.org/address/${a}` : ""; }
function warpcast(u) { return u && !u.startsWith("!") ? `https://warpcast.com/${u}` : ""; }
function twitter(u) { return u ? `https://twitter.com/${u}` : ""; }
function zora(h) { return h ? `https://zora.co/${h}` : ""; }
function short(a) { return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ""; }

function installReadinessTop(r) {
  if (r.ready_to_install) return "ready";
  if (r.needs_gas_sponsorship) return "needs_gas";
  return "unknown";
}
function priTop(r) {
  if (r.rank <= 20) return "P0";
  if (r.rank <= 100) return "P1";
  if (r.rank <= 200) return "P2";
  return "P3";
}
function priExt(t) {
  return t === "whale" ? "P0" : t === "heavy_user" ? "P1" : t === "active_user" ? "P2" : "P3";
}
function priHeld(n) {
  return n >= 8 ? "P0" : n >= 5 ? "P1" : n >= 3 ? "P2" : "P3";
}

function topRow(r) {
  const h = r.handle ?? "";
  const t = r.coin_ticker ?? "";
  return {
    Name: t ? `@${h} ($${t})` : h ? `@${h}` : short(r.smart_wallet),
    Cohort: "top_creator",
    Status: "Not contacted",
    Priority: priTop(r),
    "Zora Handle": h,
    "Coin Ticker": t,
    "Market Cap USD": r.market_cap_usd,
    "Unique Holders": r.unique_holders,
    "Farcaster Username": r.farcaster_username,
    "Farcaster FID": r.farcaster_fid,
    "Farcaster Followers": r.farcaster_follower_count,
    "Farcaster URL": warpcast(r.farcaster_username),
    "Twitter Username": r.twitter_username,
    "Twitter Followers": r.twitter_follower_count,
    "Twitter URL": twitter(r.twitter_username),
    Basename: r.basename,
    "ENS Name": r.ens_name,
    "Holder Kind": "",
    "Install Target": r.install_target,
    "Install Target URL": basescan(r.install_target),
    "Signing EOA": r.signing_eoa,
    "Signing EOA URL": basescan(r.signing_eoa),
    "Signer ETH Balance": r.signing_eoa_eth,
    "Install Readiness": installReadinessTop(r),
    "Creators Held": "",
    "Creator Handles": "",
    "Zora Profile URL": zora(h),
    "Avatar URL": r.avatar_url ?? "",
    "Holder Address": "",
    "CSW Address": r.smart_wallet,
  };
}

function extRow(r) {
  const fc = r.farcaster_username;
  const h = r.zora_handle;
  const fcClean = fc && !fc.startsWith("!") ? fc : "";
  return {
    Name: fcClean ? `@${fcClean}` : h ? `@${h}` : r.basename ?? short(r.eoa),
    Cohort: "extension_wallet",
    Status: "Not contacted",
    Priority: priExt(r.activity_tier),
    "Zora Handle": h,
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
    Basename: r.basename,
    "ENS Name": r.ens_name,
    "Holder Kind": "eoa",
    "Install Target": r.zora_csw_address,
    "Install Target URL": basescan(r.zora_csw_address),
    "Signing EOA": r.eoa,
    "Signing EOA URL": basescan(r.eoa),
    "Signer ETH Balance": "",
    "Install Readiness": "unknown",
    "Creators Held": "",
    "Creator Handles": "",
    "Zora Profile URL": zora(h),
    "Avatar URL": r.avatar_url ?? "",
    "Holder Address": "",
    "CSW Address": r.zora_csw_address,
  };
}

function multiRow(r) {
  const h = r.owner_handle;
  const fc = r.farcaster_username;
  const creators = Array.isArray(r.creator_handles) ? r.creator_handles.join(", ") : "";
  return {
    Name: h ? `@${h}` : fc ? `@${fc}` : r.basename ?? short(r.holder_address),
    Cohort: "multi_holder",
    Status: "Not contacted",
    Priority: priHeld(r.creators_held),
    "Zora Handle": h,
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
    Basename: r.basename,
    "ENS Name": r.ens_name,
    "Holder Kind": r.holder_kind,
    "Install Target": r.holder_address,
    "Install Target URL": basescan(r.holder_address),
    "Signing EOA": "",
    "Signing EOA URL": "",
    "Signer ETH Balance": "",
    "Install Readiness": "unknown",
    "Creators Held": r.creators_held,
    "Creator Handles": creators,
    "Zora Profile URL": r.is_zora_profile ? zora(h) : "",
    "Avatar URL": r.avatar_url ?? "",
    "Holder Address": r.holder_address,
    "CSW Address": "",
  };
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToLine(row) {
  return COLUMNS.map((c) => csvEscape(row[c])).join(",");
}

function main() {
  const topCreators = JSON.parse(readFileSync(TOP_CREATORS, "utf8")).map(topRow);
  const extWallets = JSON.parse(readFileSync(EXT_WALLETS, "utf8")).map(extRow);
  const multiHolders = JSON.parse(readFileSync(MULTI_HOLDERS, "utf8")).map(multiRow);
  const rows = [...topCreators, ...extWallets, ...multiHolders];

  const header = COLUMNS.map(csvEscape).join(",");
  const body = rows.map(rowToLine).join("\n");
  writeFileSync(OUT_CSV, header + "\n" + body + "\n");

  console.log(`Wrote ${OUT_CSV}`);
  console.log(`  top_creators:      ${topCreators.length}`);
  console.log(`  extension_wallets: ${extWallets.length}`);
  console.log(`  multi_holders:     ${multiHolders.length}`);
  console.log(`  total rows:        ${rows.length}`);
}

main();
