// Stage (and optionally send) XMTP V3 MLS groups for the reachable creator
// cohort. This script is intentionally two-phased:
//
//   1. `--plan`  (default)  — write the group membership plan to a JSON
//                             file and print a summary. Nothing touches
//                             the XMTP network.
//
//   2. `--send`             — actually call `conversations.newGroup()`
//                             using the provided XMTP_AGENT_PRIVATE_KEY.
//                             Without that env var set, the script
//                             refuses to run.
//
// Why two phases: adding 150+ strangers to a group chat in one shot is
// irreversible on the network. You should always review the plan first.
//
// Group strategy (driven by CLI arg):
//
//   --shape=two-by-kind   (default)
//     Group A: creators whose winning XMTP address is `payout_recipient`
//     Group B: creators whose winning XMTP address is `csw`
//     Natural segmentation: payout-routing creators vs. Coinbase-native
//     creators. Keeps each under the 250-member cap.
//
//   --shape=priority
//     Group A: P0 members only (≈21 people — highest-signal room)
//     Group B: P1 members    (≈79 people)
//     Skip P2/P3 (too diffuse for meaningful group conversation).
//
//   --shape=top-only
//     Group A: top 50 by priority (only P0s + first 29 P1s)
//     Smallest, highest-quality, single room.
//
// Output:
//   exports/xmtp-group-plan-<ts>.json
//
// Run (plan):
//   pnpm tsx src/createXmtpGroups.ts --shape=two-by-kind
//
// Run (send):
//   XMTP_AGENT_PRIVATE_KEY=0x... \
//   pnpm tsx src/createXmtpGroups.ts --shape=top-only --send

import { readFileSync, writeFileSync, readdirSync, mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  Client,
  type Signer,
  type Identifier,
} from "@xmtp/node-sdk";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

const ROOT = resolve(import.meta.dirname, "..");
const EXPORT_DIR = resolve(ROOT, "exports");
const IDENTIFIER_KIND_ETHEREUM = 0;

// V3 MLS hard cap. Keep buffer for the sender itself + future adds.
const GROUP_MEMBER_CAP = 240;

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

interface DraftRow {
  cohort: Cohort;
  priority: string;
  handle: string | null;
  name: string;
  xmtp_address: string;
  xmtp_address_kind: AddressKind;
}

interface GroupPlan {
  id: string;
  name: string;
  description: string;
  members: Array<{
    address: string;
    address_kind: AddressKind;
    cohort: Cohort;
    priority: string;
    name: string;
    handle: string | null;
  }>;
}

function parseArgs(argv: string[]) {
  const out = {
    shape: "two-by-kind" as "two-by-kind" | "priority" | "top-only",
    send: false,
  };
  for (const a of argv) {
    if (a.startsWith("--shape=")) {
      const v = a.slice("--shape=".length);
      if (v === "two-by-kind" || v === "priority" || v === "top-only")
        out.shape = v;
    } else if (a === "--send") {
      out.send = true;
    }
  }
  return out;
}

