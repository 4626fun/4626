#!/usr/bin/env node
// Normalize the three outreach cohort exports into unified Notion page payloads.
// Output: /tmp/notion-batches/batch-NN.json, each an array of <=PAGES_PER_BATCH
// page objects ready for notion-create-pages.
//
// Usage: node scripts/build-notion-batches.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

const OUT_DIR = "/tmp/notion-batches";
const PAGES_PER_BATCH = 50;
// How many already-inserted top_creator rows to skip from the head of the
// combined stream (used during partial re-runs).
const SKIP_FROM_HEAD = Number(process.env.SKIP_FROM_HEAD ?? 0);
// Strip Avatar URL from payloads to minimise MCP response size. The column
// remains in the Notion schema and can be backfilled later.
const STRIP_AVATAR = process.env.STRIP_AVATAR === "1";

function basescan(addr) {
  if (!addr) return undefined;
  return `https://basescan.org/address/${addr}`;
}

function warpcast(username) {
  if (!username || typeof username !== "string") return undefined;
  if (username.startsWith("!")) return undefined; // bangs are unresolved FIDs
  return `https://warpcast.com/${username}`;
}

function twitterUrl(username) {
  if (!username) return undefined;
  return `https://twitter.com/${username}`;
}

function zoraProfileUrl(handle) {
  if (!handle) return undefined;
  return `https://zora.co/${handle}`;
}

