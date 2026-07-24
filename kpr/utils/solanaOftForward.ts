/**
 * Solana → Base ShareOFT forward adapter.
 *
 * In-repo LayerZero Solana OFT *send* is not yet packaged (create/wire only).
 * This module:
 *   1) Prefer an operator helper script when SOLANA_OFT_FORWARD_HELPER is set
 *   2) Otherwise fail closed with a stable error so keepers never invent a bridge
 *
 * Helper contract (stdout JSON):
 *   { "ok": true, "signature": "<solana-sig>", "amountLd": "<string>" }
 */

import { spawn } from 'node:child_process';
import { PublicKey } from '@solana/web3.js';

export type SolanaOftForwardResult = {
  signature: string;
  amountLd: string;
  mode: 'helper';
};

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

async function runHelper(params: {
  helper: string;
  mint: PublicKey;
  oftStore: PublicKey;
  amountLd: bigint;
  dstEid: number;
  toBytes32: `0x${string}`;
}): Promise<SolanaOftForwardResult> {
  const args = params.helper.split(/\s+/).filter(Boolean);
  const command = args.shift();
  if (!command) {
    throw new Error('solana_oft_forward_helper_empty');
  }

  const childEnv = {
    ...process.env,
    SOLANA_OFT_FORWARD_MINT: params.mint.toBase58(),
    SOLANA_OFT_FORWARD_STORE: params.oftStore.toBase58(),
    SOLANA_OFT_FORWARD_AMOUNT_LD: params.amountLd.toString(),
    SOLANA_OFT_FORWARD_DST_EID: String(params.dstEid),
    SOLANA_OFT_FORWARD_TO_BYTES32: params.toBytes32,
  };

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, {
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      err += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`solana_oft_forward_helper_failed:code=${code},stderr=${err.slice(0, 500)}`));
        return;
      }
      resolve(out);
    });
  });

  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const jsonLine = [...lines].reverse().find((line) => line.startsWith('{'));
  if (!jsonLine) {
    throw new Error('solana_oft_forward_helper_missing_json');
  }
  const parsed = JSON.parse(jsonLine) as {
    ok?: boolean;
    signature?: string;
    amountLd?: string;
  };
  if (!parsed.ok || !parsed.signature || !parsed.amountLd) {
    throw new Error('solana_oft_forward_helper_invalid_payload');
  }
  return {
    signature: parsed.signature,
    amountLd: parsed.amountLd,
    mode: 'helper',
  };
}

/**
 * Forward ShareOFT from Solana OFT Store to Base hubGaugeReceiver.
 */
export async function forwardSolanaShareOftToHub(params: {
  mint: PublicKey;
  amountLd: bigint;
  toBytes32?: `0x${string}`;
}): Promise<SolanaOftForwardResult> {
  if (params.amountLd <= 0n) {
    throw new Error('solana_oft_forward_amount_zero');
  }
  if (!envFlag('SOLANA_OFT_FORWARD_ENABLED')) {
    throw new Error('solana_oft_forward_disabled');
  }

  const oftStoreRaw = String(process.env.SOLANA_OFT_STORE ?? process.env.SOLANA_SHARE_MESH_OFT_STORE ?? '').trim();
  const toBytes32 = String(
    params.toBytes32 ??
      process.env.SOLANA_OFT_FORWARD_TO_BYTES32 ??
      process.env.KPR_REMOTE_FEE_HUB_GAUGE_BYTES32 ??
      '',
  ).trim() as `0x${string}`;
  const dstEid = Number(process.env.SOLANA_OFT_FORWARD_DST_EID ?? process.env.BASE_LZ_EID ?? '30184');
  const helper = String(process.env.SOLANA_OFT_FORWARD_HELPER ?? '').trim();

  if (!oftStoreRaw) {
    throw new Error('missing_solana_oft_store');
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(toBytes32)) {
    throw new Error(
      'missing_solana_oft_forward_to_bytes32: set SOLANA_OFT_FORWARD_TO_BYTES32 to bytes32(hubGaugeReceiver)',
    );
  }
  if (!Number.isFinite(dstEid) || dstEid <= 0) {
    throw new Error('invalid_solana_oft_forward_dst_eid');
  }
  if (!helper) {
    throw new Error(
      'solana_oft_forward_helper_required: set SOLANA_OFT_FORWARD_HELPER to an executable that prints {ok,signature,amountLd} (in-repo LZ Solana OFT send SDK not packaged yet)',
    );
  }

  return runHelper({
    helper,
    mint: params.mint,
    oftStore: new PublicKey(oftStoreRaw),
    amountLd: params.amountLd,
    dstEid,
    toBytes32,
  });
}

export function hubGaugeToBytes32(gauge: string): `0x${string}` {
  const normalized = gauge.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error(`invalid_hub_gauge:${gauge}`);
  }
  return `0x${'0'.repeat(24)}${normalized.slice(2)}` as `0x${string}`;
}
