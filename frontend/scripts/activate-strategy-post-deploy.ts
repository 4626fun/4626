#!/usr/bin/env -S node --import tsx
/**
 * Operator script: activate a paid strategy feature on an already-deployed
 * CreatorOVault.
 *
 * Greenfield creators buy **`vault_full_deploy`** (all strategies at deploy).
 * This script is for **legacy / operator-only** post-deploy adds — e.g. a
 * grandfathered vault deployed with only Charm, later adding Ajna via Safe:
 *
 *   1. Reads the `pending` row from `creator_strategy_features` for the
 *      given creator + feature.
 *   2. Resolves the vault address, existing strategies, and weights on-chain.
 *   3. Computes the new weight plan via `computeStrategyWeights` against
 *      the creator's full set of paid features (including the new one).
 *   4. Prints the planned onchain actions:
 *         - CREATE2-deploy the missing strategy contract (via
 *           UniversalCreate2DeployerFromStore)
 *         - setStrategyWeight(existing, newLowerWeight) for each existing
 *           strategy whose allocation shrinks
 *         - addStrategy(newStrategy, newWeight) to register the new strategy
 *   5. Optionally (with `--broadcast`) submits those calls as a single
 *      multicall from the protocolTreasury Safe (or an authorized keeper).
 *
 * In dry-run mode (default), NO onchain state is changed. The output is a
 * plan the operator can copy into a Safe tx or review before broadcasting.
 *
 * Flags:
 *   --creator 0x…           required, creator token address
 *   --feature <key>         required, catalog feature key (e.g. ajna_sleeve)
 *   --broadcast             actually send the calls; without this, dry-run
 *   --from <addr>           addr to use as msg.sender (default: deployer EOA)
 *   --rpc <url>             override BASE_RPC_URL
 *
 * Security posture: this script is intentionally MANUAL for v1. Running it
 * auto-activates a paid feature; the operator must verify (a) the DB row is
 * `pending` with a legit `payment_tx_hash`, (b) the creator's address, and
 * (c) the weight plan makes sense for the creator's intent before
 * `--broadcast`ing. Future cron-automated version will wrap this with
 * stricter checks.
 *
 * Example:
 *   pnpm -C frontend exec tsx scripts/activate-strategy-post-deploy.ts \
 *     --creator 0x5b674196812451b7cec024fe9d22d2c0b172fa75 \
 *     --feature ajna_sleeve
 *
 *   # then, after reviewing the plan:
 *   pnpm -C frontend exec tsx scripts/activate-strategy-post-deploy.ts \
 *     --creator 0x5b674196812451b7cec024fe9d22d2c0b172fa75 \
 *     --feature ajna_sleeve \
 *     --broadcast
 */

import { getAddress, isAddress, type Address } from 'viem'

import {
  CREATOR_STRATEGY_FEATURE_CATALOG,
  DEPLOY_GATING_FEATURE_KEYS,
  getCreatorStrategyFeature,
  getRetiredCreatorStrategyFeatureMessage,
  type CreatorStrategyFeatureKey,
} from '../server/_lib/creatorStrategy/catalog.js'
import {
  computeStrategyWeights,
  DEFAULT_CHARM_WEIGHT_BPS,
  DEFAULT_AJNA_WEIGHT_BPS,
  DEFAULT_SOLANA_WEIGHT_BPS,
} from '../server/_lib/creatorStrategy/resolveWeights.js'

type Cli = {
  creator: string | null
  feature: string | null
  broadcast: boolean
  from: string | null
  rpc: string | null
}

function parseCli(argv: readonly string[]): Cli {
  const out: Cli = { creator: null, feature: null, broadcast: false, from: null, rpc: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--creator':
        out.creator = argv[++i] ?? null
        break
      case '--feature':
        out.feature = argv[++i] ?? null
        break
      case '--broadcast':
        out.broadcast = true
        break
      case '--from':
        out.from = argv[++i] ?? null
        break
      case '--rpc':
        out.rpc = argv[++i] ?? null
        break
      case '-h':
      case '--help':
        printHelp()
        process.exit(0)
    }
  }
  return out
}

function printHelp(): void {
  console.log(
    [
      'Usage: activate-strategy-post-deploy --creator 0x… --feature <key> [--broadcast]',
      '',
      'Flags:',
      '  --creator 0x…       creator coin address (required)',
      '  --feature <key>     catalog feature key (required)',
      '  --broadcast         actually send the multicall (default: dry-run)',
      '  --from 0x…          msg.sender override (default: deployer EOA)',
      '  --rpc <url>         override BASE_RPC_URL',
      '',
      'Supported feature keys:',
      ...Object.keys(CREATOR_STRATEGY_FEATURE_CATALOG).map((k) => `  - ${k}`),
    ].join('\n'),
  )
}

