/**
 * Keepr Solana Fee Settlement Action — Solana read/write + bridge + Base write.
 *
 * Harvests withheld TransferFeeConfig fees from the Token-2022 mint,
 * bridges them to Base, and forwards to the gauge controller.
 *
 * Flow:
 *   1. Read withheld fee amount from Solana Token-2022 mint
 *   2. If above threshold, harvest fees to the mint authority account
 *   3. Bridge fees to Base (Keepr Twin receives them)
 *   4. Call SolanaBridgeAdapter.receiveFeeFromSolana() on Base
 */

import { Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getTransferFeeConfig,
  getMint,
  getAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token';
import {
  requireEnv,
  CHAINS,
  SOLANA_BRIDGE_ADAPTER_ABI,
  parseDotenvJsonObject,
} from '../config.js';
import { getPublicClient, writeContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair, solanaPubkeyToBytes32 } from '../utils/solana.js';
import { collectKeeperBaseWritePreflight, formatKeeperPreflightSummary } from '../utils/solanaKeeperPreflight.js';
// FIX: HGH-02 — Import isAddress for shareOFT validation
import { getAddress, isAddress, zeroAddress, type Address } from 'viem';

const WORKFLOW_NAME = 'keepr-solana-settle-fees';

// Minimum fee amount (in Solana token units) before settlement.
const MIN_FEE_THRESHOLD = BigInt(1_000_000); // 0.001 tokens at 9 decimals

import { settleFeesInstructionDiscriminator } from '../utils/hookInstructionDiscriminators.js';

const SETTLE_FEES_DISCRIMINATOR = settleFeesInstructionDiscriminator();

const REGISTRY_SHARE_VIEW_ABI = [
  {
    type: 'function',
    name: 'getShareOFTForToken',
    stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getTokenForShareOFT',
    stateMutability: 'view',
    inputs: [{ name: '_shareOFT', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
] as const;

export interface FeeSettlementResult {
  feesSettled: boolean;
  /** Solana ATA delta harvested this run (may exceed what was forwarded to Base). */
  solanaHarvestedAmount: string;
  amountSettled: string;
  bridged: boolean;
  forwardedToGauge: boolean;
  /** M2-10 — mints skipped due to mapping / registry integrity failure. */
  mappingIntegrityFailures: number;
}

function getRegistryAddress(): Address | null {
  const raw = String(process.env.REGISTRY_4626 ?? process.env.REGISTRY ?? '').trim();
  if (!raw || !isAddress(raw)) return null;
  return getAddress(raw);
}

/** Reverse mint → creatorCoin from SOLANA_CREATOR_COIN_TO_MINT_MAPPING when present. */
function buildMintToCreatorCoinMap(): Record<string, Address> {
  const out: Record<string, Address> = {};
  try {
    const raw = String(process.env.SOLANA_CREATOR_COIN_TO_MINT_MAPPING ?? '').trim();
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [creatorCoin, mint] of Object.entries(parsed)) {
      if (typeof mint !== 'string' || !isAddress(creatorCoin)) continue;
      out[mint.trim()] = getAddress(creatorCoin as Address);
    }
  } catch {
    // ignore malformed env; integrity check will fall back to shareOFT reverse lookup
  }
  return out;
}

/**
 * M2-10 — assert operator SOLANA_SHARE_OFT_MAPPING agrees with on-chain registry
 * when creatorCoin reverse mapping is available; otherwise require getTokenForShareOFT
 * to be non-zero so fees are not forwarded to an unregistered ShareOFT.
 */
async function assertShareOftMappingIntegrity(params: {
  mint: string;
  shareOFT: Address;
  mintToCreatorCoin: Record<string, Address>;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const registry = getRegistryAddress();
  if (!registry) {
    // Soft: no registry configured — keep prior behavior but surface a warning via caller.
    return { ok: true };
  }

  const client = getPublicClient();
  const creatorCoin = params.mintToCreatorCoin[params.mint];

  try {
    if (creatorCoin) {
      const onchainShare = (await client.readContract({
        address: registry,
        abi: REGISTRY_SHARE_VIEW_ABI,
        functionName: 'getShareOFTForToken',
        args: [creatorCoin],
      })) as Address;
      if (!onchainShare || getAddress(onchainShare) === zeroAddress) {
        return { ok: false, reason: 'registry_share_oft_unset' };
      }
      if (getAddress(onchainShare) !== getAddress(params.shareOFT)) {
        return {
          ok: false,
          reason: `registry_share_oft_mismatch expected=${getAddress(onchainShare)} mapped=${getAddress(params.shareOFT)}`,
        };
      }
      return { ok: true };
    }

    const token = (await client.readContract({
      address: registry,
      abi: REGISTRY_SHARE_VIEW_ABI,
      functionName: 'getTokenForShareOFT',
      args: [params.shareOFT],
    })) as Address;
    if (!token || getAddress(token) === zeroAddress) {
      return { ok: false, reason: 'registry_token_for_share_oft_unset' };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: `registry_read_failed:${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function executeSolanaFeeSettlement(): Promise<FeeSettlementResult> {
  const result: FeeSettlementResult = {
    feesSettled: false,
    solanaHarvestedAmount: '0',
    amountSettled: '0',
    bridged: false,
    forwardedToGauge: false,
    mappingIntegrityFailures: 0,
  };

  const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
  const solanaBridgeAdapter = requireEnv('SOLANA_BRIDGE_ADAPTER') as `0x${string}`;
  const keeperPubkey = requireEnv('SOLANA_KEEPER_PUBKEY');

  try {
    const connection = new Connection(solanaRpcUrl, 'confirmed');
    const keeperKeypair = loadKeeperKeypair();
    const programPubkey = new PublicKey(CHAINS.solana.programId);
    const creatorMints = (process.env.SOLANA_CREATOR_MINTS ?? '').split(',').filter(Boolean);
    // FIX: HGH-02 — Validate each address in shareOFTMapping before use
    const rawShareOFTMapping = parseDotenvJsonObject('SOLANA_SHARE_OFT_MAPPING');
    const shareOFTMapping: Record<string, `0x${string}`> = {};
    for (const [key, value] of Object.entries(rawShareOFTMapping)) {
      if (typeof value === 'string' && isAddress(value)) {
        shareOFTMapping[key] = value as `0x${string}`;
      } else {
        await alertWarning(WORKFLOW_NAME, `Invalid shareOFT address in SOLANA_SHARE_OFT_MAPPING for key ${key} — skipping`);
      }
    }
    const mintToCreatorCoin = buildMintToCreatorCoinMap();

    if (creatorMints.length === 0) {
      await alertInfo(WORKFLOW_NAME, 'No creator mints configured — skipping');
      return result;
    }

    let totalFeesSettled = BigInt(0);
    let totalSolanaHarvested = BigInt(0);
    let totalBaseForwarded = BigInt(0);

    for (const mintStr of creatorMints) {
      const mint = new PublicKey(mintStr);
      const shareOFT = shareOFTMapping[mintStr] as `0x${string}` | undefined;

      if (!shareOFT) {
        await alertWarning(WORKFLOW_NAME, `No ShareOFT mapping for mint ${mintStr} — skipping`);
        continue;
      }

      // M2-10: refuse Base forward path when registry disagrees with operator mapping.
      const integrity = await assertShareOftMappingIntegrity({
        mint: mintStr,
        shareOFT,
        mintToCreatorCoin,
      });
      if (!integrity.ok) {
        result.mappingIntegrityFailures += 1;
        await alertCritical(WORKFLOW_NAME, 'ShareOFT mapping integrity failed — skipping mint', {
          mint: mintStr,
          shareOFT,
          reason: integrity.reason,
        });
        continue;
      }

      const mintAccount = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const feeConfig = getTransferFeeConfig(mintAccount);

      if (!feeConfig) {
        await alertWarning(WORKFLOW_NAME, `No TransferFeeConfig on mint ${mintStr}`);
        continue;
      }

      const accountsWithFees: Array<InstanceType<typeof PublicKey>> = [];

      let allAccounts: ReadonlyArray<{ pubkey: InstanceType<typeof PublicKey> }> = [];
      try {
        allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
          filters: [
            { memcmp: { offset: 0, bytes: mintStr } },
          ],
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        await alertWarning(WORKFLOW_NAME, 'Token-2022 account scan unavailable on RPC', {
          error: msg,
          mint: mintStr,
        });
      }

      if (allAccounts.length === 0 && process.env.SOLANA_FEE_ACCOUNTS) {
        // FIX: MED-08 — Validate SOLANA_FEE_ACCOUNTS as valid Solana public keys before use
        const manualAccounts = process.env.SOLANA_FEE_ACCOUNTS
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);

        const validatedAccounts: Array<{ pubkey: InstanceType<typeof PublicKey> }> = [];
        for (const a of manualAccounts) {
          try {
            const pk = new PublicKey(a);
            if (!PublicKey.isOnCurve(pk.toBytes())) {
              await alertWarning(WORKFLOW_NAME, `SOLANA_FEE_ACCOUNTS entry not on curve: ${a}`);
            }
            validatedAccounts.push({ pubkey: pk });
          } catch {
            await alertWarning(WORKFLOW_NAME, `Invalid pubkey in SOLANA_FEE_ACCOUNTS: ${a} — skipping`);
          }
        }
        allAccounts = validatedAccounts;

        await alertInfo(WORKFLOW_NAME, 'Using manually provided fee accounts', {
          count: allAccounts.length,
          mint: mintStr,
        });
      }

      if (allAccounts.length === 0) {
        await alertWarning(WORKFLOW_NAME, 'No token accounts available for fee harvesting', {
          mint: mintStr,
        });
        continue;
      }

      for (const acct of allAccounts) {
        accountsWithFees.push(acct.pubkey);
      }

      const [creatorConfigPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('creator_config'), mint.toBuffer()],
        programPubkey,
      );

      const keeperAta = getAssociatedTokenAddressSync(
        mint,
        keeperKeypair.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
      );
      const ensureAtaTx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(
          keeperKeypair.publicKey,
          keeperAta,
          keeperKeypair.publicKey,
          mint,
          TOKEN_2022_PROGRAM_ID,
        ),
      );

      try {
        await sendAndConfirmTransaction(connection, ensureAtaTx, [keeperKeypair], {
          commitment: 'confirmed',
        });
      } catch (ataErr: unknown) {
        const msg = ataErr instanceof Error ? ataErr.message : String(ataErr);
        await alertWarning(WORKFLOW_NAME, `Failed to ensure ATA for ${mintStr}: ${msg}`);
      }

      // FIX: CRT-02 — Record ATA balance BEFORE settlement to compute delta
      let balanceBefore = BigInt(0);
      try {
        const beforeAccount = await getAccount(connection, keeperAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
        balanceBefore = BigInt(beforeAccount.amount.toString());
      } catch {
        // ATA may not exist yet; balance is 0
      }

      const batchSize = 20;
      const batches = accountsWithFees.length > 0
        ? Array.from({ length: Math.ceil(accountsWithFees.length / batchSize) }, (_, i) =>
            accountsWithFees.slice(i * batchSize, i * batchSize + batchSize),
          )
        : [[]];

      for (const batch of batches) {
        const settleIx = {
          programId: programPubkey,
          keys: [
            { pubkey: keeperKeypair.publicKey, isSigner: true, isWritable: false },
            { pubkey: creatorConfigPda, isSigner: false, isWritable: false },
            { pubkey: mint, isSigner: false, isWritable: true },
            { pubkey: keeperAta, isSigner: false, isWritable: true },
            { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
            ...batch.map((acct) => ({ pubkey: acct, isSigner: false, isWritable: true })),
          ],
          data: SETTLE_FEES_DISCRIMINATOR,
        };

        try {
          const tx = new Transaction().add(settleIx);
          const sig = await sendAndConfirmTransaction(connection, tx, [keeperKeypair], {
            commitment: 'confirmed',
          });
          await alertInfo(WORKFLOW_NAME, `settle_fees executed for ${mintStr}`, { sig });
        } catch (settleErr: unknown) {
          const msg = settleErr instanceof Error ? settleErr.message : String(settleErr);
          await alertWarning(WORKFLOW_NAME, `settle_fees failed for ${mintStr}: ${msg}`);
        }
      }

      const feeVaultAccount = await getAccount(connection, keeperAta, 'confirmed', TOKEN_2022_PROGRAM_ID);
      const feeVaultBalanceAfter = BigInt(feeVaultAccount.amount.toString());
      // FIX: CRT-02 — Use only the delta from this settlement, not the entire ATA balance
      const feeVaultAmount = feeVaultBalanceAfter - balanceBefore;

      // M2-10: track Solana harvest separately from Base forward.
      if (feeVaultAmount > 0n) {
        totalSolanaHarvested += feeVaultAmount;
        result.solanaHarvestedAmount = totalSolanaHarvested.toString();
      }

      if (feeVaultAmount < MIN_FEE_THRESHOLD) {
        await alertInfo(WORKFLOW_NAME, `Fee amount below threshold for ${mintStr}`, {
          withheld: feeVaultAmount.toString(),
          threshold: MIN_FEE_THRESHOLD.toString(),
          solanaHarvestedAmount: result.solanaHarvestedAmount,
        });
        continue;
      }

      totalFeesSettled += feeVaultAmount;
      result.feesSettled = true;

      const preflight = await collectKeeperBaseWritePreflight();
      for (const warning of preflight.warnings) {
        await alertWarning(WORKFLOW_NAME, warning);
      }
      if (preflight.blockers.length > 0) {
        await alertWarning(WORKFLOW_NAME, 'Skipping Base fee forward — Solana harvest kept separate (M2-10)', {
          blockers: preflight.blockers,
          summary: formatKeeperPreflightSummary(preflight),
          solanaHarvestedAmount: feeVaultAmount.toString(),
          baseForwarded: '0',
          mint: mintStr,
        });
        continue;
      }

      const keeperBytes32 = solanaPubkeyToBytes32(keeperPubkey);

      const txResult = await writeContract({
        address: solanaBridgeAdapter,
        abi: SOLANA_BRIDGE_ADAPTER_ABI,
        functionName: 'receiveFeeFromSolana',
        args: [keeperBytes32, shareOFT, feeVaultAmount],
      });

      if (txResult.success) {
        result.forwardedToGauge = true;
        result.bridged = true;
        totalBaseForwarded += feeVaultAmount;
        result.amountSettled = totalBaseForwarded.toString();
        await alertInfo(WORKFLOW_NAME, 'Fees forwarded to gauge', {
          txHash: txResult.txHash,
          amount: feeVaultAmount.toString(),
          solanaHarvestedAmount: result.solanaHarvestedAmount,
          baseForwardedAmount: result.amountSettled,
          mint: mintStr,
        });
      } else {
        await alertCritical(WORKFLOW_NAME, 'Failed to forward fees to gauge', {
          error: txResult.error,
          solanaHarvestedAmount: feeVaultAmount.toString(),
          baseForwarded: '0',
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Fee settlement failed', { error: message });
    throw err;
  }

  return result;
}
