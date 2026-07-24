/**
 * Create a Meteora DLMM pool for the creator's share token on Solana.
 *
 * Canonical B2 trade fee lives on this pool (690 bps), not on Token-2022 transfer fee.
 *
 * Usage:
 *   pnpm solana:create-dlmm-pool
 *
 * Required env:
 *   SOLANA_KEEPER_KEYPAIR   - Payer keypair
 *   SOLANA_RPC_URL          - Solana RPC endpoint
 *   TOKEN_MINT_X            - First token mint (e.g., creator share token)
 *   TOKEN_MINT_Y            - Second token mint (e.g., USDC or SOL)
 *   BIN_STEP                - DLMM bin step (e.g., 25 for 0.25% bins)
 *   ACTIVE_ID               - Initial active bin ID
 *
 * Optional env:
 *   FEE_BPS                 - Swap fee in BPS (default: 690). Non-690 requires ALLOW_NONCANONICAL_FEE_BPS=1
 *   BASE_FACTOR             - Base factor for the pool (default: 10000)
 *   ACTIVATION_TYPE         - "timestamp" (default) or "slot"
 *   ACTIVATION_POINT        - Unix timestamp (timestamp mode) or slot (slot mode)
 *   ACTIVATION_DELAY_SECONDS - Delay after now before trading starts (default: 0 = Meteora UI live)
 *   ACTIVATION_SLOT_OFFSET  - Slot offset when ACTIVATION_TYPE=slot (default: 200)
 *   METEORA_HAS_ALPHA_VAULT - "1" when pairing with Alpha Vault launch (default: off)
 *   HAS_ALPHA_VAULT         - Alias for METEORA_HAS_ALPHA_VAULT
 *   COLLECT_FEE_MODE        - "only_y" (default) or "input_only"
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { loadKeeperKeypair, sendConfirmedSolanaTransaction } from '../../../utils/solana.js';
import { requireEnv } from '../../../config.js';
import {
  CANONICAL_DLMM_FEE_BPS,
  COLLECT_FEE_MODE_ONLY_Y,
  feePercentageToBps,
  loadBn,
  loadDlmmClass,
  loadDlmmSdk,
} from '../../../utils/dlmm.js';

const sdk = loadDlmmSdk();
const Dlmm = loadDlmmClass();
const BN = loadBn();

const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';
const connection = new Connection(rpcUrl, 'confirmed');
const payer = loadKeeperKeypair();

const tokenMintX = new PublicKey(requireEnv('TOKEN_MINT_X'));
const tokenMintY = new PublicKey(requireEnv('TOKEN_MINT_Y'));
const binStep = new BN(requireEnv('BIN_STEP'));
const activeId = new BN(requireEnv('ACTIVE_ID'));
const baseFactor = new BN(process.env.BASE_FACTOR ?? '10000');
const feeBpsNumber = Number.parseInt(process.env.FEE_BPS ?? String(CANONICAL_DLMM_FEE_BPS), 10);
const feeBps = new BN(feeBpsNumber);
const cluster = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';

function envFlag(name: string): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function redactRpcUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    return parsed.pathname === '/' && !parsed.search
      ? parsed.origin
      : `${parsed.origin}/<redacted>`;
  } catch {
    return '<redacted-rpc-url>';
  }
}

function resolveCollectFeeMode(): number {
  const raw = String(process.env.COLLECT_FEE_MODE ?? 'only_y').trim().toLowerCase();
  if (raw === 'only_y' || raw === 'y' || raw === '1') {
    return sdk.CollectFeeMode?.OnlyY ?? Dlmm.CollectFeeMode?.OnlyY ?? COLLECT_FEE_MODE_ONLY_Y;
  }
  if (raw === 'input_only' || raw === 'input' || raw === '0') {
    return sdk.CollectFeeMode?.InputOnly ?? Dlmm.CollectFeeMode?.InputOnly ?? 0;
  }
  throw new Error(`COLLECT_FEE_MODE must be only_y or input_only. Received: ${raw}`);
}

function assertCanonicalFeeBps(bps: number): void {
  if (!Number.isFinite(bps) || bps < 0 || bps > 10_000) {
    throw new Error(`FEE_BPS out of range: ${bps}`);
  }
  if (bps !== CANONICAL_DLMM_FEE_BPS && !envFlag('ALLOW_NONCANONICAL_FEE_BPS')) {
    throw new Error(
      `FEE_BPS must be ${CANONICAL_DLMM_FEE_BPS} for canonical B2 pools (got ${bps}). Set ALLOW_NONCANONICAL_FEE_BPS=1 to override.`,
    );
  }
}

async function assertPoolFeeConfig(poolAddress: PublicKey, expectedFeeBps: number, expectedCollectMode: number): Promise<void> {
  const dlmmPool = await Dlmm.create(connection, poolAddress, { cluster });
  const feeInfo = dlmmPool.getFeeInfo();
  const baseFeeBps = feePercentageToBps(feeInfo.baseFeeRatePercentage);
  const maxFeeBps = feePercentageToBps(feeInfo.maxFeeRatePercentage);
  const collectFeeMode = Number(dlmmPool.lbPair?.parameters?.collectFeeMode ?? NaN);
  const variableFeeControl = Number(dlmmPool.lbPair?.parameters?.variableFeeControl ?? 0);

  if (baseFeeBps !== expectedFeeBps) {
    throw new Error(`pool_base_fee_bps_mismatch:expected=${expectedFeeBps},actual=${baseFeeBps}`);
  }
  if (maxFeeBps > expectedFeeBps) {
    throw new Error(`pool_max_fee_bps_exceeds_cap:cap=${expectedFeeBps},actual=${maxFeeBps}`);
  }
  if (Number.isFinite(collectFeeMode) && collectFeeMode !== expectedCollectMode) {
    throw new Error(`pool_collect_fee_mode_mismatch:expected=${expectedCollectMode},actual=${collectFeeMode}`);
  }
  if (variableFeeControl !== 0 && maxFeeBps > expectedFeeBps) {
    throw new Error(`pool_dynamic_fee_uncapped:variableFeeControl=${variableFeeControl},maxFeeBps=${maxFeeBps}`);
  }
}

assertCanonicalFeeBps(feeBpsNumber);
const collectFeeMode = resolveCollectFeeMode();
const hasAlphaVault = envFlag('METEORA_HAS_ALPHA_VAULT') || envFlag('HAS_ALPHA_VAULT');

function resolveActivationDelaySeconds(): number {
  const raw = String(process.env.ACTIVATION_DELAY_SECONDS ?? '0').trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`ACTIVATION_DELAY_SECONDS must be a non-negative integer. Received: ${raw}`);
  }
  return parsed;
}

const programIds = sdk.LBCLMM_PROGRAM_IDS ?? Dlmm.LBCLMM_PROGRAM_IDS;
const derivePair = sdk.deriveCustomizablePermissionlessLbPair ?? Dlmm.deriveCustomizablePermissionlessLbPair;
const programId = new PublicKey(programIds[cluster]);
const [poolAddress] = derivePair(tokenMintX, tokenMintY, programId);

console.log('=== Create Meteora DLMM Pool ===');
console.log('RPC:        ', redactRpcUrl(rpcUrl));
console.log('Payer:      ', payer.publicKey.toBase58());
console.log('Token X:    ', tokenMintX.toBase58());
console.log('Token Y:    ', tokenMintY.toBase58());
console.log('Bin Step:   ', binStep.toString());
console.log('Active ID:  ', activeId.toString());
console.log('Base Factor:', baseFactor.toString());
console.log('Fee (BPS):  ', feeBps.toString());
console.log('CollectFee: ', collectFeeMode === COLLECT_FEE_MODE_ONLY_Y ? 'OnlyY' : 'InputOnly');
console.log('Program:    ', programId.toBase58());
console.log('Pool (PDA): ', poolAddress.toBase58());
console.log();

const existingPool = await connection.getAccountInfo(poolAddress);
if (existingPool) {
  console.log('DLMM Pool already exists — verifying fee config.');
  await assertPoolFeeConfig(poolAddress, feeBpsNumber, collectFeeMode);
  console.log('  Pool:      ', poolAddress.toBase58());
  console.log('  Signature: existing');
  console.log('  Fee check: passed');
  process.exit(0);
}

const ActivationType = sdk.ActivationType ?? Dlmm.ActivationType;
const activationKindRaw = String(process.env.ACTIVATION_TYPE ?? 'timestamp').trim().toLowerCase();
const activationType =
  activationKindRaw === 'timestamp' ? ActivationType.Timestamp : ActivationType.Slot;
const activationPointExplicit = String(process.env.ACTIVATION_POINT ?? '').trim();
const activationPoint =
  activationType === ActivationType.Timestamp
    ? activationPointExplicit
      ? new BN(activationPointExplicit)
      : new BN(Math.floor(Date.now() / 1000) + resolveActivationDelaySeconds())
    : new BN(
        String(
          (await connection.getSlot('confirmed')) +
            Number.parseInt(process.env.ACTIVATION_SLOT_OFFSET ?? '200', 10),
        ),
      );
console.log('AlphaVault:', hasAlphaVault ? 'yes (launch lane)' : 'no (default share-mesh pool)');
console.log(
  'Activation: ',
  activationPoint.toString(),
  activationType === ActivationType.Timestamp ? '(timestamp)' : '(slot)',
);
console.log();

const concreteFunctionType =
  sdk.ConcreteFunctionType?.LimitOrder ?? Dlmm.ConcreteFunctionType?.LimitOrder ?? 0;
const createPair =
  sdk.createCustomizablePermissionlessLbPair2 ?? Dlmm.createCustomizablePermissionlessLbPair2;
const createPoolTx = await createPair(
  connection,
  binStep,
  tokenMintX,
  tokenMintY,
  activeId,
  feeBps,
  activationType,
  hasAlphaVault,
  payer.publicKey,
  activationPoint,
  false,
  concreteFunctionType,
  collectFeeMode,
  { cluster },
);

const sig = await sendConfirmedSolanaTransaction({
  connection,
  transaction: createPoolTx,
  signers: [payer],
  commitment: 'confirmed',
});

await assertPoolFeeConfig(poolAddress, feeBpsNumber, collectFeeMode);

console.log('DLMM Pool created!');
console.log('  Signature:', sig);
console.log('  Pool:     ', poolAddress.toBase58());
console.log();
console.log('Next steps (Meteora UI visibility):');
console.log('  1. Seed initial DLMM liquidity with feeOwner — empty pools do not swap');
console.log('     pnpm -C kpr solana:seed-dlmm-liquidity');
console.log('  2. Confirm activation time has passed (default: start now; delay via ACTIVATION_DELAY_SECONDS)');
console.log('  3. Verify on https://app.meteora.ag/pools by pasting mint or pool address');
console.log(
  '  4. Optional display metadata: BADGE_TARGET=meteora pnpm -C kpr solana:prepare-token-badge',
);
console.log(
  '     (generates wallet/token-list JSON — not the same as Meteora admin token_badge for Token-2022)',
);
if (hasAlphaVault) {
  console.log('  5. Create Alpha Vault: pnpm -C kpr solana:create-alpha-vault');
}
