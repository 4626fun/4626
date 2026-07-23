#!/usr/bin/env node
/**
 * Render Shovel JSON config for 4626 protocol-native indexing (Tier A).
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node render-config.mjs > config.generated.json
 *
 * RPC: prefers BASE_LOGS_RPC_URL (Alchemy) then BASE_RPC_URL.
 * DB:  SHOVEL_PG_URL or DATABASE_URL (direct Supabase Postgres URL).
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function requireEnv(name, fallback) {
  const value = (process.env[name] ?? fallback ?? '').trim()
  if (!value) {
    console.error(`Missing required env: ${name}`)
    process.exit(1)
  }
  return value
}

function addrFilter(hexAddress) {
  return hexAddress.replace(/^0x/i, '').toLowerCase()
}

function blockMetaColumns() {
  return [
    { name: 'block_num', type: 'numeric' },
    { name: 'block_time', type: 'numeric' },
    { name: 'tx_hash', type: 'bytea' },
    { name: 'log_idx', type: 'int' },
    { name: 'log_addr', type: 'bytea' },
  ]
}

function blockMetaBindings(includeLogAddr = false) {
  const bindings = [
    { name: 'block_num', column: 'block_num' },
    { name: 'block_time', column: 'block_time' },
    { name: 'tx_hash', column: 'tx_hash' },
    { name: 'log_idx', column: 'log_idx' },
  ]
  if (includeLogAddr) {
    bindings.push({ name: 'log_addr', column: 'log_addr' })
  }
  return bindings
}

function logAddrFilter(filterArg) {
  return {
    name: 'log_addr',
    column: 'log_addr',
    filter_op: 'contains',
    filter_arg: filterArg,
  }
}

function logAddrFilterRef(integration, column) {
  return {
    name: 'log_addr',
    column: 'log_addr',
    filter_op: 'contains',
    filter_ref: { integration, column },
  }
}

const pgUrl = requireEnv('SHOVEL_PG_URL', process.env.DATABASE_URL)
const rpcUrl = requireEnv('BASE_LOGS_RPC_URL', process.env.BASE_RPC_URL)
const startBlock = BigInt(requireEnv('SHOVEL_BASE_START_BLOCK', '0'))

const deploymentBatcher = addrFilter(
  requireEnv('DEPLOYMENT_BATCHER', '0x02D7abC547F8B1e7E2D7a919D8D1005918361750'),
)
const lotteryManager = addrFilter(
  requireEnv('LOTTERY_MANAGER', '0xB45E68a5867935a5734E4185977F81c528006650'),
)

const baseSource = {
  name: 'base',
  chain_id: 8453,
  urls: [rpcUrl],
}

const sourceRef = [{ name: 'base', start: Number(startBlock) }]

/** @type {Record<string, unknown>} */
const config = {
  pg_url: pgUrl,
  eth_sources: [{
    ...baseSource,
    // 200 matches Alchemy/matrixed header-batch probe; 500 often fails eth_getBlockByNumber batches.
    batch_size: Number(process.env.SHOVEL_BATCH_SIZE ?? '200'),
    concurrency: Number(process.env.SHOVEL_CONCURRENCY ?? '1'),
  }],
  integrations: [
    {
      name: 'protocol_phase1_deployed',
      enabled: true,
      sources: sourceRef,
      table: {
        name: 'protocol_phase1_deployed',
        columns: [
          ...blockMetaColumns(),
          { name: 'creator_token', type: 'bytea' },
          { name: 'owner', type: 'bytea' },
          { name: 'oft_bootstrap_registry', type: 'bytea' },
          { name: 'vault', type: 'bytea' },
          { name: 'wrapper', type: 'bytea' },
          { name: 'share_oft', type: 'bytea' },
        ],
        index: [
          ['creator_token'],
          ['share_oft'],
          ['vault'],
          ['block_num DESC'],
        ],
      },
      block: [...blockMetaBindings(), logAddrFilter([deploymentBatcher])],
      event: {
        name: 'Phase1Deployed',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'creatorToken', type: 'address', column: 'creator_token' },
          { indexed: true, name: 'owner', type: 'address', column: 'owner' },
          { indexed: false, name: 'oftBootstrapRegistry', type: 'address', column: 'oft_bootstrap_registry' },
          { indexed: false, name: 'vault', type: 'address', column: 'vault' },
          { indexed: false, name: 'wrapper', type: 'address', column: 'wrapper' },
          { indexed: false, name: 'shareOFT', type: 'address', column: 'share_oft' },
        ],
      },
    },
    {
      name: 'protocol_phase2_launched',
      // Unused by app today — keep schema defined for future deploy dashboards.
      enabled: false,
      sources: sourceRef,
      table: {
        name: 'protocol_phase2_launched',
        columns: [
          ...blockMetaColumns(),
          { name: 'creator_token', type: 'bytea' },
          { name: 'owner', type: 'bytea' },
          { name: 'gauge_controller', type: 'bytea' },
          { name: 'cca_launch_arm', type: 'bytea' },
          { name: 'oracle', type: 'bytea' },
          { name: 'auction', type: 'bytea' },
        ],
        index: [['creator_token'], ['block_num DESC']],
      },
      block: [...blockMetaBindings(), logAddrFilter([deploymentBatcher])],
      event: {
        name: 'Phase2DeployedAndLaunched',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'creatorToken', type: 'address', column: 'creator_token' },
          { indexed: true, name: 'owner', type: 'address', column: 'owner' },
          { indexed: false, name: 'gaugeController', type: 'address', column: 'gauge_controller' },
          { indexed: false, name: 'ccaLaunchArm', type: 'address', column: 'cca_launch_arm' },
          { indexed: false, name: 'oracle', type: 'address', column: 'oracle' },
          { indexed: false, name: 'auction', type: 'address', column: 'auction' },
        ],
      },
    },
    {
      name: 'protocol_share_bridge_solana',
      // Unused by app today — Solana pipe still uses registry/DB paths.
      enabled: false,
      sources: sourceRef,
      table: {
        name: 'protocol_share_bridge_solana',
        columns: [
          ...blockMetaColumns(),
          { name: 'creator_token', type: 'bytea' },
          { name: 'owner', type: 'bytea' },
          { name: 'share_oft', type: 'bytea' },
          { name: 'amount', type: 'numeric' },
          { name: 'solana_destination', type: 'bytea' },
        ],
        index: [['share_oft'], ['block_num DESC']],
      },
      block: [...blockMetaBindings(), logAddrFilter([deploymentBatcher])],
      event: {
        name: 'ShareAllocationBridgedToSolana',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'creatorToken', type: 'address', column: 'creator_token' },
          { indexed: true, name: 'owner', type: 'address', column: 'owner' },
          { indexed: true, name: 'shareOFT', type: 'address', column: 'share_oft' },
          { indexed: false, name: 'amount', type: 'uint256', column: 'amount' },
          { indexed: false, name: 'solanaDestination', type: 'bytes32', column: 'solana_destination' },
        ],
      },
    },
    {
      name: 'protocol_lottery_winners',
      enabled: true,
      sources: sourceRef,
      table: {
        name: 'protocol_lottery_winners',
        columns: [
          ...blockMetaColumns(),
          { name: 'token', type: 'bytea' },
          { name: 'user', type: 'bytea' },
          { name: 'swap_amount_usd', type: 'numeric' },
          { name: 'reward_amount', type: 'numeric' },
          { name: 'request_id', type: 'numeric' },
        ],
        index: [['token'], ['user'], ['block_num DESC']],
      },
      block: [...blockMetaBindings(), logAddrFilter([lotteryManager])],
      event: {
        name: 'LotteryWinner',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'token', type: 'address', column: 'token' },
          { indexed: true, name: 'user', type: 'address', column: 'user' },
          { indexed: false, name: 'swapAmountUSD', type: 'uint256', column: 'swap_amount_usd' },
          { indexed: false, name: 'rewardAmount', type: 'uint256', column: 'reward_amount' },
          { indexed: false, name: 'requestId', type: 'uint256', column: 'request_id' },
        ],
      },
    },
    {
      name: 'protocol_lottery_multi_jackpot',
      enabled: true,
      sources: sourceRef,
      table: {
        name: 'protocol_lottery_multi_jackpot',
        columns: [
          ...blockMetaColumns(),
          { name: 'triggering_coin', type: 'bytea' },
          { name: 'winner', type: 'bytea' },
          { name: 'num_vaults_paid', type: 'numeric' },
        ],
        index: [['winner'], ['block_num DESC']],
      },
      block: [...blockMetaBindings(), logAddrFilter([lotteryManager])],
      event: {
        name: 'MultiTokenJackpotWon',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'triggeringCoin', type: 'address', column: 'triggering_coin' },
          { indexed: true, name: 'winner', type: 'address', column: 'winner' },
          { indexed: false, name: 'numVaultsPaid', type: 'uint256', column: 'num_vaults_paid' },
        ],
      },
    },
    {
      name: 'protocol_lottery_winner_callbacks',
      enabled: true,
      sources: sourceRef,
      table: {
        name: 'protocol_lottery_winner_callbacks',
        columns: [
          ...blockMetaColumns(),
          { name: 'dst_eid', type: 'numeric' },
          { name: 'winner', type: 'bytea' },
          { name: 'token', type: 'bytea' },
          { name: 'total_shares_paid', type: 'numeric' },
        ],
        index: [['winner'], ['token'], ['block_num DESC']],
      },
      block: [...blockMetaBindings(), logAddrFilter([lotteryManager])],
      event: {
        name: 'WinnerCallbackSent',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'dstEid', type: 'uint32', column: 'dst_eid' },
          { indexed: true, name: 'winner', type: 'address', column: 'winner' },
          { indexed: true, name: 'token', type: 'address', column: 'token' },
          { indexed: false, name: 'totalSharesPaid', type: 'uint256', column: 'total_shares_paid' },
        ],
      },
    },
    {
      name: 'protocol_lottery_winner_callback_drops',
      enabled: true,
      sources: sourceRef,
      table: {
        name: 'protocol_lottery_winner_callback_drops',
        columns: [
          ...blockMetaColumns(),
          { name: 'dst_eid', type: 'numeric' },
          { name: 'winner', type: 'bytea' },
          { name: 'token', type: 'bytea' },
          { name: 'total_shares_paid', type: 'numeric' },
          { name: 'reason', type: 'numeric' },
        ],
        index: [['winner'], ['token'], ['block_num DESC']],
      },
      block: [...blockMetaBindings(), logAddrFilter([lotteryManager])],
      event: {
        name: 'WinnerCallbackDropped',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'dstEid', type: 'uint32', column: 'dst_eid' },
          { indexed: true, name: 'winner', type: 'address', column: 'winner' },
          { indexed: true, name: 'token', type: 'address', column: 'token' },
          { indexed: false, name: 'totalSharesPaid', type: 'uint256', column: 'total_shares_paid' },
          { indexed: false, name: 'reason', type: 'uint8', column: 'reason' },
        ],
      },
    },
    {
      name: 'protocol_lottery_entries',
      enabled: true,
      sources: sourceRef,
      table: {
        name: 'protocol_lottery_entries',
        columns: [
          ...blockMetaColumns(),
          { name: 'token', type: 'bytea' },
          { name: 'user', type: 'bytea' },
          { name: 'swap_amount_usd', type: 'numeric' },
          { name: 'win_chance_ppm', type: 'numeric' },
          { name: 'request_id', type: 'numeric' },
        ],
        index: [['token'], ['user'], ['block_num DESC']],
      },
      block: [...blockMetaBindings(), logAddrFilter([lotteryManager])],
      event: {
        name: 'LotteryEntryCreated',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'token', type: 'address', column: 'token' },
          { indexed: true, name: 'user', type: 'address', column: 'user' },
          { indexed: false, name: 'swapAmountUSD', type: 'uint256', column: 'swap_amount_usd' },
          { indexed: false, name: 'winChancePPM', type: 'uint256', column: 'win_chance_ppm' },
          { indexed: false, name: 'requestId', type: 'uint256', column: 'request_id' },
        ],
      },
    },
    {
      name: 'protocol_vault_burn_stream_set',
      // Unused by app; filter_ref also misses deploy-time burn stream until UpdateBurnStream.
      enabled: false,
      sources: sourceRef,
      table: {
        name: 'protocol_vault_burn_stream_set',
        columns: [
          ...blockMetaColumns(),
          { name: 'old_burn_stream', type: 'bytea' },
          { name: 'new_burn_stream', type: 'bytea' },
        ],
        index: [['new_burn_stream'], ['block_num DESC']],
      },
      block: [
        ...blockMetaBindings(),
        logAddrFilterRef('protocol_phase1_deployed', 'vault'),
      ],
      event: {
        name: 'UpdateBurnStream',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'oldBurnStream', type: 'address', column: 'old_burn_stream' },
          { indexed: true, name: 'newBurnStream', type: 'address', column: 'new_burn_stream' },
        ],
      },
    },
    {
      name: 'protocol_burn_stream_dripped',
      // Depends on protocol_vault_burn_stream_set; disabled until burn-stream product reads exist.
      enabled: false,
      sources: sourceRef,
      table: {
        name: 'protocol_burn_stream_dripped',
        columns: [
          ...blockMetaColumns(),
          { name: 'epoch_start', type: 'numeric' },
          { name: 'burned_now', type: 'numeric' },
          { name: 'burned_total', type: 'numeric' },
          { name: 'remaining', type: 'numeric' },
          { name: 'pps', type: 'numeric' },
        ],
        index: [['epoch_start'], ['block_num DESC']],
      },
      block: [
        ...blockMetaBindings(),
        logAddrFilterRef('protocol_vault_burn_stream_set', 'new_burn_stream'),
      ],
      event: {
        name: 'StreamDripped',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'epochStart', type: 'uint256', column: 'epoch_start' },
          { indexed: false, name: 'burnedNow', type: 'uint256', column: 'burned_now' },
          { indexed: false, name: 'burnedTotal', type: 'uint256', column: 'burned_total' },
          { indexed: false, name: 'remaining', type: 'uint256', column: 'remaining' },
          { indexed: false, name: 'pps', type: 'uint256', column: 'pps' },
        ],
      },
    },
    {
      name: 'protocol_share_oft_transfers',
      // Disabled: ERC-20 Transfer over all ShareOFTs hits eth_getLogs 20k caps and
      // infinite converge-retry from SHOVEL_BASE_START_BLOCK. Re-enable only with a
      // product consumer and a smaller per-address / capped backfill strategy.
      enabled: false,
      sources: sourceRef,
      table: {
        name: 'protocol_share_oft_transfers',
        columns: [
          ...blockMetaColumns(),
          { name: 'from_addr', type: 'bytea' },
          { name: 'to_addr', type: 'bytea' },
          { name: 'value', type: 'numeric' },
        ],
        index: [['from_addr'], ['to_addr'], ['block_num DESC']],
      },
      block: [
        ...blockMetaBindings(),
        logAddrFilterRef('protocol_phase1_deployed', 'share_oft'),
      ],
      event: {
        name: 'Transfer',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'from', type: 'address', column: 'from_addr' },
          { indexed: true, name: 'to', type: 'address', column: 'to_addr' },
          { indexed: false, name: 'value', type: 'uint256', column: 'value' },
        ],
      },
    },
    {
      name: 'protocol_share_oft_buy_fees',
      enabled: true,
      sources: sourceRef,
      table: {
        name: 'protocol_share_oft_buy_fees',
        columns: [
          ...blockMetaColumns(),
          { name: 'from_addr', type: 'bytea' },
          { name: 'to_addr', type: 'bytea' },
          { name: 'amount', type: 'numeric' },
          { name: 'fee', type: 'numeric' },
        ],
        index: [['from_addr'], ['block_num DESC']],
      },
      block: [
        ...blockMetaBindings(),
        logAddrFilterRef('protocol_phase1_deployed', 'share_oft'),
      ],
      event: {
        name: 'BuyFee',
        type: 'event',
        anonymous: false,
        inputs: [
          { indexed: true, name: 'from', type: 'address', column: 'from_addr' },
          { indexed: true, name: 'to', type: 'address', column: 'to_addr' },
          { indexed: false, name: 'amount', type: 'uint256', column: 'amount' },
          { indexed: false, name: 'fee', type: 'uint256', column: 'fee' },
        ],
      },
    },
  ],
}

const outPath = process.argv.includes('--write')
  ? join(__dirname, 'config.generated.json')
  : null

const json = `${JSON.stringify(config, null, 2)}\n`

if (outPath) {
  writeFileSync(outPath, json)
  console.error(`Wrote ${outPath}`)
} else {
  process.stdout.write(json)
}
