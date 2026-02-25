/**
 * Create a Token-2022 mint with TransferFeeConfig + TransferHook extensions.
 *
 * Usage:
 *   pnpm solana:create-token-2022-mint
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Base58 or JSON array secret key (payer + mint authority)
 *   SOLANA_RPC_URL          - Solana RPC endpoint (default: devnet)
 *
 * Optional env:
 *   SOLANA_PROGRAM_ID       - Transfer Hook program ID (default: from config)
 *   TRANSFER_FEE_BPS        - Fee in basis points (default: 690 = 6.9%)
 *   MAX_FEE                 - Maximum fee per transfer in token units (default: u64 max)
 *   TOKEN_DECIMALS          - Mint decimals (default: 9)
 */

import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeTransferHookInstruction,
  getMintLen,
} from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { loadKeeperKeypair } from '../../../utils/solana.js';
import { CHAINS } from '../../../config.js';

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');

const payer = loadKeeperKeypair();
const mintKeypair = Keypair.generate();

const programId = new PublicKey(CHAINS.solana.programId);
const decimals = Number(process.env.TOKEN_DECIMALS ?? '9');
const feeBps = Number(process.env.TRANSFER_FEE_BPS ?? '690');
const maxFee = BigInt(process.env.MAX_FEE ?? String(2n ** 64n - 1n));

console.log('=== Create Token-2022 Mint ===');
console.log('RPC:            ', rpcUrl);
console.log('Payer:          ', payer.publicKey.toBase58());
console.log('Mint:           ', mintKeypair.publicKey.toBase58());
console.log('Decimals:       ', decimals);
console.log('Fee BPS:        ', feeBps);
console.log('Max Fee:        ', maxFee.toString());
console.log('Transfer Hook:  ', programId.toBase58());
console.log();

const extensions = [ExtensionType.TransferFeeConfig, ExtensionType.TransferHook];
const mintLen = getMintLen(extensions);
const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

const tx = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    space: mintLen,
    lamports,
    programId: TOKEN_2022_PROGRAM_ID,
  }),
  createInitializeTransferFeeConfigInstruction(
    mintKeypair.publicKey,
    payer.publicKey,
    payer.publicKey,
    feeBps,
    maxFee,
    TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeTransferHookInstruction(
    mintKeypair.publicKey,
    payer.publicKey,
    programId,
    TOKEN_2022_PROGRAM_ID,
  ),
  createInitializeMintInstruction(
    mintKeypair.publicKey,
    decimals,
    payer.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID,
  ),
);

const sig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair], {
  commitment: 'confirmed',
});

console.log('Mint created!');
console.log('  Mint:      ', mintKeypair.publicKey.toBase58());
console.log('  Signature: ', sig);
console.log();
console.log('Next steps:');
console.log('  1. Run: pnpm solana:init-creator-pdas');
console.log('  2. Run: pnpm solana:prepare-token-badge');
console.log('  3. Fund the mint with bridged ShareOFT tokens');
