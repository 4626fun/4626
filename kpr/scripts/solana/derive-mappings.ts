import { createHash } from 'node:crypto';
import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Connection, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';

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

async function fetchTwinMappings() {
  const baseRpc = (process.env.BASE_RPC_URL ?? 'https://mainnet.base.org').trim();
  const solanaBridgeAdapter = requireEnv('SOLANA_BRIDGE_ADAPTER') as Address;
  const client = createPublicClient({ chain: base, transport: http(baseRpc, { timeout: 20_000 }) });

  const event = {
    type: 'event',
    name: 'TwinMapped',
    inputs: [
      { name: 'solanaAddress', type: 'bytes32', indexed: true },
      { name: 'twinAddress', type: 'address', indexed: true },
    ],
  } as const;

  const logs = await client.getLogs({
    address: solanaBridgeAdapter,
    event,
    fromBlock: 0n,
    toBlock: 'latest',
  });

  const mapping: Record<string, string> = {};
  for (const log of logs) {
    const { solanaAddress, twinAddress } = log.args as any;
    if (!solanaAddress || !twinAddress) continue;
    const twin = String(twinAddress).toLowerCase();
    const solanaPubkey = bs58.encode(Buffer.from(String(solanaAddress).replace(/^0x/, ''), 'hex'));
    mapping[twin] = solanaPubkey;
  }
  return mapping;
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

  let twinToPubkey: Record<string, string> = {};
  try {
    twinToPubkey = await fetchTwinMappings();
  } catch (err) {
    console.warn('Twin mapping lookup failed (continuing without it):', err instanceof Error ? err.message : err);
  }

  console.log('\n# === Suggested env values ===');
  console.log(`SOLANA_CREATOR_MINTS=${creatorMints.join(',')}`);
  console.log(`SOLANA_SHARE_OFT_MAPPING=${JSON.stringify(shareOftMapping)}`);
  console.log(`SOLANA_CREATOR_COIN_TO_MINT_MAPPING=${JSON.stringify(creatorCoinToMint)}`);
  if (Object.keys(twinToPubkey).length > 0) {
    console.log(`SOLANA_TWIN_TO_PUBKEY_MAPPING=${JSON.stringify(twinToPubkey)}`);
  } else {
    console.log('SOLANA_TWIN_TO_PUBKEY_MAPPING={}');
  }
}

main().catch((err) => {
  console.error('Failed to derive mappings:', err);
  process.exit(1);
});
