#!/usr/bin/env node
/**
 * Walks every cre/cre-workflows/<workflow>/config.{staging,production}.json
 * and refuses any top-level key that starts with `mock`.
 *
 * Run from the repo root:
 *   node cre/scripts/check-no-mock-in-non-local-config.mjs
 *
 * Exit codes:
 *   0 — all configs clean
 *   1 — one or more configs contain forbidden mock* fields
 */

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, basename } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("../cre-workflows/", import.meta.url))

function findConfigFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) {
      out.push(...findConfigFiles(p))
    } else if (s.isFile()) {
      const name = basename(p)
      if (
        name === "config.staging.json" ||
        name === "config.production.json"
      ) {
        out.push(p)
      }
    }
  }
  return out
}

function findMockKeys(value, path) {
  const offenders = []
  if (Array.isArray(value)) {
    value.forEach((entry, idx) => {
      offenders.push(...findMockKeys(entry, `${path}[${idx}]`))
    })
    return offenders
  }
  if (value && typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      const lower = key.toLowerCase()
      // Allow `allowMockData: false` so prod configs can explicitly disclaim
      // mock usage; reject any key whose name starts with `mock`.
      if (lower.startsWith("mock")) {
        offenders.push(`${path}.${key}`)
      }
      offenders.push(...findMockKeys(val, `${path}.${key}`))
    }
  }
  return offenders
}

const violations = []
for (const file of findConfigFiles(ROOT)) {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"))
  } catch (err) {
    console.error(`[check-no-mock-in-non-local-config] failed to parse ${file}: ${err.message}`)
    process.exit(1)
  }
  const offenders = findMockKeys(parsed, "$")
  // Reject any explicit `allowMockData: true` outside local-simulation too.
  if (parsed && typeof parsed === "object" && parsed.allowMockData === true) {
    offenders.push("$.allowMockData=true")
  }
  for (const offender of offenders) {
    violations.push({ file, offender })
  }
}

if (violations.length === 0) {
  console.log("[check-no-mock-in-non-local-config] clean — no mock* fields in any staging/production config")
  process.exit(0)
}

console.error("[check-no-mock-in-non-local-config] forbidden mock* fields found:")
for (const v of violations) {
  console.error(`  ${v.file}: ${v.offender}`)
}
console.error("\nMock data is only permitted in config.local-simulation.json with workflowName ending in `-local-simulation` AND allowMockData=true.")
process.exit(1)
