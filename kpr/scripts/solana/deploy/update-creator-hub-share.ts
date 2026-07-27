/**
 * Update CreatorConfig.hub_share_oft for an existing B2 mint.
 *
 *   pnpm -C kpr exec tsx scripts/solana/deploy/update-creator-hub-share.ts \
 *     --mint A6HB5... --hub-share-token 0x4471...
 */
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { loadKeeperKeypair, sendConfirmedSolanaTransaction } from '../../../utils/solana.js';
import { CHAINS } from '../../../config.js';
import idl from '../../../../programs/creator-share-hook/target/idl/creator_share_hook.json' with { type: 'json' };

function getArg(name: string): string {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return '';
  const v = process.argv[idx + 1];
  if (!v || v.startsWith('--')) return '';
  return v;
}

function hexToBytes32(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error(`Invalid bytes32 hex: ${hex}`);
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) {
    bytes.push(Number.parseInt(clean.substring(i, i + 2), 16));
  }
  return bytes;
}

function evmAddressToBytes32(address: string): number[] {
  const clean = address.startsWith('0x') ? address.slice(2) : address;
  if (clean.length !== 40) throw new Error(`Invalid EVM address: ${address}`);
  return hexToBytes32(`0x${'0'.repeat(24)}${clean}`);
}

const mintStr = getArg('--mint') || process.env.SOLANA_B2_MINT || '';
const hubShare = getArg('--hub-share-token') || '';
if (!mintStr || !hubShare) {
  process.stderr.write('Usage: --mint <base58> --hub-share-token 0x...\n');
  process.exit(1);
}

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();
const provider = new AnchorProvider(connection, new Wallet(payer), { commitment: 'confirmed' });
const programId = new PublicKey(CHAINS.solana.programId);
const program = new Program(idl as never, provider);
const mint = new PublicKey(mintStr);
const [creatorConfig] = PublicKey.findProgramAddressSync(
  [Buffer.from('creator_config'), mint.toBuffer()],
  programId,
);

const before = await (program.account as { creatorConfig: { fetch: (k: PublicKey) => Promise<{ hubShareOft: number[] }> } }).creatorConfig.fetch(
  creatorConfig,
);
const nextHub = evmAddressToBytes32(hubShare);
console.log(
  JSON.stringify(
    {
      mint: mint.toBase58(),
      creatorConfig: creatorConfig.toBase58(),
      beforeHubShareOft: `0x${Buffer.from(before.hubShareOft).toString('hex')}`,
      nextHubShareOft: `0x${Buffer.from(nextHub).toString('hex')}`,
      authority: payer.publicKey.toBase58(),
    },
    null,
    2,
  ),
);

const beforeHex = Buffer.from(before.hubShareOft).toString('hex');
const nextHex = Buffer.from(nextHub).toString('hex');
if (beforeHex === nextHex) {
  console.log('hub_share_oft already matches; no-op');
  process.exit(0);
}

const tx = await program.methods
  .updateConfig({
    hubCreatorCoin: null,
    hubShareOft: nextHub,
    feeBps: null,
    settlementThreshold: null,
    lotteryEnabled: null,
  })
  .accounts({
    authority: payer.publicKey,
    creatorMint: mint,
  })
  .transaction();

const sig = await sendConfirmedSolanaTransaction({
  connection,
  transaction: tx,
  signers: [payer],
  commitment: 'confirmed',
});
const after = await (program.account as { creatorConfig: { fetch: (k: PublicKey) => Promise<{ hubShareOft: number[] }> } }).creatorConfig.fetch(
  creatorConfig,
);
console.log(
  JSON.stringify(
    {
      signature: sig,
      afterHubShareOft: `0x${Buffer.from(after.hubShareOft).toString('hex')}`,
    },
    null,
    2,
  ),
);
