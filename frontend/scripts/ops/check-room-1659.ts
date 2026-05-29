#!/usr/bin/env tsx
/**
 * Debug script: See exactly what data Hermit would get for room 1659
 * for a given wallet.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/ops/check-room-1659.ts --wallet=0x...
 */

import { resolveRoom1659MarketContext, formatRoom1659MarketForHermit } from '../../server/_lib/alfaclub/room1659Market.js';
import { buildPinataPromptForHermit } from '../../server/_lib/hermit/skillRouter.js'; // for E2E prompt simulation

async function main() {
  const args = process.argv.slice(2);
  let wallet = args.find(a => a.startsWith('--wallet='))?.split('=')[1];

  if (!wallet) {
    console.error('Usage: pnpm -C frontend exec tsx scripts/ops/check-room-1659.ts --wallet=0xYourAddress');
    process.exit(1);
  }

  wallet = wallet.toLowerCase();

  console.log(`\nFetching room 1659 market context for ${wallet}...\n`);

  const snapshot = await resolveRoom1659MarketContext(wallet);

  console.log('Raw snapshot:');
  console.dir(snapshot, { depth: 4 });

  console.log('\nFormatted for Hermit prompt:');
  const formatted = formatRoom1659MarketForHermit(snapshot);
  console.dir(formatted);

  // E2E prompt injection simulation
  console.log('\n--- E2E Prompt Injection Simulation (what would be sent to Pinata/Hermit) ---');
  try {
    const simulatedPrompt = buildPinataPromptForHermit({
      mode: 'copy',
      userPrompt: 'give me a hype line about my position',
      userPreferences: { spanishDialect: null, tone: 'degen' },
      room1659Market: snapshot, // this is the key new data
    });
    console.log('Sample generated prompt (truncated):');
    console.log(simulatedPrompt.slice(0, 1200) + (simulatedPrompt.length > 1200 ? '...' : ''));
  } catch (e) {
    console.log('Could not simulate full prompt (build function may require more context):', (e as Error).message);
  }

  if (!snapshot.ok) {
    console.log('\n⚠️  Snapshot not OK. Common causes:');
    console.log('- No DATABASE_URL or live JWT in Supabase');
    console.log('- Spot positions endpoint requires specific auth for room 1659');
    console.log('- Hyperliquid rate limits or address has no activity');
  }

  if (snapshot.onchain && snapshot.onchain.totalSupply === null) {
    console.log('\n⚠️  On-chain FriendKey reads still failing even with numeric ID=1659.');
    console.log('   Almost certainly the contract address is still wrong. Use the official one:');
    console.log('   0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F (FriendKey)');
    console.log('');
    console.log('   In the Friend protocol there is one main ERC1155 contract (FriendKey).');
    console.log('   Each room/creator has a numeric tokenId inside that contract.');
    console.log('');
    console.log('   Action needed: Find the real FriendKey contract address for room 1659');
    console.log('   (look at room creation transaction, the RoomManager contract, or ask the team).');
    console.log('   Once you have it, set:');
    console.log('     ROOM_1659_FRIENDKEY_TOKEN=0xAF0Bf8593dC6CA973DF2132731B0F9B5F974FA9F');
    console.log('     ROOM_1659_FRIENDKEY_ID=1659');
    console.log('   Then re-run — full on-chain curve data will activate.');
  } else if (snapshot.onchain && !snapshot.onchain.note) {
    console.log('\n✅ Full on-chain FriendKey data is now LIVE for room 1659!');
  }
}

main().catch(console.error);