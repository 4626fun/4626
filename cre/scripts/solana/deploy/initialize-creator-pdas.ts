/**
 * Initialize CreatorConfig + PendingEntries + WinnerRecord PDAs for a Token-2022 mint.
 *
 * Usage:
 *   pnpm solana:init-creator-pdas
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer + authority keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   CREATOR_MINT            - Token-2022 mint address (base58)
 *   HUB_CREATOR_COIN        - Base Creator Coin address (0x-prefixed hex)
 *   HUB_SHARE_OFT           - Base ShareOFT address (0x-prefixed hex)
 *
 * Optional env:
 *   SOLANA_PROGRAM_ID       - Transfer Hook program ID (default: from config)
 *   KEEPER_PUBKEY           - Keeper authority (default: payer pubkey)
 *   TRANSFER_FEE_BPS        - Fee BPS for config (default: 690)
 *   FLUSH_THRESHOLD         - Minimum fee before flush (default: 0)
 *   LOTTERY_ENABLED         - Enable lottery entries (default: true)
 *   KNOWN_AMM_PROGRAMS      - Comma-separated AMM program IDs for buy detection
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { loadKeeperKeypair } from '../../../utils/solana.js';
import { CHAINS, requireEnv } from '../../../config.js';

import idl from '../../../../target/idl/creator_share_hook.json' with { type: 'json' };

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();
const wallet = new Wallet(payer);
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

const programId = new PublicKey(CHAINS.solana.programId);
const program = new Program(idl as any, provider);

const creatorMint = new PublicKey(requireEnv('CREATOR_MINT'));
const hubCreatorCoin = requireEnv('HUB_CREATOR_COIN');
const hubShareOft = requireEnv('HUB_SHARE_OFT');
const keeperPubkey = process.env.KEEPER_PUBKEY
  ? new PublicKey(process.env.KEEPER_PUBKEY)
  : payer.publicKey;
const feeBps = Number(process.env.TRANSFER_FEE_BPS ?? '690');
const flushThreshold = new BN(process.env.FLUSH_THRESHOLD ?? '0');
const lotteryEnabled = (process.env.LOTTERY_ENABLED ?? 'true').toLowerCase() !== 'false';
const knownAmmPrograms = (process.env.KNOWN_AMM_PROGRAMS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => new PublicKey(s));

function hexToBytes32(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error(`Invalid bytes32 hex: ${hex}`);
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(parseInt(clean.substring(i, i + 2), 16));
  }
  return bytes;
}

console.log('=== Initialize Creator PDAs ===');
console.log('RPC:             ', rpcUrl);
console.log('Payer:           ', payer.publicKey.toBase58());
console.log('Creator Mint:    ', creatorMint.toBase58());
console.log('Hub Creator Coin:', hubCreatorCoin);
console.log('Hub ShareOFT:    ', hubShareOft);
console.log('Keeper:          ', keeperPubkey.toBase58());
console.log('Fee BPS:         ', feeBps);
console.log('Lottery:         ', lotteryEnabled);
console.log('AMM Programs:    ', knownAmmPrograms.length);
console.log();

const sig = await program.methods
  .initializeCreator({
    keeperAuthority: keeperPubkey,
    hubCreatorCoin: hexToBytes32(hubCreatorCoin),
    hubShareOft: hexToBytes32(hubShareOft),
    feeBps,
    flushThreshold,
    lotteryEnabled,
    knownAmmPrograms,
  })
  .accounts({ creatorMint })
  .rpc();

console.log('Creator PDAs initialized!');
console.log('  Signature:', sig);
console.log();
console.log('Next steps:');
console.log('  1. Initialize extra account meta list: anchor test (or manual ix)');
console.log('  2. Run: pnpm solana:prepare-token-badge');
