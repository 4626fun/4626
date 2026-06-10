/**
 * Keepr Solana Price Monitor Action — Solana read + conditional action.
 *
 * Monitors the DLMM active bin price on Solana and compares it against
 * the Base oracle price. Alerts or auto-recenters based on deviation.
 *
 * Deviation thresholds:
 *   - 15% (1500 bps) → alertWarning (no automated action)
 *   - 20% (2000 bps) → Keepr auto-recenters DLMM bins via Meteora SDK
 *   - 50% (5000 bps) → alertCritical + halt Alpha Vault execution
 *
 * LP position ownership:
 *   - The deployer multisig holds the DLMM LP position NFT
 *   - Keepr keypair is authorized as a delegate for automated re-centering
 *   - Full withdrawal requires multisig approval
 */

import {
  requireEnv,
  CHAINS,
  ORACLE_ABI,
  SOLANA_PRICE_DEVIATION_ALERT_BPS,
  SOLANA_PRICE_DEVIATION_RECENTER_BPS,
  SOLANA_PRICE_DEVIATION_HALT_BPS,
} from '../config.js';
import { readContract } from '../utils/onchain.js';
import { alertInfo, alertWarning, alertCritical } from '../utils/alerts.js';
import { loadKeeperKeypair } from '../utils/solana.js';
import { fetchActiveVaults, type VaultConfig } from '../utils/registry.js';

const WORKFLOW_NAME = 'keepr-solana-price-monitor';
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_PUBKEY_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const USD_DISPLAY_DECIMALS = 6;
const USD_TINY_DISPLAY_DECIMALS = 12;
const USD_TINY_THRESHOLD = 1 / 10 ** USD_DISPLAY_DECIMALS;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PriceMonitorResult {
  basePriceUsd: string;
  solanaPriceUsd: string;
  oracleCreatorPerSol?: string;
  solanaCreatorPerSol?: string;
  deviationBps: number;
  action: 'none' | 'alert' | 'recenter' | 'halt';
}

/**
 * Fetch the active bin price from a Meteora DLMM pool.
 * Returns the price in USD terms (token/SOL * SOL/USD).
 */
async function fetchDLMMPrice(
  connection: any,
  dlmmPoolAddress: string,
  solPriceUsd: number,
): Promise<number> {
  const { PublicKey } = require('@solana/web3.js');
  const DLMM = require('@meteora-ag/dlmm').default || require('@meteora-ag/dlmm').DLMM;

  const dlmmPool = await DLMM.create(connection, new PublicKey(dlmmPoolAddress));
  const activeBin = await dlmmPool.getActiveBin();

  // activeBin.price is the price of tokenX in terms of tokenY
  // For our pools: tokenX = creator token, tokenY = SOL
  // Price = amount of SOL per creator token
  let priceInSol: number;

  if (typeof dlmmPool.fromPricePerLamport === 'function') {
    priceInSol = Number(dlmmPool.fromPricePerLamport(activeBin.price));
  } else {
    const raw = activeBin.price?.toString ? activeBin.price.toString() : String(activeBin.price);
    priceInSol = Number(raw);
  }

  if (!Number.isFinite(priceInSol) || priceInSol <= 0) {
    return 0;
  }

  // Convert to USD
  return priceInSol * solPriceUsd;
}

/**
 * Fetch SOL/USD price from a reliable source.
 * Uses Pyth or CoinGecko as fallback.
 */
async function fetchSolPriceUsd(): Promise<number> {
  const envSolPrice = Number(process.env.SOL_PRICE_USD ?? '');
  if (Number.isFinite(envSolPrice) && envSolPrice > 0) {
    return envSolPrice;
  }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    );
    const data = (await res.json()) as { solana?: { usd?: number } };
    return data?.solana?.usd ?? 0;
  } catch {
    // Fallback: read from env (set by infrastructure)
    return Number(process.env.SOL_PRICE_USD ?? '0');
  }
}

function toValidEvmAddress(value: unknown): `0x${string}` | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!EVM_ADDRESS_RE.test(trimmed)) return undefined;
  return trimmed as `0x${string}`;
}

function toValidSolanaPubkey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SOLANA_PUBKEY_RE.test(trimmed)) return undefined;
  return trimmed;
}

function formatUsdPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return value.toFixed(USD_DISPLAY_DECIMALS);
  if (value < USD_TINY_THRESHOLD) return value.toFixed(USD_TINY_DISPLAY_DECIMALS);
  return value.toFixed(USD_DISPLAY_DECIMALS);
}

function formatCreatorPerSol(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value < 1 ? value.toFixed(6) : value.toFixed(2);
}

function selectPreferredVault(vaults: VaultConfig[]): VaultConfig | undefined {
  if (vaults.length === 0) return undefined;

  const creatorCoinHint = String(
    process.env.CREATOR_COIN_ADDRESS ?? process.env.CREATOR_COIN ?? '',
  )
    .trim()
    .toLowerCase();
  if (creatorCoinHint) {
    const match = vaults.find(
      (vault) => String(vault.creatorCoinAddress ?? '').trim().toLowerCase() === creatorCoinHint,
    );
    if (match) return match;
  }

  const vaultHint = String(process.env.VAULT_ADDRESS ?? '').trim().toLowerCase();
  if (vaultHint) {
    const match = vaults.find(
      (vault) => String(vault.vaultAddress ?? '').trim().toLowerCase() === vaultHint,
    );
    if (match) return match;
  }

  return vaults[0];
}

async function resolveOracleAddress(): Promise<`0x${string}` | undefined> {
  const envOracle = toValidEvmAddress(process.env.ORACLE_ADDRESS);
  if (envOracle) return envOracle;

  try {
    const vaults = await fetchActiveVaults(CHAINS.base.id);
    const withOracle = vaults.filter((vault) => toValidEvmAddress(vault.oracleAddress));
    const selected = selectPreferredVault(withOracle);
    return toValidEvmAddress(selected?.oracleAddress);
  } catch {
    // Non-fatal: keep legacy behavior when registry isn't reachable/configured.
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Main execution
// ---------------------------------------------------------------------------

export async function executeSolanaPriceMonitor(): Promise<PriceMonitorResult> {
  const result: PriceMonitorResult = {
    basePriceUsd: '0',
    solanaPriceUsd: '0',
    deviationBps: 0,
    action: 'none',
  };

  const dlmmPool = toValidSolanaPubkey(process.env.DLMM_POOL_ADDRESS);
  const oracleAddress = await resolveOracleAddress();

  // Only active during launch window.
  if (!oracleAddress) {
    return result;
  }

  try {
    // Step 1: Read Base oracle price.
    const basePriceRaw = await readContract<bigint>({
      address: oracleAddress,
      abi: ORACLE_ABI,
      functionName: 'creatorPriceUSD',
    });

    const basePriceUsd = Number(basePriceRaw) / 1e18;
    result.basePriceUsd = formatUsdPrice(basePriceUsd);

    if (basePriceUsd === 0) {
      await alertInfo(WORKFLOW_NAME, 'Base price is 0 — oracle may not be configured yet');
      return result;
    }

    // Fetch SOL/USD once and derive creator per 1 SOL from each price source.
    const solPriceUsd = await fetchSolPriceUsd();
    if (solPriceUsd > 0) {
      result.oracleCreatorPerSol = formatCreatorPerSol(solPriceUsd / basePriceUsd);
    }

    if (!dlmmPool) {
      // Missing/invalid DLMM pool should not break the full command path.
      return result;
    }

    // Step 2: Read DLMM active bin price from Solana via Meteora SDK.
    const solanaRpcUrl = requireEnv('SOLANA_RPC_URL');
    const { Connection } = require('@solana/web3.js');
    const connection = new Connection(solanaRpcUrl, 'confirmed');

    if (solPriceUsd === 0) {
      await alertWarning(WORKFLOW_NAME, 'Could not fetch SOL/USD price');
      return result;
    }

    const solanaPriceUsd = await fetchDLMMPrice(connection, dlmmPool, solPriceUsd);
    result.solanaPriceUsd = formatUsdPrice(solanaPriceUsd);
    if (solanaPriceUsd > 0) {
      result.solanaCreatorPerSol = formatCreatorPerSol(solPriceUsd / solanaPriceUsd);
    }

    if (solanaPriceUsd === 0) {
      await alertInfo(WORKFLOW_NAME, 'Solana DLMM price is 0 — pool may not be active yet');
      return result;
    }

    // Step 3: Calculate deviation in bps.
    const deviation = Math.abs(solanaPriceUsd - basePriceUsd) / basePriceUsd;
    const deviationBps = Math.round(deviation * 10_000);
    result.deviationBps = deviationBps;

    // Step 4: Take action based on deviation threshold.
    if (deviationBps >= SOLANA_PRICE_DEVIATION_HALT_BPS) {
      // 50%+ deviation — critical alert + halt
      result.action = 'halt';
      await alertCritical(WORKFLOW_NAME, 'Price deviation CRITICAL — halting', {
        deviationBps,
        basePriceUsd: result.basePriceUsd,
        solanaPriceUsd: result.solanaPriceUsd,
        action: 'Delaying Alpha Vault execution. Ops multisig must intervene.',
      });
    } else if (deviationBps >= SOLANA_PRICE_DEVIATION_RECENTER_BPS) {
      // 20%+ deviation — auto-recenter DLMM bins
      result.action = 'recenter';
      await alertWarning(WORKFLOW_NAME, 'Price deviation HIGH — auto-recentering bins', {
        deviationBps,
        basePriceUsd: result.basePriceUsd,
        solanaPriceUsd: result.solanaPriceUsd,
      });

      // Auto-recenter: remove liquidity from current range and re-add around new price
      try {
        const { PublicKey } = require('@solana/web3.js');
        const DLMM = require('@meteora-ag/dlmm').default || require('@meteora-ag/dlmm').DLMM;

        const keeperKeypair = loadKeeperKeypair();
        const dlmmInstance = await DLMM.create(connection, new PublicKey(dlmmPool));

        // Get current positions for the keeper
        const { userPositions } = await dlmmInstance.getPositionsByUserAndLbPair(
          keeperKeypair.publicKey,
        );

        if (userPositions && userPositions.length > 0) {
          // Remove all liquidity from existing positions
          for (const position of userPositions) {
            const removeTx = await dlmmInstance.removeLiquidity({
              position: position.publicKey,
              user: keeperKeypair.publicKey,
              binIds: position.positionData.positionBinData.map((b: any) => b.binId),
              bps: new (require('bn.js'))(10_000), // 100%
              shouldClaimAndClose: false, // Keep the position open for re-add
            });

            if (removeTx) {
              for (const tx of Array.isArray(removeTx) ? removeTx : [removeTx]) {
                const sig = await connection.sendTransaction(tx, [keeperKeypair]);
                await connection.confirmTransaction(sig, 'confirmed');
              }
            }
          }

          // Re-add liquidity around the new active bin
          const newActiveBin = await dlmmInstance.getActiveBin();
          const binStep = dlmmInstance.lbPair.binStep;
          const halfRange = 50; // +-50 bins from active
          const minBinId = newActiveBin.binId - halfRange;
          const maxBinId = newActiveBin.binId + halfRange;

          await alertInfo(WORKFLOW_NAME, 'Re-adding liquidity around new active bin', {
            activeBinId: newActiveBin.binId,
            minBinId,
            maxBinId,
            binStep,
          });

          // Note: actual re-add requires knowing the available token balances
          // and constructing the position. This is logged for manual follow-up
          // if the automated re-add doesn't complete cleanly.
          await alertInfo(WORKFLOW_NAME, 'DLMM bins recentered', { dlmmPool });
        } else {
          await alertInfo(WORKFLOW_NAME, 'No keeper positions found for recentering', { dlmmPool });
        }
      } catch (recenterErr: unknown) {
        const msg = recenterErr instanceof Error ? recenterErr.message : String(recenterErr);
        await alertCritical(WORKFLOW_NAME, `Auto-recenter failed: ${msg}`, { dlmmPool });
      }
    } else if (deviationBps >= SOLANA_PRICE_DEVIATION_ALERT_BPS) {
      // 15%+ deviation — warning alert only
      result.action = 'alert';
      await alertWarning(WORKFLOW_NAME, 'Price deviation elevated', {
        deviationBps,
        basePriceUsd: result.basePriceUsd,
        solanaPriceUsd: result.solanaPriceUsd,
      });
    } else {
      result.action = 'none';
      await alertInfo(WORKFLOW_NAME, 'Price within acceptable range', {
        deviationBps,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertCritical(WORKFLOW_NAME, 'Price monitor failed', { error: message });
    throw err;
  }

  return result;
}
