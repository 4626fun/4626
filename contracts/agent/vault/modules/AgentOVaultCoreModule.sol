// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {CreatorOVaultCoreModule} from "@4626/creator/vault/modules/CreatorOVaultCoreModule.sol";

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
 *      MINT / INJECTCAPITAL POLICY (documented limitation):
 *      `mint(shares)` promises an exact share amount for a pre-quoted asset amount.
 *      With an inbound transfer tax that promise cannot be kept without either
 *      under-collateralizing the shares or silently overcharging the caller, so
 *      `mint` intentionally inherits the base exact-transfer path and REVERTS with
 *      `TransferAmountMismatch` for fee-on-transfer tokens. The same applies to
 *      `injectCapital` (exact-pull, management-only). `deposit` is the supported
 *      inflow for taxed assets.
 *
 *      OUTFLOW POLICY (documented limitation):
 *      `withdraw`/`redeem` inherit the base vault-side debit. For receiver-side-tax
 *      tokens the RECEIVER may get less than requested (tax outside custody). For
 *      sender-side-tax the transfer fails closed. Standard ERC-4626 boundary for FOT assets.
 */
contract AgentOVaultCoreModule is CreatorOVaultCoreModule {
    using SafeERC20 for IERC20;

    bytes32 internal constant AGENT_MODULE_KIND = keccak256("AgentOVaultModule.core");

    /// @dev Must match the vault's ERC4626 `_decimalsOffset() = 3` virtual-offset math.
    uint256 internal constant VIRTUAL_SHARES_UNITS = 1000;
    uint256 internal constant VIRTUAL_ASSETS_UNITS = 1;

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
        bool isFirstDeposit = supplyBefore == 0;
        uint256 priceBefore = isFirstDeposit ? 0 : pricePerShare();

        _requireStrategyValuationsReady(false);
        if (!isFirstDeposit) {
            _checkTrustedPpsDeviation(priceBefore);
        }

        // Snapshot pre-transfer assets so share pricing is not diluted by the pull.
        uint256 assetsBefore = totalAssets();
        uint256 received = _pullAgentTokenMeasured(msg.sender, assets);

        if (isFirstDeposit && received < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(received, MINIMUM_FIRST_DEPOSIT);
        }

        // Same rounding/offset math as ERC4626 previewDeposit with _decimalsOffset() = 3,
        // applied to the measured amount against the pre-transfer snapshot.
        shares = Math.mulDiv(received, supplyBefore + VIRTUAL_SHARES_UNITS, assetsBefore + VIRTUAL_ASSETS_UNITS);
        if (shares == 0) revert ZeroShares();
        if (!isFirstDeposit && supplyBefore + shares > maxTotalSupply) revert InvalidAmount();

        if (!isFirstDeposit && shares > received * 10_000) {
            revert InflationAttackDetected(received, shares);
        }

        // ODA-480-[3] lane parity: the measured-transfer override must apply the same
        // withdraw-cooldown policy as the base module, including trusted-adapter handling.
        uint256 receiverSharesBefore = _balances[receiver];
        _sharesUpdate(address(0), receiver, shares);
        if (_shouldStampInflowCooldown(receiver, receiverSharesBefore)) {
            lastDepositBlock[receiver] = block.number;
        }

        if (!isFirstDeposit) {
            uint256 priceAfter = pricePerShare();
            _checkPriceChange(priceBefore, priceAfter);
        }

        _increaseReportBaselineForPrincipalInflow(received);

        emit Deposit(msg.sender, receiver, received, shares);

        if (autoAllocate && defaultQueue.length > 0) {
            _autoAllocateToStrategy();
        }
    }

    /**
     * @notice Pull the agent token and credit only what actually arrived.
     * @dev - Reverts on zero measured receipt.
     *      - Rejects `received > amount` so rebasing-up / reflexive tokens cannot
     *        mint uncollateralized credit in the same call.
     *      - Syncs `coinBalance` to the real post-transfer balance.
     */
    function _pullAgentTokenMeasured(address from, uint256 amount) internal returns (uint256 received) {
        IERC20 coin = _vaultAsset(); // inherited; resolves to agentToken in agent lane context
        uint256 beforeBal = coin.balanceOf(address(this));
        coin.safeTransferFrom(from, address(this), amount);
        uint256 afterBal = coin.balanceOf(address(this));

        received = afterBal - beforeBal;
        if (received == 0) revert ZeroAmount();
        if (received > amount) revert TransferAmountMismatch(amount, received);
        coinBalance = afterBal;
    }
}
