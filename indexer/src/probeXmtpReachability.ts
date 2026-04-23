// Probe XMTP reachability for every address class in the outreach dataset.
//
// Why this matters: Base App (Coinbase Wallet messaging) auto-registers a
// user's Coinbase Smart Wallet as an XMTP identity the first time they open
// the messages tab. Any CBSW-family address in our dataset might therefore be
// directly messageable — we just need to ask the network which ones actually
// are.
//
// Strategy: collect every candidate address per creator (csw / payout /
// primary / signing eoa / holder / owner), dedupe to a single unique-address
// set, bootstrap an ephemeral XMTP client on production, and batch
// `canMessage` across chunks of 50. Join reachability back to creator rows
// with a preference order so each creator ends up with one "best" target.
//
// Outputs:
//   exports/xmtp-reach-<ts>.json — full per-creator detail
//   exports/xmtp-reach-<ts>.csv  — Notion-mergeable columns
//
// Usage: pnpm tsx src/probeXmtpReachability.ts
// Env:   XMTP_ENV=production (default)  |  dev  |  local

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

import {
  Client,
  type Signer,
  type Identifier,
} from "@xmtp/node-sdk";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// IdentifierKind is exported as an ambient const enum by @xmtp/node-sdk,
// which can't be referenced under `isolatedModules`. Matches
// IdentifierKind.Ethereum in the SDK source (also what the repo's
// xmtpQueueExecutor uses: ETHEREUM_IDENTIFIER_KIND = 0).
const IDENTIFIER_KIND_ETHEREUM = 0;

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

// Keep under the XMTP API's per-request cap. 50 is the published safe batch.
const CAN_MESSAGE_BATCH = 50;

const XMTP_ENV = (process.env.XMTP_ENV ?? "production") as
  | "production"
  | "dev"
  | "local";

type Cohort = "top_creator" | "extension_wallet" | "multi_holder";

type AddressKind =
  | "payout_recipient"
  | "csw"
  | "primary_wallet"
  | "signing_eoa"
  | "privy_wallet"
  | "base_owner"
  | "holder";

interface Candidate {
  address: string; // lowercased
  kind: AddressKind;
}

// Preference order when multiple addresses for one creator are reachable.
// Lower index wins. Payout first because that's usually the creator's main
// Coinbase CBSW (Base App identity). CSW second because the Zora-created
// smart wallet may also be the user's Base App account if they onboarded
// via Zora first. Signing EOA last — it's the weakest signal.
const KIND_PRIORITY: AddressKind[] = [
  "payout_recipient",
  "csw",
  "primary_wallet",
  "signing_eoa",
  "privy_wallet",
  "base_owner",
  "holder",
];

function priorityOf(kind: AddressKind): number {
  const i = KIND_PRIORITY.indexOf(kind);
  return i < 0 ? 999 : i;
}

function lc(addr: unknown): string | null {
  if (typeof addr !== "string") return null;
  const t = addr.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(t)) return null;
  return t.toLowerCase();
}

function addCandidate(
  list: Candidate[],
  address: unknown,
  kind: AddressKind,
): void {
  const a = lc(address);
  if (!a) return;
  // Same address can be both csw and primary_wallet for some creators; keep
  // only the higher-priority kind for this creator.
  const existing = list.find((c) => c.address === a);
  if (!existing) {
    list.push({ address: a, kind });
    return;
  }
  if (priorityOf(kind) < priorityOf(existing.kind)) {
    existing.kind = kind;
  }
}

interface CreatorRow {
  cohort: Cohort;
  name: string;
  handle: string | null;
  candidates: Candidate[];
}

