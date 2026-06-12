#!/usr/bin/env tsx
/**
 * Revoke the AlfaClub vigilante's historical ERC-8004 self-feedback on the
 * 4626 agent (default agentId 2205).
 *
 * The vigilante's `giveFeedback` lane used to publish per-creator leaderboard
 * scorecards as feedback ON agent 2205 itself, signed by the sidekick EOA
 * (`ALFACLUB_VIGILANTE_SIGNER_PRIVATE_KEY` / `KPR_PRIVATE_KEY`). That lane is
 * now disabled; this one-time sweep revokes the existing entries so the
 * agent's 8004scan feed only carries real third-party feedback.
 *
 * Revocation must come from the same client address that authored the
 * feedback (`revokeFeedback` is reviewer-scoped), so this script signs with
 * the same key resolution as the vigilante.
 *
 * Dry run (default — lists what would be revoked, no transactions):
 *   pnpm -C frontend exec tsx scripts/ops/revoke-alfaclub-self-feedback.ts
 *
 * Execute:
 *   pnpm -C frontend exec tsx scripts/ops/revoke-alfaclub-self-feedback.ts \
 *     --execute --confirm=REVOKE-SELF-FEEDBACK
 *
 * Options:
 *   --agent=<id>        Agent id to sweep (default: ERC8004_AGENT_ID or 2205)
 *   --max=<n>           Cap revocations this run (default: all)
 *   --spacing-ms=<n>    Delay between txs (default: 1500)
 *   --tag1=<tag>        Only revoke entries with this tag1 (default: alfaclub)
 *                       Pass --tag1= (empty) to match every tag.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code: number) => void
  cwd: () => string
}

function loadDotEnvIfPresent(): void {
  for (const candidate of ['.env', 'frontend/.env']) {
    let raw: string
    try {
      raw = readFileSync(resolve(process.cwd(), candidate), 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
      if (!match) continue
      const key = match[1]
      if (process.env[key] !== undefined) continue
      let value = match[2]
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
    return
  }
}

function readArg(name: string, fallback: string): string {
  const prefix = `--${name}=`
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === `--${name}` && argv[i + 1] !== undefined) return argv[i + 1]
    if (argv[i].startsWith(prefix)) return argv[i].slice(prefix.length)
  }
  return fallback
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

function resolveSignerPrivateKey(): `0x${string}` | null {
  for (const key of ['ALFACLUB_VIGILANTE_SIGNER_PRIVATE_KEY', 'KPR_PRIVATE_KEY']) {
    const raw = (process.env[key] ?? '').trim()
    const hex = raw.startsWith('0x') ? raw.slice(2) : raw
    if (/^[0-9a-fA-F]{64}$/.test(hex)) return `0x${hex}` as `0x${string}`
  }
  return null
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
  loadDotEnvIfPresent()

  // Import after env load so the registry address override is visible.
  const { getReputationRegistryAddress, REPUTATION_REGISTRY_ABI } = await import(
    '../../server/_lib/agent/erc8004.js'
  )

  const agentIdRaw = readArg('agent', (process.env.ERC8004_AGENT_ID ?? '2205').trim())
  if (!/^\d+$/.test(agentIdRaw)) {
    console.error(`Invalid --agent value: ${agentIdRaw}`)
    process.exit(1)
  }
  const agentId = BigInt(agentIdRaw)
  const execute = hasFlag('execute')
  const confirm = readArg('confirm', '')
  const maxRaw = readArg('max', '')
  const max = /^\d+$/.test(maxRaw) ? Number.parseInt(maxRaw, 10) : null
  const spacingMs = Number.parseInt(readArg('spacing-ms', '1500'), 10) || 1500
  const tag1Filter = readArg('tag1', 'alfaclub')

  if (execute && confirm !== 'REVOKE-SELF-FEEDBACK') {
    console.error('Refusing to execute without --confirm=REVOKE-SELF-FEEDBACK')
    process.exit(1)
  }

  const pk = resolveSignerPrivateKey()
  if (!pk) {
    console.error(
      'No signer key found (ALFACLUB_VIGILANTE_SIGNER_PRIVATE_KEY or KPR_PRIVATE_KEY).',
    )
    process.exit(1)
  }
  const account = privateKeyToAccount(pk)

  const rpcUrl = (process.env.BASE_RPC_URL ?? '').trim() || 'https://mainnet.base.org'
  const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ account, chain: base, transport: http(rpcUrl) })
  const registry = getReputationRegistryAddress()

  console.log(`Registry:  ${registry}`)
  console.log(`Agent id:  ${agentId}`)
  console.log(`Client:    ${account.address} (feedback author / revoke signer)`)
  console.log(`Tag1:      ${tag1Filter || '(any)'}`)
  console.log(`Mode:      ${execute ? 'EXECUTE' : 'dry-run'}`)
  console.log('')

  const [, feedbackIndexes, values, valueDecimals, tag1s, tag2s, revokedStatuses] =
    (await publicClient.readContract({
      address: registry,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: 'readAllFeedback',
      args: [agentId, [account.address as Address], '', '', true],
    })) as [
      Address[],
      bigint[],
      bigint[],
      number[],
      string[],
      string[],
      boolean[],
    ]

  type Entry = { index: bigint; value: bigint; decimals: number; tag1: string; tag2: string }
  const pending: Entry[] = []
  let alreadyRevoked = 0
  let tagSkipped = 0
  for (let i = 0; i < feedbackIndexes.length; i += 1) {
    if (revokedStatuses[i]) {
      alreadyRevoked += 1
      continue
    }
    if (tag1Filter && tag1s[i] !== tag1Filter) {
      tagSkipped += 1
      continue
    }
    pending.push({
      index: feedbackIndexes[i],
      value: values[i],
      decimals: valueDecimals[i],
      tag1: tag1s[i],
      tag2: tag2s[i],
    })
  }

  console.log(
    `Found ${feedbackIndexes.length} entr${feedbackIndexes.length === 1 ? 'y' : 'ies'} from this client — ` +
      `${alreadyRevoked} already revoked, ${tagSkipped} skipped by tag filter, ${pending.length} pending revoke.`,
  )

  const targets = max !== null ? pending.slice(0, max) : pending
  if (targets.length === 0) {
    console.log('Nothing to revoke.')
    return
  }

  for (const entry of targets) {
    const display = Number(entry.value) / 10 ** entry.decimals
    console.log(
      `  index ${entry.index}  value ${display} (${entry.value}e-${entry.decimals})  [${entry.tag1}/${entry.tag2}]`,
    )
  }

  if (!execute) {
    console.log('')
    console.log(
      `Dry run complete. Re-run with --execute --confirm=REVOKE-SELF-FEEDBACK to revoke ${targets.length} entr${targets.length === 1 ? 'y' : 'ies'}.`,
    )
    return
  }

  console.log('')
  let revoked = 0
  let failed = 0
  for (let i = 0; i < targets.length; i += 1) {
    const entry = targets[i]
    try {
      const hash = await walletClient.writeContract({
        address: registry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: 'revokeFeedback',
        args: [agentId, entry.index],
      })
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 })
      if (receipt.status === 'success') {
        revoked += 1
        console.log(`  ✓ revoked index ${entry.index} — ${hash}`)
      } else {
        failed += 1
        console.log(`  ✗ reverted index ${entry.index} — ${hash}`)
      }
    } catch (err) {
      failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ✗ failed index ${entry.index} — ${msg.slice(0, 200)}`)
    }
    if (i < targets.length - 1) await sleep(spacingMs)
  }

  console.log('')
  console.log(`Done: ${revoked} revoked, ${failed} failed, ${pending.length - targets.length} remaining (run again).`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
