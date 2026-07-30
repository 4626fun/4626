// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";
import {IAgentTokenV4} from "@4626/agent/interfaces/IAgentTokenV4.sol";
import {OVaultModuleConstants} from "@4626/shared/vault/modules/OVaultModuleConstants.sol";

/**
 * @title AgentOVaultCoreModule
 * @notice Core module for AgentOVault: measured-transfer accounting for
 *         AgentTokenV4 / fee-on-transfer style underlying tokens.
 *
 * @dev ACCOUNTING MODE:
 *      This module overrides the deposit inflow to credit shares from the assets the
 *      vault ACTUALLY received (measured after transfer), so a transfer tax cannot inflate
 *      accounting. It is the measured-FOT counterpart to the exact-transfer core module used by the creator lane.
 *
 *      INFLOW POLICY (deposit):
 *      - Pull `assets`, measure `received = balanceAfter - balanceBefore`.
 *      - `received > assets` (rebasing-up / reflexive credit) is rejected.
 *      - Shares are computed from `received` against the PRE-transfer
 *        (totalSupply, totalAssets) snapshot using the same virtual-offset math as
 *        ERC4626 `previewDeposit` (decimals offset = 3).
 *      - First-deposit minimum, inflation-attack guard, report baseline, and the
 *        Deposit event all use `received`, never the nominal `assets`.
 *
 *      MINT POLICY (documented limitation):
 *      `mint(shares)` promises an exact share amount for a pre-quoted asset amount.
 *      With an inbound transfer tax that promise cannot be kept without either
 *      under-collateralizing the shares or silently overcharging the caller, so
 *      `mint` intentionally inherits the base exact-transfer path and REVERTS with
 *      `TransferAmountMismatch` for fee-on-transfer tokens; the vault's `maxMint`
 *      advertises 0 and `previewMint` reverts (LeftClaw #509 U-05). `deposit` is
 *      the supported inflow for taxed assets. `injectCapital` is supported via a
 *      measured-pull override (LeftClaw #509 U-06).
 *
 *      OUTFLOW POLICY (LeftClaw #509 U-01/U-02):
 *      `withdraw`/`redeem`/`claimQueuedWithdrawal` run measured helpers via virtual
 *      dispatch. Strategy refills gross each request up by the token's quoted tax and
 *      iterate until the vault ACTUALLY holds the target (taxed strategy→vault legs
 *      can never close an exact-request gap). The push tolerates a receiver-side tax,
 *      rejects only a vault-side over-debit (sender-side surcharge fails closed), and
 *      returns the DELIVERED amount — which drives return values, Withdraw events,
 *      impairment-recovery booking, and the wrapper's `minOut` slippage guard.
 */
