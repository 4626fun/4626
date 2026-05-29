#!/usr/bin/env tsx
/**
 * Debug / inspection tool for room 1659 Hermit market context.
 *
 * Run this before begging Hermit for theatrical copy so you know exactly
 * what numbers the model is seeing.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/check-room-1659.ts --wallet 0xEbF94fA19DB7d2E7905dEcD01DaE4ea9eb4C1FF2
 */

import 'dotenv/config'
import { resolveRoom1659MarketContext, formatRoom1659MarketForHermit } from '../../frontend/server/_lib/alfaclub/room1659Market.js'
import { buildPinataPromptForHermit } from '../../frontend/server/_lib/hermit/skillRouter.js'

async function main() {
  const args = process.argv.slice(2)
  let wallet = '0xEbF94fA19DB7d2E7905dEcD01DaE4ea9eb4C1FF2'

  for (const arg of args) {
    if (arg.startsWith('0x') && arg.length > 30) {
      wallet = arg
      break
    }
    if (arg.includes('=')) {
      const [k, v] = arg.split('=')
      if (k.includes('wallet') && v && v.startsWith('0x')) {
        wallet = v
        break
      }
    }
  }

  console.log('=== ROOM 1659 HERMIT MARKET CONTEXT DEBUG ===')
  console.log('Wallet:', wallet)
  console.log('Fetching live data (Hyperliquid + AlfaClub + on-chain FriendKey quadratic curve)...\n')

  const snapshot = await resolveRoom1659MarketContext(wallet)

  console.log('RAW SNAPSHOT:')
  console.dir(snapshot, { depth: 4 })
  console.log('\n')

  const formatted = formatRoom1659MarketForHermit(snapshot)

  console.log('FORMATTED BLOCK (what gets shown to Hermit in the prompt):')
  console.log('-----------------------------------------------------------')
  console.log(`hype: ${formatted.hype}`)
  console.log(`liquidation: ${formatted.liquidation}`)
  console.log(`yourPosition / on-chain curve:`)
  console.log(formatted.yourPosition)
  console.log('-----------------------------------------------------------\n')

  // Show what the actual Pinata prompt prefix would look like
  console.log('EXAMPLE FULL PROMPT PREFIX THAT HERMIT SEES (truncated):')
  console.log('-----------------------------------------------------------')
  const fakePrompt = buildPinataPromptForHermit({
    mode: 'copy',
    userPrompt: 'say something unhinged and theatrical about the current situation in this room',
    room1659Market: snapshot,
  })
  console.log(fakePrompt.slice(0, 2200) + '\n... [truncated]')
  console.log('-----------------------------------------------------------\n')

  console.log('Use any of these as your actual message to hermit4626 in room 1659:')
  console.log('')
  console.log('/hermit this room is one liquidation away from glory or collapse. the quadratic curve still has tiny supply. write me 3-4 cinematic, quotable, dramatic lines the room can spam.')
  console.log('')
  console.log('/meme give me the most unhinged theatrical marketing copy for this stressed room using the live curve numbers.')
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
