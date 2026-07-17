#!/usr/bin/env tsx
/**
 * Read-only Hermit Railway env dependency auditor (H-08).
 *
 * Classifies known keys as required / Keepr-only / Vercel-only / approval-gated.
 * Reports presence + length class only — never prints secret values.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/hermit-railway-env-dependency-audit.ts
 *   railway variables --service 4626-hermit-agent --json \
 *     | pnpm -C frontend exec tsx scripts/ops/hermit-railway-env-dependency-audit.ts --stdin-json
 *   pnpm -C frontend exec tsx scripts/ops/hermit-railway-env-dependency-audit.ts --strict
 */

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code: number) => void
  stdin: { on: (event: string, cb: (chunk?: Buffer) => void) => void }
}

type Class =
  | "required"
  | "recommended"
  | "approval_gated"
  | "keepr_only"
  | "vercel_only"
  | "retired_alias"

type Entry = {
  key: string
  class: Class
  note: string
}

const MATRIX: Entry[] = [
  { key: "DATABASE_URL", class: "required", note: "Supabase pooler for ingest/JWT/claims" },
  { key: "ALFACLUB_API_KEY", class: "required", note: "Only bot credential for JWT-less posts" },
  { key: "ALFACLUB_CHAT_ROOM_ID", class: "required", note: "Bridge primary room (single id)" },
  {
    key: "ALFACLUB_HERMIT_COMMAND_ROOMS",
    class: "required",
    note: "Command rooms: 2,1043,1484,1659,1660",
  },
  {
    key: "ALFACLUB_INVERSE_AKITA_CHAT_REACTION_ROOM_IDS",
    class: "required",
    note: "Reaction rooms: 1484,1660,2,1043,1659",
  },
  { key: "ALFACLUB_CHAT_BRIDGE_ENABLED", class: "required", note: "Must be on for live Hermit" },
  {
    key: "ALFACLUB_CHAT_BRIDGE_ALLOW_RAILWAY",
    class: "required",
    note: "Must be on for Railway executor",
  },
  { key: "ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN", class: "recommended", note: "Seed only; Vercel cron rotates" },
  { key: "ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN", class: "recommended", note: "Seed only; Vercel cron rotates" },
  { key: "HERMIT_AGENT_CHAT_ENDPOINT", class: "recommended", note: "Creative /h drafts via Vercel" },
  { key: "HERMIT_AGENT_BEARER_TOKEN", class: "recommended", note: "Bearer for draft endpoint" },
  { key: "ARENA_ACP_HOME", class: "recommended", note: "Persistent ACP volume home" },
  { key: "ACP_ACCESS_TOKEN", class: "recommended", note: "Arena ACP session seed" },
  { key: "ACP_REFRESH_TOKEN", class: "recommended", note: "Single-use; do not re-seed consumed" },
  { key: "DGCLAW_API_KEY", class: "recommended", note: "dgclaw leaderboard/forum only" },
  {
    key: "ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED",
    class: "approval_gated",
    note: "Ship split_by_action code with value 0 until canary",
  },
  {
    key: "VIRTUALS_ACP_ENABLED",
    class: "approval_gated",
    note: "SDK bridge idle lane; keep 0 unless approved",
  },
  {
    key: "ALFACLUB_INVERSE_OPINION_TRADE_CAPTURE_ENABLED",
    class: "approval_gated",
    note: "Durable capture; enable only with migration chain live",
  },
  { key: "XMTP_AGENT_ADDRESS", class: "keepr_only", note: "Keepr XMTP; not Hermit chat path" },
  { key: "XMTP_WALLET_KEY", class: "keepr_only", note: "Keepr XMTP; do not delete in H-08" },
  { key: "PROTOCOL_CSW_ADDRESS", class: "keepr_only", note: "Protocol agent custody; Keepr/ERC-8004" },
  { key: "PROTOCOL_CSW_PRIVY_WALLET_ID", class: "keepr_only", note: "Protocol CSW Privy id" },
  { key: "CANONICAL_CSW_ADDRESS", class: "keepr_only", note: "Operator personal custody" },
  { key: "PRIVY_WALLET_ID", class: "keepr_only", note: "Server wallet id (Keepr lane)" },
  { key: "PRIVY_WALLET_ADDRESS", class: "keepr_only", note: "Server wallet address (Keepr lane)" },
  { key: "AGENT_RUNTIME_ROLE", class: "keepr_only", note: "Keepr primary role flag" },
  { key: "AGENT_CONSUME_XMTP", class: "keepr_only", note: "Keepr XMTP consumer flag" },
  {
    key: "ALFACLUB_RAILWAY_HERMIT_PRIMARY",
    class: "vercel_only",
    note: "Suppresses Vercel bridge cron while Railway healthy",
  },
  {
    key: "ALFACLUB_VERCEL_TOKEN_REFRESH_CRON_DISABLED",
    class: "vercel_only",
    note: "Must stay unset/off — Vercel owns Privy/JWT rotation",
  },
  {
    key: "ALFACLUB_VERCEL_BRIDGE_CRON_DISABLED",
    class: "vercel_only",
    note: "Failover control; keep unset unless deliberately disabling",
  },
  {
    key: "ALFACLUB_DAILY_BRIEF_ROOM_ID",
    class: "vercel_only",
    note: "Daily brief is Vercel cron; 1659 when separate-brief on",
  },
  { key: "CRON_SECRET", class: "vercel_only", note: "Vercel cron auth" },
  { key: "ALFACLUB_BOT_TOKEN", class: "retired_alias", note: "Retired; use ALFACLUB_API_KEY only" },
  { key: "alfaclub_api_key", class: "retired_alias", note: "Retired lowercase alias" },
  {
    key: "WENAKITA_ALFACLUB_API_KEY",
    class: "retired_alias",
    note: "Retired shadow alias; remove if present on Railway",
  },
]

