#!/usr/bin/env node
/**
 * Compare deployment ABI JSON (historical / last-exported) against current Solidity
 * for naming drift that renames create (ABI-breaking).
 *
 * Usage:
 *   node scripts/check-abi-source-naming-parity.mjs
 *   node scripts/check-abi-source-naming-parity.mjs --fail   # exit 1 on mismatches
 *
 * This does NOT prove on-chain bytecode matches source — only that checked-in
 * `deployments/base/contracts/**` ABI names lag renames in `contracts/**`.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FAIL = process.argv.includes('--fail')

/** Patterns that flag intentional naming cutovers (legacy vs canonical). */
const INTEREST =
  /ve4626|VaultGauge|vaultGauge|CreatorLottery|creatorStats|tokenStats|TokenLottery|IVe4626|Ive4626|CreatorRegistry|Registry4626|setve4626|setVault|BribeDepot|BribesFactory/i

/**
 * Pairs: current source of truth → last exported deployment ABI.
 * Extend when adding greenfield renames.
 */
const PAIRS = [
  {
    id: 'LotteryManager4626',
    sol: 'contracts/shared/lottery/manager/LotteryManager4626.sol',
    abi: 'deployments/base/contracts/services/lottery/LotteryManager4626.json',
    /** Expected renames: ABI (old) → source (new). Documented for operators. */
    knownMaps: [
      ['setVaultGaugeVoting', 'setve4626GaugeVoting'],
      ['vaultGaugeVoting', 've4626GaugeVoting'],
      ['proposeVaultGaugeVoting', 'proposeve4626GaugeVoting'],
      ['commitVaultGaugeVoting', 'commitve4626GaugeVoting'],
      ['cancelVaultGaugeVotingProposal', 'cancelve4626GaugeVotingProposal'],
      ['VaultGaugeVotingUpdated', 've4626GaugeVotingUpdated'],
      ['VaultGaugeVotingProposed', 've4626GaugeVotingProposed'],
      ['VaultGaugeVotingProposalCancelled', 've4626GaugeVotingProposalCancelled'],
      ['getCreatorLotteryStats', 'getTokenLotteryStats'],
      ['creatorStats', 'tokenStats'],
    ],
  },
  {
    id: 'Registry4626',
    sol: 'contracts/shared/core/Registry4626.sol',
    abi: 'deployments/base/contracts/core/Registry4626.json',
    knownMaps: [
      // contractName field only; selectors largely Token* already on newer builds
    ],
  },
  {
    id: 've4626GaugeVoting',
    sol: 'contracts/shared/governance/ve4626GaugeVoting.sol',
    abi: 'deployments/base/contracts/governance/ve4626GaugeVoting.json',
    knownMaps: [],
  },
  {
    id: 'BribeDepot4626',
    sol: 'contracts/shared/governance/bribes/BribeDepot4626.sol',
    abi: 'deployments/base/contracts/governance/BribeDepot4626.json',
    knownMaps: [],
  },
  {
    id: 'VRFConsumer4626',

    sol: 'contracts/shared/lottery/manager/VRFConsumer4626.sol',
    abi: 'deployments/base/contracts/services/lottery/vrf/VRFConsumer4626.json',
    knownMaps: [],
  },
]

