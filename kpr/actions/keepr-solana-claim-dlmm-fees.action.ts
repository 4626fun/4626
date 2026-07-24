/**
 * Keepr Solana DLMM fee claim — Meteora pool swap fees only.
 *
 * Claims accrued DLMM swap fees for protocol positions into the position
 * feeOwner Token Y / WSOL ATA (jackpot fee vault). This is intentionally
 * separate from settle_fees (Token-2022 transfer-fee harvest), which is a
 * no-op on B2 zero-transfer-fee mints.
 *
 * Required env:
 *   SOLANA_RPC_URL
 *   SOLANA_KEEPER_KEYPAIR
 *   SOLANA_METEORA_POOL or SOLANA_DLMM_POOLS (comma-separated)
 *
 * Optional env:
 *   SOLANA_DLMM_POSITION_OWNER — position owner for discovery (default: keeper)
 *   SOLANA_DLMM_POSITIONS — optional comma-separated position pubkeys to claim
 *   SOLANA_DLMM_FEE_OWNER — expected feeOwner; claim proves ATA delta for this pubkey
 *   SOLANA_DLMM_MIN_CLAIM_Y — min Token Y delta for threshold telemetry (default: 1000)
 */

import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  getAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { alertCritical, alertInfo, alertWarning } from '../utils/alerts.js';
import { loadKeeperKeypair } from '../utils/solana.js';
import { loadDlmmClass } from '../utils/dlmm.js';

const WORKFLOW_NAME = 'keepr-solana-claim-dlmm-fees';
const Dlmm = loadDlmmClass();

export interface DlmmFeeClaimResult {
  poolsProcessed: number;
  positionsClaimed: number;
  quoteHarvestedAmount: string;
  harvestThresholdMet: boolean;
  signatures: string[];
}

function parsePoolAddresses(): PublicKey[] {
  const raw =
    process.env.SOLANA_DLMM_POOLS?.trim() ||
    process.env.SOLANA_METEORA_POOL?.trim() ||
    '';
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) {
    throw new Error('missing_solana_meteora_pool');
  }
  return values.map((value) => new PublicKey(value));
}

function parseOptionalPubkeys(raw: string | undefined): PublicKey[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new PublicKey(value));
}

async function readTokenAmount(
  connection: Connection,
  ata: PublicKey,
  programId: PublicKey,
): Promise<bigint> {
  try {
    const account = await getAccount(connection, ata, 'confirmed', programId);
    return BigInt(account.amount.toString());
  } catch {
    return 0n;
  }
}

async function resolveTokenProgram(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint, 'confirmed');
  if (!info) {
    throw new Error(`missing_mint_account:${mint.toBase58()}`);
  }
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