function lengthClass(value: string): "empty" | "short" | "medium" | "long" {
  const n = value.trim().length
  if (n === 0) return "empty"
  if (n < 16) return "short"
  if (n < 64) return "medium"
  return "long"
}

async function readStdinJson(): Promise<Record<string, string>> {
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    process.stdin.on("data", (chunk) => {
      if (chunk) chunks.push(chunk)
    })
    process.stdin.on("end", () => resolve())
    process.stdin.on("error", reject)
  })
  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) return {}
  const parsed = JSON.parse(raw) as unknown
  const vars =
    parsed && typeof parsed === "object" && parsed !== null && "variables" in parsed
      ? (parsed as { variables: Record<string, unknown> }).variables
      : (parsed as Record<string, unknown>)
  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(vars ?? {})) {
    if (value && typeof value === "object" && value !== null && "value" in value) {
      flat[key] = String((value as { value: unknown }).value ?? "")
    } else if (value == null) {
      flat[key] = ""
    } else {
      flat[key] = String(value)
    }
  }
  return flat
}

function readProcessEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const entry of MATRIX) {
    out[entry.key] = String(process.env[entry.key] ?? "")
  }
  return out
}

async function main(): Promise<void> {
  const strict = process.argv.includes("--strict")
  const fromStdin = process.argv.includes("--stdin-json")
  const envMap = fromStdin ? await readStdinJson() : readProcessEnv()

  let failed = 0
  console.log("Hermit Railway env dependency audit (presence + length class only)\n")
  console.log(
    [
      "class".padEnd(16),
      "key".padEnd(48),
      "present".padEnd(8),
      "lenClass".padEnd(10),
      "note",
    ].join(" "),
  )
  console.log("-".repeat(120))

  for (const entry of MATRIX) {
    const value = String(envMap[entry.key] ?? "")
    const present = value.trim().length > 0
    const lc = lengthClass(value)
    console.log(
      [
        entry.class.padEnd(16),
        entry.key.padEnd(48),
        (present ? "yes" : "no").padEnd(8),
        lc.padEnd(10),
        entry.note,
      ].join(" "),
    )

    if (entry.class === "required" && !present) failed += 1
    if (entry.class === "retired_alias" && present) failed += 1
    if (
      entry.key === "ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED" &&
      present &&
      !["0", "false", "off", "no"].includes(value.trim().toLowerCase())
    ) {
      failed += 1
      console.log("  !! approval_gated flag is ON — keep 0 until canary approval")
    }
  }

  console.log("")
  if (failed > 0) {
    console.log(`RESULT: FAIL (${failed} issue(s))`)
    if (strict) process.exit(1)
    process.exit(0)
  }
  console.log("RESULT: OK")
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