function rowsFromTopCreators(): CreatorRow[] {
  const arr = JSON.parse(readFileSync(TOP_CREATORS, "utf8")) as Array<
    Record<string, unknown>
  >;
  return arr.map((r) => {
    const handle = (r.handle as string | null) ?? null;
    const ticker = r.coin_ticker as string | null;
    const name = ticker
      ? `@${handle} ($${ticker})`
      : handle
        ? `@${handle}`
        : (lc(r.smart_wallet) ?? "unknown");

    const cands: Candidate[] = [];
    addCandidate(cands, r.payout_recipient, "payout_recipient");
    addCandidate(cands, r.smart_wallet, "csw");
    addCandidate(cands, r.primary_wallet, "primary_wallet");
    addCandidate(cands, r.signing_eoa, "signing_eoa");
    addCandidate(cands, r.privy_wallet, "privy_wallet");
    return { cohort: "top_creator", name, handle, candidates: cands };
  });
}

function rowsFromExtWallets(): CreatorRow[] {
  const arr = JSON.parse(readFileSync(EXT_WALLETS, "utf8")) as Array<
    Record<string, unknown>
  >;
  return arr.map((r) => {
    const handle = (r.zora_handle as string | null) ?? null;
    const fc = r.farcaster_username as string | null;
    const name =
      fc && !fc.startsWith("!")
        ? `@${fc}`
        : handle
          ? `@${handle}`
          : (lc(r.eoa) ?? "unknown");

    const cands: Candidate[] = [];
    addCandidate(cands, r.zora_csw_address, "csw");
    addCandidate(cands, r.eoa, "signing_eoa");
    addCandidate(cands, r.zora_csw_base_owner, "base_owner");
    return { cohort: "extension_wallet", name, handle, candidates: cands };
  });
}

function rowsFromMultiHolders(): CreatorRow[] {
  const arr = JSON.parse(readFileSync(MULTI_HOLDERS, "utf8")) as Array<
    Record<string, unknown>
  >;
  return arr.map((r) => {
    const handle = (r.owner_handle as string | null) ?? null;
    const fc = r.farcaster_username as string | null;
    const holder = lc(r.holder_address);
    const name = handle
      ? `@${handle}`
      : fc
        ? `@${fc}`
        : (holder ?? "unknown");

    const cands: Candidate[] = [];
    // CBSW proxies here are almost certainly the user's Base App CSW. Treat
    // them as csw for preference ordering; EOA holders as signing_eoa.
    const kind: AddressKind =
      r.holder_kind === "cbsw_proxy" ? "csw" : "holder";
    addCandidate(cands, r.holder_address, kind);
    return { cohort: "multi_holder", name, handle, candidates: cands };
  });
}

async function buildEphemeralClient(): Promise<Client> {
  const pk = `0x${randomBytes(32).toString("hex")}` as Hex;
  const account = privateKeyToAccount(pk);

  const signer: Signer = {
    type: "EOA",
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IDENTIFIER_KIND_ETHEREUM,
    }),
    signMessage: async (message: string) => {
      const sig = await account.signMessage({ message });
      return hexToUint8(sig);
    },
  };

  // Never persist. Each probe run starts from a fresh throwaway identity.
  const dbPath = mkdtempSync(`${tmpdir()}/xmtp-probe-`);
  const dbKey = new Uint8Array(32);
  globalThis.crypto.getRandomValues(dbKey);

  return Client.create(signer, {
    env: XMTP_ENV,
    dbPath: `${dbPath}/db.sqlite`,
    dbEncryptionKey: dbKey,
  });
}