function extractSolNames(solText) {
  // Strip nested interface/library bodies so we only attribute names to the main contract file's
  // top-level implementations (avoids Ive4626GaugeVoting helpers counting as LotteryManager APIs).
  const stripped = solText.replace(/\binterface\s+\w+[^{]*\{[\s\S]*?\n\}/g, '')
  const funcs = new Set([...stripped.matchAll(/\bfunction\s+(\w+)\s*\(/g)].map((m) => m[1]))
  const events = new Set([...stripped.matchAll(/\bevent\s+(\w+)\s*\(/g)].map((m) => m[1]))
  // public state var getters (simple forms)
  const state = new Set(
    [
      ...stripped.matchAll(
        /^\s*(?:mapping\s*\([^)]+\)|[A-Za-z0-9_\[\].]+)\s+public(?:\s+immutable)?\s+(\w+)\s*[;=]/gm,
      ),
    ].map((m) => m[1]),
  )
  return { funcs: new Set([...funcs, ...state]), events }
}

function extractAbiNames(abiJson) {
  const abi = Array.isArray(abiJson) ? abiJson : abiJson.abi
  const funcs = new Set()
  const events = new Set()
  for (const item of abi || []) {
    if (!item?.name) continue
    if (item.type === 'function') funcs.add(item.name)
    if (item.type === 'event') events.add(item.name)
  }
  return {
    funcs,
    events,
    contractName: Array.isArray(abiJson) ? undefined : abiJson.contractName,
  }
}

function interesting(names) {
  return [...names].filter((n) => INTEREST.test(n)).sort()
}

function main() {
  let mismatches = 0
  const report = []

  for (const pair of PAIRS) {
    const solPath = join(ROOT, pair.sol)
    const abiPath = join(ROOT, pair.abi)
    const section = { id: pair.id, sol: pair.sol, abi: pair.abi, issues: [] }

    if (!existsSync(solPath) || !existsSync(abiPath)) {
      section.issues.push({ kind: 'missing-file', detail: `${pair.sol} or ${pair.abi}` })
      mismatches++
      report.push(section)
      continue
    }

    const sol = extractSolNames(readFileSync(solPath, 'utf8'))
    const abiRaw = JSON.parse(readFileSync(abiPath, 'utf8'))
    const abi = extractAbiNames(abiRaw)

    if (abi.contractName && abi.contractName !== pair.id) {
      section.issues.push({
        kind: 'contractName',
        detail: `JSON contractName=${JSON.stringify(abi.contractName)} expected ${pair.id}`,
        got: abi.contractName,
        expected: pair.id,
      })
      mismatches++
    }

    const sF = interesting(sol.funcs)
    const aF = interesting(abi.funcs)
    const sE = interesting(sol.events)
    const aE = interesting(abi.events)

    const onlySrcF = sF.filter((n) => !abi.funcs.has(n))
    const onlyAbiF = aF.filter((n) => !sol.funcs.has(n))
    const onlySrcE = sE.filter((n) => !abi.events.has(n))
    const onlyAbiE = aE.filter((n) => !sol.events.has(n))

    const mapOldToNew = new Map(pair.knownMaps || [])
    const mapNewToOld = new Map((pair.knownMaps || []).map(([o, n]) => [n, o]))

    for (const n of onlySrcF) {
      const old = mapNewToOld.get(n)
      section.issues.push({
        kind: 'func-source-only',
        name: n,
        note: old ? `known rename from ABI \`${old}\`` : 'no known ABI counterpart (new or renamed)',
      })
      mismatches++
    }
    for (const n of onlyAbiF) {
      const neu = mapOldToNew.get(n)
      section.issues.push({
        kind: 'func-abi-only',
        name: n,
        note: neu ? `known rename → source \`${neu}\`` : 'stale ABI name not in source',
      })
      mismatches++
    }
    for (const n of onlySrcE) {
      const old = mapNewToOld.get(n)
      section.issues.push({
        kind: 'event-source-only',
        name: n,
        note: old ? `known rename from ABI \`${old}\`` : 'no known ABI counterpart',
      })
      mismatches++
    }
    for (const n of onlyAbiE) {
      const neu = mapOldToNew.get(n)
      section.issues.push({
        kind: 'event-abi-only',
        name: n,
        note: neu ? `known rename → source \`${neu}\`` : 'stale ABI name not in source',
      })
      mismatches++
    }

    section.summary = {
      sourceInterestingFuncs: sF,
      abiInterestingFuncs: aF,
      sourceInterestingEvents: sE,
      abiInterestingEvents: aE,
    }
    report.push(section)
  }

  // Human-readable stdout
  console.log('ABI ↔ source naming parity (deployments/base vs contracts/)\n')
  for (const section of report) {
    console.log(`## ${section.id}`)
    console.log(`   source: ${section.sol}`)
    console.log(`   abi:    ${section.abi}`)
    if (!section.issues.length) {
      console.log('   OK — no interesting name drift\n')
      continue
    }
    for (const issue of section.issues) {
      const name = issue.name ? ` \`${issue.name}\`` : ''
      const note = issue.note || issue.detail || ''
      console.log(`   - [${issue.kind}]${name}${note ? ` — ${note}` : ''}`)
    }
    console.log('')
  }

  console.log(`Total interesting mismatches: ${mismatches}`)
  if (mismatches > 0) {
    console.log(`
Operator note:
  Checked-in deployment ABIs lag source renames. Do not call old selectors against
  newly deployed greenfield bytecode (or vice versa). After a greenfield forge build:
    1) export fresh ABIs into deployments/base/contracts/**
    2) re-run this script until clean (or update knownMaps)
    3) point frontend/ops at the new addresses + ABIs
`)
  }

  if (FAIL && mismatches > 0) process.exit(1)
}

main()