contract AgentOVaultCoreModule is CreatorOVaultCoreModule {
    using SafeERC20 for IERC20;

    bytes32 internal constant AGENT_MODULE_KIND = keccak256("AgentOVaultModule.core");

    // LeftClaw #509 U-10: VIRTUAL_SHARES_UNITS / VIRTUAL_ASSETS_UNITS / DECIMALS_OFFSET
    // are inherited from CreatorOVaultCoreModule (which derives them from
    // OVaultModuleConstants) — do not redeclare.

    uint256 internal constant MAX_REFILL_ROUNDS = OVaultModuleConstants.MAX_REFILL_ROUNDS;

    function moduleKind() external pure override returns (bytes32) {
        return AGENT_MODULE_KIND;
    }

    /// @notice Deposit with measured-transfer accounting (fee-on-transfer safe).
    /// @dev Mirrors the base deposit guard order; differs only in that shares,
    ///      first-deposit minimum, report baseline, and the Deposit event are
    ///      derived from the measured `received` amount.
    function deposit(uint256 assets, address receiver) external override onlyDelegateCall returns (uint256 shares) {
        _enforceOperatorPermIfGranted(OP_DEPOSIT);
        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
        if (_isCcaAuctionLive()) revert CcaAuctionDepositBlocked();
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        _processProfitUnlock();

        uint256 supplyBefore = _totalSupply;
        // Snapshot pre-transfer assets so share pricing is not diluted by the pull.
        // LeftClaw #509 (re-seed lead): computed before the first-deposit branch at no
        // extra cost so a burn-to-zero re-seed can keep the guards armed (below).
        uint256 assetsBefore = totalAssets();
        // Supply can return to zero while assets remain (burnSharesForPriceIncrease,
        // full-redemption dust). Only a truly empty vault gets the first-deposit guard
        // exemptions; a re-seed onto residual assets keeps the guards armed.
        bool isFirstDeposit = supplyBefore == 0 && assetsBefore == 0;
        uint256 priceBefore = isFirstDeposit ? 0 : pricePerShare();

        _requireStrategyValuationsReady(false);
        if (!isFirstDeposit) {
            _checkTrustedPpsDeviation(priceBefore);
        }

        uint256 received = _pullAgentTokenMeasured(msg.sender, assets);

        if (isFirstDeposit && received < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(received, MINIMUM_FIRST_DEPOSIT);
        }

        // Same rounding/offset math as ERC4626 previewDeposit with _decimalsOffset() = 3,
        // applied to the measured amount against the pre-transfer snapshot.
        shares = Math.mulDiv(received, supplyBefore + VIRTUAL_SHARES_UNITS, assetsBefore + VIRTUAL_ASSETS_UNITS);
        if (shares == 0) revert ZeroShares();
        if (!isFirstDeposit && supplyBefore + shares > maxTotalSupply) revert InvalidAmount();
        // Yearn-parity depositLimit (storage v7): measured receipt must fit remaining capacity.
        // The creator-lane base deposit enforces this; this override must not skip it.
        if (received > _remainingDepositAssets()) revert InvalidAmount();

        if (!isFirstDeposit && shares > received * 10_000) {
            revert InflationAttackDetected(received, shares);
        }

        // ODA-480-[3] lane parity: the measured-transfer override must apply the same
        // withdraw-cooldown policy as the base module, including trusted-adapter handling.
        uint256 receiverSharesBefore = _balances[receiver];
        _sharesUpdate(address(0), receiver, shares);
        if (_shouldStampInflowCooldown(receiver, receiverSharesBefore, shares)) {
            lastDepositBlock[receiver] = block.number;
        }

        if (autoAllocate && defaultQueue.length > 0) {
            _autoAllocateToStrategy();
        }

        // LeftClaw #509 U-08: evaluate the circuit breaker AFTER the allocation hop.
        // In this lane the vault→strategy hop is a taxed transfer — the only step in
        // `deposit` that can move price per share — so a guard evaluated before it is
        // structurally blind to the one loss it exists to catch.
        if (!isFirstDeposit) {
            _checkPriceChange(priceBefore, pricePerShare());
        }

        _increaseReportBaselineForPrincipalInflow(received);

        emit Deposit(msg.sender, receiver, received, shares);
    }

    /**
     * @notice Pull the agent token and credit only what actually arrived.
     * @dev - Reverts on zero measured receipt.
     *      - Rejects `received > amount` so rebasing-up / reflexive tokens cannot
     *        mint uncollateralized credit in the same call.
     *      - Moves the tracked ledger by `received` only (LeftClaw #509 U-07): an
     *        untracked surplus must not enter NAV as a side effect of this pull;
     *        recognition stays explicit via `syncBalances()`.
     */
    function _pullAgentTokenMeasured(address from, uint256 amount) internal returns (uint256 received) {
        IERC20 coin = _vaultAsset(); // inherited; resolves to agentToken in agent lane context
        uint256 beforeBal = coin.balanceOf(address(this));
        coin.safeTransferFrom(from, address(this), amount);
        uint256 afterBal = coin.balanceOf(address(this));

        received = afterBal - beforeBal;
        if (received == 0) revert ZeroAmount();
        if (received > amount) revert TransferAmountMismatch(amount, received);
        coinBalance += received;
    }

    /**
     * @notice Measured capital injection for the taxed lane (LeftClaw #509 U-06).
     * @dev The base exact pull reverts under any inbound tax, removing management's
     *      only recapitalization lever on the lane that needs it most. Books the
     *      measured receipt everywhere (baseline + event) and keeps the per-call
     *      +10% price-move cap. Caller is still gated by the vault (`onlyManagement`).
     */
    function injectCapital(uint256 amount) external override onlyDelegateCall {
        _enforceOperatorPermIfGranted(OP_DEPOSIT);
        if (amount == 0) revert ZeroAmount();

        uint256 priceBefore = pricePerShare();
        uint256 received = _pullAgentTokenMeasured(msg.sender, amount);
        uint256 priceAfter = pricePerShare();
        _checkPriceChange(priceBefore, priceAfter);
        _increaseReportBaselineForPrincipalInflow(received);

        emit CapitalInjected(msg.sender, received, priceAfter);
    }

    /**
     * @notice Measured strategy refill for the taxed lane (LeftClaw #509 U-01).
     * @dev The base `_ensureCoin` requests exactly the deficit, but every strategy→vault
     *      leg is a transfer whose recipient is the vault — taxed by the same token this
     *      module exists for — so delivery is strictly below the request and the strict
     *      balance check bricked every withdrawal needing strategy liquidity. Requesting
     *      the exact remainder again cannot close the gap either (floor rounding keeps a
     *      residual), so each round grosses the request up by the token's quoted tax and
     *      re-measures what the vault ACTUALLY holds. Overshoot stays idle in the vault.
     */
    function _ensureCoin(uint256 coinNeeded) internal override {
        uint256 available = _syncCoinBalance();
        if (available >= coinNeeded) return;

        uint256 taxBps = _quotedMaxTaxBps();
        for (uint256 i = 0; i < MAX_REFILL_ROUNDS && available < coinNeeded; i++) {
            uint256 deficit = coinNeeded - available;
            uint256 request = deficit;
            if (taxBps > 0) {
                // ceil(deficit / (1 - t)) so post-tax arrival covers the full deficit.
                request = (deficit * MAX_BPS + (MAX_BPS - taxBps - 1)) / (MAX_BPS - taxBps);
            }
            uint256 before = available;
            // lossBasis = full user coinNeeded (Yearn maxLoss is vs requested assets).
            _withdrawFromStrategies(request, coinNeeded);
            available = _syncCoinBalance();
            if (available == before) break; // no progress — stop rather than spin
        }
        if (available < coinNeeded) revert InsufficientBalance();
    }

    /**
     * @notice Measured push for the taxed lane (LeftClaw #509 U-02).
     * @dev Tolerates a receiver-side tax (vault debited exactly `amount`, receiver may
     *      get less), rejects only a vault-side over-debit (sender-side surcharge fails
     *      closed), and returns what the RECEIVER actually got so wrapper `minOut`
     *      checks, Withdraw events and recovery booking observe delivered truth.
     */
    function _pushCreatorCoinExact(address to, uint256 amount) internal override returns (uint256 delivered) {
        IERC20 coin = _vaultAsset();
        if (to == address(this)) revert TransferAmountMismatch(amount, 0);
        uint256 toBefore = coin.balanceOf(to);
        uint256 selfBefore = coin.balanceOf(address(this));
        coin.safeTransfer(to, amount);
        uint256 selfAfter = coin.balanceOf(address(this));

        uint256 spent = selfBefore - selfAfter;
        if (spent > amount) revert TransferAmountMismatch(amount, spent);
        delivered = coin.balanceOf(to) - toBefore;
        // U-07 delta write (same ledger discipline as the pull side).
        coinBalance -= spent;
    }

    /// @dev Worst-case quoted transfer tax (bps), read from the token. Plain transfers
    ///      (no LP on either side) are taxed at max(buy, sell) on AgentTokenV4-style
    ///      tokens. Falls back to 0 (exact requests) when the token exposes no quote.
    function _quotedMaxTaxBps() internal view returns (uint256 taxBps) {
        address token = address(_vaultAsset());
        uint256 buyBps;
        try IAgentTokenV4(token).buyTaxBps() returns (uint16 bps) {
            buyBps = bps;
        } catch {
            return 0;
        }
        try IAgentTokenV4(token).sellTaxBps() returns (uint16 bps) {
            taxBps = bps > buyBps ? bps : buyBps;
        } catch {
            taxBps = buyBps;
        }
        if (taxBps >= MAX_BPS) return 0; // degenerate quote — fall back to exact requests
    }
}