function hexToUint8(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function probeReachability(
  client: Client,
  addresses: string[],
): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  for (let i = 0; i < addresses.length; i += CAN_MESSAGE_BATCH) {
    const batch = addresses.slice(i, i + CAN_MESSAGE_BATCH);
    const ids: Identifier[] = batch.map((a) => ({
      identifier: a,
      identifierKind: IDENTIFIER_KIND_ETHEREUM,
    }));
    const result = await client.canMessage(ids);
    // canMessage returns Map<lowercaseAddress, boolean>
    for (const a of batch) {
      out.set(a, result.get(a) ?? false);
    }
    const progress = Math.min(i + batch.length, addresses.length);
    process.stdout.write(
      `\r  probed ${progress}/${addresses.length} (${Math.round((progress / addresses.length) * 100)}%)`,
    );
  }
  process.stdout.write("\n");
  return out;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  console.log(`XMTP reachability probe — env=${XMTP_ENV}`);
  console.log("Loading cohorts...");

  const rows = [
    ...rowsFromTopCreators(),
    ...rowsFromExtWallets(),
    ...rowsFromMultiHolders(),
  ];
  console.log(`  rows: ${rows.length}`);

  const uniq = new Set<string>();
  for (const r of rows) for (const c of r.candidates) uniq.add(c.address);
  const unique = [...uniq];
  console.log(`  unique candidate addresses: ${unique.length}`);

  console.log("Bootstrapping ephemeral XMTP client...");
  const client = await buildEphemeralClient();
  console.log(`  inbox id: ${client.inboxId}`);

  console.log(`Probing canMessage in batches of ${CAN_MESSAGE_BATCH}...`);
  const reach = await probeReachability(client, unique);

  const reachableTotal = [...reach.values()].filter(Boolean).length;
  console.log(
    `\nReachable addresses: ${reachableTotal} / ${unique.length} (${((reachableTotal / unique.length) * 100).toFixed(1)}%)`,
  );

  // Join back per creator
  type Enriched = CreatorRow & {
    reachable_candidates: Candidate[];
    xmtp_reachable: boolean;
    xmtp_address: string | null;
    xmtp_address_kind: AddressKind | null;
  };

  const enriched: Enriched[] = rows.map((row) => {
    const reachableCands = row.candidates.filter(
      (c) => reach.get(c.address) === true,
    );
    reachableCands.sort((a, b) => priorityOf(a.kind) - priorityOf(b.kind));
    const best = reachableCands[0] ?? null;
    return {
      ...row,
      reachable_candidates: reachableCands,
      xmtp_reachable: !!best,
      xmtp_address: best?.address ?? null,
      xmtp_address_kind: best?.kind ?? null,
    };
  });

  // Summary by cohort and by winning kind
  const byCohort: Record<string, { total: number; reachable: number }> = {
    top_creator: { total: 0, reachable: 0 },
    extension_wallet: { total: 0, reachable: 0 },
    multi_holder: { total: 0, reachable: 0 },
  };
  const byKind: Record<string, number> = {};
  for (const r of enriched) {
    byCohort[r.cohort].total += 1;
    if (r.xmtp_reachable) byCohort[r.cohort].reachable += 1;
    if (r.xmtp_address_kind) {
      byKind[r.xmtp_address_kind] = (byKind[r.xmtp_address_kind] ?? 0) + 1;
    }
  }

  console.log("\nReachable creators by cohort:");
  for (const [c, { total, reachable }] of Object.entries(byCohort)) {
    const pct = total ? ((reachable / total) * 100).toFixed(1) : "0.0";
    console.log(`  ${c.padEnd(18)} ${reachable}/${total} (${pct}%)`);
  }
  console.log("\nWinning address kind distribution:");
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(18)} ${n}`);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = resolve(EXPORT_DIR, `xmtp-reach-${ts}.json`);
  const csvPath = resolve(EXPORT_DIR, `xmtp-reach-${ts}.csv`);

  writeFileSync(jsonPath, JSON.stringify(enriched, null, 2));

  const header = [
    "Name",
    "Cohort",
    "Zora Handle",
    "XMTP Reachable",
    "XMTP Address",
    "XMTP Address Kind",
    "Reachable Candidates Count",
  ].map(csvEscape).join(",");
  const body = enriched
    .map((r) =>
      [
        r.name,
        r.cohort,
        r.handle ?? "",
        r.xmtp_reachable ? "true" : "false",
        r.xmtp_address ?? "",
        r.xmtp_address_kind ?? "",
        r.reachable_candidates.length,
      ]
        .map(csvEscape)
        .join(","),
    )
    .join("\n");
  writeFileSync(csvPath, header + "\n" + body + "\n");

  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${csvPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