export async function executeSolanaDlmmFeeClaim(): Promise<DlmmFeeClaimResult> {
  const result: DlmmFeeClaimResult = {
    poolsProcessed: 0,
    positionsClaimed: 0,
    quoteHarvestedAmount: '0',
    harvestThresholdMet: false,
    signatures: [],
  };

  const solanaRpcUrl = process.env.SOLANA_RPC_URL?.trim();
  if (!solanaRpcUrl) {
    throw new Error('Missing required env var: SOLANA_RPC_URL');
  }

  const minClaimY = BigInt(process.env.SOLANA_DLMM_MIN_CLAIM_Y ?? '1000');
  let totalQuoteHarvested = 0n;

  try {
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeper = loadKeeperKeypair();
    const positionOwner = new PublicKey(
      process.env.SOLANA_DLMM_POSITION_OWNER?.trim() || keeper.publicKey.toBase58(),
    );
    const expectedFeeOwnerRaw = process.env.SOLANA_DLMM_FEE_OWNER?.trim();
    const expectedFeeOwner = expectedFeeOwnerRaw
      ? new PublicKey(expectedFeeOwnerRaw)
      : null;
    const allowedPositions = new Set(
      parseOptionalPubkeys(process.env.SOLANA_DLMM_POSITIONS).map((pk) => pk.toBase58()),
    );
    const pools = parsePoolAddresses();
    const cluster = solanaRpcUrl.includes('devnet') ? 'devnet' : 'mainnet-beta';

    if (!positionOwner.equals(keeper.publicKey)) {
      throw new Error(
        `dlmm_claim_requires_position_owner_signer:keeper=${keeper.publicKey.toBase58()},owner=${positionOwner.toBase58()}`,
      );
    }

    for (const poolAddress of pools) {
      const dlmmPool = await Dlmm.create(connection, poolAddress, { cluster });
      const quoteMint: PublicKey = dlmmPool.tokenY.publicKey ?? dlmmPool.lbPair.tokenYMint;
      const quoteProgram = quoteMint.equals(NATIVE_MINT)
        ? TOKEN_PROGRAM_ID
        : await resolveTokenProgram(connection, quoteMint);

      const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(positionOwner);
      const positions = (userPositions ?? []).filter((position: { publicKey: PublicKey }) => {
        if (allowedPositions.size === 0) return true;
        return allowedPositions.has(position.publicKey.toBase58());
      });

      if (positions.length === 0) {
        await alertInfo(WORKFLOW_NAME, 'No DLMM positions to claim', {
          pool: poolAddress.toBase58(),
          positionOwner: positionOwner.toBase58(),
        });
        result.poolsProcessed += 1;
        continue;
      }

      const positionFeeOwners: Array<{ position: PublicKey; feeOwner: PublicKey }> = positions.map(
        (position: { publicKey: PublicKey; positionData?: { feeOwner?: PublicKey }; feeOwner?: () => PublicKey }) => {
          const onChain =
            typeof position.feeOwner === 'function'
              ? position.feeOwner()
              : position.positionData?.feeOwner;
          if (!onChain) {
            throw new Error(
              `dlmm_position_fee_owner_missing:pool=${poolAddress.toBase58()},position=${position.publicKey.toBase58()}`,
            );
          }
          return { position: position.publicKey, feeOwner: onChain };
        },
      );

      const uniqueFeeOwners = new Map<string, PublicKey>(
        positionFeeOwners.map((entry) => [entry.feeOwner.toBase58(), entry.feeOwner]),
      );
      if (uniqueFeeOwners.size !== 1) {
        throw new Error(
          `dlmm_position_fee_owner_inconsistent:pool=${poolAddress.toBase58()},fee_owners=${[...uniqueFeeOwners.keys()].join(',')}`,
        );
      }
      const feeOwnerFromPositions = uniqueFeeOwners.values().next().value;
      if (!feeOwnerFromPositions) {
        throw new Error(`dlmm_position_fee_owner_missing:pool=${poolAddress.toBase58()}`);
      }

      if (expectedFeeOwner && !expectedFeeOwner.equals(feeOwnerFromPositions)) {
        throw new Error(
          `dlmm_fee_owner_mismatch:expected=${expectedFeeOwner.toBase58()},actual=${feeOwnerFromPositions.toBase58()},pool=${poolAddress.toBase58()}`,
        );
      }

      // Prefer explicit env expectation; otherwise use the verified on-chain feeOwner.
      const feeOwner: PublicKey = expectedFeeOwner ?? feeOwnerFromPositions;

      const feeOwnerAta = getAssociatedTokenAddressSync(
        quoteMint,
        feeOwner,
        true,
        quoteProgram,
      );
      const ensureAtaTx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          keeper.publicKey,
          feeOwnerAta,
          feeOwner,
          quoteMint,
          quoteProgram,
        ),
      );
      try {
        await sendAndConfirmTransaction(connection, ensureAtaTx, [keeper], {
          commitment: 'confirmed',
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        await alertWarning(WORKFLOW_NAME, `Failed to ensure feeOwner ATA: ${message}`, {
          feeOwner: feeOwner.toBase58(),
          quoteMint: quoteMint.toBase58(),
        });
      }

      const before = await readTokenAmount(connection, feeOwnerAta, quoteProgram);
      const claimTxs = await dlmmPool.claimAllSwapFee({
        owner: positionOwner,
        positions,
      });

      for (const claimTx of claimTxs ?? []) {
        const sig = await sendAndConfirmTransaction(connection, claimTx, [keeper], {
          commitment: 'confirmed',
        });
        result.signatures.push(sig);
      }

      const after = await readTokenAmount(connection, feeOwnerAta, quoteProgram);
      const delta = after > before ? after - before : 0n;
      totalQuoteHarvested += delta;
      result.positionsClaimed += positions.length;
      result.poolsProcessed += 1;

      await alertInfo(WORKFLOW_NAME, 'DLMM fee claim executed', {
        pool: poolAddress.toBase58(),
        positions: positions.length,
        feeOwner: feeOwner.toBase58(),
        quoteMint: quoteMint.toBase58(),
        quoteDelta: delta.toString(),
      });
    }

    result.quoteHarvestedAmount = totalQuoteHarvested.toString();
    result.harvestThresholdMet = totalQuoteHarvested >= minClaimY;
    await alertInfo(WORKFLOW_NAME, 'DLMM fee claim completed', {
      poolsProcessed: result.poolsProcessed,
      positionsClaimed: result.positionsClaimed,
      quoteHarvestedAmount: result.quoteHarvestedAmount,
      harvestThresholdMet: result.harvestThresholdMet,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await alertCritical(WORKFLOW_NAME, 'DLMM fee claim failed', { error: message });
    throw error;
  }

  return result;
}
