import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import type { Address } from 'viem';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const v = (process.env[key] ?? '').trim();
  if (!v) throw new Error(`${key} missing`);
  return v;
}

function bytes32ToAddress(buf: Buffer): Address {
  const hex = buf.toString('hex').padStart(64, '0');
  const addr = `0x${hex.slice(-40)}` as Address;
  return addr;
}

function isZeroAddress(addr: string): boolean {
  return /^0x0{40}$/i.test(addr);
}

function creatorConfigDiscriminator(): Buffer {
  return createHash('sha256').update('account:CreatorConfig').digest().subarray(0, 8);
}

async function fetchCreatorConfigs() {
  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
  const programId = requireEnv('SOLANA_PROGRAM_ID');
  const connection = new Connection(solanaRpcUrl, 'confirmed');

  const discriminator = creatorConfigDiscriminator();
  const accounts = await connection.getProgramAccounts(new PublicKey(programId), {
    filters: [
      { dataSize: 501 },
      { memcmp: { offset: 0, bytes: bs58.encode(discriminator) } },
    ],
  });

  const configs = accounts.map((acc) => {
    const data = acc.account.data as Buffer;
    const creatorMint = new PublicKey(data.subarray(8, 40)).toBase58();
    const hubCreatorCoin = bytes32ToAddress(data.subarray(104, 136));
    const hubShareOft = bytes32ToAddress(data.subarray(136, 168));
    return { creatorMint, hubCreatorCoin, hubShareOft };
  });

  return configs;
}

async function main() {
  const configs = await fetchCreatorConfigs();
  if (configs.length === 0) {
    console.log('No CreatorConfig PDAs found. Ensure SOLANA_PROGRAM_ID is correct and configs are initialized.');
    return;
  }

  const creatorMints = configs.map((c) => c.creatorMint);
  const shareOftMapping: Record<string, string> = {};
  const creatorCoinToMint: Record<string, string> = {};

  for (const cfg of configs) {
    if (cfg.hubShareOft && !isZeroAddress(cfg.hubShareOft)) {
      shareOftMapping[cfg.creatorMint] = cfg.hubShareOft;
    }
    if (cfg.hubCreatorCoin && !isZeroAddress(cfg.hubCreatorCoin)) {
      creatorCoinToMint[cfg.hubCreatorCoin.toLowerCase()] = cfg.creatorMint;
    }
  }

  console.log('\n# === Suggested env values (LayerZero ShareOFT only) ===');
  console.log(`SOLANA_CREATOR_MINTS=${creatorMints.join(',')}`);
  console.log(`SOLANA_SHARE_OFT_MAPPING=${JSON.stringify(shareOftMapping)}`);
  console.log(`SOLANA_CREATOR_COIN_TO_MINT_MAPPING=${JSON.stringify(creatorCoinToMint)}`);
  console.log('# Twin/SolanaBridgeAdapter mapping retired — use Registry4626 per-token LZ peers');
}

main().catch((err) => {
  console.error('Failed to derive mappings:', err);
  process.exit(1);
});
