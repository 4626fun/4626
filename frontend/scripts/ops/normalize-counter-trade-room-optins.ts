#!/usr/bin/env tsx

import {
  enforceSingleActiveCounterTradeActor,
  listActiveCounterTradeOptIns,
} from '../../server/_lib/alfaclub/counterTradeStore.js'

declare const process: {
  argv: string[]
  exit: (code: number) => void
}

function readArg(name: string, fallback: string): string {
  const prefix = `--${name}=`
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === `--${name}` && argv[i + 1]) return argv[i + 1]
    if (argv[i].startsWith(prefix)) return argv[i].slice(prefix.length)
  }
  return fallback
}

function hasFlag(name: string): boolean {
  const argv = process.argv.slice(2)
  return argv.includes(`--${name}`)
}

async function main(): Promise<void> {
  const roomId = readArg('room', '1659')
  const apply = hasFlag('apply')
  const reason = readArg('reason', 'room_single_actor_enforced')

  const active = await listActiveCounterTradeOptIns({ roomId, limit: 300 })
  if (active.length === 0) {
    console.log('[normalize-counter-trade-room-optins] no active opt-ins found', { roomId })
    process.exit(0)
    return
  }

  const survivor = active[0]
  const extras = active.slice(1)
  console.log('[normalize-counter-trade-room-optins] current active opt-ins', {
    roomId,
    activeCount: active.length,
    survivorSenderAddress: survivor.senderAddress,
    extraSenderAddresses: extras.map((row) => row.senderAddress),
    dryRun: !apply,
  })

  if (!apply || extras.length === 0) {
    process.exit(0)
    return
  }

  const result = await enforceSingleActiveCounterTradeActor({
    roomId,
    survivorSenderAddress: survivor.senderAddress,
    pauseReason: reason,
  })
  if (!result) {
    console.error('[normalize-counter-trade-room-optins] failed to enforce single actor', { roomId })
    process.exit(1)
    return
  }

  console.log('[normalize-counter-trade-room-optins] enforcement applied', {
    roomId: result.roomId,
    survivorSenderAddress: result.survivorSenderAddress,
    pausedSenderAddresses: result.pausedSenderAddresses,
  })
  process.exit(0)
}

void main()