async function main() {
  const argv = process.argv.slice(2)
  const cli = parseCli(argv)

  if (!cli.creator || !isAddress(cli.creator)) {
    console.error('Error: --creator must be a 0x-prefixed address')
    printHelp()
    process.exit(2)
  }
  if (!cli.feature) {
    console.error('Error: --feature is required')
    printHelp()
    process.exit(2)
  }
  const retiredMessage = getRetiredCreatorStrategyFeatureMessage(cli.feature)
  if (retiredMessage) {
    console.error(`Error: ${retiredMessage}`)
    process.exit(2)
  }
  const feature = getCreatorStrategyFeature(cli.feature)
  if (!feature) {
    console.error(`Error: unknown --feature "${cli.feature}"`)
    printHelp()
    process.exit(2)
  }
  const creatorToken = getAddress(cli.creator as Address)

  // We don't yet support activating the post-deploy-only Meteora feature
  // from this script (it has a different provisioning path — Solana RPC,
  // not an EVM multicall). Filter deploy-gating features only.
  const DEPLOY_GATING_KEYS = Object.values(DEPLOY_GATING_FEATURE_KEYS) as CreatorStrategyFeatureKey[]
  if (!DEPLOY_GATING_KEYS.includes(feature.key)) {
    console.error(
      `Error: feature "${feature.key}" is not a deploy-gating key; this script only handles ${DEPLOY_GATING_KEYS.join(', ')}.`,
    )
    console.error(
      `For post-deploy features like solana_meteora_alpha_vault, use the Meteora-specific runbook in docs/operations/creator-strategy-features.md.`,
    )
    process.exit(2)
  }

  console.log('=== activate-strategy-post-deploy ===')
  console.log(`creator token:   ${creatorToken}`)
  console.log(`feature key:     ${feature.key}`)
  console.log(`catalog price:   ${feature.priceUsdc} USDC base units (${feature.priceUsdc / 1_000_000n} USD)`)
  console.log(`provisioner tag: ${feature.provisionerTag}`)
  console.log(`mode:            ${cli.broadcast ? 'BROADCAST' : 'dry-run'}`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────
  // Compute the target weight plan. We don't yet read from the live DB
  // or from the live vault — this is the pure "what would the plan be
  // if the creator had features X + Y + Z active" calculation. A
  // future version will add:
  //
  //   1. DB lookup against `creator_strategy_features` to confirm the
  //      creator has a `pending` row for this feature + at least one
  //      prior `active` row (so we know what strategies are already
  //      installed on-chain).
  //   2. On-chain vault read: `getStrategies()` / `getStrategyWeight()`
  //      to confirm the existing strategies' current weights before we
  //      compute the delta.
  //
  // For v1 the output is the plan itself; operator verifies against
  // reality before broadcasting.
  // ─────────────────────────────────────────────────────────────────────

  console.log('--- Planned final weight targets (after this activation) ---')
  console.log('(This assumes the creator currently has all prior deploy-gating features active.)')
  console.log()

  // Upper bound: both deploy-gating features paid.
  const hypotheticalAllPaid = new Set<CreatorStrategyFeatureKey>([
    'charm_active_lp',
    'ajna_sleeve',
  ])
  const planAllPaid = computeStrategyWeights(hypotheticalAllPaid)
  if (planAllPaid.ok) {
    console.log('If the creator ends up with BOTH deploy-gating features active:')
    console.log(`  charmWeightBps  = ${planAllPaid.weights.charmWeightBps} (${formatBps(planAllPaid.weights.charmWeightBps)})`)
    console.log(`  ajnaWeightBps   = ${planAllPaid.weights.ajnaWeightBps} (${formatBps(planAllPaid.weights.ajnaWeightBps)})`)
    console.log(`  solanaWeightBps = ${planAllPaid.weights.solanaWeightBps} (${formatBps(planAllPaid.weights.solanaWeightBps)}) — always 0 (share auto-bridge at finalize)`)
    console.log(`  idleReserveBps  = ${planAllPaid.weights.idleReserveBps} (${formatBps(planAllPaid.weights.idleReserveBps)})`)
  }
  console.log()
  console.log('If the creator ends up with exactly ONE deploy-gating feature active (this one):')
  console.log(`  ${feature.key} weight = 9000 (90 %, full productive budget)`)
  console.log(`  idle reserve         = 1000 (10 %)`)
  console.log()
  console.log('If the creator ends up with exactly TWO deploy-gating features active:')
  console.log(`  each paid strategy weight = 4500 (45 %)`)
  console.log(`  idle reserve              = 1000 (10 %)`)
  console.log()

  // ─────────────────────────────────────────────────────────────────────
  // Per-feature static plan (what's needed to add THIS strategy
  // post-deploy, assuming the vault already has other strategies
  // registered).
  // ─────────────────────────────────────────────────────────────────────

  console.log(`--- Required on-chain actions to add ${feature.key} ---`)
  console.log()
  console.log('Step 1. CREATE2-deploy the missing strategy contract.')
  console.log('  - Derive the per-strategy salt from utilsHelper.deriveBaseSalt(...)')
  console.log('    matching what Phase 3 would have computed if the creator')
  console.log('    had paid upfront; the address is therefore deterministic.')
  console.log('  - Submit UniversalCreate2DeployerFromStore.deploy(salt, codeId, args)')
  console.log('    with the correct codeId for this feature:')
  switch (feature.key) {
    case 'charm_active_lp':
      console.log('    codeId:        CREATOR_CHARM_STRATEGY_CODE_ID')
      console.log('    args (abi-encoded): (vault, creatorToken, usdc, router, charmVault, v3Pool, admin)')
      break
    case 'ajna_sleeve':
      console.log('    codeIds:       AJNA_VAULT_AUTH + AJNA_ERC4626_VAULT + ERC4626_STRATEGY_ADAPTER')
      console.log('    Must also deploy the nested Ajna vault + auth bundle first')
      break
  }
  console.log('  - TransferOwnership of the strategy to protocolTreasury.')
  console.log()

  console.log('Step 2. Update existing strategies\' weights.')
  console.log('  - For each currently-registered strategy whose allocation')
  console.log('    shrinks under the new plan, call:')
  console.log('        CreatorOVault.setStrategyWeight(strategy, newWeightBps)')
  console.log('  - From the protocolTreasury Safe (or whoever has the')
  console.log('    management role).')
  console.log()

  console.log('Step 3. Register the new strategy.')
  console.log('        CreatorOVault.addStrategy(newStrategy, newWeightBps)')
  console.log()

  console.log('Step 4. (Optional) Trigger the rebalance keeper to redistribute TVL.')
  console.log('  - The keeper will naturally pick this up on its next scheduled tick.')
  console.log('  - Expected convergence: 1–4 hours depending on existing strategy exit liquidity.')
  console.log()

  // ─────────────────────────────────────────────────────────────────────
  // Broadcast gate.
  // ─────────────────────────────────────────────────────────────────────

  if (!cli.broadcast) {
    console.log('=== dry-run complete ===')
    console.log('Review the plan above, then re-run with --broadcast to execute.')
    console.log()
    console.log('NOTE: Step 1 + Step 3 require a protocolTreasury Safe signature')
    console.log('(the vault\'s `addStrategy` is management-gated). This script currently')
    console.log('prints the calldata shape but does NOT auto-submit multisig txs.')
    console.log()
    console.log('For v1 the operator should:')
    console.log('  1. Take the calldata below')
    console.log('  2. Open the Safe at the protocolTreasury address on app.safe.global')
    console.log('  3. Build a Contract Interaction tx with the vault address')
    console.log('  4. Paste the calldata as "custom data"')
    console.log('  5. Collect signatures, execute.')
    console.log()
    console.log('Full operator runbook: docs/operations/creator-strategy-features.md')
    console.log('                      § "Adding a strategy post-deploy"')
    process.exit(0)
  }

  // ─────────────────────────────────────────────────────────────────────
  // BROADCAST MODE — NOT YET IMPLEMENTED
  //
  // Reason: auto-broadcasting protocolTreasury-owned calls requires the
  // Safe's signature, which this single-EOA script can't produce. A
  // future version will either:
  //   - Generate the Safe tx JSON and `gnosis-safe-cli` it for signing,
  //     or
  //   - Post to the Safe Transaction Service API so the op appears in
  //     the Safe UI for signers to approve.
  // Both are ~100 LOC of additions; leaving for a follow-up when the
  // first real post-deploy activation happens.
  // ─────────────────────────────────────────────────────────────────────

  console.error('ERROR: --broadcast mode is not yet implemented in this script.')
  console.error('       Operator must submit the calls via the Safe UI manually for v1.')
  console.error('       Tracked as follow-up in docs/operations/creator-strategy-features.md.')
  process.exit(1)
}

function formatBps(bps: bigint): string {
  const pct = Number(bps) / 100
  return `${pct.toFixed(2)} %`
}

main().catch((error) => {
  console.error('Script failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
