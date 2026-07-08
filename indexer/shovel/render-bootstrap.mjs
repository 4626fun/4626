#!/usr/bin/env node
/** Bootstrap Shovel config: fixed-address integrations only (no filter_ref). */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const pgUrl = requireEnv('SHOVEL_PG_URL', process.env.DATABASE_URL)
const rpcUrl = requireEnv('BASE_LOGS_RPC_URL', process.env.BASE_RPC_URL)
const startBlock = Number(requireEnv('SHOVEL_BASE_START_BLOCK', '48345250'))
const deploymentBatcher = addrFilter(requireEnv('DEPLOYMENT_BATCHER', '0x02D7abC547F8B1e7E2D7a919D8D1005918361750'))
const lotteryManager = addrFilter(requireEnv('LOTTERY_MANAGER', '0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1'))

function fixedEvent(name, tableName, logFilter, event) {
  return {
    name,
    enabled: true,
    sources: [{ name: 'base', start: startBlock }],
    table: {
      name: tableName,
      columns: [
        { name: 'block_num', type: 'numeric' },
        { name: 'block_time', type: 'numeric' },
        { name: 'tx_hash', type: 'bytea' },
        { name: 'log_addr', type: 'bytea' },
        ...event.extraColumns,
      ],
    },
    block: [
      { name: 'block_num', column: 'block_num' },
      { name: 'block_time', column: 'block_time' },
      { name: 'tx_hash', column: 'tx_hash' },
      {
        name: 'log_addr',
        column: 'log_addr',
        filter_op: 'contains',
        filter_arg: logFilter,
      },
    ],
    event: {
      name: event.name,
      type: 'event',
      anonymous: false,
      inputs: event.inputs,
    },
  }
}

const config = {
  pg_url: pgUrl,
  eth_sources: [
    {
      name: 'base',
      chain_id: 8453,
      urls: [rpcUrl],
      batch_size: Number(process.env.SHOVEL_BATCH_SIZE ?? '500'),
      concurrency: Number(process.env.SHOVEL_CONCURRENCY ?? '1'),
    },
  ],
  integrations: [
    fixedEvent('protocol_phase1_deployed', 'protocol_phase1_deployed', [deploymentBatcher], {
      name: 'Phase1Deployed',
      extraColumns: [
        { name: 'creator_token', type: 'bytea' },
        { name: 'owner', type: 'bytea' },
        { name: 'oft_bootstrap_registry', type: 'bytea' },
        { name: 'vault', type: 'bytea' },
        { name: 'wrapper', type: 'bytea' },
        { name: 'share_oft', type: 'bytea' },
      ],
      inputs: [
        { indexed: true, name: 'creatorToken', type: 'address', column: 'creator_token' },
        { indexed: true, name: 'owner', type: 'address', column: 'owner' },
        { indexed: false, name: 'oftBootstrapRegistry', type: 'address', column: 'oft_bootstrap_registry' },
        { indexed: false, name: 'vault', type: 'address', column: 'vault' },
        { indexed: false, name: 'wrapper', type: 'address', column: 'wrapper' },
        { indexed: false, name: 'shareOFT', type: 'address', column: 'share_oft' },
      ],
    }),
    fixedEvent('protocol_lottery_winners', 'protocol_lottery_winners', [lotteryManager], {
      name: 'LotteryWinner',
      extraColumns: [
        { name: 'token', type: 'bytea' },
        { name: 'winner', type: 'bytea' },
        { name: 'swap_amount_usd', type: 'numeric' },
        { name: 'reward_amount', type: 'numeric' },
        { name: 'request_id', type: 'numeric' },
      ],
      inputs: [
        { indexed: true, name: 'token', type: 'address', column: 'token' },
        { indexed: true, name: 'user', type: 'address', column: 'winner' },
        { indexed: false, name: 'swapAmountUSD', type: 'uint256', column: 'swap_amount_usd' },
        { indexed: false, name: 'rewardAmount', type: 'uint256', column: 'reward_amount' },
        { indexed: false, name: 'requestId', type: 'uint256', column: 'request_id' },
      ],
    }),
  ],
}

writeFileSync(join(__dirname, 'config.bootstrap.json'), `${JSON.stringify(config, null, 2)}\n`)
console.error('Wrote config.bootstrap.json')