function shortAddr(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Avatar URLs from Zora's CDN end with `?quality=...` and are often very
// long (>2000 chars). Notion caps URL fields at ~2000 chars; strip query.
function cleanUrl(u) {
  if (!u) return undefined;
  if (typeof u !== "string") return undefined;
  if (u.length > 1900) {
    const i = u.indexOf("?");
    if (i > 0 && i < 1900) return u.slice(0, i);
    return undefined;
  }
  return u;
}

// Drop null/undefined so we don't send empty fields to Notion.
function compact(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "number" && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function installReadinessTop(row) {
  if (row.ready_to_install) return "ready";
  if (row.needs_gas_sponsorship) return "needs_gas";
  return "unknown";
}

function priorityByRank(rank, thresholds = [20, 100, 200]) {
  const [p0, p1, p2] = thresholds;
  if (rank <= p0) return "P0";
  if (rank <= p1) return "P1";
  if (rank <= p2) return "P2";
  return "P3";
}

function topCreatorRow(row) {
  const handle = row.handle ?? "";
  const ticker = row.coin_ticker ?? "";
  const name = ticker
    ? `@${handle} ($${ticker})`
    : handle
      ? `@${handle}`
      : shortAddr(row.smart_wallet);

  return compact({
    Name: name,
    Cohort: "top_creator",
    Status: "Not contacted",
    Priority: priorityByRank(row.rank),
    "Zora Handle": handle,
    "Coin Ticker": ticker,
    "Market Cap USD": row.market_cap_usd,
    "Unique Holders": row.unique_holders,
    "Farcaster Username": row.farcaster_username,
    "Farcaster FID": row.farcaster_fid,
    "Farcaster Followers": row.farcaster_follower_count,
    "Farcaster URL": warpcast(row.farcaster_username),
    "Twitter Username": row.twitter_username,
    "Twitter Followers": row.twitter_follower_count,
    "Twitter URL": twitterUrl(row.twitter_username),
    Basename: row.basename,
    "ENS Name": row.ens_name,
    "Install Target": row.install_target,
    "Install Target URL": basescan(row.install_target),
    "Signing EOA": row.signing_eoa,
    "Signing EOA URL": basescan(row.signing_eoa),
    "Signer ETH Balance": row.signing_eoa_eth,
    "Install Readiness": installReadinessTop(row),
    "CSW Address": row.smart_wallet,
    "Zora Profile URL": zoraProfileUrl(handle),
    "Avatar URL": cleanUrl(row.avatar_url),
  });
}

function priorityByActivityTier(tier) {
  if (tier === "whale") return "P0";
  if (tier === "heavy_user") return "P1";
  if (tier === "active_user") return "P2";
  return "P3";
}

function extensionWalletRow(row) {
  const fc = row.farcaster_username;
  const handle = row.zora_handle;
  const name = fc && !fc.startsWith("!")
    ? `@${fc}`
    : handle
      ? `@${handle}`
      : row.basename
        ? row.basename
        : shortAddr(row.eoa);

  return compact({
    Name: name,
    Cohort: "extension_wallet",
    Status: "Not contacted",
    Priority: priorityByActivityTier(row.activity_tier),
    "Zora Handle": handle,
    "Farcaster Username": fc && !fc.startsWith("!") ? fc : undefined,
    "Farcaster FID": row.farcaster_fid,
    "Farcaster URL": warpcast(fc),
    Basename: row.basename,
    "ENS Name": row.ens_name,
    "Holder Kind": "eoa",
    "Install Target": row.zora_csw_address,
    "Install Target URL": basescan(row.zora_csw_address),
    "Signing EOA": row.eoa,
    "Signing EOA URL": basescan(row.eoa),
    "Install Readiness": "unknown",
    "CSW Address": row.zora_csw_address,
    "Zora Profile URL": zoraProfileUrl(handle),
    "Avatar URL": cleanUrl(row.avatar_url),
  });
}

function priorityByCreatorsHeld(n) {
  if (n >= 8) return "P0";
  if (n >= 5) return "P1";
  if (n >= 3) return "P2";
  return "P3";
}

function multiHolderRow(row) {
  const handle = row.owner_handle;
  const fc = row.farcaster_username;
  const name = handle
    ? `@${handle}`
    : fc
      ? `@${fc}`
      : row.basename ?? shortAddr(row.holder_address);

  const creatorHandles = Array.isArray(row.creator_handles)
    ? row.creator_handles.join(", ")
    : undefined;

  return compact({
    Name: name,
    Cohort: "multi_holder",
    Status: "Not contacted",
    Priority: priorityByCreatorsHeld(row.creators_held),
    "Zora Handle": handle,
    "Farcaster Username": fc,
    "Farcaster FID": row.farcaster_fid,
    "Farcaster URL": warpcast(fc),
    Basename: row.basename,
    "ENS Name": row.ens_name,
    "Holder Kind": row.holder_kind,
    "Install Target": row.holder_address,
    "Install Target URL": basescan(row.holder_address),
    "Install Readiness": "unknown",
    "Creators Held": row.creators_held,
    "Creator Handles": creatorHandles,
    "Holder Address": row.holder_address,
    "Zora Profile URL": row.is_zora_profile ? zoraProfileUrl(handle) : undefined,
    "Avatar URL": cleanUrl(row.avatar_url),
  });
}

function main() {
  const topCreators = readJson(TOP_CREATORS).map(topCreatorRow);
  const extWallets = readJson(EXT_WALLETS).map(extensionWalletRow);
  const multiHolders = readJson(MULTI_HOLDERS).map(multiHolderRow);

  let all = [...topCreators, ...extWallets, ...multiHolders];
  if (SKIP_FROM_HEAD > 0) all = all.slice(SKIP_FROM_HEAD);
  if (STRIP_AVATAR) {
    all = all.map((r) => {
      const { ["Avatar URL"]: _avatar, ...rest } = r;
      return rest;
    });
  }
  const pages = all.map((properties) => ({ properties }));

  console.log(`Normalized rows:`);
  console.log(`  top_creators:    ${topCreators.length}`);
  console.log(`  extension_wallets: ${extWallets.length}`);
  console.log(`  multi_holders:   ${multiHolders.length}`);
  console.log(`  total:           ${pages.length}`);

  mkdirSync(OUT_DIR, { recursive: true });

  const batches = [];
  for (let i = 0; i < pages.length; i += PAGES_PER_BATCH) {
    batches.push(pages.slice(i, i + PAGES_PER_BATCH));
  }

  batches.forEach((batch, idx) => {
    const path = `${OUT_DIR}/batch-${String(idx + 1).padStart(2, "0")}.json`;
    writeFileSync(path, JSON.stringify(batch, null, 2));
    console.log(`  wrote ${path} (${batch.length} pages)`);
  });

  writeFileSync(
    `${OUT_DIR}/manifest.json`,
    JSON.stringify(
      {
        totalPages: pages.length,
        batches: batches.length,
        pagesPerBatch: PAGES_PER_BATCH,
        dataSourceId: "1120a00e-fd44-4bea-a206-8e4a872c9780",
        databaseUrl:
          "https://www.notion.so/b3a8d5b4e0294d1fba6ccfa21f17c729",
      },
      null,
      2,
    ),
  );
}

main();