function latest(prefix: string): string {
  const files = readdirSync(EXPORT_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .sort();
  if (!files.length) throw new Error(`No ${prefix}*.json in ${EXPORT_DIR}`);
  return resolve(EXPORT_DIR, files[files.length - 1]);
}

function buildPlans(
  shape: "two-by-kind" | "priority" | "top-only",
  drafts: DraftRow[],
  _reach: XmtpReachRow[],
): GroupPlan[] {
  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const sorted = [...drafts].sort(
    (a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9),
  );

  const asMember = (d: DraftRow) => ({
    address: d.xmtp_address,
    address_kind: d.xmtp_address_kind,
    cohort: d.cohort,
    priority: d.priority,
    name: d.name,
    handle: d.handle,
  });

  const cap = (arr: DraftRow[]) => arr.slice(0, GROUP_MEMBER_CAP).map(asMember);

  if (shape === "two-by-kind") {
    const payout = sorted.filter((d) => d.xmtp_address_kind === "payout_recipient");
    const csw = sorted.filter((d) => d.xmtp_address_kind === "csw");
    return [
      {
        id: "group-payout-routed",
        name: "4626 · payout-routed creators",
        description:
          "Zora creators whose XMTP-reachable address is the Coinbase wallet they set as Zora payout recipient. Expect to find most top creators here.",
        members: cap(payout),
      },
      {
        id: "group-coinbase-native",
        name: "4626 · Coinbase-native creators",
        description:
          "Zora creators whose Zora smart wallet IS their Base App inbox — i.e., they onboarded Zora through a Coinbase account.",
        members: cap(csw),
      },
    ];
  }

  if (shape === "priority") {
    const p0 = sorted.filter((d) => d.priority === "P0");
    const p1 = sorted.filter((d) => d.priority === "P1");
    return [
      {
        id: "group-p0",
        name: "4626 · P0 creators",
        description: "Top 20-50 creators by market cap / unique holders. Highest signal room.",
        members: cap(p0),
      },
      {
        id: "group-p1",
        name: "4626 · P1 creators",
        description: "Mid-tier creators (ranks 21-100). Group adds should be consented first via DM.",
        members: cap(p1),
      },
    ];
  }

  // top-only
  return [
    {
      id: "group-top-50",
      name: "4626 · top 50 creators",
      description:
        "Hand-picked smallest-but-highest-signal room. P0 first, then the strongest P1 creators up to 50 seats.",
      members: cap(sorted.slice(0, 50)),
    },
  ];
}

async function buildAgentClient(privateKey: Hex): Promise<Client> {
  const account = privateKeyToAccount(privateKey);
  const signer: Signer = {
    type: "EOA",
    getIdentifier: () => ({
      identifier: account.address.toLowerCase(),
      identifierKind: IDENTIFIER_KIND_ETHEREUM,
    }),
    signMessage: async (m: string) => {
      const sig = await account.signMessage({ message: m });
      return hexToUint8(sig);
    },
  };
  // Ephemeral DB for this run. For a real agent you'd persist this path
  // so the agent keeps its inbox across restarts — but this script creates
  // the group once and exits.
  const dbDir = mkdtempSync(`${tmpdir()}/xmtp-agent-`);
  const dbKey = new Uint8Array(32);
  globalThis.crypto.getRandomValues(dbKey);
  return Client.create(signer, {
    env: "production",
    dbPath: `${dbDir}/db.sqlite`,
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

async function sendPlan(plan: GroupPlan, privateKey: Hex) {
  const client = await buildAgentClient(privateKey);
  console.log(`\nAgent inbox id: ${client.inboxId}`);
  console.log(`Creating group: ${plan.name}`);
  console.log(`  members: ${plan.members.length}`);

  const identifiers: Identifier[] = plan.members.map((m) => ({
    identifier: m.address,
    identifierKind: IDENTIFIER_KIND_ETHEREUM,
  }));

  const group = await client.conversations.createGroupWithIdentifiers(
    identifiers,
    {
      groupName: plan.name,
      groupDescription: plan.description,
    },
  );

  console.log(`  created group id: ${group.id}`);
  return { planId: plan.id, groupId: group.id };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`XMTP group creator — shape=${args.shape} send=${args.send}`);

  const reachPath = latest("xmtp-reach-");
  const dmPath = latest("dm-campaign-");
  const reach = JSON.parse(readFileSync(reachPath, "utf8")) as XmtpReachRow[];
  const drafts = JSON.parse(readFileSync(dmPath, "utf8")) as DraftRow[];

  const plans = buildPlans(args.shape, drafts, reach);

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const planPath = resolve(EXPORT_DIR, `xmtp-group-plan-${ts}.json`);
  writeFileSync(planPath, JSON.stringify(plans, null, 2));

  console.log(`\nWrote plan: ${planPath}`);
  for (const p of plans) {
    console.log(`\n  ${p.id}`);
    console.log(`    name: ${p.name}`);
    console.log(`    members: ${p.members.length}`);
    const byKind: Record<string, number> = {};
    for (const m of p.members) {
      byKind[m.address_kind] = (byKind[m.address_kind] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(byKind)) {
      console.log(`      ${k}: ${v}`);
    }
  }

  if (!args.send) {
    console.log("\n[plan only] no groups created. Re-run with --send after review.");
    return;
  }

  const pk = process.env.XMTP_AGENT_PRIVATE_KEY as Hex | undefined;
  if (!pk || !pk.startsWith("0x") || pk.length !== 66) {
    console.error(
      "\nERROR: --send requires XMTP_AGENT_PRIVATE_KEY=0x<64 hex> in env.",
    );
    process.exit(2);
  }

  console.log("\n[send] creating groups on production XMTP network...");
  const results = [];
  for (const plan of plans) {
    const r = await sendPlan(plan, pk);
    results.push(r);
  }
  writeFileSync(
    resolve(EXPORT_DIR, `xmtp-group-ids-${ts}.json`),
    JSON.stringify(results, null, 2),
  );
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
